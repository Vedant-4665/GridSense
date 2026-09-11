"""Data ingestion: historical CSV seed plus live weather forecast."""
import pandas as pd
import requests

import config


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
    """Open-Meteo, no API key required. Returns hourly forward weather."""
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "temperature_2m,cloud_cover,wind_speed_10m,shortwave_radiation",
        "forecast_days": max(1, min(7, hours // 24 + 1)),
        "timezone": "auto",
    }
    resp = requests.get(config.WEATHER_API_URL, params=params, timeout=15)
    resp.raise_for_status()
    hourly = resp.json()["hourly"]

    return pd.DataFrame({
        "timestamp": pd.to_datetime(hourly["time"]),
        "ambient_temp": hourly["temperature_2m"],
        "cloud_cover": hourly["cloud_cover"],
        "wind_speed": hourly["wind_speed_10m"],
        # Open-Meteo returns W/m2; the training data uses kW/m2.
        "irradiation": [v / 1000 for v in hourly["shortwave_radiation"]],
    }).head(hours)
