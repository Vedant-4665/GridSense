"""Data ingestion: historical CSV seed plus live weather forecast."""
from datetime import datetime

import pandas as pd
import requests

import config


def discover_plant_csvs(folder) -> list:
    """(generation, weather) CSV pairs in the standard plant-export layout."""
    pairs = []
    for generation in sorted(folder.glob("*_Generation_Data.csv")):
        weather = generation.with_name(generation.name.replace("_Generation_Data", "_Weather_Sensor_Data"))
        if weather.exists():
            pairs.append((generation, weather))
    return pairs


def load_generation_csv(path) -> pd.DataFrame:
    """Expects the standard plant generation export (15-minute resolution)."""
    df = pd.read_csv(path)
    df.columns = [c.strip().lower() for c in df.columns]
    df["timestamp"] = pd.to_datetime(df["date_time"], dayfirst=True, errors="coerce")
    return df.dropna(subset=["timestamp"])


def load_weather_csv(path) -> pd.DataFrame:
    df = pd.read_csv(path)
    df.columns = [c.strip().lower() for c in df.columns]
    df["timestamp"] = pd.to_datetime(df["date_time"], errors="coerce")
    return df.dropna(subset=["timestamp"])


def fetch_forecast_weather(lat: float, lon: float, hours: int = 72) -> pd.DataFrame:
    """
    Open-Meteo, no API key required. Returns hourly weather covering at least
    the next `hours`, stamped in this machine's local time to match every other
    timestamp in the database.
    """
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "temperature_2m,cloud_cover,wind_speed_10m,shortwave_radiation",
        "wind_speed_unit": "ms",
        # Hourly data starts at midnight today, so one extra day is needed to
        # reach `hours` past now.
        "forecast_days": max(1, min(7, hours // 24 + 2)),
        "timezone": "GMT",
    }
    resp = requests.get(config.WEATHER_API_URL, params=params, timeout=15)
    resp.raise_for_status()
    hourly = resp.json()["hourly"]

    local_tz = datetime.now().astimezone().tzinfo
    return pd.DataFrame({
        "timestamp": (pd.to_datetime(hourly["time"]).tz_localize("UTC")
                      .tz_convert(local_tz).tz_localize(None)),
        "ambient_temp": hourly["temperature_2m"],
        "cloud_cover": hourly["cloud_cover"],
        "wind_speed": hourly["wind_speed_10m"],
        # Open-Meteo returns W/m2; the training data uses kW/m2.
        "irradiation": [v / 1000 if v is not None else None for v in hourly["shortwave_radiation"]],
    })


def interpolate_to_blocks(hourly: pd.DataFrame, start: datetime, hours: int) -> pd.DataFrame:
    """
    Interpolate hourly weather onto settlement blocks from `start`.

    Open-Meteo's shortwave_radiation is the mean of the preceding hour, so each
    value is placed at the middle of that hour before interpolating. Stamped as
    delivered, the whole solar curve lands 30 minutes late. Temperature, cloud
    cover and wind are instantaneous and are used as stamped.
    """
    blocks = pd.date_range(start, periods=hours * 60 // config.BLOCK_MINUTES,
                           freq=f"{config.BLOCK_MINUTES}min")

    instant = hourly.set_index("timestamp")[["ambient_temp", "cloud_cover", "wind_speed"]]
    radiation = hourly.set_index(hourly["timestamp"] - pd.Timedelta(minutes=30))[["irradiation"]]

    out = pd.concat([_onto(instant, blocks), _onto(radiation, blocks)], axis=1)
    if out.isna().any().any():
        raise ValueError(f"Weather forecast does not cover {hours}h from {start:%Y-%m-%d %H:%M}")

    # No weather API forecasts module temperature. Estimate it from ambient
    # temperature and irradiance with the standard NOCT model.
    out["module_temp"] = out["ambient_temp"] + (config.MODULE_NOCT_C - 20) / 0.8 * out["irradiation"]
    return out.rename_axis("timestamp").reset_index()


def _onto(frame: pd.DataFrame, index: pd.DatetimeIndex) -> pd.DataFrame:
    """Linear-in-time interpolation onto `index`, never extrapolating past the data."""
    merged = frame.reindex(frame.index.union(index)).interpolate(method="time", limit_area="inside")
    return merged.reindex(index)
