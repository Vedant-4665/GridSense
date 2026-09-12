"""
Forecast-deviation diagnostic (ideation feature 6).

Runs the trained model back over the weather the plant actually had, and
compares that expectation against what each inverter really produced. A
sustained clear-sky shortfall with no meteorological explanation is the soiling
signature: no extra sensor hardware, only data the platform already holds.
"""
import pandas as pd
from sqlalchemy import select

import config
from models import Asset, DeviationAlert, GenerationReading, Plant, WeatherReading, engine
from services import deviation, forecaster


def run(s, plant: Plant, model=None) -> dict:
    """Re-scan one plant's inverters. Replaces the alerts the last scan raised."""
    assets = s.query(Asset).filter_by(plant_id=plant.id).all()
    expected = _expected_capacity_factor(plant, model) if assets else pd.DataFrame()
    if expected.empty:
        return {"plant_id": plant.id, "assets_checked": 0, "alerts": 0}

    actual = _actual_by_asset(plant.id)
    tariff = plant.tariff_rate or config.DEFAULT_RETAIL_TARIFF

    # Clear out what the previous scan raised. Anything a human acknowledged or
    # resolved is left alone.
    (s.query(DeviationAlert)
      .filter(DeviationAlert.asset_id.in_([a.id for a in assets]), DeviationAlert.status == "open")
      .delete(synchronize_session=False))

    raised = 0
    for asset in assets:
        rows = actual[actual["asset_id"] == asset.id]
        if rows.empty:
            continue
        paired = expected.merge(rows, on="timestamp")
        readings = [{
            "timestamp": r.timestamp.to_pydatetime(),
            "predicted_kw": r.capacity_factor * (asset.capacity_kw or 0),
            "actual_kw": r.ac_power,
            "irradiation": r.irradiation,
        } for r in paired.itertuples()]

        found = deviation.analyse(readings)
        asset.status = "alert" if found else "healthy"
        if found:
            alert = _merge(found)
            s.add(DeviationAlert(
                asset_id=asset.id, status="open",
                est_revenue_loss=round(alert["est_loss_kwh"] * tariff, 2), **alert,
            ))
            raised += 1

    return {"plant_id": plant.id, "assets_checked": len(assets), "alerts": raised}


def _merge(windows: list[dict]) -> dict:
    """
    One flag per inverter. An operator cares that a panel is dirty, not that it
    was dirty on four separate afternoons, so the windows are folded into a
    single alert spanning the whole episode.
    """
    loss = sum(w["est_loss_kwh"] for w in windows)
    gap = (sum(w["deviation_pct"] * w["est_loss_kwh"] for w in windows) / loss) if loss else 0.0
    return {
        "window_start": min(w["window_start"] for w in windows),
        "window_end": max(w["window_end"] for w in windows),
        "deviation_pct": round(gap, 2),
        "suspected_cause": "soiling" if gap < 20 else "degradation",
        "severity": "high" if gap >= 15 else "medium",
        "est_loss_kwh": round(loss, 2),
    }


def _expected_capacity_factor(plant: Plant, model) -> pd.DataFrame:
    """What the model says the plant should have produced, block by block."""
    weather = pd.read_sql(
        select(WeatherReading.timestamp, WeatherReading.ambient_temp, WeatherReading.module_temp,
               WeatherReading.irradiation, WeatherReading.cloud_cover, WeatherReading.wind_speed)
        .where(WeatherReading.plant_id == plant.id),
        engine,
    )
    if weather.empty:
        return weather
    weather = weather.sort_values("timestamp").reset_index(drop=True)
    weather["capacity_factor"] = forecaster.predict(weather, model)
    return weather


def _actual_by_asset(plant_id: int) -> pd.DataFrame:
    return pd.read_sql(
        select(GenerationReading.asset_id, GenerationReading.timestamp, GenerationReading.ac_power)
        .where(GenerationReading.plant_id == plant_id, GenerationReading.asset_id.isnot(None)),
        engine,
    )
