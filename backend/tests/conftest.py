"""
Test fixtures. Everything runs against a throwaway SQLite file and never
touches the network: the weather service and the forecast pipeline are stubbed
where a test isn't about them.
"""
import os
import pathlib
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# Set before importing the app: config reads these at import time.
TMP = pathlib.Path(tempfile.mkdtemp(prefix="gridsense-tests-"))
os.environ["DATABASE_URL"] = f"sqlite:///{TMP / 'test.sqlite3'}"
os.environ["SECRET_KEY"] = "test-secret-key"
os.environ["DEMO_LOGIN"] = "1"

import pytest                                            # noqa: E402
from werkzeug.security import generate_password_hash     # noqa: E402

import config                                            # noqa: E402
from app import create_app                               # noqa: E402
from models import (                                     # noqa: E402
    ROLES, Asset, Base, DeviationAlert, GenerationReading, Plant, User,
    engine, get_session, new_session_token,
)

PASSWORD = "correct-horse-battery"


@pytest.fixture(scope="session")
def app():
    application = create_app()
    application.config.update(TESTING=True)
    return application


@pytest.fixture
def db(app):
    """A clean database with one demo account per role and two plants."""
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with get_session() as s:
        users = {
            role: User(email=config.DEMO_EMAIL.format(role=role), name=f"{label} (demo)",
                       role=role, password_hash=generate_password_hash(PASSWORD),
                       session_token=new_session_token())
            for role, label in ROLES.items()
        }
        s.add_all(users.values())
        s.flush()

        solar = Plant(name="Test Solar", owner_id=users["utility"].id, latitude=23.0, longitude=72.0,
                      capacity_kw=50000, plant_type="solar", owner_type="utility", tariff_rate=3.0)
        wind = Plant(name="Test Wind", owner_id=users["utility"].id, latitude=23.5, longitude=69.5,
                     capacity_kw=18000, plant_type="wind", owner_type="utility")
        other = Plant(name="Someone Else's", owner_id=users["plant_owner"].id, latitude=9.0, longitude=78.0,
                      capacity_kw=3, plant_type="solar", owner_type="distributed")
        s.add_all([solar, wind, other])
        s.flush()

        inverter = Asset(plant_id=solar.id, source_key="INV-01", asset_name="Inverter 1",
                         capacity_kw=5000, status="alert")
        s.add(inverter)
        s.flush()
        s.add(DeviationAlert(asset_id=inverter.id, deviation_pct=11.0, suspected_cause="soiling",
                             severity="medium", est_loss_kwh=1000, est_revenue_loss=3000, status="open"))
        s.add(GenerationReading(plant_id=solar.id, asset_id=inverter.id,
                                timestamp=__import__("datetime").datetime(2026, 9, 1, 10, 0),
                                ac_power=100.0, dc_power=102.0))
        s.commit()
        return {"plants": {"solar": solar.id, "wind": wind.id, "other": other.id},
                "users": {role: user.id for role, user in users.items()}}


@pytest.fixture
def client(app, db):
    return app.test_client()


def sign_in(client, role="utility"):
    """Log the test client in as a seeded demo account."""
    response = client.post("/api/auth/demo", json={"role": role})
    assert response.status_code == 200, response.get_json()
    return response.get_json()
