from flask import Blueprint, jsonify, request

from models import DeviationAlert, get_session

bp = Blueprint("alerts", __name__, url_prefix="/api/alerts")


@bp.get("")
def list_alerts():
    status = request.args.get("status")
    with get_session() as s:
        q = s.query(DeviationAlert)
        if status:
            q = q.filter_by(status=status)
        rows = q.order_by(DeviationAlert.est_revenue_loss.desc()).all()
        return jsonify([a.to_dict() for a in rows])


@bp.patch("/<int:alert_id>")
def update_alert(alert_id):
    body = request.get_json(force=True) or {}
    new_status = body.get("status")
    if new_status not in {"open", "ack", "resolved"}:
        return jsonify({"error": "status must be open, ack or resolved"}), 400

    with get_session() as s:
        alert = s.get(DeviationAlert, alert_id)
        if not alert:
            return jsonify({"error": "Alert not found"}), 404
        alert.status = new_status
        s.commit()
        return jsonify(alert.to_dict())
