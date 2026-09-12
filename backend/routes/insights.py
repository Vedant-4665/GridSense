from flask import Blueprint, jsonify

import config
from models import ROLES
from services import forecaster

bp = Blueprint("insights", __name__, url_prefix="/api")


@bp.get("/model")
def model_card():
    """How good the forecast is, and what it leans on. Written at training time."""
    try:
        return jsonify(forecaster.model_card())
    except FileNotFoundError as exc:
        return jsonify({"error": str(exc)}), 503


@bp.get("/settings")
def settings():
    """The regulatory assumptions every rupee figure rests on."""
    return jsonify({
        "tolerance_band_pct": {k: round(v * 100, 2) for k, v in config.TOLERANCE_BAND.items()},
        "deviation_slabs": [
            {"up_to_pct": round(upper * 100, 2), "rate_per_kwh": rate}
            for upper, rate in config.DEVIATION_SLABS
        ],
        "over_injection_freq_hz": config.OVER_INJECTION_FREQ_HZ,
        "block_minutes": config.BLOCK_MINUTES,
        "forecast_horizons": config.FORECAST_HORIZONS,
        "default_retail_tariff": config.DEFAULT_RETAIL_TARIFF,
        "regulation": "CERC DSM (Third Amendment) Regulations 2026, in force 31 August 2026",
        "roles": ROLES,
    })
