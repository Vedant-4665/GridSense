from datetime import datetime

from flask import Blueprint, g, jsonify, request
from sqlalchemy import func

import config
from models import OWNER_ROLES, Forecast, GenerationReading, Plant, Recommendation, get_session
from routes.auth import can_act_on, visible_plant, visible_plants
from services import pipeline

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


@bp.patch("/<int:plant_id>")
def update_plant(plant_id):
    """
    Change the assumptions behind this plant's costing: its tariff, its
    tolerance band, or its name. Re-prices the forecast in place.
    """
    body = request.get_json(silent=True) or {}
    with get_session() as s:
        plant = visible_plant(s, plant_id)
        if not plant:
            return jsonify({"error": "Plant not found"}), 404
        if not can_act_on(plant):
            return jsonify({"error": "Only the plant's owner can change its settings"}), 403

        if "name" in body:
            name = str(body["name"]).strip()
            if not name:
                return jsonify({"error": "name is required"}), 400
            plant.name = name
        if "location" in body:
            plant.location = str(body["location"] or "").strip() or None
        if "tariff_rate" in body:
            try:
                tariff = float(body["tariff_rate"])
            except (TypeError, ValueError):
                return jsonify({"error": "tariff_rate must be a number"}), 400
            if not 0 < tariff < 100:
                return jsonify({"error": "tariff_rate must be between 0 and 100 Rs/kWh"}), 400
            plant.tariff_rate = tariff
        if "band_pct" in body:
            band = body["band_pct"]
            if band is None:          # back to the regulator default
                plant.band_pct = None
            else:
                try:
                    band = float(band)
                except (TypeError, ValueError):
                    return jsonify({"error": "band_pct must be a number"}), 400
                if not 0 <= band <= 100:
                    return jsonify({"error": "band_pct must be between 0 and 100"}), 400
                plant.band_pct = band

        pipeline.recost(s, plant)
        s.commit()
        return jsonify(plant.to_dict())


@bp.get("/<int:plant_id>/generation")
def generation(plant_id):
    limit = request.args.get("limit", 500, type=int)
    with get_session() as s:
        if not visible_plant(s, plant_id):
            return jsonify({"error": "Plant not found"}), 404
        # Summed across inverters: one plant-level figure per block.
        rows = (s.query(GenerationReading.timestamp,
                        func.sum(GenerationReading.ac_power).label("ac_power"),
                        func.sum(GenerationReading.dc_power).label("dc_power"))
                 .filter(GenerationReading.plant_id == plant_id)
                 .group_by(GenerationReading.timestamp)
                 .order_by(GenerationReading.timestamp.desc())
                 .limit(limit).all())
        return jsonify([
            {"timestamp": r.timestamp.isoformat(),
             "ac_power": round(r.ac_power, 2) if r.ac_power is not None else None,
             "dc_power": round(r.dc_power, 2) if r.dc_power is not None else None}
            for r in reversed(rows)
        ])


@bp.post("/<int:plant_id>/schedule")
def declare_schedule(plant_id):
    """
    Declare the current forecast as the schedule filed with the grid. Blocks
    that have already settled keep whatever was declared for them.
    """
    with get_session() as s:
        plant = visible_plant(s, plant_id)
        if not plant:
            return jsonify({"error": "Plant not found"}), 404
        if not can_act_on(plant):
            return jsonify({"error": "Only the plant's owner can declare its schedule"}), 403

        since = datetime.now()
        blocks = (s.query(Forecast)
                   .filter(Forecast.plant_id == plant_id, Forecast.target_timestamp > since)
                   .order_by(Forecast.target_timestamp).all())
        for block in blocks:
            block.scheduled_kw = block.predicted_kw
        # Declaring the forecast as the schedule leaves nothing to deviate from,
        # so actions costed against the old schedule no longer apply.
        (s.query(Recommendation)
          .filter(Recommendation.plant_id == plant_id, Recommendation.window_start > since)
          .delete(synchronize_session=False))
        s.commit()
        return jsonify({
            "plant_id": plant_id,
            "blocks_declared": len(blocks),
            "window_start": blocks[0].target_timestamp.isoformat() if blocks else None,
        })


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
