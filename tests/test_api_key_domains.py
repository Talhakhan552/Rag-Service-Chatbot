"""
Domain lock: a key with allowed_domains only works when the browser's
Origin matches one of them, so other websites can't embed it.
"""


async def _setup(client, allowed_domains):
    await client.post("/api/v1/auth/register", json={"email": "dom@example.com", "password": "testpass123"})
    token = (await client.post("/api/v1/auth/login", json={"email": "dom@example.com", "password": "testpass123"})).json()["access_token"]
    auth = {"Authorization": f"Bearer {token}"}
    ws = (await client.post("/api/v1/workspaces", json={"name": "Dom Co"}, headers=auth)).json()["id"]
    res = await client.post(f"/api/v1/workspaces/{ws}/api-keys", json={"name": "w", "allowed_domains": allowed_domains}, headers=auth)
    assert res.status_code == 201
    return ws, res.json()


async def _list(client, ws, key, origin=None):
    headers = {"X-API-Key": key}
    if origin:
        headers["Origin"] = origin
    return await client.get(f"/api/v1/workspaces/{ws}/chat/sessions", headers=headers)


async def test_domains_are_normalized_to_hostnames(client):
    _, body = await _setup(client, ["https://Shop.example.com/page", " example.com ", ""])
    assert body["allowed_domains"] == ["example.com", "shop.example.com"]


async def test_locked_key_only_works_from_allowed_origin(client):
    ws, body = await _setup(client, ["example.com"])
    key = body["key"]
    assert (await _list(client, ws, key, "https://example.com")).status_code == 200
    assert (await _list(client, ws, key, "https://evil.com")).status_code == 403
    assert (await _list(client, ws, key, "https://example.com.evil.com")).status_code == 403
    assert (await _list(client, ws, key)).status_code == 403


async def test_unlocked_key_works_without_origin(client):
    ws, body = await _setup(client, [])
    assert (await _list(client, ws, body["key"])).status_code == 200


async def test_new_keys_do_not_use_stripe_prefix(client):
    # sk_live_ matches Stripe's secret-key pattern and trips GitHub secret scanning.
    _, body = await _setup(client, [])
    assert body["key"].startswith("cx_pub_")
    assert body["key_prefix"].startswith("cx_pub_")
