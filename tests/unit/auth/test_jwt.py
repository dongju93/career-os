from career_os_api.auth.jwt import create_access_token, decode_access_token


def test_create_and_decode_token():
    token = create_access_token(data={"sub": "test-user-id"})
    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == "test-user-id"
    assert "iat" in payload
    assert "exp" in payload


def test_decode_invalid_token_returns_none():
    payload = decode_access_token("invalid.token.here")
    assert payload is None


def test_decode_tampered_token_returns_none():
    token = create_access_token(data={"sub": "user-1"})
    payload = decode_access_token(token + "tampered")
    assert payload is None
