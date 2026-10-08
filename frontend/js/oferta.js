const API = window.API_BASE || (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && location.port !== "8000" ? "http://127.0.0.1:8000" : "");

function safe(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function price(value) {
    return Number(value).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

async function loadProduct() {
    const area = document.getElementById("produto");
    const id = new URLSearchParams(location.search).get("id");

    if (!id) {
        area.innerHTML = "<p>Produto não encontrado.</p>";
        return;
    }

    try {
        const response = await fetch(`${API}/produtos/${encodeURIComponent(id)}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const product = await response.json();
        document.title = `${product.nome} | Ofertas do Joabel`;
        const descriptionTag = document.querySelector('meta[name="description"]');
        if (descriptionTag) {
            descriptionTag.content = `${product.nome}: ${price(product.preco_atual)} na ${product.loja || "loja parceira"}. Confira os detalhes da oferta.`;
        }
        const openGraphTitle = document.querySelector('meta[property="og:title"]');
        const openGraphDescription = document.querySelector('meta[property="og:description"]');
        if (openGraphTitle) openGraphTitle.content = document.title;
        if (openGraphDescription && descriptionTag) openGraphDescription.content = descriptionTag.content;

        const image = product.imagem
            ? `<div class="produto-detalhe-imagem">
                 <img src="${safe(product.imagem)}" alt="${safe(product.nome)}"
                      onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                 <div class="imagem-fallback-detalhe" role="img" aria-label="Imagem indisponível">✦<span>Imagem indisponível</span></div>
               </div>`
            : `<div class="produto-detalhe-imagem sem-imagem"><div class="imagem-fallback-detalhe" role="img" aria-label="Imagem não cadastrada">✦<span>Imagem não cadastrada</span></div></div>`;

        const oldPrice = product.preco_antigo != null
            ? `<div class="produto-preco-antigo">${price(product.preco_antigo)}</div>`
            : "";

        const discount = Number(product.desconto) > 0
            ? `<span class="desconto grande">🔥 ${Number(product.desconto).toFixed(0)}% OFF</span>`
            : "";

        const link = product.link_afiliado || product.link_produto || "";
        const linkValido = /^https:\/\//i.test(link);

        area.innerHTML = `
            <div class="produto-detalhe-conteudo">
                ${image}
                <div class="produto-detalhe-info">
                    <span class="produto-categoria">OFERTA EM DESTAQUE</span>
                    <div class="produto-loja">${safe(product.loja || "Loja parceira")}</div>
                    <h1>${safe(product.nome)}</h1>
                    <p class="produto-descricao">${safe(product.descricao || "Confira os detalhes deste produto na loja.")}</p>
                    <div class="produto-precos">
                        ${oldPrice}
                        <div class="produto-preco-atual">${price(product.preco_atual)}</div>
                        ${discount ? `<div class="produto-desconto">${discount}</div>` : ""}
                    </div>
                    ${linkValido
                        ? `<a class="btn-comprar" href="${safe(link)}" target="_blank" rel="noopener noreferrer">🛒 VER OFERTA NA LOJA <span aria-hidden="true">↗</span></a>`
                        : `<span class="btn-comprar btn-comprar-desabilitado" aria-disabled="true">Link da loja ainda não cadastrado</span>`}
                    <p class="aviso-afiliado">Podemos receber comissão por compras feitas por este link, sem custo adicional para você. A compra é concluída na loja parceira.</p>
                </div>
            </div>
        `;
    } catch (error) {
        console.error(error);
        area.innerHTML = "<p>Não foi possível carregar o produto.</p>";
    }
}

document.addEventListener("DOMContentLoaded", loadProduct);
