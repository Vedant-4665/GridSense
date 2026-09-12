import math
import unicodedata
from datetime import datetime

from flask import Blueprint, g, jsonify, request
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

import config
from models import OWNER_ROLES, Forecast, GenerationReading, Plant, Recommendation, get_session
from routes.auth import can_act_on, visible_plant, visible_plants
from services import pipeline

bp = Blueprint("plants", __name__, url_prefix="/api/plants")

MAX_NAME = 120          # matches Plant.name
MAX_LOCATION = 120      # matches Plant.location
COORD_DECIMALS = 6      # ~0.1 m: finer than any plant boundary


def _text(value, limit: int):
    """
    Trim, normalise and drop control characters, keeping ordinary Unicode.
    Returns None when nothing is left, or False when it is too long to accept
    (too long is refused rather than silently truncated).
    """
    text = unicodedata.normalize("NFC", str(value if value is not None else ""))
    text = "".join(ch for ch in text if ch == " " or not unicodedata.category(ch).startswith("C")).strip()
    if not text:
        return None
    return text if len(text) <= limit else False


def _finite(value):
    """A real number, or None for NaN, Infinity, blanks and anything unparseable."""
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


@bp.get("")
def list_plants():
    with get_session() as s:
        return jsonify([p.to_dict() for p in visible_plants(s).all()])


@bp.post("")
def create_plant():
    """Register a plant owned by the current user. Owner roles only."""
    if g.user.role not in OWNER_ROLES:
        return jsonify({"error": "Only plant owners and utilities can add plants"}), 403

    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify({"error": "Send a JSON object describing the plant"}), 400

    # A retried request carries the key of the one before it. If that request
    # already created the plant, hand back the same plant instead of a second.
    key = (request.headers.get("Idempotency-Key") or "").strip()[:64] or None
    if key:
        with get_session() as s:
            already = s.query(Plant).filter_by(owner_id=g.user.id, idempotency_key=key).first()
            if already:
                return jsonify(already.to_dict()), 200

    name = _text(body.get("name"), MAX_NAME)
    location = _text(body.get("location"), MAX_LOCATION)
    if name is False:
        return jsonify({"error": f"name must be {MAX_NAME} characters or fewer"}), 400
    if location is False:
        return jsonify({"error": f"location must be {MAX_LOCATION} characters or fewer"}), 400
    if not name:
        return jsonify({"error": "name is required"}), 400

    latitude, longitude = _finite(body.get("latitude")), _finite(body.get("longitude"))
    capacity = _finite(body.get("capacity_kw"))
    tariff = _finite(body.get("tariff_rate", config.DEFAULT_RETAIL_TARIFF))
    if latitude is None or longitude is None or capacity is None:
        return jsonify({"error": "latitude, longitude and capacity_kw must be numbers"}), 400
    if tariff is None:
        return jsonify({"error": "tariff_rate must be a number"}), 400

    plant = Plant(
        owner_id=g.user.id, name=name, location=location,
        latitude=round(latitude, COORD_DECIMALS), longitude=round(longitude, COORD_DECIMALS),
        capacity_kw=capacity,
        plant_type=body.get("plant_type", "solar"),
        owner_type=body.get("owner_type", "utility"),
        tariff_rate=tariff, idempotency_key=key,
    )
    error = _invalid(plant)
    if error:
        return jsonify({"error": error}), 400

    with get_session() as s:
        s.add(plant)
        try:
            s.commit()
        except IntegrityError:
            # Simultaneous retries of the same creation: one wins, the rest get
            # the plant it made.
            s.rollback()
            if not key:
                raise
            already = s.query(Plant).filter_by(owner_id=g.user.id, idempotency_key=key).first()
            if not already:
                raise
            return jsonify(already.to_dict()), 200
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
            name = _text(body["name"], MAX_NAME)
            if name is False:
                return jsonify({"error": f"name must be {MAX_NAME} characters or fewer"}), 400
            if not name:
                return jsonify({"error": "name is required"}), 400
            plant.name = name
        if "location" in body:
            location = _text(body["location"], MAX_LOCATION)
            if location is False:
                return jsonify({"error": f"location must be {MAX_LOCATION} characters or fewer"}), 400
            plant.location = location
        if "tariff_rate" in body:
            tariff = _finite(body["tariff_rate"])
            if tariff is None:
                return jsonify({"error": "tariff_rate must be a number"}), 400
            if not 0 < tariff < 100:
                return jsonify({"error": "tariff_rate must be between 0 and 100 Rs/kWh"}), 400
            plant.tariff_rate = tariff
        if "band_pct" in body:
            band = body["band_pct"]
            if band is None:          # back to the regulator default
                plant.band_pct = None
            else:
                band = _finite(band)
                if band is None:
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
    if len(p.name) > MAX_NAME:
        return f"name must be {MAX_NAME} characters or fewer"
    if not (-90 <= p.latitude <= 90 and -180 <= p.longitude <= 180):
        return "latitude or longitude is out of range"
    if not 0 < p.capacity_kw < 10_000_000:
        return "capacity_kw must be between 0 and 10,000,000"
    if p.plant_type not in ("solar", "wind"):
        return "plant_type must be solar or wind"
    if p.owner_type not in ("utility", "distributed"):
        return "owner_type must be utility or distributed"
    if not 0 < (p.tariff_rate or 0) < 100:
        return "tariff_rate must be between 0 and 100 Rs/kWh"
    return None
