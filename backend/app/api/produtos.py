from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.orm import Session
from urllib.parse import urlsplit

from ..database.database import get_db
from ..database.tables import Produto, Categoria
from ..security import require_admin

router = APIRouter(prefix="/produtos", tags=["Produtos"])


class ProdutoCreate(BaseModel):
    nome: str = Field(min_length=1, max_length=255)
    descricao: str | None = Field(default=None, max_length=5000)
    preco_antigo: float | None = Field(default=None, ge=0)
    preco_atual: float = Field(gt=0)
    desconto: float | None = Field(default=None, ge=0, le=100)
    imagem: str | None = Field(default=None, max_length=500)
    categoria_id: int | None = Field(default=None, gt=0)
    loja: str = Field(min_length=1, max_length=50)
    link_produto: str | None = Field(default=None, max_length=1000)
    link_afiliado: str | None = Field(default=None, max_length=1000)
    avaliacao: float | None = Field(default=None, ge=0, le=5)

    @field_validator("link_produto", "link_afiliado")
    @classmethod
    def validar_links_de_compra(cls, value: str | None):
        if value is None or not value.strip():
            return None
        parsed = urlsplit(value.strip())
        if parsed.scheme != "https" or not parsed.netloc:
            raise ValueError("Links de produto e afiliado devem usar HTTPS.")
        return value.strip()

    @field_validator("imagem")
    @classmethod
    def validar_imagem(cls, value: str | None):
        if value is None or not value.strip():
            return None
        value = value.strip()
        parsed = urlsplit(value)
        if parsed.scheme:
            if parsed.scheme != "https" or not parsed.netloc:
                raise ValueError("A imagem deve usar uma URL HTTPS.")
        elif value.startswith(("//", "\\")) or ".." in value.split("/") or "\\" in value:
            raise ValueError("Informe uma URL HTTPS ou caminho relativo de imagem válido.")
        return value


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
    status_code=201,
    dependencies=[Depends(require_admin)],
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
    response_model=ProdutoResponse,
    dependencies=[Depends(require_admin)],
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


@router.delete("/{produto_id}", dependencies=[Depends(require_admin)])
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
