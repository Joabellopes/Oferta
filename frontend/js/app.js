const API = window.API_BASE || (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && location.port !== "8000" ? "http://127.0.0.1:8000" : "");

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

function ativarEfeito3D(card) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    card.addEventListener("pointermove", event => {
        if (event.pointerType !== "mouse") return;

        const area = card.getBoundingClientRect();
        const x = (event.clientX - area.left) / area.width;
        const y = (event.clientY - area.top) / area.height;

        card.style.setProperty("--card-rotate-x", `${(0.5 - y) * 8}deg`);
        card.style.setProperty("--card-rotate-y", `${(x - 0.5) * 10}deg`);
        card.style.setProperty("--card-light-x", `${x * 100}%`);
        card.style.setProperty("--card-light-y", `${y * 100}%`);
    });

    card.addEventListener("pointerleave", () => {
        card.style.removeProperty("--card-rotate-x");
        card.style.removeProperty("--card-rotate-y");
        card.style.removeProperty("--card-light-x");
        card.style.removeProperty("--card-light-y");
    });
}

function prepararAnimacoes() {
    const reduzMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hero = document.querySelector(".home-page .hero");
    const canvas = document.querySelector(".hero-particles");

    if (!reduzMovimento && hero && canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
            let largura = 0;
            let altura = 0;
            let quadro = 0;
            let pontos = [];
            const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

            const redimensionar = () => {
                const limites = hero.getBoundingClientRect();
                largura = limites.width;
                altura = limites.height;
                canvas.width = Math.round(largura * dpr);
                canvas.height = Math.round(altura * dpr);
                canvas.style.width = `${largura}px`;
                canvas.style.height = `${altura}px`;
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                const total = Math.min(58, Math.max(24, Math.round(largura / 22)));
                pontos = Array.from({ length: total }, () => ({
                    x: Math.random() * largura,
                    y: Math.random() * altura,
                    vx: (Math.random() - 0.5) * 0.22,
                    vy: (Math.random() - 0.5) * 0.22
                }));
            };

            const desenhar = () => {
                ctx.clearRect(0, 0, largura, altura);
                pontos.forEach((ponto, i) => {
                    ponto.x += ponto.vx;
                    ponto.y += ponto.vy;
                    if (ponto.x < 0 || ponto.x > largura) ponto.vx *= -1;
                    if (ponto.y < 0 || ponto.y > altura) ponto.vy *= -1;
                    ctx.beginPath();
                    ctx.arc(ponto.x, ponto.y, 1.35, 0, Math.PI * 2);
                    ctx.fillStyle = "rgba(179, 211, 255, .54)";
                    ctx.fill();
                    for (let j = i + 1; j < pontos.length; j++) {
                        const outro = pontos[j];
                        const distancia = Math.hypot(ponto.x - outro.x, ponto.y - outro.y);
                        if (distancia < 112) {
                            ctx.beginPath();
                            ctx.moveTo(ponto.x, ponto.y);
                            ctx.lineTo(outro.x, outro.y);
                            ctx.strokeStyle = `rgba(135, 178, 242, ${0.15 * (1 - distancia / 112)})`;
                            ctx.lineWidth = 0.7;
                            ctx.stroke();
                        }
                    }
                });
                quadro = window.requestAnimationFrame(desenhar);
            };

            redimensionar();
            desenhar();
            window.addEventListener("resize", redimensionar, { passive: true });
            document.addEventListener("visibilitychange", () => {
                if (document.hidden) window.cancelAnimationFrame(quadro);
                else desenhar();
            });
        }
    }

    const elementos = document.querySelectorAll(".home-page .categorias, .home-page .ofertas-section, .home-page .beneficios, .home-page .cta, .home-page footer, .home-page .section-header, .home-page .beneficio");
    if (!reduzMovimento && "IntersectionObserver" in window) {
        const observador = new IntersectionObserver(entradas => {
            entradas.forEach(entrada => {
                if (entrada.isIntersecting) {
                    entrada.target.classList.add("motion-visible");
                    observador.unobserve(entrada.target);
                }
            });
        }, { threshold: 0.12, rootMargin: "0px 0px -35px 0px" });
        elementos.forEach((elemento, indice) => {
            elemento.classList.add("motion-reveal");
            elemento.style.setProperty("--motion-delay", `${Math.min(indice % 4, 3) * 75}ms`);
            observador.observe(elemento);
        });
    }
}

function criarImagem(produto) {
    const nome = escapeHtml(produto.nome);
    const url = String(produto.imagem ?? "").trim();

    if (!url) {
        return `
            <div class="produto-imagem sem-foto" role="img" aria-label="Imagem não cadastrada">
                <span aria-hidden="true">✦</span>
                <small>Imagem não cadastrada</small>
            </div>
        `;
    }

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
        card.className = "produto produto-entrada";

        const lojaNome = String(produto.loja || "Loja parceira");
        const lojaSlug = lojaNome.toLowerCase().includes("mercado livre")
            ? "mercado-livre"
            : lojaNome.toLowerCase().includes("shopee")
                ? "shopee"
                : lojaNome.toLowerCase().includes("amazon")
                    ? "amazon"
                    : "outra";
        const lojaSigla = {
            "mercado-livre": "ML",
            shopee: "S",
            amazon: "a",
            outra: "↗"
        }[lojaSlug];

        const descontoNumero = Number(produto.desconto);
        const desconto = Number.isFinite(descontoNumero) && descontoNumero > 0
            ? `<span class="desconto">🔥 ${descontoNumero.toFixed(0)}% OFF</span>`
            : "";

        const precoAntigo = produto.preco_antigo != null
            ? `<div class="preco-antigo">${formatarPreco(produto.preco_antigo)}</div>`
            : "";

        const economiaValor = Number(produto.preco_antigo) - Number(produto.preco_atual);
        const economia = Number.isFinite(economiaValor) && economiaValor > 0
            ? `<span class="economia">Economize ${formatarPreco(economiaValor)}</span>`
            : "";

        const avaliacaoNumero = Number(produto.avaliacao);
        const avaliacao = Number.isFinite(avaliacaoNumero)
            ? `<span class="avaliacao">★ ${avaliacaoNumero.toFixed(1)}</span>`
            : "";

        card.innerHTML = `
            <span class="produto-selo">OFERTA</span>
            ${criarImagem(produto)}

            <div class="produto-conteudo">
                <div class="produto-loja loja-${lojaSlug}">
                    <span class="loja-sigla" aria-hidden="true">${lojaSigla}</span>
                    ${escapeHtml(lojaNome)}
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

                ${economia}

                <a
                    class="botao-oferta"
                    href="oferta.html?id=${encodeURIComponent(produto.id)}"
                >
                    Ver oferta
                </a>
            </div>
        `;

        ativarEfeito3D(card);
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
    prepararAnimacoes();
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
