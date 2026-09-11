import requests
from flask import Blueprint, jsonify, request

import config
from models import Forecast, Recommendation, get_session
from routes.auth import can_act_on, visible_plant
from services import costing, pipeline

bp = Blueprint("forecast", __name__, url_prefix="/api")


@bp.get("/plants/<int:plant_id>/forecast")
def get_forecast(plant_id):
    horizon = request.args.get("horizon", 24, type=int)
    if horizon not in config.FORECAST_HORIZONS:
        return jsonify({"error": f"horizon must be one of {config.FORECAST_HORIZONS}"}), 400

    with get_session() as s:
        if not visible_plant(s, plant_id):
            return jsonify({"error": "Plant not found"}), 404
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
        if not visible_plant(s, plant_id):
            return jsonify({"error": "Plant not found"}), 404
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
    """
    Regenerate the plant's next 72 hours of forecast blocks from live weather
    and re-cost them. Uses the model saved by `python seed.py --train`.
    """
    plant_id = (request.get_json(silent=True) or {}).get("plant_id")
    if not isinstance(plant_id, int):
        return jsonify({"error": "plant_id is required"}), 400

    with get_session() as s:
        plant = visible_plant(s, plant_id)
        if not plant:
            return jsonify({"error": "Plant not found"}), 404
        if not can_act_on(plant):
            return jsonify({"error": "Only the plant's owner can run its forecast"}), 403
        if plant.plant_type != "solar":
            return jsonify({"error": "Forecasting is solar-only for now"}), 422
        try:
            summary = pipeline.run_forecast(s, plant)
        except FileNotFoundError as exc:
            return jsonify({"error": str(exc)}), 503
        except requests.RequestException as exc:
            return jsonify({"error": f"Weather forecast unavailable: {exc}"}), 502
        s.commit()
        return jsonify(summary)
