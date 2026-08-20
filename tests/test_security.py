import uuid

import pytest

from app.core.security import create_access_token, decode_access_token, hash_password, verify_password


def test_password_hash_roundtrip():
    hashed = hash_password("mypassword123")
    assert verify_password("mypassword123", hashed)
    assert not verify_password("wrongpassword", hashed)


def test_password_hash_is_not_the_plaintext():
    hashed = hash_password("mypassword123")
    assert hashed != "mypassword123"


def test_jwt_roundtrip():
    user_id = uuid.uuid4()
    token = create_access_token(user_id)
    assert decode_access_token(token) == user_id


def test_jwt_rejects_garbage_token():
    with pytest.raises(ValueError):
        decode_access_token("not.a.real.token")


def test_jwt_rejects_tampered_token():
    user_id = uuid.uuid4()
    token = create_access_token(user_id)
    tampered = token[:-1] + ("A" if token[-1] != "A" else "B")
    with pytest.raises(ValueError):
        decode_access_token(tampered)