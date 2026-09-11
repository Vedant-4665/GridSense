from flask import Blueprint, jsonify

from models import DeviationAlert, Plant, Recommendation, get_session

bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")


@bp.get("/summary")
def summary():
    """Single call for every KPI on the overview page — avoids a request waterfall."""
    with get_session() as s:
        recs = s.query(Recommendation).all()
        alerts = s.query(DeviationAlert).filter_by(status="open").all()
        return jsonify({
            "plants": s.query(Plant).count(),
            "flagged_windows": len(recs),
            "total_exposure_inr": round(sum(r.exposure_inr or 0 for r in recs), 2),
            "open_alerts": len(alerts),
            "revenue_at_risk_inr": round(sum(a.est_revenue_loss or 0 for a in alerts), 2),
        })
