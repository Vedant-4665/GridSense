from flask import Blueprint, jsonify, request

from models import Asset, GenerationReading, Plant, get_session

bp = Blueprint("plants", __name__, url_prefix="/api/plants")


@bp.get("")
def list_plants():
    with get_session() as s:
        return jsonify([p.to_dict() for p in s.query(Plant).all()])


@bp.get("/<int:plant_id>")
def get_plant(plant_id):
    with get_session() as s:
        plant = s.get(Plant, plant_id)
        if not plant:
            return jsonify({"error": "Plant not found"}), 404
        data = plant.to_dict()
        data["assets"] = [a.to_dict() for a in plant.assets]
        return jsonify(data)


@bp.get("/<int:plant_id>/generation")
def generation(plant_id):
    limit = request.args.get("limit", 500, type=int)
    with get_session() as s:
        rows = (s.query(GenerationReading)
                 .filter_by(plant_id=plant_id)
                 .order_by(GenerationReading.timestamp.desc())
                 .limit(limit).all())
        return jsonify([
            {"timestamp": r.timestamp.isoformat(), "ac_power": r.ac_power, "dc_power": r.dc_power}
            for r in reversed(rows)
        ])
