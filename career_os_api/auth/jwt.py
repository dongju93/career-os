from datetime import UTC, datetime, timedelta

from jose import JWTError, jwt

from career_os_api.config import settings


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    issued_at = datetime.now(UTC)
    expire = issued_at + timedelta(minutes=settings.jwt_expire_minutes)
    to_encode.update({"iat": int(issued_at.timestamp()), "exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(
            token, settings.secret_key, algorithms=[settings.jwt_algorithm]
        )
        return payload
    except JWTError:
        return None
