from flask import Blueprint, g, jsonify, request

import config
from models import OWNER_ROLES, GenerationReading, Plant, get_session
from routes.auth import visible_plant, visible_plants

bp = Blueprint("plants", __name__, url_prefix="/api/plants")


@bp.get("")
def list_plants():
    with get_session() as s:
        return jsonify([p.to_dict() for p in visible_plants(s).all()])


@bp.post("")
def create_plant():
    """Register a plant owned by the current user. Owner roles only."""
    if g.user.role not in OWNER_ROLES:
        return jsonify({"error": "Only plant owners and utilities can add plants"}), 403

    body = request.get_json(silent=True) or {}
    try:
        plant = Plant(
            owner_id=g.user.id,
            name=str(body["name"]).strip(),
            location=str(body.get("location") or "").strip() or None,
            latitude=float(body["latitude"]), longitude=float(body["longitude"]),
            capacity_kw=float(body["capacity_kw"]),
            plant_type=body.get("plant_type", "solar"),
            owner_type=body.get("owner_type", "utility"),
            tariff_rate=float(body.get("tariff_rate", config.DEFAULT_RETAIL_TARIFF)),
        )
    except (KeyError, TypeError, ValueError):
        return jsonify({"error": "name, latitude, longitude and capacity_kw are required"}), 400

    error = _invalid(plant)
    if error:
        return jsonify({"error": error}), 400

    with get_session() as s:
        s.add(plant)
        s.commit()
        return jsonify(plant.to_dict()), 201


@bp.get("/<int:plant_id>")
def get_plant(plant_id):
    with get_session() as s:
        plant = visible_plant(s, plant_id)
        if not plant:
            return jsonify({"error": "Plant not found"}), 404
        data = plant.to_dict()
        data["assets"] = [a.to_dict() for a in plant.assets]
        return jsonify(data)


@bp.get("/<int:plant_id>/generation")
def generation(plant_id):
    limit = request.args.get("limit", 500, type=int)
    with get_session() as s:
        if not visible_plant(s, plant_id):
            return jsonify({"error": "Plant not found"}), 404
        rows = (s.query(GenerationReading)
                 .filter_by(plant_id=plant_id)
                 .order_by(GenerationReading.timestamp.desc())
                 .limit(limit).all())
        return jsonify([
            {"timestamp": r.timestamp.isoformat(), "ac_power": r.ac_power, "dc_power": r.dc_power}
            for r in reversed(rows)
        ])


def _invalid(p: Plant):
    """First validation error for a new plant, or None."""
    if not p.name:
        return "name is required"
    if not (-90 <= p.latitude <= 90 and -180 <= p.longitude <= 180):
        return "latitude or longitude is out of range"
    if not 0 < p.capacity_kw < 10_000_000:
        return "capacity_kw must be between 0 and 10,000,000"
    if p.plant_type not in ("solar", "wind"):
        return "plant_type must be solar or wind"
    if p.owner_type not in ("utility", "distributed"):
        return "owner_type must be utility or distributed"
    return None
