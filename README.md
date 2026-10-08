# Ofertas do Joabel

Vitrine de ofertas com frontend estático, API FastAPI e banco MySQL.

## Iniciar localmente

1. Configure o `.env` com base em `.env.example`.
2. Ative o ambiente virtual e execute `python -m backend.app.database.criar_tabelas`.
3. Inicie `uvicorn backend.app.main:app --reload --port 8000`.
4. Abra `http://127.0.0.1:8000`.

Para usar o Live Server em `http://127.0.0.1:5500`, mantenha o backend iniciado em `http://127.0.0.1:8000`.

Consulte [DEPLOYMENT.md](DEPLOYMENT.md) para os requisitos de publicação, segurança e variáveis de produção.
