"""
Deviation costing.

Deliberately rule-based and deterministic, not learned: regulatory arithmetic
must be reproducible and inspectable. Every number here traces to config.py.
"""
import config


def tolerance_band(plant_type: str, override: float | None = None) -> float:
    """Fraction of scheduled generation allowed before charges start."""
    if override is not None:
        return override
    return config.TOLERANCE_BAND.get(plant_type, 0.05)


def slab_rate(abs_error_fraction: float) -> float:
    """Rupees per unit for a given absolute error fraction."""
    for upper, rate in config.DEVIATION_SLABS:
        if abs_error_fraction <= upper:
            return rate
    return config.DEVIATION_SLABS[-1][1]


def block_exposure(scheduled_kwh: float, forecast_kwh: float, plant_type: str = "solar",
                   band: float | None = None) -> dict:
    """
    Exposure for one settlement block.

    Only the deviation *beyond* the tolerance band is chargeable. Returns the
    full working so the UI can show the operator how the figure was reached.
    """
    if not scheduled_kwh:
        return {"breached": False, "exposure_inr": 0.0, "deviation_pct": 0.0}

    deviation_kwh = forecast_kwh - scheduled_kwh
    error_fraction = abs(deviation_kwh) / scheduled_kwh
    band = tolerance_band(plant_type, band)

    direction = "under" if deviation_kwh < 0 else "over"
    if error_fraction <= band:
        return {
            "breached": False, "exposure_inr": 0.0,
            "deviation_pct": round(error_fraction * 100, 2),
            "band_pct": round(band * 100, 2),
            "direction": direction,
            # Surplus earns nothing when the grid is already at or above
            # OVER_INJECTION_FREQ_HZ, whether or not the band is breached.
            "over_injection_risk": direction == "over",
        }

    chargeable_kwh = (error_fraction - band) * scheduled_kwh
    rate = slab_rate(error_fraction)

    return {
        "breached": True,
        "deviation_pct": round(error_fraction * 100, 2),
        "band_pct": round(band * 100, 2),
        "direction": direction,
        "over_injection_risk": direction == "over",
        "chargeable_units": round(chargeable_kwh, 2),
        "rate_per_unit": rate,
        "exposure_inr": round(chargeable_kwh * rate, 2),
    }


def recommend_action(result: dict) -> tuple[str, str]:
    """Map a costed block to a grid action and an operator-facing message."""
    if not result.get("breached"):
        return "none", "Within tolerance band. No action needed."

    if result["direction"] == "under":
        return (
            "dispatch_storage",
            f"Under-generation of {result['deviation_pct']}% projected against a "
            f"{result['band_pct']}% band. Exposure Rs {result['exposure_inr']}. "
            "Revise the schedule down before gate closure, or discharge storage to cover the shortfall.",
        )
    return (
        "curtail",
        f"Over-generation of {result['deviation_pct']}% projected against a "
        f"{result['band_pct']}% band. Exposure Rs {result['exposure_inr']}. "
        "Surplus may be unremunerated if frequency is at or above "
        f"{config.OVER_INJECTION_FREQ_HZ} Hz. Curtail or charge storage.",
    )


def severity_for(deviation_pct: float) -> str:
    if deviation_pct >= 15:
        return "high"
    if deviation_pct >= 10:
        return "medium"
    return "low"
