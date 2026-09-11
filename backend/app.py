"""GridSense API entry point."""
from flask import Flask, jsonify
from flask_cors import CORS

from models import init_db
from routes import alerts, dashboard, forecast, plants


def create_app():
    app = Flask(__name__)
    CORS(app)
    init_db()

    for module in (plants, forecast, alerts, dashboard):
        app.register_blueprint(module.bp)

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok", "service": "gridsense"})

    return app


if __name__ == "__main__":
    create_app().run(debug=True, port=5000)
