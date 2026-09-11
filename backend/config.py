"""Central configuration. Keep every tunable number here, not scattered in code."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR.parent / "data"
MODEL_PATH = BASE_DIR / "ml" / "model.pkl"

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'gridsense.sqlite3'}")

# Open-Meteo needs no API key.
WEATHER_API_URL = "https://api.open-meteo.com/v1/forecast"

# --- Regulatory parameters -------------------------------------------------
# Deviation tolerance bands, as a fraction of scheduled generation.
# CERC DSM (Third Amendment) Regulations 2026, in force 31 Aug 2026.
TOLERANCE_BAND = {"solar": 0.05, "wind": 0.10}

# Slab structure for deviation charges, rupees per unit (kWh).
# Each tuple: (upper bound of absolute error as a fraction, rate per unit).
DEVIATION_SLABS = [
    (0.05, 0.00),
    (0.15, 0.25),
    (0.25, 0.50),
    (1.00, 0.75),
]

# Frequency at or above which over-injection is unremunerated (Hz).
OVER_INJECTION_FREQ_HZ = 50.05

# Default retail tariff for the distributed-asset view (rupees per unit).
DEFAULT_RETAIL_TARIFF = 8.0

FORECAST_HORIZONS = [24, 48, 72]
BLOCK_MINUTES = 15

# Forecast uncertainty band as a fraction of predicted output. A flat
# placeholder until the model produces its own intervals.
CONFIDENCE_BAND = 0.08

# Nominal operating cell temperature of a typical crystalline module (deg C),
# used to estimate module temperature from forecast weather.
MODULE_NOCT_C = 45.0
