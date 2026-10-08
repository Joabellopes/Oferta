from .database import engine, Base, SessionLocal
from .tables import Categoria, Produto


print("Criando tabelas...")

Base.metadata.create_all(bind=engine)

categorias_iniciais = [
    ("Beleza", "beleza"),
    ("Casa", "casa"),
    ("Eletrônicos", "eletronicos"),
    ("Games", "games"),
    ("Moda", "moda"),
    ("Pets", "pets"),
]

with SessionLocal() as sessao:
    for nome, slug in categorias_iniciais:
        existente = sessao.query(Categoria).filter_by(slug=slug).first()
        if existente is None:
            sessao.add(Categoria(nome=nome, slug=slug))
    sessao.commit()

print("Tabelas criadas com sucesso!")
