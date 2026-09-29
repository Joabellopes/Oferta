from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from ..database.database import get_db
from ..database.tables import Produto, Categoria

router = APIRouter(prefix="/produtos", tags=["Produtos"])


class ProdutoCreate(BaseModel):
    nome: str = Field(min_length=1)
    descricao: str | None = None
    preco_antigo: float | None = Field(default=None, ge=0)
    preco_atual: float = Field(gt=0)
    desconto: float | None = Field(default=None, ge=0, le=100)
    imagem: str | None = None
    categoria_id: int | None = Field(default=None, gt=0)
    loja: str = Field(min_length=1)
    link_produto: str | None = None
    link_afiliado: str | None = None
    avaliacao: float | None = Field(default=None, ge=0, le=5)


class ProdutoResponse(BaseModel):
    id: int
    nome: str
    descricao: str | None = None
    preco_antigo: float | None = None
    preco_atual: float
    desconto: float | None = None
    imagem: str | None = None
    categoria_id: int | None = None
    loja: str
    link_produto: str | None = None
    link_afiliado: str | None = None
    avaliacao: float | None = None

    model_config = ConfigDict(from_attributes=True)


def validar_categoria(categoria_id: int | None, db: Session):
    if categoria_id is None:
        return

    categoria = (
        db.query(Categoria)
        .filter(Categoria.id == categoria_id)
        .first()
    )

    if categoria is None:
        raise HTTPException(
            status_code=400,
            detail="Categoria não encontrada"
        )


def calcular_desconto(
    preco_antigo: float | None,
    preco_atual: float,
    desconto_informado: float | None
):
    if preco_antigo is None or preco_antigo <= 0:
        return desconto_informado

    if preco_atual > preco_antigo:
        raise HTTPException(
            status_code=400,
            detail="O preço atual não pode ser maior que o preço antigo."
        )

    return round(
        ((preco_antigo - preco_atual) / preco_antigo) * 100,
        2
    )


# IMPORTANTE:
# As rotas específicas precisam ficar ANTES de /{produto_id}.


@router.get("/", response_model=list[ProdutoResponse])
def listar_produtos(db: Session = Depends(get_db)):
    return (
        db.query(Produto)
        .order_by(Produto.id.desc())
        .all()
    )


@router.get(
    "/buscar/{termo}",
    response_model=list[ProdutoResponse]
)
def buscar_produtos(
    termo: str,
    db: Session = Depends(get_db)
):
    termo = termo.strip()

    if not termo:
        return (
            db.query(Produto)
            .order_by(Produto.id.desc())
            .all()
        )

    return (
        db.query(Produto)
        .filter(Produto.nome.ilike(f"%{termo}%"))
        .order_by(Produto.id.desc())
        .all()
    )


@router.get(
    "/categoria/{slug}",
    response_model=list[ProdutoResponse]
)
def produtos_por_categoria(
    slug: str,
    db: Session = Depends(get_db)
):
    categoria = (
        db.query(Categoria)
        .filter(Categoria.slug == slug)
        .first()
    )

    if categoria is None:
        raise HTTPException(
            status_code=404,
            detail="Categoria não encontrada"
        )

    return (
        db.query(Produto)
        .filter(Produto.categoria_id == categoria.id)
        .order_by(Produto.id.desc())
        .all()
    )


@router.get(
    "/{produto_id}",
    response_model=ProdutoResponse
)
def buscar_produto(
    produto_id: int,
    db: Session = Depends(get_db)
):
    produto = (
        db.query(Produto)
        .filter(Produto.id == produto_id)
        .first()
    )

    if produto is None:
        raise HTTPException(
            status_code=404,
            detail="Produto não encontrado"
        )

    return produto


@router.post(
    "/",
    response_model=ProdutoResponse,
    status_code=201
)
def criar_produto(
    dados: ProdutoCreate,
    db: Session = Depends(get_db)
):
    validar_categoria(dados.categoria_id, db)

    novo_produto = Produto(
        nome=dados.nome.strip(),
        descricao=dados.descricao,
        preco_antigo=dados.preco_antigo,
        preco_atual=dados.preco_atual,
        desconto=calcular_desconto(
            dados.preco_antigo,
            dados.preco_atual,
            dados.desconto
        ),
        imagem=dados.imagem,
        categoria_id=dados.categoria_id,
        loja=dados.loja.strip(),
        link_produto=dados.link_produto,
        link_afiliado=dados.link_afiliado,
        avaliacao=dados.avaliacao
    )

    db.add(novo_produto)
    db.commit()
    db.refresh(novo_produto)

    return novo_produto


@router.put(
    "/{produto_id}",
    response_model=ProdutoResponse
)
def atualizar_produto(
    produto_id: int,
    dados: ProdutoCreate,
    db: Session = Depends(get_db)
):
    produto = (
        db.query(Produto)
        .filter(Produto.id == produto_id)
        .first()
    )

    if produto is None:
        raise HTTPException(
            status_code=404,
            detail="Produto não encontrado"
        )

    validar_categoria(dados.categoria_id, db)

    produto.nome = dados.nome.strip()
    produto.descricao = dados.descricao
    produto.preco_antigo = dados.preco_antigo
    produto.preco_atual = dados.preco_atual
    produto.desconto = calcular_desconto(
        dados.preco_antigo,
        dados.preco_atual,
        dados.desconto
    )
    produto.imagem = dados.imagem
    produto.categoria_id = dados.categoria_id
    produto.loja = dados.loja.strip()
    produto.link_produto = dados.link_produto
    produto.link_afiliado = dados.link_afiliado
    produto.avaliacao = dados.avaliacao

    db.commit()
    db.refresh(produto)

    return produto


@router.delete("/{produto_id}")
def excluir_produto(
    produto_id: int,
    db: Session = Depends(get_db)
):
    produto = (
        db.query(Produto)
        .filter(Produto.id == produto_id)
        .first()
    )

    if produto is None:
        raise HTTPException(
            status_code=404,
            detail="Produto não encontrado"
        )

    db.delete(produto)
    db.commit()

    return {
        "mensagem": "Produto excluído com sucesso",
        "id": produto_id
    }
