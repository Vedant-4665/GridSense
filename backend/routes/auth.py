"""
Customer accounts, and the access rules every other route relies on.

The session is Flask's signed cookie (HttpOnly, SameSite=Lax) holding the user
id and that user's current session token.
"""
import re

from flask import Blueprint, g, jsonify, request, session
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash

import config
from models import OWNER_ROLES, ROLES, Plant, User, get_session, new_session_token

bp = Blueprint("auth", __name__, url_prefix="/api/auth")

PUBLIC_ENDPOINTS = {"health", "auth.register", "auth.login", "auth.logout", "auth.demo_login"}
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Checked when the email is unknown, so a failed login takes as long whether
# or not the account exists.
_DUMMY_HASH = generate_password_hash("gridsense-timing-equaliser")


# --- Access rules ------------------------------------------------------------

def require_login():
    """Runs before every request. Everything under /api is private unless in PUBLIC_ENDPOINTS."""
    if (request.method == "OPTIONS" or not request.path.startswith("/api/")
            or request.endpoint in PUBLIC_ENDPOINTS):
        return None
    user = _session_user()
    if user is None:
        session.clear()
        return jsonify({"error": "Login required"}), 401
    g.user = user
    return None


def visible_plants(s):
    """Plants the current user may see: their own, or all of them for operators and traders."""
    q = s.query(Plant)
    return q.filter(Plant.owner_id == g.user.id) if g.user.role in OWNER_ROLES else q


def visible_plant(s, plant_id):
    """The plant, or None if it doesn't exist or isn't visible. Callers answer 404 either way."""
    return visible_plants(s).filter(Plant.id == plant_id).first()


def visible_plant_ids(s) -> list[int]:
    return [pid for (pid,) in visible_plants(s).with_entities(Plant.id)]


def can_act_on(plant) -> bool:
    """Only a plant's owner changes it: runs its forecast, updates its alerts."""
    return g.user.role in OWNER_ROLES and plant.owner_id == g.user.id


# --- Endpoints ---------------------------------------------------------------

@bp.post("/register")
def register():
    body = request.get_json(silent=True) or {}
    email = str(body.get("email", "")).strip().lower()
    password = str(body.get("password", ""))
    name = str(body.get("name", "")).strip()
    organisation = str(body.get("organisation", "")).strip() or None
    role = body.get("role")

    if not EMAIL_RE.match(email):
        return _bad("Enter a valid email address")
    if len(password) < config.MIN_PASSWORD_LENGTH:
        return _bad(f"Password must be at least {config.MIN_PASSWORD_LENGTH} characters")
    if not name:
        return _bad("Name is required")
    if not isinstance(role, str) or role not in ROLES:
        return _bad(f"role must be one of {', '.join(ROLES)}")

    with get_session() as s:
        user = User(email=email, password_hash=generate_password_hash(password), name=name,
                    organisation=organisation, role=role, session_token=new_session_token())
        s.add(user)
        try:
            s.commit()
        except IntegrityError:
            return jsonify({"error": "An account with this email already exists"}), 409
        _start_session(user)
        return jsonify(user.to_dict()), 201


@bp.post("/login")
def login():
    body = request.get_json(silent=True) or {}
    email = str(body.get("email", "")).strip().lower()
    password = str(body.get("password", ""))

    with get_session() as s:
        user = s.query(User).filter_by(email=email).first()
    password_ok = check_password_hash(user.password_hash if user else _DUMMY_HASH, password)
    if not (user and password_ok):
        return jsonify({"error": "Incorrect email or password"}), 401
    _start_session(user)
    return jsonify(user.to_dict())


@bp.post("/logout")
def logout():
    """Ends the session on every device, by rotating the user's session token."""
    user = _session_user()
    if user:
        with get_session() as s:
            s.get(User, user.id).session_token = new_session_token()
            s.commit()
    session.clear()
    return jsonify({"status": "logged_out"})


@bp.get("/me")
def me():
    return jsonify(g.user.to_dict())


@bp.post("/demo")
def demo_login():
    """One-click login as the seeded demo account for a role. Off unless DEMO_LOGIN."""
    if not config.DEMO_LOGIN:
        return jsonify({"error": "Not found"}), 404
    role = (request.get_json(silent=True) or {}).get("role", "utility")
    if not isinstance(role, str) or role not in ROLES:
        return _bad(f"role must be one of {', '.join(ROLES)}")

    with get_session() as s:
        user = s.query(User).filter_by(email=config.DEMO_EMAIL.format(role=role)).first()
    if not user:
        return jsonify({"error": "Demo accounts missing. Run: python seed.py"}), 404
    _start_session(user)
    return jsonify(user.to_dict())


# --- Helpers -----------------------------------------------------------------

def _session_user():
    user_id, token = session.get("user_id"), session.get("token")
    if user_id is None or token is None:
        return None
    with get_session() as s:
        user = s.get(User, user_id)
    return user if user and user.session_token == token else None


def _start_session(user):
    session.clear()
    session.permanent = True
    session["user_id"] = user.id
    session["token"] = user.session_token


def _bad(message):
    return jsonify({"error": message}), 400
