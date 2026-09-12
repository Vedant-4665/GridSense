"""Central configuration. Keep every tunable number here, not scattered in code."""
import os
import secrets
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR.parent / "data"
MODEL_PATH = BASE_DIR / "ml" / "model.pkl"
# Scores and feature importances from the last training run, for the accuracy page.
MODEL_CARD_PATH = BASE_DIR / "ml" / "model_card.json"

load_dotenv(BASE_DIR / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'gridsense.sqlite3'}")

# The Vite proxy reads the same variable. On macOS, AirPlay Receiver holds 5000.
API_PORT = int(os.getenv("API_PORT", "5000"))

# Open-Meteo needs no API key.
WEATHER_API_URL = "https://api.open-meteo.com/v1/forecast"

# Point this at your network's root certificate (PEM) if it inspects HTTPS and
# the system trust store isn't enough. True means "use the normal trust chain".
CA_BUNDLE = os.getenv("REQUESTS_CA_BUNDLE") or os.getenv("WEATHER_CA_BUNDLE") or True

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


# --- Auth ------------------------------------------------------------------
def _dev_secret_key() -> str:
    """Random key kept beside the code, so logins survive restarts in development."""
    path = BASE_DIR / ".secret_key"
    if not path.exists():
        path.write_text(secrets.token_hex(32))
    return path.read_text().strip()


# Signs the session cookie. Set SECRET_KEY in the environment for any real deployment.
SECRET_KEY = os.getenv("SECRET_KEY") or _dev_secret_key()
# Cookie over HTTPS only. Turn on wherever the app is served over TLS.
SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE") == "1"
SESSION_DAYS = 7
MIN_PASSWORD_LENGTH = 8

# One-click demo accounts, one per role, created by seed.py. Turn off for real customers.
DEMO_LOGIN = os.getenv("DEMO_LOGIN", "1") == "1"
DEMO_EMAIL = "{role}@demo.gridsense.test"
