from conftest import PASSWORD, sign_in
import config


def test_health_needs_no_login(client):
    assert client.get("/api/health").status_code == 200


def test_everything_else_does(client):
    for path in ("/api/plants", "/api/dashboard/summary", "/api/alerts", "/api/auth/me",
                 "/api/model", "/api/settings", "/api/weather/current?latitude=23&longitude=72"):
        response = client.get(path)
        assert response.status_code == 401, path
        assert response.get_json()["error"] == "Login required"


def test_demo_login_then_me(client):
    account = sign_in(client, "utility")
    assert account["role"] == "utility"
    assert client.get("/api/auth/me").get_json()["email"] == account["email"]


def test_demo_login_can_be_turned_off(client, monkeypatch):
    monkeypatch.setattr(config, "DEMO_LOGIN", False)
    assert client.post("/api/auth/demo", json={"role": "utility"}).status_code == 404


def test_password_login_and_wrong_password(client):
    email = config.DEMO_EMAIL.format(role="utility")
    assert client.post("/api/auth/login", json={"email": email, "password": PASSWORD}).status_code == 200
    client.post("/api/auth/logout")
    bad = client.post("/api/auth/login", json={"email": email, "password": "wrong"})
    assert bad.status_code == 401
    assert bad.get_json()["error"] == "Incorrect email or password"


def test_unknown_email_gives_the_same_message(client):
    response = client.post("/api/auth/login", json={"email": "nobody@example.com", "password": "x"})
    assert response.status_code == 401
    assert response.get_json()["error"] == "Incorrect email or password"


def test_logout_ends_the_session(client):
    sign_in(client)
    client.post("/api/auth/logout")
    assert client.get("/api/auth/me").status_code == 401


def test_registration_validation(client):
    cases = [
        ({"email": "nope", "password": "longenough", "name": "A", "role": "utility"}, "email"),
        ({"email": "a@b.co", "password": "short", "name": "A", "role": "utility"}, "Password"),
        ({"email": "a@b.co", "password": "longenough", "name": "", "role": "utility"}, "Name"),
        ({"email": "a@b.co", "password": "longenough", "name": "A", "role": "wizard"}, "role"),
    ]
    for payload, expected in cases:
        response = client.post("/api/auth/register", json=payload)
        assert response.status_code == 400
        assert expected in response.get_json()["error"]


def test_duplicate_registration_is_refused(client):
    payload = {"email": "asha@example.com", "password": "longenough", "name": "Asha", "role": "utility"}
    assert client.post("/api/auth/register", json=payload).status_code == 201
    client.post("/api/auth/logout")
    assert client.post("/api/auth/register", json=payload).status_code == 409
