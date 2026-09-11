"""Feature engineering for the forecasting model."""
import numpy as np
import pandas as pd

FEATURE_COLUMNS = [
    "irradiation", "ambient_temp", "module_temp", "cloud_cover", "wind_speed",
    "hour_sin", "hour_cos", "doy_sin", "doy_cos", "lag_1", "lag_4", "rolling_4",
]


def build(df: pd.DataFrame) -> pd.DataFrame:
    """
    df must contain: timestamp, ac_power, and the raw weather columns.
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

    df["lag_1"] = df["ac_power"].shift(1)        # previous 15-min block
    df["lag_4"] = df["ac_power"].shift(4)        # one hour back
    df["rolling_4"] = df["ac_power"].shift(1).rolling(4).mean()

    for col in FEATURE_COLUMNS:
        if col not in df.columns:
            df[col] = 0.0

    return df.fillna(0.0)
