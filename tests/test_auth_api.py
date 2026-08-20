"""
Integration tests -- real HTTP requests through the full app, against
a real Postgres (see conftest.py for isolation strategy). These catch
what unit tests can't: wiring bugs, wrong status codes, serialization
mismatches between the DB model and the response schema.
"""


async def test_register_returns_user(client):
    res = await client.post(
        "/api/v1/auth/register", json={"email": "alice@example.com", "password": "testpass123"}
    )
    assert res.status_code == 201
    body = res.json()
    assert body["email"] == "alice@example.com"
    assert "hashed_password" not in body


async def test_register_duplicate_email_rejected(client):
    await client.post("/api/v1/auth/register", json={"email": "bob@example.com", "password": "testpass123"})
    res = await client.post("/api/v1/auth/register", json={"email": "bob@example.com", "password": "testpass123"})
    assert res.status_code == 409


async def test_login_with_correct_credentials(client):
    await client.post("/api/v1/auth/register", json={"email": "carol@example.com", "password": "testpass123"})
    res = await client.post("/api/v1/auth/login", json={"email": "carol@example.com", "password": "testpass123"})
    assert res.status_code == 200
    body = res.json()
    assert "access_token" in body
    assert "refresh_token" in body


async def test_login_with_wrong_password_rejected(client):
    await client.post("/api/v1/auth/register", json={"email": "dave@example.com", "password": "testpass123"})
    res = await client.post("/api/v1/auth/login", json={"email": "dave@example.com", "password": "wrongpass"})
    assert res.status_code == 401


async def test_me_requires_authentication(client):
    res = await client.get("/api/v1/auth/me")
    # HTTPBearer's exact status code for a missing (vs invalid) header
    # has varied across FastAPI/Starlette versions -- 403 here matches
    # this project's pinned fastapi==0.115.0.
    assert res.status_code == 403

async def test_me_returns_current_user_with_valid_token(client):
    await client.post("/api/v1/auth/register", json={"email": "erin@example.com", "password": "testpass123"})
    login_res = await client.post("/api/v1/auth/login", json={"email": "erin@example.com", "password": "testpass123"})
    token = login_res.json()["access_token"]

    res = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json()["email"] == "erin@example.com"


async def test_refresh_rotates_token_and_invalidates_old_one(client):
    await client.post("/api/v1/auth/register", json={"email": "frank@example.com", "password": "testpass123"})
    login_res = await client.post("/api/v1/auth/login", json={"email": "frank@example.com", "password": "testpass123"})
    old_refresh = login_res.json()["refresh_token"]

    refresh_res = await client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
    assert refresh_res.status_code == 200

    reuse_res = await client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
    assert reuse_res.status_code == 401