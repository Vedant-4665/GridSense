"""
Forecast-deviation diagnostic.

Where actual generation sits persistently below forecast on clear-sky periods
with no meteorological explanation, the site is flagged. Uses only forecast and
generation data already held by the platform. No sensor hardware required.
"""
from datetime import timedelta

CLEAR_SKY_IRRADIATION = 0.45     # threshold above which weather is not the explanation
SUSTAINED_GAP_PCT = 8.0          # gap below which we assume normal model error
MIN_CONSECUTIVE_BLOCKS = 8       # ~2 hours at 15-minute resolution


def analyse(paired_readings: list[dict]) -> list[dict]:
    """
    paired_readings: [{timestamp, predicted_kw, actual_kw, irradiation}, ...]
    Returns candidate alerts. TODO(hackathon): tune thresholds against seed data.
    """
    alerts, run = [], []

    for row in paired_readings:
        if row.get("irradiation", 0) < CLEAR_SKY_IRRADIATION or not row.get("predicted_kw"):
            run = []
            continue

        gap_pct = (row["predicted_kw"] - row["actual_kw"]) / row["predicted_kw"] * 100
        if gap_pct >= SUSTAINED_GAP_PCT:
            run.append({**row, "gap_pct": gap_pct})
        else:
            if len(run) >= MIN_CONSECUTIVE_BLOCKS:
                alerts.append(_build_alert(run))
            run = []

    if len(run) >= MIN_CONSECUTIVE_BLOCKS:
        alerts.append(_build_alert(run))

    return alerts


def _build_alert(run: list[dict]) -> dict:
    avg_gap = sum(r["gap_pct"] for r in run) / len(run)
    lost_kwh = sum((r["predicted_kw"] - r["actual_kw"]) * 0.25 for r in run)
    return {
        "window_start": run[0]["timestamp"],
        "window_end": run[-1]["timestamp"],
        "deviation_pct": round(avg_gap, 2),
        # Gradual and clear-sky-persistent is the soiling signature.
        "suspected_cause": "soiling" if avg_gap < 20 else "degradation",
        "severity": "high" if avg_gap >= 15 else "medium",
        "est_loss_kwh": round(lost_kwh, 2),
    }
