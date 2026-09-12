"""Weather, diagnostics, alerts and the read-only summaries."""
import pytest
import requests

import config
from conftest import sign_in
from services import diagnostics, ingest

SAMPLE = {"latitude": 23.0, "longitude": 72.0, "observed_at": "2026-09-12T12:00", "timezone": "Asia/Kolkata",
          "temperature_c": 37.0, "cloud_cover_pct": 11, "wind_speed_ms": 2.12,
          "irradiance_kw_m2": 0.737, "weather_code": 0}


@pytest.mark.parametrize("query", ["", "?latitude=23", "?latitude=abc&longitude=72",
                                   "?latitude=999&longitude=72", "?latitude=23&longitude=999"])
def test_weather_needs_real_coordinates(client, query):
    sign_in(client)
    assert client.get(f"/api/weather/current{query}").status_code == 400


def test_weather_passes_the_service_through(client, monkeypatch):
    sign_in(client)
    monkeypatch.setattr(ingest, "fetch_current_weather", lambda lat, lon: SAMPLE)
    assert client.get("/api/weather/current?latitude=23&longitude=72").get_json() == SAMPLE


def test_weather_explains_an_intercepted_connection(client, monkeypatch):
    sign_in(client)
    def explode(*_a, **_k):
        raise requests.exceptions.SSLError("self-signed certificate in certificate chain")
    monkeypatch.setattr(ingest, "fetch_current_weather", explode)
    response = client.get("/api/weather/current?latitude=23&longitude=72")
    assert response.status_code == 502
    assert "inspecting HTTPS" in response.get_json()["error"]


def test_weather_handles_the_service_being_down(client, monkeypatch):
    sign_in(client)
    def explode(*_a, **_k):
        raise requests.ConnectionError("no route to host")
    monkeypatch.setattr(ingest, "fetch_current_weather", explode)
    assert client.get("/api/weather/current?latitude=23&longitude=72").status_code == 502


def test_diagnostics_rules(client, db, monkeypatch):
    sign_in(client)
    assert client.post("/api/diagnostics/run", json={}).status_code == 400
    assert client.post("/api/diagnostics/run", json={"plant_id": 9999}).status_code == 404
    monkeypatch.setattr(diagnostics, "run", lambda *_a, **_k: {"plant_id": 1, "assets_checked": 10, "alerts": 1})
    assert client.post("/api/diagnostics/run", json={"plant_id": db["plants"]["solar"]}).status_code == 200


def test_viewers_cannot_run_the_health_check(client, db):
    sign_in(client, "grid_operator")
    assert client.post("/api/diagnostics/run", json={"plant_id": db["plants"]["solar"]}).status_code == 403


def test_alerts_are_scoped_and_owner_writable(client, db):
    sign_in(client, "utility")
    alerts = client.get("/api/alerts?status=open").get_json()
    assert len(alerts) == 1
    alert_id = alerts[0]["id"]
    assert client.patch(f"/api/alerts/{alert_id}", json={"status": "nonsense"}).status_code == 400
    assert client.patch(f"/api/alerts/{alert_id}", json={"status": "ack"}).get_json()["status"] == "ack"
    assert client.patch("/api/alerts/9999", json={"status": "ack"}).status_code == 404


def test_viewers_cannot_change_alerts(client, db):
    sign_in(client, "utility")
    alert_id = client.get("/api/alerts").get_json()[0]["id"]
    client.post("/api/auth/logout")
    sign_in(client, "trader")
    assert client.patch(f"/api/alerts/{alert_id}", json={"status": "ack"}).status_code == 403


def test_summary_counts_only_what_you_can_see(client):
    sign_in(client, "utility")
    mine = client.get("/api/dashboard/summary").get_json()
    assert mine["plants"] == 2                      # the solar and wind plants, not the rooftop
    assert set(mine) == {"plants", "flagged_windows", "total_exposure_inr", "open_alerts", "revenue_at_risk_inr"}

    client.post("/api/auth/logout")
    sign_in(client, "grid_operator")
    assert client.get("/api/dashboard/summary").get_json()["plants"] == 3


def test_settings_expose_the_regulation(client):
    sign_in(client)
    settings = client.get("/api/settings").get_json()
    assert settings["tolerance_band_pct"] == {"solar": 5.0, "wind": 10.0}
    assert settings["deviation_slabs"][0]["rate_per_kwh"] == 0.0
    assert settings["over_injection_freq_hz"] == 50.05
    assert settings["block_minutes"] == 15


def test_model_card_needs_training(client, monkeypatch, tmp_path):
    sign_in(client)
    monkeypatch.setattr(config, "MODEL_CARD_PATH", tmp_path / "missing.json")
    assert client.get("/api/model").status_code == 503
