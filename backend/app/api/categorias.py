from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict

from ..database.database import get_db
from ..database.tables import Categoria


router = APIRouter(
    prefix="/categorias",
    tags=["Categorias"]
)


class CategoriaResponse(BaseModel):
    id: int
    nome: str
    slug: str

    model_config = ConfigDict(from_attributes=True)


@router.get("/", response_model=list[CategoriaResponse])
def listar_categorias(
    db: Session = Depends(get_db)
):
    categorias = (
        db.query(Categoria)
        .order_by(Categoria.nome)
        .all()
    )

    return categorias