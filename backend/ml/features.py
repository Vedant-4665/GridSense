"""Feature engineering for the forecasting model."""
import numpy as np
import pandas as pd

# Only inputs that exist 24-72 hours ahead: forecast weather and the calendar.
# Lags of actual output are deliberately absent. They don't exist at forecast
# time, and run recursively they lost to weather-only on the seed data.
FEATURE_COLUMNS = [
    "irradiation", "ambient_temp", "module_temp", "cloud_cover", "wind_speed",
    "hour_sin", "hour_cos", "doy_sin", "doy_cos",
]


def build(df: pd.DataFrame) -> pd.DataFrame:
    """
    df must contain: timestamp and the raw weather columns.
    Cyclical encoding is used for hour and day-of-year so the model sees
    23:45 and 00:00 as adjacent rather than maximally distant.
    """
    df = df.sort_values("timestamp").copy()
    ts = pd.to_datetime(df["timestamp"])

    hour = ts.dt.hour + ts.dt.minute / 60
    df["hour_sin"] = np.sin(2 * np.pi * hour / 24)
    df["hour_cos"] = np.cos(2 * np.pi * hour / 24)

    doy = ts.dt.dayofyear
    df["doy_sin"] = np.sin(2 * np.pi * doy / 365)
    df["doy_cos"] = np.cos(2 * np.pi * doy / 365)

    for col in FEATURE_COLUMNS:
        if col not in df.columns:
            df[col] = 0.0

    return df.fillna(0.0)
