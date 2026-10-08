import json
import os
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import APIRouter, Depends, HTTPException, Query

from ..security import require_admin


router = APIRouter(
    prefix="/integracoes/mercado-livre",
    tags=["Integração Mercado Livre"],
    dependencies=[Depends(require_admin)],
)

API_URL = "https://api.mercadolibre.com/sites/MLB/search"


@router.get("/buscar")
def buscar_ofertas_mercado_livre(q: str = Query(min_length=2, max_length=120)):
    token = os.getenv("MELI_ACCESS_TOKEN", "").strip()
    if not token:
        raise HTTPException(
            status_code=503,
            detail=(
                "Integração não configurada. Adicione MELI_ACCESS_TOKEN ao .env "
                "depois de autorizar o aplicativo no Mercado Livre."
            ),
        )

    url = f"{API_URL}?{urlencode({'q': q.strip(), 'limit': 12})}"
    request = Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "User-Agent": "OfertasDoJoabel/1.0",
        },
        method="GET",
    )

    try:
        with urlopen(request, timeout=12) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        if error.code in (401, 403):
            raise HTTPException(
                status_code=502,
                detail=(
                    "O Mercado Livre recusou a autorização. Confira se o token "
                    "está válido e pertence ao aplicativo autorizado."
                ),
            ) from None
        if error.code == 429:
            raise HTTPException(
                status_code=503,
                detail="Limite temporário de consultas do Mercado Livre atingido.",
                headers={"Retry-After": error.headers.get("Retry-After", "60")},
            ) from None
        raise HTTPException(
            status_code=502,
            detail="O Mercado Livre não conseguiu concluir a busca agora.",
        ) from None
    except (TimeoutError, URLError, json.JSONDecodeError):
        raise HTTPException(
            status_code=502,
            detail="Não foi possível consultar o Mercado Livre agora.",
        ) from None

    resultados = []
    for item in payload.get("results", []):
        imagem = item.get("thumbnail") or ""
        if imagem.startswith("http://"):
            imagem = "https://" + imagem[7:]
        resultados.append(
            {
                "id": item.get("id"),
                "nome": item.get("title"),
                "preco_atual": item.get("price"),
                "preco_antigo": item.get("original_price"),
                "imagem": imagem or None,
                "link_produto": item.get("permalink"),
            }
        )

    return {
        "query": q.strip(),
        "total": payload.get("paging", {}).get("total", 0),
        "resultados": resultados,
    }
