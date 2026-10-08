import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import sessionmaker, declarative_base

PROJECT_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(PROJECT_ROOT / ".env")

DATABASE_URL = os.getenv("DATABASE_URL") or os.getenv("MYSQL_URL")
if DATABASE_URL and DATABASE_URL.startswith("mysql://"):
    DATABASE_URL = DATABASE_URL.replace("mysql://", "mysql+pymysql://", 1)

if not DATABASE_URL:
    required = ("DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME")
    aliases = {
        "DB_HOST": os.getenv("MYSQLHOST"),
        "DB_PORT": os.getenv("MYSQLPORT"),
        "DB_USER": os.getenv("MYSQLUSER"),
        "DB_PASSWORD": os.getenv("MYSQLPASSWORD"),
        "DB_NAME": os.getenv("MYSQLDATABASE"),
    }
    settings = {name: os.getenv(name) or aliases.get(name) for name in required}
    missing = [name for name in required if not settings[name]]
    if missing:
        raise RuntimeError(
            "Configuração de banco incompleta. Defina DATABASE_URL ou: "
            + ", ".join(missing)
        )

    DATABASE_URL = URL.create(
        "mysql+pymysql",
        username=settings["DB_USER"],
        password=settings["DB_PASSWORD"],
        host=settings["DB_HOST"],
        port=int(os.getenv("DB_PORT") or aliases.get("DB_PORT") or "3306"),
        database=settings["DB_NAME"],
    )

engine = create_engine(
    DATABASE_URL,
    echo=os.getenv("APP_ENV", "production" if os.getenv("PORT") else "development").lower() != "production",
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False
)

Base = declarative_base()


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()
