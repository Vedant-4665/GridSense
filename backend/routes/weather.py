from flask import Blueprint, jsonify, request
import requests

from services import ingest

bp = Blueprint("weather", __name__, url_prefix="/api/weather")


@bp.get("/current")
def current():
    """
    Conditions at a coordinate right now, straight from Open-Meteo. Used by the
    add-plant screen so a site is more than two numbers. Nothing is stored.
    """
    try:
        latitude = float(request.args.get("latitude", ""))
        longitude = float(request.args.get("longitude", ""))
    except (TypeError, ValueError):
        return jsonify({"error": "latitude and longitude are required"}), 400
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        return jsonify({"error": "latitude or longitude is out of range"}), 400

    try:
        return jsonify(ingest.fetch_current_weather(latitude, longitude))
    except requests.RequestException as exc:
        return jsonify({"error": f"Weather service unavailable: {exc}"}), 502
    except (KeyError, ValueError) as exc:
        return jsonify({"error": f"Weather service returned something unexpected: {exc}"}), 502
