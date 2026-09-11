"""
Rebuild the database from scratch. One command, always.

    python seed.py            # demo data only
    python seed.py --csv      # load real CSVs from ../data/raw/

When the database gets into a bad state at 3am, run this rather than debugging it.
"""
import argparse
import math
import random
from datetime import datetime, timedelta

import config
from models import (
    Asset, DeviationAlert, Forecast, GenerationReading, Plant,
    Recommendation, WeatherReading, Base, engine, get_session, init_db,
)
from services import costing

random.seed(42)


def reset():
    Base.metadata.drop_all(engine)
    init_db()
    print("Schema rebuilt.")


def solar_curve(hour: float, capacity_kw: float) -> float:
    """Simple clear-sky bell between 06:00 and 18:00."""
    if hour < 6 or hour > 18:
        return 0.0
    return capacity_kw * math.sin(math.pi * (hour - 6) / 12) ** 1.4


def seed_demo():
    with get_session() as s:
        utility = Plant(
            name="Ahmedabad Solar Park", location="Gujarat, India",
            latitude=23.0225, longitude=72.5714, capacity_kw=50000,
            plant_type="solar", owner_type="utility",
        )
        rooftop = Plant(
            name="Rooftop 3kW (demo)", location="Ahmedabad, India",
            latitude=23.0225, longitude=72.5714, capacity_kw=3,
            plant_type="solar", owner_type="distributed",
            tariff_rate=config.DEFAULT_RETAIL_TARIFF,
        )
        s.add_all([utility, rooftop])
        s.flush()

        assets = [
            Asset(plant_id=utility.id, source_key=f"INV-{i:02d}",
                  asset_name=f"Inverter {i}", capacity_kw=5000,
                  status="alert" if i == 3 else "healthy")
            for i in range(1, 11)
        ]
        s.add_all(assets)
        s.flush()

        now = datetime.now().replace(minute=0, second=0, microsecond=0)
        start = now - timedelta(days=7)

        # --- history: 7 days of 15-minute readings -------------------------
        t = start
        while t < now:
            hour = t.hour + t.minute / 60
            clear = solar_curve(hour, utility.capacity_kw)
            weather_factor = 1.0 if t.day % 3 else 0.72     # cloudy every third day
            actual = clear * weather_factor * random.uniform(0.95, 1.03)

            s.add(GenerationReading(plant_id=utility.id, timestamp=t,
                                    ac_power=actual, dc_power=actual * 1.02))
            s.add(WeatherReading(
                plant_id=utility.id, timestamp=t,
                ambient_temp=26 + 8 * math.sin(math.pi * hour / 24),
                module_temp=30 + 14 * math.sin(math.pi * hour / 24),
                irradiation=clear / utility.capacity_kw,
                cloud_cover=(1 - weather_factor) * 100, wind_speed=3.4,
                source="sensor",
            ))
            t += timedelta(minutes=config.BLOCK_MINUTES)

        # --- forward forecast: 72 hours ------------------------------------
        t = now
        while t < now + timedelta(hours=72):
            hour = t.hour + t.minute / 60
            clear = solar_curve(hour, utility.capacity_kw)
            predicted = clear * random.uniform(0.90, 1.0)
            scheduled = clear * 0.97

            s.add(Forecast(
                plant_id=utility.id, target_timestamp=t,
                horizon_hours=int((t - now).total_seconds() // 3600),
                predicted_kw=predicted, scheduled_kw=scheduled,
                confidence_low=predicted * 0.92, confidence_high=predicted * 1.08,
            ))

            # Cost the block, and record a recommendation where the band is breached.
            if scheduled > 0:
                hours = config.BLOCK_MINUTES / 60
                result = costing.block_exposure(
                    scheduled_kwh=scheduled * hours,
                    forecast_kwh=predicted * hours,
                    plant_type="solar",
                )
                if result["breached"]:
                    action, message = costing.recommend_action(result)
                    s.add(Recommendation(
                        plant_id=utility.id, window_start=t,
                        window_end=t + timedelta(minutes=config.BLOCK_MINUTES),
                        window_type=result["direction"], action_type=action,
                        severity=costing.severity_for(result["deviation_pct"]),
                        deviation_pct=result["deviation_pct"],
                        expected_delta_kwh=result.get("chargeable_units"),
                        exposure_inr=result["exposure_inr"], message=message,
                    ))
            t += timedelta(minutes=config.BLOCK_MINUTES)

        # --- one seeded deviation alert on inverter 3 ----------------------
        s.add(DeviationAlert(
            asset_id=assets[2].id,
            window_start=now - timedelta(days=4), window_end=now,
            deviation_pct=12.4, suspected_cause="soiling", severity="medium",
            est_loss_kwh=4820, est_revenue_loss=14460, status="open",
        ))

        s.commit()
        print(f"Seeded {s.query(GenerationReading).count()} generation readings, "
              f"{s.query(Forecast).count()} forecast blocks, "
              f"{s.query(Recommendation).count()} recommendations.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", action="store_true", help="load real CSVs from data/raw/")
    args = parser.parse_args()

    reset()
    seed_demo()
    if args.csv:
        print("TODO(hackathon): wire services.ingest.load_generation_csv here.")
    print("Done. Start the API with: python app.py")
