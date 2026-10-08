from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..security import (
    ADMIN_AUTH_ENABLED,
    TOKEN_TTL_SECONDS,
    autenticar,
    require_admin,
)


router = APIRouter(prefix="/auth", tags=["Autenticação"])


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=1, max_length=256)


@router.get("/status")
def status_autenticacao():
    return {"enabled": ADMIN_AUTH_ENABLED}


@router.post("/login")
def login(dados: LoginRequest):
    if not ADMIN_AUTH_ENABLED:
        return {"enabled": False}
    token = autenticar(dados.username, dados.password)
    if not token:
        raise HTTPException(status_code=401, detail="Usuário ou senha incorretos.")
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": TOKEN_TTL_SECONDS,
    }


@router.get("/verify", dependencies=[Depends(require_admin)])
def verificar_sessao():
    return {"authenticated": True}
