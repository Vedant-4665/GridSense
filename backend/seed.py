"""
Rebuild the database from scratch. One command, always.

    python seed.py              # seeded demo plant + trained model + deviation scan
    python seed.py --csv        # real plant exports from ../data/raw/ instead
    python seed.py --csv --true-dates   # keep the dataset's own dates
    python seed.py --no-train   # skip training (asset health stays empty)

When the database gets into a bad state at 3am, run this rather than debugging it.
"""
import argparse
import math
import random
import secrets
from datetime import datetime, timedelta

from werkzeug.security import generate_password_hash

import config
from models import (
    ROLES, Asset, Forecast, GenerationReading, Plant, Recommendation, User,
    WeatherReading, Base, engine, get_session, init_db, new_session_token,
)
from services import diagnostics, forecaster, ingest, pipeline, realdata

random.seed(42)

INVERTERS = 10
# One inverter has been losing output to soiling for the last few days. Nothing
# here writes an alert: the diagnostic has to find this on its own.
SOILED_INVERTER = 3
SOILING_DAYS = 4
SOILING_LOSS = 0.12


def reset():
    Base.metadata.drop_all(engine)
    init_db()
    print("Schema rebuilt.")


def solar_curve(hour: float, capacity_kw: float) -> float:
    """Simple clear-sky bell between 06:00 and 18:00."""
    # Exactly zero at the edges: sin(pi) is 1e-16, not 0, and a near-zero
    # schedule gets costed as a 100% deviation.
    if hour <= 6 or hour >= 18:
        return 0.0
    return capacity_kw * math.sin(math.pi * (hour - 6) / 12) ** 1.4


def seed_demo_users(s) -> dict:
    """
    One account per role, for POST /api/auth/demo. Their passwords are random
    and never shown, so the demo login is the only way in.
    """
    users = {
        role: User(email=config.DEMO_EMAIL.format(role=role), name=f"{label} (demo)",
                   organisation="GridSense demo", role=role,
                   password_hash=generate_password_hash(secrets.token_urlsafe(32)),
                   session_token=new_session_token())
        for role, label in ROLES.items()
    }
    s.add_all(users.values())
    s.flush()
    return users


def seed_users() -> dict:
    with get_session() as s:
        demo = seed_demo_users(s)
        s.commit()
        return {role: user.id for role, user in demo.items()}


def seed_demo(owners: dict):
    with get_session() as s:
        utility = Plant(
            name="Ahmedabad Solar Park", location="Gujarat, India",
            latitude=23.0225, longitude=72.5714, capacity_kw=50000,
            plant_type="solar", owner_type="utility", owner_id=owners["utility"],
            tariff_rate=3.0,          # typical utility-scale PPA rate, Rs/kWh
        )
        rooftop = Plant(
            name="Rooftop 3kW (demo)", location="Ahmedabad, India",
            latitude=23.0225, longitude=72.5714, capacity_kw=3,
            plant_type="solar", owner_type="distributed",
            tariff_rate=config.DEFAULT_RETAIL_TARIFF, owner_id=owners["plant_owner"],
        )
        s.add_all([utility, rooftop])
        s.flush()

        assets = [
            Asset(plant_id=utility.id, source_key=f"INV-{i:02d}",
                  asset_name=f"Inverter {i}", capacity_kw=utility.capacity_kw / INVERTERS,
                  status="healthy")
            for i in range(1, INVERTERS + 1)
        ]
        rooftop_inverter = Asset(plant_id=rooftop.id, source_key="ROOF-01",
                                 asset_name="Rooftop inverter", capacity_kw=rooftop.capacity_kw,
                                 status="healthy")
        s.add_all([*assets, rooftop_inverter])
        s.flush()

        now = datetime.now().replace(minute=0, second=0, microsecond=0)
        start = now - timedelta(days=7)
        soiling_from = now - timedelta(days=SOILING_DAYS)

        # --- history: 7 days of 15-minute readings, per inverter -------------
        t = start
        while t < now:
            hour = t.hour + t.minute / 60
            clear = solar_curve(hour, utility.capacity_kw)
            weather_factor = 1.0 if t.day % 3 else 0.72     # cloudy every third day
            plant_output = clear * weather_factor * random.uniform(0.95, 1.03)
            per_inverter = plant_output / INVERTERS

            for asset in assets:
                output = per_inverter
                if asset.asset_name.endswith(f" {SOILED_INVERTER}") and t >= soiling_from:
                    output *= 1 - SOILING_LOSS
                s.add(GenerationReading(plant_id=utility.id, asset_id=asset.id, timestamp=t,
                                        ac_power=output, dc_power=output * 1.02))

            # The rooftop sits in the same city: same weather, one inverter,
            # a thousandth of the output and no soiling.
            roof_output = plant_output / utility.capacity_kw * rooftop.capacity_kw
            s.add(GenerationReading(plant_id=rooftop.id, asset_id=rooftop_inverter.id,
                                    timestamp=t, ac_power=roof_output, dc_power=roof_output * 1.02))

            weather = dict(
                timestamp=t,
                ambient_temp=26 + 8 * math.sin(math.pi * hour / 24),
                module_temp=30 + 14 * math.sin(math.pi * hour / 24),
                # Measured irradiance, so clouds are already in it: the same
                # thing the weather API returns for a forecast.
                irradiation=clear * weather_factor / utility.capacity_kw,
                cloud_cover=(1 - weather_factor) * 100, wind_speed=3.4,
                source="sensor",
            )
            s.add(WeatherReading(plant_id=utility.id, **weather))
            s.add(WeatherReading(plant_id=rooftop.id, **weather))
            t += timedelta(minutes=config.BLOCK_MINUTES)

        # --- forward forecast: 72 hours --------------------------------------
        t = now
        while t < now + timedelta(hours=72):
            hour = t.hour + t.minute / 60
            clear = solar_curve(hour, utility.capacity_kw)
            predicted = clear * random.uniform(0.90, 1.0)
            scheduled = clear * 0.97

            # The rooftop is not scheduled with the grid: no schedule, no
            # deviation charges, just an expectation of output.
            roof_predicted = predicted / utility.capacity_kw * rooftop.capacity_kw
            s.add(Forecast(
                plant_id=rooftop.id, target_timestamp=t,
                horizon_hours=int((t - now).total_seconds() // 3600),
                predicted_kw=roof_predicted,
                confidence_low=roof_predicted * (1 - config.CONFIDENCE_BAND),
                confidence_high=roof_predicted * (1 + config.CONFIDENCE_BAND),
            ))

            s.add(Forecast(
                plant_id=utility.id, target_timestamp=t,
                horizon_hours=int((t - now).total_seconds() // 3600),
                predicted_kw=predicted, scheduled_kw=scheduled,
                confidence_low=predicted * (1 - config.CONFIDENCE_BAND),
                confidence_high=predicted * (1 + config.CONFIDENCE_BAND),
            ))

            # Cost the block, and record a recommendation where the band is breached.
            if scheduled > 0:
                rec = pipeline.recommendation_for(utility, t, scheduled_kw=scheduled,
                                                  predicted_kw=predicted)
                if rec:
                    s.add(rec)
            t += timedelta(minutes=config.BLOCK_MINUTES)

        s.commit()
        print(f"Seeded {s.query(GenerationReading).count()} generation readings across {INVERTERS} inverters, "
              f"{s.query(Forecast).count()} forecast blocks, "
              f"{s.query(Recommendation).count()} recommendations.")


def seed_real(owner_ids: list, shift_to_now: bool) -> list:
    """Import the real plant exports sitting in data/raw/."""
    with get_session() as s:
        plants = realdata.import_plants(s, owner_ids, shift_to_now=shift_to_now)
        s.commit()
        for plant in plants:
            readings = s.query(GenerationReading).filter_by(plant_id=plant.id).count()
            inverters = s.query(Asset).filter_by(plant_id=plant.id).count()
            print(f"Imported {plant.name}: {readings:,} readings from {inverters} inverters.")
        if shift_to_now:
            print("Dates replayed so the history ends at the current block; readings are untouched.")
        return [p.id for p in plants]


def forecast_real(plant_ids: list):
    """
    Forecast each imported plant from live weather, then file the schedule a
    plant would have filed the usual way: yesterday's output, block for block.
    """
    with get_session() as s:
        for plant_id in plant_ids:
            plant = s.get(Plant, plant_id)
            try:
                run = pipeline.run_forecast(s, plant)
            except Exception as exc:                     # noqa: BLE001 - weather API or model
                print(f"  {plant.name}: no forecast yet ({exc})")
                continue
            filled = realdata.persistence_schedule(s, plant)
            s.commit()
            costed = pipeline.recost(s, plant)
            s.commit()
            print(f"  {plant.name}: {run['blocks_written']} blocks forecast, {filled} scheduled the naive way, "
                  f"{costed['breached_blocks']} outside the band, Rs {costed['total_exposure_inr']:,.0f} at risk.")


def train_model():
    frame = pipeline.training_frame()
    model, m = forecaster.train(frame)
    print(f"Model trained on {len(frame)} blocks, saved to {config.MODEL_PATH.relative_to(config.BASE_DIR)}.")
    print(f"Held-out MAE {m['mae']:,.1f} kW vs day-ahead persistence baseline "
          f"{m['baseline_mae']:,.1f} kW: {m['improvement_pct']}% improvement "
          f"over {m['test_blocks']} blocks.")
    return model


def scan_for_deviations(model):
    """Find soiling and degradation in the seeded history, the same way production would."""
    with get_session() as s:
        found = sum(diagnostics.run(s, plant, model)["alerts"] for plant in s.query(Plant).all())
        s.commit()
    print(f"Deviation scan: {found} alert(s) raised from forecast-vs-actual gaps.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", action="store_true", help="import real plant exports from data/raw/")
    parser.add_argument("--true-dates", action="store_true",
                        help="with --csv, keep the dataset's own dates instead of replaying them to today")
    parser.add_argument("--train", action="store_true", help=argparse.SUPPRESS)  # now the default
    parser.add_argument("--no-train", dest="train", action="store_false",
                        help="skip model training and the deviation scan")
    parser.set_defaults(train=True)
    args = parser.parse_args()

    try:
        pairs = ingest.discover_plant_csvs(config.DATA_DIR / "raw") if args.csv else None
    except OSError:
        pairs = []
    if args.csv and not pairs:
        parser.error("no plant CSVs in data/raw/ — expected Plant_1_Generation_Data.csv "
                     "and Plant_1_Weather_Sensor_Data.csv (see README)")

    reset()
    owners = seed_users()
    print(f"Seeded {len(owners)} demo accounts.")
    plant_ids = (seed_real([owners["utility"], owners["plant_owner"]], shift_to_now=not args.true_dates)
                 if args.csv else seed_demo(owners))

    if args.train:
        scan_for_deviations(train_model())
        if args.csv:
            forecast_real(plant_ids)
    print("Done. Start the API with: python app.py")
