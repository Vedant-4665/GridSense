"""The costing arithmetic, and the rules around running a forecast."""
from datetime import datetime, timedelta

import pytest
import requests

import config
from conftest import sign_in
from models import Forecast, get_session
from services import pipeline


def test_the_worked_example_from_the_ideation(client):
    """50 MW plant, 10 MWh scheduled, 8.6 MWh forecast: 900 units at Rs 0.25 = Rs 225."""
    sign_in(client)
    result = client.post("/api/costing/preview",
                         json={"scheduled_kwh": 10000, "forecast_kwh": 8600, "plant_type": "solar"}).get_json()
    assert result["breached"] is True
    assert result["deviation_pct"] == 14.0
    assert result["band_pct"] == 5.0
    assert result["direction"] == "under"
    assert result["chargeable_units"] == 900.0
    assert result["rate_per_unit"] == 0.25
    assert result["exposure_inr"] == 225.0
    assert result["action_type"] == "dispatch_storage"


def test_inside_the_band_costs_nothing(client):
    sign_in(client)
    result = client.post("/api/costing/preview", json={"scheduled_kwh": 10000, "forecast_kwh": 9700}).get_json()
    assert result["breached"] is False
    assert result["exposure_inr"] == 0.0


def test_over_generation_flags_unpaid_surplus(client):
    sign_in(client)
    result = client.post("/api/costing/preview", json={"scheduled_kwh": 10000, "forecast_kwh": 12800}).get_json()
    assert result["direction"] == "over"
    assert result["over_injection_risk"] is True
    assert result["action_type"] == "curtail"


def test_a_wider_band_forgives_the_same_gap(client):
    sign_in(client)
    tight = client.post("/api/costing/preview", json={"scheduled_kwh": 10000, "forecast_kwh": 9300}).get_json()
    loose = client.post("/api/costing/preview",
                        json={"scheduled_kwh": 10000, "forecast_kwh": 9300, "band_pct": 10}).get_json()
    assert tight["breached"] is True and loose["breached"] is False


def test_wind_gets_its_own_band(client):
    sign_in(client)
    result = client.post("/api/costing/preview",
                         json={"scheduled_kwh": 10000, "forecast_kwh": 9300, "plant_type": "wind"}).get_json()
    assert result["band_pct"] == 10.0


def test_forecast_run_refusals(client, db):
    sign_in(client)
    assert client.post("/api/forecast/run", json={}).status_code == 400
    assert client.post("/api/forecast/run", json={"plant_id": 9999}).status_code == 404
    assert client.post("/api/forecast/run", json={"plant_id": db["plants"]["other"]}).status_code == 404
    wind = client.post("/api/forecast/run", json={"plant_id": db["plants"]["wind"]})
    assert wind.status_code == 422
    assert "solar-only" in wind.get_json()["error"]


def test_viewers_cannot_run_forecasts(client, db):
    sign_in(client, "trader")
    assert client.post("/api/forecast/run", json={"plant_id": db["plants"]["solar"]}).status_code == 403


def test_an_untrained_model_says_so(client, db, monkeypatch, tmp_path):
    sign_in(client)
    monkeypatch.setattr(config, "MODEL_PATH", tmp_path / "missing.pkl")
    response = client.post("/api/forecast/run", json={"plant_id": db["plants"]["solar"]})
    assert response.status_code == 503
    assert "seed.py" in response.get_json()["error"]


def test_a_network_that_inspects_https_is_explained(client, db, monkeypatch):
    sign_in(client)
    def explode(*_args, **_kwargs):
        raise requests.exceptions.SSLError("self-signed certificate in certificate chain")
    monkeypatch.setattr(pipeline, "run_forecast", explode)
    response = client.post("/api/forecast/run", json={"plant_id": db["plants"]["solar"]})
    assert response.status_code == 502
    assert "inspecting HTTPS" in response.get_json()["error"]


def test_a_successful_run_returns_its_summary(client, db, monkeypatch):
    sign_in(client)
    summary = {"plant_id": db["plants"]["solar"], "blocks_written": 288, "breached_blocks": 12,
               "unscheduled_blocks": 0, "total_exposure_inr": 1234.5, "window_start": "2026-09-12T10:00:00"}
    monkeypatch.setattr(pipeline, "run_forecast", lambda *_a, **_k: summary)
    assert client.post("/api/forecast/run", json={"plant_id": db["plants"]["solar"]}).get_json() == summary


def test_horizon_must_be_one_we_support(client, db):
    sign_in(client)
    assert client.get(f"/api/plants/{db['plants']['solar']}/forecast?horizon=13").status_code == 400
    assert client.get(f"/api/plants/{db['plants']['solar']}/forecast?horizon=72").status_code == 200


def test_declaring_a_schedule_copies_the_forecast(client, db):
    plant_id = db["plants"]["solar"]
    later = datetime.now() + timedelta(hours=1)
    with get_session() as s:
        for offset in (0, 15):
            s.add(Forecast(plant_id=plant_id, target_timestamp=later + timedelta(minutes=offset),
                           predicted_kw=1000.0, horizon_hours=1))
        s.commit()

    sign_in(client)
    result = client.post(f"/api/plants/{plant_id}/schedule").get_json()
    assert result["blocks_declared"] == 2

    blocks = client.get(f"/api/plants/{plant_id}/forecast?horizon=24").get_json()["blocks"]
    assert all(b["scheduled_kw"] == b["predicted_kw"] for b in blocks)


def test_only_the_owner_declares_a_schedule(client, db):
    sign_in(client, "grid_operator")
    assert client.post(f"/api/plants/{db['plants']['solar']}/schedule").status_code == 403
