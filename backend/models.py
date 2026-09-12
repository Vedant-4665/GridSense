"""SQLAlchemy models. One table per concept described in the ideation document."""
import secrets
from datetime import datetime, timezone

from sqlalchemy import (
    Column, DateTime, Float, ForeignKey, Integer, String, create_engine,
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

import config

Base = declarative_base()
engine = create_engine(config.DATABASE_URL, future=True)
SessionLocal = sessionmaker(bind=engine, future=True, expire_on_commit=False)


def _now():
    return datetime.now(timezone.utc)


def _round(value, digits=2):
    """Round for JSON. Keeps 0.0 as 0.0, where a truthiness check would turn it into null."""
    return round(value, digits) if value is not None else None


# Customer roles. Owners see and act on their own plants; grid operators and
# traders see every plant, read-only.
ROLES = {
    "plant_owner": "Renewable plant owner",
    "utility": "Utility company",
    "grid_operator": "Grid operator",
    "trader": "Energy trader",
}
OWNER_ROLES = {"plant_owner", "utility"}


def new_session_token():
    return secrets.token_hex(16)


class User(Base):
    """A customer account."""
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String(254), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(120), nullable=False)
    organisation = Column(String(120))
    role = Column(String(24), nullable=False)   # see ROLES
    # Copied into the session cookie and checked on every request. Rotating it
    # on logout invalidates every cookie ever issued to this user.
    session_token = Column(String(32), nullable=False, default=new_session_token)
    created_at = Column(DateTime, default=_now)

    plants = relationship("Plant", back_populates="owner")

    def to_dict(self):
        return {
            "id": self.id, "email": self.email, "name": self.name,
            "organisation": self.organisation, "role": self.role,
        }


class Plant(Base):
    __tablename__ = "plants"
    id = Column(Integer, primary_key=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    name = Column(String(120), nullable=False)
    location = Column(String(120))
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    capacity_kw = Column(Float, nullable=False)
    plant_type = Column(String(16), nullable=False, default="solar")   # solar | wind
    owner_type = Column(String(16), nullable=False, default="utility")  # utility | distributed
    tariff_rate = Column(Float, default=config.DEFAULT_RETAIL_TARIFF)
    # Null means "use the regulator default for this technology".
    band_pct = Column(Float)

    owner = relationship("User", back_populates="plants")
    assets = relationship("Asset", back_populates="plant")

    def to_dict(self):
        return {
            "id": self.id, "name": self.name, "location": self.location,
            "latitude": self.latitude, "longitude": self.longitude,
            "capacity_kw": self.capacity_kw, "plant_type": self.plant_type,
            "owner_type": self.owner_type, "tariff_rate": self.tariff_rate,
            # Always the band in force for this plant, default or overridden.
            "band_pct": self.effective_band_pct,
            "band_is_custom": self.band_pct is not None,
        }

    @property
    def effective_band_pct(self) -> float:
        if self.band_pct is not None:
            return self.band_pct
        return config.TOLERANCE_BAND.get(self.plant_type, 0.05) * 100


class Asset(Base):
    __tablename__ = "assets"
    id = Column(Integer, primary_key=True)
    plant_id = Column(Integer, ForeignKey("plants.id"), nullable=False)
    source_key = Column(String(64), nullable=False)   # inverter id from source data
    asset_name = Column(String(120))
    capacity_kw = Column(Float)
    status = Column(String(16), default="healthy")    # healthy | watch | alert

    plant = relationship("Plant", back_populates="assets")

    def to_dict(self):
        return {
            "id": self.id, "plant_id": self.plant_id, "source_key": self.source_key,
            "asset_name": self.asset_name, "capacity_kw": self.capacity_kw,
            "status": self.status,
        }


class GenerationReading(Base):
    __tablename__ = "generation_readings"
    id = Column(Integer, primary_key=True)
    plant_id = Column(Integer, ForeignKey("plants.id"), nullable=False, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    dc_power = Column(Float)
    ac_power = Column(Float)
    daily_yield = Column(Float)
    total_yield = Column(Float)


class WeatherReading(Base):
    __tablename__ = "weather_readings"
    id = Column(Integer, primary_key=True)
    plant_id = Column(Integer, ForeignKey("plants.id"), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    ambient_temp = Column(Float)
    module_temp = Column(Float)
    irradiation = Column(Float)
    cloud_cover = Column(Float)
    wind_speed = Column(Float)
    source = Column(String(16), default="sensor")   # sensor | api


class Forecast(Base):
    __tablename__ = "forecasts"
    id = Column(Integer, primary_key=True)
    plant_id = Column(Integer, ForeignKey("plants.id"), nullable=False, index=True)
    generated_at = Column(DateTime, default=_now)
    target_timestamp = Column(DateTime, nullable=False, index=True)
    horizon_hours = Column(Integer)
    predicted_kw = Column(Float, nullable=False)
    scheduled_kw = Column(Float)
    confidence_low = Column(Float)
    confidence_high = Column(Float)
    model_version = Column(String(32), default="v1")

    def to_dict(self):
        return {
            "target_timestamp": self.target_timestamp.isoformat(),
            "predicted_kw": _round(self.predicted_kw),
            "scheduled_kw": _round(self.scheduled_kw),
            "confidence_low": _round(self.confidence_low),
            "confidence_high": _round(self.confidence_high),
            "horizon_hours": self.horizon_hours,
        }


class Recommendation(Base):
    """A costed grid action for one flagged window."""
    __tablename__ = "recommendations"
    id = Column(Integer, primary_key=True)
    plant_id = Column(Integer, ForeignKey("plants.id"), nullable=False, index=True)
    window_start = Column(DateTime, nullable=False)
    window_end = Column(DateTime, nullable=False)
    window_type = Column(String(16))        # over | under
    action_type = Column(String(24))        # curtail | dispatch_storage | activate_backup | revise_schedule
    severity = Column(String(16))           # low | medium | high
    deviation_pct = Column(Float)
    expected_delta_kwh = Column(Float)
    exposure_inr = Column(Float)
    message = Column(String(400))

    def to_dict(self):
        return {
            "id": self.id, "plant_id": self.plant_id,
            "window_start": self.window_start.isoformat(),
            "window_end": self.window_end.isoformat(),
            "window_type": self.window_type, "action_type": self.action_type,
            "severity": self.severity,
            "deviation_pct": _round(self.deviation_pct),
            "expected_delta_kwh": _round(self.expected_delta_kwh),
            "exposure_inr": _round(self.exposure_inr),
            "message": self.message,
        }


class DeviationAlert(Base):
    """Site-level flag where actual diverges from forecast with no weather explanation."""
    __tablename__ = "deviation_alerts"
    id = Column(Integer, primary_key=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False, index=True)
    detected_at = Column(DateTime, default=_now)
    window_start = Column(DateTime)
    window_end = Column(DateTime)
    deviation_pct = Column(Float)
    suspected_cause = Column(String(64))    # soiling | degradation | unknown
    severity = Column(String(16))
    est_loss_kwh = Column(Float)
    est_revenue_loss = Column(Float)
    status = Column(String(16), default="open")   # open | ack | resolved

    def to_dict(self):
        return {
            "id": self.id, "asset_id": self.asset_id,
            "detected_at": self.detected_at.isoformat() if self.detected_at else None,
            "window_start": self.window_start.isoformat() if self.window_start else None,
            "window_end": self.window_end.isoformat() if self.window_end else None,
            "deviation_pct": _round(self.deviation_pct),
            "suspected_cause": self.suspected_cause, "severity": self.severity,
            "est_loss_kwh": _round(self.est_loss_kwh),
            "est_revenue_loss": _round(self.est_revenue_loss),
            "status": self.status,
        }


def init_db():
    Base.metadata.create_all(engine)


def get_session():
    return SessionLocal()
