from uuid import UUID

from pydantic import BaseModel


class GoogleLoginResponse(BaseModel):
    message: str
    user_id: UUID
    email: str
    name: str | None
    picture: str | None
    access_token: str
    token_type: str = "bearer"
