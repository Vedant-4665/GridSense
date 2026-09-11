from flask import Blueprint, jsonify

from models import Asset, DeviationAlert, Recommendation, get_session
from routes.auth import visible_plant_ids

bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")


@bp.get("/summary")
def summary():
    """Single call for every KPI on the overview page — avoids a request waterfall."""
    with get_session() as s:
        plant_ids = visible_plant_ids(s)
        recs = s.query(Recommendation).filter(Recommendation.plant_id.in_(plant_ids)).all()
        alerts = (s.query(DeviationAlert).join(Asset)
                   .filter(Asset.plant_id.in_(plant_ids), DeviationAlert.status == "open")
                   .all())
        return jsonify({
            "plants": len(plant_ids),
            "flagged_windows": len(recs),
            "total_exposure_inr": round(sum(r.exposure_inr or 0 for r in recs), 2),
            "open_alerts": len(alerts),
            "revenue_at_risk_inr": round(sum(a.est_revenue_loss or 0 for a in alerts), 2),
        })
