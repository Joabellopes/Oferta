from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from .database import Base


class Categoria(Base):
    __tablename__ = "categorias"

    id = Column(Integer, primary_key=True, index=True)

    nome = Column(String(100), nullable=False, unique=True)

    slug = Column(String(100), nullable=False, unique=True)

    produtos = relationship(
        "Produto",
        back_populates="categoria_relacao"
    )


class Produto(Base):
    __tablename__ = "produtos"

    id = Column(Integer, primary_key=True, index=True)

    nome = Column(String(255), nullable=False)

    descricao = Column(Text, nullable=True)

    preco_antigo = Column(Float, nullable=True)

    preco_atual = Column(Float, nullable=False)

    desconto = Column(Float, nullable=True)

    imagem = Column(String(500), nullable=True)

    # Campo antigo — vamos manter por enquanto
    categoria = Column(String(100), nullable=True)

    # Novo relacionamento
    categoria_id = Column(
        Integer,
        ForeignKey("categorias.id"),
        nullable=True
    )

    categoria_relacao = relationship(
        "Categoria",
        back_populates="produtos"
    )

    loja = Column(String(50), nullable=False)

    link_produto = Column(String(1000), nullable=True)

    link_afiliado = Column(String(1000), nullable=True)

    avaliacao = Column(Float, nullable=True)

    data_atualizacao = Column(
        DateTime,
        default=datetime.utcnow
    )