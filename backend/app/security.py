import base64
import hashlib
import hmac
import json
import os
import time
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Header, HTTPException


load_dotenv(Path(__file__).resolve().parents[2] / ".env")

RUNTIME_DEFAULT = "production" if os.getenv("PORT") else "development"
APP_ENV = os.getenv("APP_ENV", RUNTIME_DEFAULT).strip().lower()
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
ADMIN_SECRET_KEY = os.getenv("ADMIN_SECRET_KEY", "")
ADMIN_AUTH_ENABLED = APP_ENV == "production" or any(
    (ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_SECRET_KEY)
)
TOKEN_TTL_SECONDS = 8 * 60 * 60


def validate_security_configuration():
    supplied = (ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_SECRET_KEY)
    if any(supplied) and not all(supplied):
        raise RuntimeError(
            "Defina ADMIN_USERNAME, ADMIN_PASSWORD e ADMIN_SECRET_KEY juntos."
        )

    if APP_ENV == "production":
        if not all(supplied):
            raise RuntimeError(
                "Autenticação obrigatória em produção. Configure as três variáveis ADMIN_*."
            )
        if len(ADMIN_SECRET_KEY) < 32:
            raise RuntimeError("ADMIN_SECRET_KEY deve ter pelo menos 32 caracteres.")
        if len(ADMIN_PASSWORD) < 14:
            raise RuntimeError("ADMIN_PASSWORD deve ter pelo menos 14 caracteres.")


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def emitir_token(username: str) -> str:
    payload = json.dumps(
        {"sub": username, "exp": int(time.time()) + TOKEN_TTL_SECONDS},
        separators=(",", ":"),
    ).encode("utf-8")
    encoded = _b64encode(payload)
    signature = hmac.new(
        ADMIN_SECRET_KEY.encode("utf-8"), encoded.encode("ascii"), hashlib.sha256
    ).digest()
    return f"{encoded}.{_b64encode(signature)}"


def token_valido(token: str | None) -> bool:
    if not token or not ADMIN_SECRET_KEY:
        return False
    try:
        encoded, signature = token.split(".", 1)
        expected = hmac.new(
            ADMIN_SECRET_KEY.encode("utf-8"), encoded.encode("ascii"), hashlib.sha256
        ).digest()
        if not hmac.compare_digest(expected, _b64decode(signature)):
            return False
        payload = json.loads(_b64decode(encoded))
        return (
            payload.get("sub") == ADMIN_USERNAME
            and int(payload.get("exp", 0)) > int(time.time())
        )
    except (ValueError, TypeError, json.JSONDecodeError):
        return False


def require_admin(authorization: str | None = Header(default=None)):
    if not ADMIN_AUTH_ENABLED:
        return
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token_valido(token):
        raise HTTPException(
            status_code=401, detail="Autenticação administrativa necessária."
        )


def autenticar(username: str, password: str) -> str | None:
    usuario_ok = hmac.compare_digest(username.encode(), ADMIN_USERNAME.encode())
    senha_ok = hmac.compare_digest(password.encode(), ADMIN_PASSWORD.encode())
    if usuario_ok and senha_ok and ADMIN_AUTH_ENABLED:
        return emitir_token(ADMIN_USERNAME)
    return None
