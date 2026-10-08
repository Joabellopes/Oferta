import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from .api.auth import router as auth_router
from .api.produtos import router as produtos_router
from .api.categorias import router as categorias_router
from .api.mercado_livre import router as mercado_livre_router
from .api.uploads import router as uploads_router
from .database.database import engine
from .security import APP_ENV, validate_security_configuration


app = FastAPI(
    title="Ofertas do Joabel",
    description="Sistema de ofertas afiliadas - Mercado Livre e Shopee",
    version="1.0.0",
    docs_url=None if APP_ENV == "production" else "/docs",
    redoc_url=None if APP_ENV == "production" else "/redoc",
    openapi_url=None if APP_ENV == "production" else "/openapi.json",
)


validate_security_configuration()

origens_padrao = "http://127.0.0.1:5500,http://localhost:5500"
origens_frontend = [
    origem.strip()
    for origem in os.getenv("FRONTEND_ORIGINS", origens_padrao).split(",")
    if origem.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origens_frontend,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)


app.include_router(produtos_router)
app.include_router(categorias_router)
app.include_router(auth_router)
app.include_router(mercado_livre_router)
app.include_router(uploads_router)


@app.get("/health")
def health():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError as error:
        raise HTTPException(status_code=503, detail="Banco de dados indisponível.") from error

    return {
        "mensagem": "Sistema de ofertas funcionando!",
        "status": "online",
        "database": "online",
    }


FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")


@app.middleware("http")
async def cabecalhos_de_seguranca(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if APP_ENV == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response
