"""
Forecast run: forward weather in, costed forecast blocks out.

Also home to the pieces seed.py shares with the run: the training frame, and
the rule that turns a breached block into a Recommendation.
"""
from datetime import datetime, timedelta

import pandas as pd
from sqlalchemy import func, select

import config
from models import Forecast, GenerationReading, Plant, Recommendation, WeatherReading, engine
from services import costing, forecaster, ingest


def training_frame() -> pd.DataFrame:
    """Plant-level generation joined to weather and capacity, one row per plant per block."""
    generation = pd.read_sql(
        # Summed so per-inverter CSV rows and plant-level seed rows look the same.
        select(GenerationReading.plant_id, GenerationReading.timestamp,
               func.sum(GenerationReading.ac_power).label("ac_power"))
        .group_by(GenerationReading.plant_id, GenerationReading.timestamp),
        engine,
    )
    weather = pd.read_sql(
        select(WeatherReading.plant_id, WeatherReading.timestamp,
               WeatherReading.ambient_temp, WeatherReading.module_temp,
               WeatherReading.irradiation, WeatherReading.cloud_cover,
               WeatherReading.wind_speed),
        engine,
    )
    plants = pd.read_sql(select(Plant.id.label("plant_id"), Plant.capacity_kw), engine)
    return generation.merge(weather, on=["plant_id", "timestamp"]).merge(plants, on="plant_id")


def run_forecast(s, plant: Plant, hours: int = max(config.FORECAST_HORIZONS)) -> dict:
    """
    Replace the plant's future forecast blocks with fresh ones and re-cost them.

    Raises FileNotFoundError when no model is trained, and
    requests.RequestException when the weather forecast can't be fetched.
    Both happen before anything is written. Does not commit.
    """
    model = forecaster.load()
    start = _next_block_start(datetime.now())
    hourly = ingest.fetch_forecast_weather(plant.latitude, plant.longitude, hours)
    blocks = ingest.interpolate_to_blocks(hourly, start, hours)
    blocks["predicted_kw"] = forecaster.predict(blocks, model) * plant.capacity_kw

    future = s.query(Forecast).filter(Forecast.plant_id == plant.id,
                                      Forecast.target_timestamp >= start)
    # The schedule is what the plant declared to the grid, not something this
    # run produces, so it carries over onto the new blocks.
    schedule = {f.target_timestamp: f.scheduled_kw for f in future}
    future.delete(synchronize_session=False)
    (s.query(Recommendation)
      .filter(Recommendation.plant_id == plant.id, Recommendation.window_start >= start)
      .delete(synchronize_session=False))

    breached, unscheduled, exposure = 0, 0, 0.0
    for row in blocks.itertuples():
        t, predicted = row.timestamp.to_pydatetime(), float(row.predicted_kw)
        scheduled = schedule.get(t)
        s.add(Forecast(
            plant_id=plant.id, target_timestamp=t,
            horizon_hours=int((t - start).total_seconds() // 3600),
            predicted_kw=predicted, scheduled_kw=scheduled,
            confidence_low=predicted * (1 - config.CONFIDENCE_BAND),
            confidence_high=predicted * (1 + config.CONFIDENCE_BAND),
        ))
        if scheduled is None:
            unscheduled += 1
            continue
        rec = recommendation_for(plant, t, scheduled_kw=scheduled, predicted_kw=predicted)
        if rec:
            s.add(rec)
            breached += 1
            exposure += rec.exposure_inr

    return {
        "plant_id": plant.id,
        "window_start": start.isoformat(),
        "blocks_written": len(blocks),
        "breached_blocks": breached,
        "unscheduled_blocks": unscheduled,
        "total_exposure_inr": round(exposure, 2),
    }


def recommendation_for(plant: Plant, t: datetime, scheduled_kw: float, predicted_kw: float):
    """Cost one block. A Recommendation if it breaches the tolerance band, else None."""
    hours = config.BLOCK_MINUTES / 60
    result = costing.block_exposure(
        scheduled_kwh=scheduled_kw * hours,
        forecast_kwh=predicted_kw * hours,
        plant_type=plant.plant_type,
    )
    if not result["breached"]:
        return None

    action, message = costing.recommend_action(result)
    return Recommendation(
        plant_id=plant.id, window_start=t,
        window_end=t + timedelta(minutes=config.BLOCK_MINUTES),
        window_type=result["direction"], action_type=action,
        severity=costing.severity_for(result["deviation_pct"]),
        deviation_pct=result["deviation_pct"],
        expected_delta_kwh=result.get("chargeable_units"),
        exposure_inr=result["exposure_inr"], message=message,
    )


def _next_block_start(now: datetime) -> datetime:
    """First settlement block boundary at or after `now`."""
    floored = now.replace(minute=now.minute - now.minute % config.BLOCK_MINUTES,
                          second=0, microsecond=0)
    return floored if floored == now else floored + timedelta(minutes=config.BLOCK_MINUTES)
