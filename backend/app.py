"""GridSense API entry point."""
import os
import socket
import sys
from datetime import timedelta

from flask import Flask, jsonify
from flask_cors import CORS

import config
from models import init_db
from routes import alerts, auth, dashboard, diagnostics, forecast, insights, plants, weather


def create_app():
    app = Flask(__name__)
    app.config.update(
        SECRET_KEY=config.SECRET_KEY,
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=config.SESSION_COOKIE_SECURE,
        PERMANENT_SESSION_LIFETIME=timedelta(days=config.SESSION_DAYS),
        # No endpoint here takes an upload; this stops oversized bodies early.
        MAX_CONTENT_LENGTH=256 * 1024,
    )
    CORS(app)
    init_db()

    app.before_request(auth.require_login)
    for module in (auth, plants, forecast, alerts, dashboard, diagnostics, insights, weather):
        app.register_blueprint(module.bp)

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok", "service": "gridsense"})

    return app


def _already_answering(port: int) -> bool:
    """
    True when something else is already serving this port. On macOS that is
    usually AirPlay Receiver on 5000, which answers requests the app never
    sees — half the traffic reaches Flask, half reaches AirPlay, and the app
    looks broken for no visible reason.
    """
    for family, address in ((socket.AF_INET, "127.0.0.1"), (socket.AF_INET6, "::1")):
        try:
            with socket.socket(family, socket.SOCK_STREAM) as probe:
                probe.settimeout(0.4)
                if probe.connect_ex((address, port)) == 0:
                    return True
        except OSError:
            continue
    return False


if __name__ == "__main__":
    # The reloader re-runs this file in a child process; only the parent checks.
    if not os.environ.get("WERKZEUG_RUN_MAIN") and _already_answering(config.API_PORT):
        sys.exit(
            f"\nPort {config.API_PORT} is already answering, so GridSense would only receive "
            f"some of the traffic.\n"
            f"On macOS this is usually AirPlay Receiver (System Settings -> General -> "
            f"AirDrop & Handoff).\n\n"
            f"Either turn that off, or run both halves on another port:\n"
            f"  API_PORT=5001 python app.py\n"
            f"  API_PORT=5001 npm run dev\n"
        )
    create_app().run(debug=True, port=config.API_PORT)
