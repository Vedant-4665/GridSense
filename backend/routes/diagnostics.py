from flask import Blueprint, jsonify, request

from models import get_session
from routes.auth import can_act_on, visible_plant
from services import diagnostics

bp = Blueprint("diagnostics", __name__, url_prefix="/api/diagnostics")


@bp.post("/run")
def run_diagnostic():
    """Re-scan a plant's inverters for weather-unexplained shortfalls."""
    plant_id = (request.get_json(silent=True) or {}).get("plant_id")
    if not isinstance(plant_id, int):
        return jsonify({"error": "plant_id is required"}), 400

    with get_session() as s:
        plant = visible_plant(s, plant_id)
        if not plant:
            return jsonify({"error": "Plant not found"}), 404
        if not can_act_on(plant):
            return jsonify({"error": "Only the plant's owner can run its health check"}), 403
        try:
            summary = diagnostics.run(s, plant)
        except FileNotFoundError as exc:
            return jsonify({"error": str(exc)}), 503
        s.commit()
        return jsonify(summary)
