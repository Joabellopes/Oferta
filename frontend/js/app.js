const API = "http://127.0.0.1:8000";

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatarPreco(value) {
    const numero = Number(value);
    if (!Number.isFinite(numero)) return "R$ 0,00";

    return numero.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function imagemFallback(nome) {
    return `
        <div class="sem-imagem fallback-imagem">
            <span>Sem imagem</span>
        </div>
    `;
}

function criarImagem(produto) {
    const nome = escapeHtml(produto.nome);
    const url = String(produto.imagem ?? "").trim();

    if (!url) return imagemFallback(nome);

    return `
        <div class="produto-imagem">
            <img
                src="${escapeHtml(url)}"
                alt="${nome}"
                loading="lazy"
                onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
            >
            ${imagemFallback(nome)}
        </div>
    `;
}

function mostrarProdutos(produtos) {
    const area = document.getElementById("produtos");
    if (!area) return;

    area.innerHTML = "";

    if (!Array.isArray(produtos) || produtos.length === 0) {
        area.innerHTML = `
            <div class="estado-vazio">
                Nenhuma oferta encontrada.
            </div>
        `;
        return;
    }

    produtos.forEach(produto => {
        const card = document.createElement("article");
        card.className = "produto";

        const descontoNumero = Number(produto.desconto);
        const desconto = Number.isFinite(descontoNumero) && descontoNumero > 0
            ? `<span class="desconto">🔥 ${descontoNumero.toFixed(0)}% OFF</span>`
            : "";

        const precoAntigo = produto.preco_antigo != null
            ? `<div class="preco-antigo">${formatarPreco(produto.preco_antigo)}</div>`
            : "";

        const avaliacaoNumero = Number(produto.avaliacao);
        const avaliacao = Number.isFinite(avaliacaoNumero)
            ? `<span class="avaliacao">★ ${avaliacaoNumero.toFixed(1)}</span>`
            : "";

        card.innerHTML = `
            ${criarImagem(produto)}

            <div class="produto-conteudo">
                <div class="produto-loja">
                    ${escapeHtml(produto.loja || "Loja não informada")}
                </div>

                <h3>${escapeHtml(produto.nome)}</h3>

                ${precoAntigo}

                <div class="preco-atual">
                    ${formatarPreco(produto.preco_atual)}
                </div>

                <div class="produto-meta">
                    ${desconto}
                    ${avaliacao}
                </div>

                <a
                    class="botao-oferta"
                    href="oferta.html?id=${encodeURIComponent(produto.id)}"
                >
                    Ver oferta
                </a>
            </div>
        `;

        area.appendChild(card);
    });
}

async function carregarProdutos() {
    const area = document.getElementById("produtos");
    if (!area) return;

    area.innerHTML = `<div class="estado-carregando">Carregando ofertas...</div>`;

    try {
        const resposta = await fetch(`${API}/produtos/`);
        if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);

        const produtos = await resposta.json();
        mostrarProdutos(produtos);
    } catch (erro) {
        console.error(erro);
        area.innerHTML = `
            <div class="estado-erro">
                Não foi possível carregar as ofertas.
            </div>
        `;
    }
}

async function carregarCategorias() {
    const area = document.getElementById("lista-categorias");
    if (!area) return;

    area.innerHTML = "";

    try {
        const resposta = await fetch(`${API}/categorias/`);
        if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);

        const categorias = await resposta.json();

        categorias.forEach(categoria => {
            const botao = document.createElement("button");
            botao.type = "button";
            botao.className = "categoria";
            botao.textContent = categoria.nome;

            botao.addEventListener("click", () => {
                document.querySelectorAll(".categoria").forEach(item => {
                    item.classList.remove("ativa");
                });
                botao.classList.add("ativa");
                carregarProdutosCategoria(categoria.slug);
            });

            area.appendChild(botao);
        });
    } catch (erro) {
        console.error(erro);
        area.innerHTML = `<span class="categoria-erro">Categorias indisponíveis</span>`;
    }
}

async function carregarProdutosCategoria(slug) {
    const area = document.getElementById("produtos");
    if (!area) return;

    area.innerHTML = `<div class="estado-carregando">Carregando ofertas...</div>`;

    try {
        const resposta = await fetch(
            `${API}/produtos/categoria/${encodeURIComponent(slug)}`
        );
        if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);

        const produtos = await resposta.json();
        mostrarProdutos(produtos);
    } catch (erro) {
        console.error(erro);
        area.innerHTML = `<div class="estado-erro">Erro ao carregar categoria.</div>`;
    }
}

async function pesquisarProdutos(termo) {
    const area = document.getElementById("produtos");
    if (!area) return;

    area.innerHTML = `<div class="estado-carregando">Buscando ofertas...</div>`;

    try {
        const resposta = await fetch(
            `${API}/produtos/buscar/${encodeURIComponent(termo)}`
        );
        if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);

        const produtos = await resposta.json();
        mostrarProdutos(produtos);
    } catch (erro) {
        console.error(erro);
        area.innerHTML = `<div class="estado-erro">Erro ao realizar a busca.</div>`;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const formBusca = document.getElementById("form-busca");

    if (formBusca) {
        formBusca.addEventListener("submit", event => {
            event.preventDefault();

            const campo = document.getElementById("campo-busca");
            const termo = campo?.value.trim() || "";

            if (!termo) {
                carregarProdutos();
                return;
            }

            pesquisarProdutos(termo);
        });
    }

    carregarCategorias();
    carregarProdutos();
});
