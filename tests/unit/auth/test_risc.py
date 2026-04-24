import time
from typing import Any

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from jose import jwt as jose_jwt
from jose.backends import RSAKey
from jose.constants import ALGORITHMS

import career_os_api.auth.risc as risc_module
from career_os_api.auth.risc import (
    EVENT_ACCOUNT_DISABLED,
    EVENT_VERIFICATION,
    RiscVerificationError,
    verify_risc_set,
)
from career_os_api.config import settings


def _generate_keypair() -> tuple[str, dict[str, Any]]:
    """Return (private PEM string, public JWK dict with a `kid`)."""
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("ascii")
    public_pem = (
        private_key.public_key()
        .public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        .decode("ascii")
    )
    public_jwk = RSAKey(public_pem, ALGORITHMS.RS256).to_dict()
    public_jwk["kid"] = "test-kid-1"
    return private_pem, public_jwk


def _sign(
    private_pem: str,
    payload: dict[str, Any],
    *,
    kid: str = "test-kid-1",
) -> str:
    return jose_jwt.encode(
        payload,
        private_pem,
        algorithm="RS256",
        headers={"kid": kid},
    )


def _base_payload(event_type: str, body: dict[str, Any]) -> dict[str, Any]:
    return {
        "iss": settings.google_risc_issuer,
        "aud": settings.risc_audience,
        "iat": int(time.time()) - 10,
        "jti": "jti-abc-123",
        "events": {event_type: body},
    }


@pytest.fixture
def signing_pair(monkeypatch: pytest.MonkeyPatch) -> tuple[str, dict[str, Any]]:
    private_pem, public_jwk = _generate_keypair()
    risc_module._jwks_state["keys"] = [public_jwk]
    risc_module._jwks_state["fetched_at"] = time.monotonic()
    yield private_pem, public_jwk
    risc_module.invalidate_jwks_cache()


async def test_verify_risc_set_accepts_valid_account_disabled_event(
    signing_pair: tuple[str, dict[str, Any]],
) -> None:
    private_pem, _ = signing_pair
    payload = _base_payload(
        EVENT_ACCOUNT_DISABLED,
        {
            "subject": {
                "subject_type": "iss-sub",
                "iss": settings.google_risc_issuer,
                "sub": "google-user-xyz",
            },
            "reason": "hijacking",
        },
    )
    token = _sign(private_pem, payload)

    event = await verify_risc_set(token)

    assert event.event_type == EVENT_ACCOUNT_DISABLED
    assert event.google_id == "google-user-xyz"
    assert event.reason == "hijacking"
    assert event.jti == "jti-abc-123"
    assert event.state is None


async def test_verify_risc_set_accepts_verification_event_without_subject(
    signing_pair: tuple[str, dict[str, Any]],
) -> None:
    private_pem, _ = signing_pair
    payload = _base_payload(EVENT_VERIFICATION, {"state": "check-123"})
    token = _sign(private_pem, payload)

    event = await verify_risc_set(token)

    assert event.event_type == EVENT_VERIFICATION
    assert event.google_id is None
    assert event.state == "check-123"


async def test_verify_risc_set_rejects_wrong_issuer(
    signing_pair: tuple[str, dict[str, Any]],
) -> None:
    private_pem, _ = signing_pair
    payload = _base_payload(
        EVENT_ACCOUNT_DISABLED,
        {"subject": {"sub": "user-1"}},
    )
    payload["iss"] = "https://attacker.example.com"
    token = _sign(private_pem, payload)

    with pytest.raises(RiscVerificationError):
        await verify_risc_set(token)


async def test_verify_risc_set_rejects_wrong_audience(
    signing_pair: tuple[str, dict[str, Any]],
) -> None:
    private_pem, _ = signing_pair
    payload = _base_payload(
        EVENT_ACCOUNT_DISABLED,
        {"subject": {"sub": "user-1"}},
    )
    payload["aud"] = "some-other-client-id"
    token = _sign(private_pem, payload)

    with pytest.raises(RiscVerificationError):
        await verify_risc_set(token)


async def test_verify_risc_set_rejects_bad_signature(
    signing_pair: tuple[str, dict[str, Any]],
) -> None:
    _, _ = signing_pair
    other_private_pem, _ = _generate_keypair()
    payload = _base_payload(
        EVENT_ACCOUNT_DISABLED,
        {"subject": {"sub": "user-1"}},
    )
    # Sign with a different key but claim the cached kid.
    token = _sign(other_private_pem, payload)

    with pytest.raises(RiscVerificationError):
        await verify_risc_set(token)


async def test_verify_risc_set_rejects_unknown_kid(
    signing_pair: tuple[str, dict[str, Any]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    private_pem, _ = signing_pair
    # Simulate a forced-refresh that still does not return a matching key.

    async def fake_fetch() -> list[dict[str, Any]]:
        return []

    monkeypatch.setattr(risc_module, "_fetch_jwks", fake_fetch)
    payload = _base_payload(
        EVENT_ACCOUNT_DISABLED,
        {"subject": {"sub": "user-1"}},
    )
    token = _sign(private_pem, payload, kid="unknown-kid")

    with pytest.raises(RiscVerificationError, match="No JWKS key matches kid"):
        await verify_risc_set(token)


async def test_verify_risc_set_rejects_future_iat(
    signing_pair: tuple[str, dict[str, Any]],
) -> None:
    private_pem, _ = signing_pair
    payload = _base_payload(
        EVENT_ACCOUNT_DISABLED,
        {"subject": {"sub": "user-1"}},
    )
    payload["iat"] = int(time.time()) + 10_000  # way beyond skew
    token = _sign(private_pem, payload)

    with pytest.raises(RiscVerificationError, match="too far in the future"):
        await verify_risc_set(token)


async def test_verify_risc_set_rejects_multi_event_payload(
    signing_pair: tuple[str, dict[str, Any]],
) -> None:
    private_pem, _ = signing_pair
    payload = _base_payload(
        EVENT_ACCOUNT_DISABLED,
        {"subject": {"sub": "user-1"}},
    )
    payload["events"][EVENT_VERIFICATION] = {"state": "x"}
    token = _sign(private_pem, payload)

    with pytest.raises(RiscVerificationError, match="exactly one"):
        await verify_risc_set(token)


async def test_verify_risc_set_rejects_missing_jti(
    signing_pair: tuple[str, dict[str, Any]],
) -> None:
    private_pem, _ = signing_pair
    payload = _base_payload(
        EVENT_ACCOUNT_DISABLED,
        {"subject": {"sub": "user-1"}},
    )
    del payload["jti"]
    token = _sign(private_pem, payload)

    with pytest.raises(RiscVerificationError, match="jti"):
        await verify_risc_set(token)


async def test_verify_risc_set_rejects_malformed_jwt() -> None:
    with pytest.raises(RiscVerificationError):
        await verify_risc_set("not-a-jwt")
