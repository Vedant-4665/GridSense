"""
Import real plant data instead of the seeded demo.

Reads the standard 15-minute plant export (generation per inverter, plus the
site's own weather sensor) from data/raw/. Nothing here invents a reading: the
only liberty taken is the calendar, since a forecasting demo has to sit next to
today's weather — see `shift_to_now`.
"""
import math
from datetime import datetime, timedelta

import pandas as pd

import config
from models import Asset, GenerationReading, Plant, WeatherReading
from services import ingest

# The published dataset does not say where these plants are, so weather
# forecasts are taken at a real Indian solar site and the app says so.
SITE = {"latitude": 23.0225, "longitude": 72.5714, "location": "Gujarat, India (site not published)"}
UTILITY_TARIFF = 3.0          # Rs/kWh, typical utility-scale PPA


def import_plants(s, owner_ids: list, shift_to_now: bool = True) -> list[Plant]:
    """
    Load every plant pair found in data/raw/, handing them out across the given
    owner accounts so each demo login opens onto a real plant.
    """
    pairs = ingest.discover_plant_csvs(config.DATA_DIR / "raw")
    if not pairs:
        raise FileNotFoundError(
            "No plant CSVs in data/raw/. Expected files named like "
            "Plant_1_Generation_Data.csv and Plant_1_Weather_Sensor_Data.csv."
        )

    plants = []
    for index, (gen_path, weather_path) in enumerate(pairs):
        generation = ingest.load_generation_csv(gen_path)
        weather = ingest.load_weather_csv(weather_path)
        offset = _offset_to_now(generation["timestamp"].max()) if shift_to_now else timedelta(0)
        generation["timestamp"] += offset
        weather["timestamp"] += offset

        plants.append(_import_one(s, gen_path.stem.replace("_Generation_Data", "").replace("_", " "),
                                  generation, weather, owner_ids[index % len(owner_ids)]))
    return plants


def _import_one(s, label: str, generation: pd.DataFrame, weather: pd.DataFrame, owner_id: int) -> Plant:
    inverters = sorted(generation["source_key"].unique())
    # Capacity the plant has actually shown, not a number from a brochure.
    per_block = generation.groupby("timestamp")["ac_power"].sum()
    capacity = float(math.ceil(per_block.quantile(0.999) / 50) * 50)

    plant = Plant(name=f"{label} · {capacity / 1000:.1f} MW", owner_id=owner_id,
                  latitude=SITE["latitude"], longitude=SITE["longitude"], location=SITE["location"],
                  capacity_kw=capacity, plant_type="solar", owner_type="utility",
                  tariff_rate=UTILITY_TARIFF)
    s.add(plant)
    s.flush()

    assets = {
        key: Asset(plant_id=plant.id, source_key=key, asset_name=f"Inverter {i + 1}",
                   capacity_kw=capacity / len(inverters), status="healthy")
        for i, key in enumerate(inverters)
    }
    s.add_all(assets.values())
    s.flush()

    s.bulk_insert_mappings(GenerationReading, [
        {"plant_id": plant.id, "asset_id": assets[r.source_key].id, "timestamp": r.timestamp.to_pydatetime(),
         "ac_power": float(r.ac_power), "dc_power": float(r.dc_power),
         "daily_yield": float(getattr(r, "daily_yield", 0.0) or 0.0),
         "total_yield": float(getattr(r, "total_yield", 0.0) or 0.0)}
        for r in generation.itertuples()
    ])

    # One weather row per block: the sensor files carry a single station.
    site_weather = weather.groupby("timestamp").agg(
        ambient_temperature=("ambient_temperature", "mean"),
        module_temperature=("module_temperature", "mean"),
        irradiation=("irradiation", "mean"),
    ).reset_index()
    s.bulk_insert_mappings(WeatherReading, [
        {"plant_id": plant.id, "timestamp": r.timestamp.to_pydatetime(),
         "ambient_temp": float(r.ambient_temperature), "module_temp": float(r.module_temperature),
         "irradiation": float(r.irradiation), "source": "sensor"}
        for r in site_weather.itertuples()
    ])
    return plant


def _offset_to_now(last_reading: pd.Timestamp) -> timedelta:
    """
    Whole days between the last real reading and the current block, so the
    history ends where the forecast begins. Values are untouched; only the
    calendar moves, and the app says so.
    """
    now = datetime.now().replace(second=0, microsecond=0)
    now -= timedelta(minutes=now.minute % config.BLOCK_MINUTES)
    days = (now - last_reading.to_pydatetime()).days
    return timedelta(days=days)


def persistence_schedule(s, plant: Plant) -> int:
    """
    Fill in the schedule a plant would have filed the usual way: yesterday's
    output, block for block. It is the naive baseline the model is scored
    against, so the deviation it produces is the cost of scheduling naively.
    """
    from models import Forecast

    history = pd.read_sql(
        f"SELECT timestamp, SUM(ac_power) AS ac_power FROM generation_readings "
        f"WHERE plant_id = {plant.id} GROUP BY timestamp", s.bind, parse_dates=["timestamp"])
    if history.empty:
        return 0
    by_time = {t.to_pydatetime(): float(v) for t, v in zip(history["timestamp"], history["ac_power"])}

    filled = 0
    for block in s.query(Forecast).filter(Forecast.plant_id == plant.id).all():
        for days_back in range(1, 8):
            earlier = by_time.get(block.target_timestamp - timedelta(days=days_back))
            if earlier is not None:
                block.scheduled_kw = earlier
                filled += 1
                break
    return filled
