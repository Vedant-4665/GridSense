import pytest

from conftest import sign_in

VALID = {"name": "Kutch Solar 2", "location": "Gujarat, India",
         "latitude": 23.73, "longitude": 69.86, "capacity_kw": 25000}


@pytest.mark.parametrize("payload, expected", [
    ({**VALID, "name": "   "}, "name is required"),
    ({**VALID, "name": "N" * 130}, "120 characters"),
    ({**VALID, "latitude": "NaN"}, "must be numbers"),
    ({**VALID, "latitude": float("inf")}, "must be numbers"),
    ({**VALID, "latitude": 91}, "out of range"),
    ({**VALID, "latitude": -91}, "out of range"),
    ({**VALID, "longitude": 181}, "out of range"),
    ({**VALID, "longitude": -181}, "out of range"),
    ({**VALID, "capacity_kw": 0}, "between 0 and 10,000,000"),
    ({**VALID, "capacity_kw": -5}, "between 0 and 10,000,000"),
    ({**VALID, "capacity_kw": 1e12}, "between 0 and 10,000,000"),
    ({**VALID, "capacity_kw": "abc"}, "must be numbers"),
    ({**VALID, "plant_type": "hydro"}, "solar or wind"),
    ({**VALID, "owner_type": "floating"}, "utility or distributed"),
    ({**VALID, "tariff_rate": 0}, "tariff_rate"),
])
def test_creation_is_refused(client, payload, expected):
    sign_in(client)
    response = client.post("/api/plants", json=payload)
    assert response.status_code == 400
    assert expected in response.get_json()["error"]


def test_body_must_be_an_object(client):
    sign_in(client)
    assert client.post("/api/plants", json="a string").status_code == 400


@pytest.mark.parametrize("plant_type", ["solar", "wind"])
@pytest.mark.parametrize("owner_type", ["utility", "distributed"])
def test_every_combination_is_accepted(client, plant_type, owner_type):
    sign_in(client)
    response = client.post("/api/plants", json={**VALID, "plant_type": plant_type, "owner_type": owner_type})
    assert response.status_code == 201
    body = response.get_json()
    assert (body["plant_type"], body["owner_type"]) == (plant_type, owner_type)
    assert body["capacity_kw"] == 25000        # kW in, kW out: no silent conversion


def test_boundary_coordinates_are_allowed(client):
    sign_in(client)
    for latitude, longitude in ((90, 180), (-90, -180), (0, 0)):
        response = client.post("/api/plants", json={**VALID, "latitude": latitude, "longitude": longitude})
        assert response.status_code == 201


def test_unicode_and_markup_survive_unchanged(client):
    sign_in(client)
    name = "सौर संयंत्र <script>alert(1)</script>"
    body = client.post("/api/plants", json={**VALID, "name": name}).get_json()
    assert body["name"] == name


def test_control_characters_are_stripped(client):
    sign_in(client)
    messy = "Kutch" + chr(0) + " Solar" + chr(7)
    body = client.post("/api/plants", json={**VALID, "name": messy}).get_json()
    assert body["name"] == "Kutch Solar"


def test_coordinates_keep_six_decimals(client):
    sign_in(client)
    body = client.post("/api/plants", json={**VALID, "latitude": 23.7312345678}).get_json()
    assert body["latitude"] == 23.731235


def test_a_repeated_key_returns_the_same_plant(client):
    sign_in(client)
    first = client.post("/api/plants", json=VALID, headers={"Idempotency-Key": "abc"})
    second = client.post("/api/plants", json=VALID, headers={"Idempotency-Key": "abc"})
    assert (first.status_code, second.status_code) == (201, 200)
    assert first.get_json()["id"] == second.get_json()["id"]
    assert len([p for p in client.get("/api/plants").get_json() if p["name"] == VALID["name"]]) == 1


def test_without_a_key_two_calls_make_two_plants(client):
    sign_in(client)
    client.post("/api/plants", json=VALID)
    client.post("/api/plants", json=VALID)
    assert len([p for p in client.get("/api/plants").get_json() if p["name"] == VALID["name"]]) == 2


def test_owners_only_see_their_own(client, db):
    sign_in(client, "utility")
    visible = {p["id"] for p in client.get("/api/plants").get_json()}
    assert db["plants"]["solar"] in visible
    assert db["plants"]["other"] not in visible
    assert client.get(f"/api/plants/{db['plants']['other']}").status_code == 404


def test_operators_see_everything_read_only(client, db):
    sign_in(client, "grid_operator")
    assert len(client.get("/api/plants").get_json()) == 3
    assert client.post("/api/plants", json=VALID).status_code == 403
    assert client.patch(f"/api/plants/{db['plants']['solar']}", json={"tariff_rate": 4}).status_code == 403


def test_settings_change_and_reprice(client, db):
    sign_in(client)
    plant_id = db["plants"]["solar"]
    updated = client.patch(f"/api/plants/{plant_id}", json={"tariff_rate": 4.5, "band_pct": 2}).get_json()
    assert (updated["tariff_rate"], updated["band_pct"], updated["band_is_custom"]) == (4.5, 2.0, True)

    back = client.patch(f"/api/plants/{plant_id}", json={"band_pct": None}).get_json()
    assert (back["band_pct"], back["band_is_custom"]) == (5.0, False)   # regulator default for solar

    assert client.patch(f"/api/plants/{plant_id}", json={"band_pct": "abc"}).status_code == 400
    assert client.patch(f"/api/plants/{plant_id}", json={"tariff_rate": float("nan")}).status_code == 400


def test_generation_is_summed_across_inverters(client, db):
    from datetime import datetime
    from models import Asset, GenerationReading, get_session

    with get_session() as s:
        second = Asset(plant_id=db["plants"]["solar"], source_key="INV-02", capacity_kw=5000)
        s.add(second)
        s.flush()
        s.add(GenerationReading(plant_id=db["plants"]["solar"], asset_id=second.id,
                                timestamp=datetime(2026, 9, 1, 10, 0), ac_power=50.0, dc_power=51.0))
        s.commit()

    sign_in(client)
    rows = client.get(f"/api/plants/{db['plants']['solar']}/generation").get_json()
    assert len(rows) == 1                 # one block, not one row per inverter
    assert rows[0]["ac_power"] == 150.0   # 100 + 50
