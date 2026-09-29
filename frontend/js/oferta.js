const API = "http://127.0.0.1:8000";

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

        const image = product.imagem
            ? `<div class="produto-imagem-detalhe">
                 <img src="${safe(product.imagem)}" alt="${safe(product.nome)}"
                      onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                 <div class="sem-imagem fallback-imagem">Imagem indisponível</div>
               </div>`
            : `<div class="produto-imagem-detalhe sem-imagem">Sem imagem</div>`;

        const oldPrice = product.preco_antigo != null
            ? `<div class="preco-antigo">${price(product.preco_antigo)}</div>`
            : "";

        const discount = Number(product.desconto) > 0
            ? `<span class="desconto grande">🔥 ${Number(product.desconto).toFixed(0)}% OFF</span>`
            : "";

        const link = product.link_afiliado || product.link_produto || "#";

        area.innerHTML = `
            ${image}
            <div class="produto-informacoes">
                <div class="loja-detalhe">${safe(product.loja)}</div>
                <h2>${safe(product.nome)}</h2>
                <p class="descricao">${safe(product.descricao || "")}</p>
                ${oldPrice}
                <div class="preco-atual grande">${price(product.preco_atual)}</div>
                <div class="detalhe-meta">${discount}</div>
                <a class="botao-comprar" href="${safe(link)}"
                   target="_blank" rel="noopener noreferrer">
                    🛒 VER OFERTA
                </a>
            </div>
        `;
    } catch (error) {
        console.error(error);
        area.innerHTML = "<p>Não foi possível carregar o produto.</p>";
    }
}

document.addEventListener("DOMContentLoaded", loadProduct);
