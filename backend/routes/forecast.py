from flask import Blueprint, jsonify, request

import config
from models import Forecast, Plant, Recommendation, get_session
from services import costing

bp = Blueprint("forecast", __name__, url_prefix="/api")


@bp.get("/plants/<int:plant_id>/forecast")
def get_forecast(plant_id):
    horizon = request.args.get("horizon", 24, type=int)
    if horizon not in config.FORECAST_HORIZONS:
        return jsonify({"error": f"horizon must be one of {config.FORECAST_HORIZONS}"}), 400

    with get_session() as s:
        rows = (s.query(Forecast)
                 .filter_by(plant_id=plant_id)
                 .order_by(Forecast.target_timestamp)
                 .limit(horizon * 4).all())
        return jsonify({"plant_id": plant_id, "horizon_hours": horizon,
                        "blocks": [r.to_dict() for r in rows]})


@bp.get("/plants/<int:plant_id>/recommendations")
def recommendations(plant_id):
    """Ranked by financial impact, not by severity label."""
    with get_session() as s:
        rows = (s.query(Recommendation)
                 .filter_by(plant_id=plant_id)
                 .order_by(Recommendation.exposure_inr.desc()).all())
        return jsonify([r.to_dict() for r in rows])


@bp.post("/costing/preview")
def costing_preview():
    """
    Exposes the costing arithmetic directly so the calculation can be
    re-run with any scheduled/forecast pair during a demo.
    """
    body = request.get_json(force=True) or {}
    result = costing.block_exposure(
        scheduled_kwh=float(body.get("scheduled_kwh", 0)),
        forecast_kwh=float(body.get("forecast_kwh", 0)),
        plant_type=body.get("plant_type", "solar"),
    )
    action, message = costing.recommend_action(result)
    return jsonify({**result, "action_type": action, "message": message})


@bp.post("/forecast/run")
def run_forecast():
    # TODO(hackathon): load model, pull weather, write Forecast + Recommendation rows.
    return jsonify({"status": "not_implemented"}), 501
