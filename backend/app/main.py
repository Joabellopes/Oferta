from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.produtos import router as produtos_router
from .api.categorias import router as categorias_router


app = FastAPI(
    title="Ofertas do Joabel",
    description="Sistema de ofertas afiliadas - Mercado Livre e Shopee",
    version="1.0.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(produtos_router)
app.include_router(categorias_router)


@app.get("/")
def inicio():
    return {
        "mensagem": "Sistema de ofertas funcionando!",
        "status": "online"
    }