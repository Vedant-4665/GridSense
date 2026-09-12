"""GridSense API entry point."""
from datetime import timedelta

from flask import Flask, jsonify
from flask_cors import CORS

import config
from models import init_db
from routes import alerts, auth, dashboard, diagnostics, forecast, insights, plants


def create_app():
    app = Flask(__name__)
    app.config.update(
        SECRET_KEY=config.SECRET_KEY,
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=config.SESSION_COOKIE_SECURE,
        PERMANENT_SESSION_LIFETIME=timedelta(days=config.SESSION_DAYS),
    )
    CORS(app)
    init_db()

    app.before_request(auth.require_login)
    for module in (auth, plants, forecast, alerts, dashboard, diagnostics, insights):
        app.register_blueprint(module.bp)

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok", "service": "gridsense"})

    return app


if __name__ == "__main__":
    create_app().run(debug=True, port=config.API_PORT)
