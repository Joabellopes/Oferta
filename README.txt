OFERTAS DO JOABEL - V2 CORRIGIDA

1) BACKEND
Abra o PowerShell na pasta do projeto:
cd C:\Users\Joabelps\Documents\afiliado_ofertas
.\venv\Scripts\Activate.ps1
uvicorn backend.app.main:app --reload

2) FRONTEND
Abra outro PowerShell:
cd C:\Users\Joabelps\Documents\afiliado_ofertas\frontend
python -m http.server 5500

3) ABRIR
Site:  http://127.0.0.1:5500/index.html
Admin: http://127.0.0.1:5500/admin.html
API:   http://127.0.0.1:8000/docs

IMPORTANTE
- Não altere database.py, tables.py, main.py ou categorias.py se eles já estão funcionando.
- Esta versão corrige o carregamento de categorias, cadastro/edição/exclusão, cálculo do desconto, prévia da imagem e cards de produtos.
- A imagem pode ser uma URL direta (https://...) ou um caminho relativo servido pelo frontend, por exemplo imagens/produto.jpg.
