const API = window.API_BASE || (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && location.port !== "8000" ? "http://127.0.0.1:8000" : "");
const ADMIN_TOKEN_KEY = "ofertasAdminToken";

let produtos = [];
let categorias = [];
let editandoId = null;
let produtoParaExcluir = null;
let resultadosMercadoLivre = [];
let imagemArquivoPendente = null;
let imagemPreviewLocal = null;

const $ = (id) => document.getElementById(id);

function tokenAdmin() {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY);
}

function bloquearPainel(bloqueado) {
    document.querySelector(".admin-header")?.toggleAttribute("inert", bloqueado);
    document.querySelector(".admin-main")?.toggleAttribute("inert", bloqueado);
}

function fetchAdmin(url, options = {}) {
    const headers = new Headers(options.headers || {});
    const token = tokenAdmin();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, { ...options, headers });
}

async function prepararAutenticacao() {
    const resposta = await fetch(`${API}/auth/status`);
    if (!resposta.ok) throw new Error("Não foi possível verificar o acesso administrativo.");
    const { enabled } = await resposta.json();
    if (!enabled) return;

    const token = tokenAdmin();
    if (token) {
        const validacao = await fetchAdmin(`${API}/auth/verify`);
        if (validacao.ok) {
            $("btnLogout").classList.remove("hidden");
            return;
        }
        sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    }

    $("loginOverlay").classList.remove("hidden");
    bloquearPainel(true);
    $("adminLoginUser").focus();
}

async function entrarNoPainel(event) {
    event.preventDefault();
    const mensagem = $("loginMessage");
    const botao = $("loginSubmit");
    mensagem.textContent = "";
    botao.disabled = true;
    botao.textContent = "Entrando...";

    try {
        const resposta = await fetch(`${API}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({
                username: $("adminLoginUser").value.trim(),
                password: $("adminLoginPassword").value
            })
        });
        const resultado = await resposta.json();
        if (!resposta.ok) throw new Error(resultado.detail || "Não foi possível entrar.");
        if (resultado.access_token) {
            sessionStorage.setItem(ADMIN_TOKEN_KEY, resultado.access_token);
        }
        bloquearPainel(false);
        $("loginOverlay").classList.add("hidden");
        $("btnLogout").classList.remove("hidden");
        await carregarCategorias();
        await carregarProdutos();
    } catch (erro) {
        mensagem.textContent = erro.message;
    } finally {
        botao.disabled = false;
        botao.textContent = "Entrar no painel";
    }
}

function numero(valor) {
    const n = Number(valor);
    return Number.isFinite(n) ? n : null;
}

function moeda(valor) {
    return Number(valor).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function mostrarMensagemMercadoLivre(texto, erro = false) {
    const area = $("mercadoLivreMessage");
    area.textContent = texto;
    area.classList.toggle("error", erro);
}

function renderizarResultadosMercadoLivre(resultados) {
    const area = $("mercadoLivreResults");
    resultadosMercadoLivre = resultados;

    if (!resultados.length) {
        area.innerHTML = "";
        mostrarMensagemMercadoLivre("Nenhum produto encontrado para essa busca.");
        return;
    }

    mostrarMensagemMercadoLivre(`${resultados.length} resultado(s). Selecione um para revisar no formulário.`);
    area.innerHTML = resultados.map((produto, index) => `
        <article class="marketplace-result">
            ${produto.imagem
                ? `<img src="${escapeHtml(produto.imagem)}" alt="" loading="lazy">`
                : '<span class="marketplace-no-image" aria-hidden="true">Sem foto</span>'}
            <div class="marketplace-result-copy">
                <strong title="${escapeHtml(produto.nome)}">${escapeHtml(produto.nome)}</strong>
                <span>${moeda(produto.preco_atual)}</span>
                <button type="button" data-marketplace-index="${index}">Usar no cadastro</button>
            </div>
        </article>
    `).join("");
}

async function buscarNoMercadoLivre(event) {
    event.preventDefault();
    const termo = $("mercadoLivreTermo").value.trim();
    if (termo.length < 2) return;

    const botao = $("mercadoLivreBuscar");
    botao.disabled = true;
    botao.textContent = "Buscando...";
    $("mercadoLivreResults").innerHTML = "";
    mostrarMensagemMercadoLivre("Consultando a API do Mercado Livre...");

    try {
        const resposta = await fetchAdmin(
            `${API}/integracoes/mercado-livre/buscar?q=${encodeURIComponent(termo)}`
        );
        const resultado = await resposta.json();
        if (!resposta.ok) {
            throw new Error(resultado.detail || "Não foi possível consultar o Mercado Livre.");
        }
        renderizarResultadosMercadoLivre(resultado.resultados || []);
    } catch (erro) {
        mostrarMensagemMercadoLivre(erro.message, true);
    } finally {
        botao.disabled = false;
        botao.textContent = "Buscar produtos";
    }
}

function usarResultadoMercadoLivre(event) {
    const botao = event.target.closest("[data-marketplace-index]");
    if (!botao) return;

    if (editandoId !== null) {
        toast("Finalize ou cancele a edição atual antes de importar.");
        return;
    }

    const produto = resultadosMercadoLivre[Number(botao.dataset.marketplaceIndex)];
    if (!produto) return;

    $("nomeProduto").value = produto.nome || "";
    $("categoria").value = "";
    $("descricao").value = "";
    $("precoAntigo").value = produto.preco_antigo ?? "";
    $("precoAtual").value = produto.preco_atual ?? "";
    $("loja").value = "Mercado Livre";
    $("imagem").value = produto.imagem || "";
    $("linkProduto").value = produto.link_produto || "";
    $("linkAfiliado").value = "";
    $("avaliacao").value = "";
    calcularDesconto();
    atualizarPreview();

    mostrarMensagemMercadoLivre(
        "Dados preenchidos. Escolha a categoria, confira os valores e adicione seu link de afiliado antes de cadastrar."
    );
    $("formPanel").scrollIntoView({ behavior: "smooth", block: "start" });
    $("nomeProduto").focus();
}

function escapeHtml(valor) {
    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function categoriaNome(id) {
    const categoria = categorias.find(c => Number(c.id) === Number(id));
    return categoria ? categoria.nome : "Sem categoria";
}

function mostrarMensagem(texto, tipo = "") {
    const area = $("mensagem");
    if (!area) return;

    area.textContent = texto;
    area.className = `message ${tipo}`.trim();

    if (texto) {
        setTimeout(() => {
            if (area.textContent === texto) {
                area.textContent = "";
                area.className = "message";
            }
        }, 4500);
    }
}

function toast(texto) {
    const area = $("toast");
    area.textContent = texto;
    area.classList.add("show");

    setTimeout(() => area.classList.remove("show"), 2500);
}

function calcularDesconto() {
    const antigo = numero($("precoAntigo").value);
    const atual = numero($("precoAtual").value);

    if (antigo !== null && antigo > 0 && atual !== null && atual >= 0 && atual <= antigo) {
        $("desconto").value = Math.round(((antigo - atual) / antigo) * 100);
    } else {
        $("desconto").value = "";
    }
}

function limparPreview() {
    imagemArquivoPendente = null;
    $("imagemArquivo").value = "";
    $("imageFileStatus").textContent = "A foto será enviada ao salvar a oferta.";
    $("imageFileStatus").classList.remove("error");
    if (imagemPreviewLocal) {
        URL.revokeObjectURL(imagemPreviewLocal);
        imagemPreviewLocal = null;
    }
    $("previewImage").removeAttribute("src");
    $("previewImage").style.display = "none";
    $("previewText").style.display = "block";
    $("previewText").textContent = "Prévia";
}

function atualizarPreview() {
    const url = $("imagem").value.trim();

    if (imagemArquivoPendente) {
        imagemArquivoPendente = null;
        $("imagemArquivo").value = "";
        $("imageFileStatus").textContent = "Usando a imagem informada pela URL.";
        if (imagemPreviewLocal) {
            URL.revokeObjectURL(imagemPreviewLocal);
            imagemPreviewLocal = null;
        }
    }

    if (!url) {
        limparPreview();
        return;
    }

    const img = $("previewImage");
    img.onload = () => {
        img.style.display = "block";
        $("previewText").style.display = "none";
    };
    img.onerror = () => {
        img.style.display = "none";
        $("previewText").style.display = "block";
        $("previewText").textContent = "Imagem indisponível";
    };
    img.src = url;
}

function selecionarImagemArquivo(file) {
    const status = $("imageFileStatus");
    const tiposAceitos = ["image/jpeg", "image/png", "image/webp"];
    if (!file) return;

    if (!tiposAceitos.includes(file.type)) {
        status.textContent = "Formato inválido. Escolha uma imagem JPG, PNG ou WebP.";
        status.classList.add("error");
        $("imagemArquivo").value = "";
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        status.textContent = "A imagem excede o limite de 5 MB.";
        status.classList.add("error");
        $("imagemArquivo").value = "";
        return;
    }

    imagemArquivoPendente = file;
    $("imagem").value = "";
    status.textContent = `${file.name} · ${(file.size / (1024 * 1024)).toFixed(2)} MB · será enviada ao salvar`;
    status.classList.remove("error");

    if (imagemPreviewLocal) URL.revokeObjectURL(imagemPreviewLocal);
    imagemPreviewLocal = URL.createObjectURL(file);
    const img = $("previewImage");
    img.src = imagemPreviewLocal;
    img.style.display = "block";
    $("previewText").style.display = "none";
}

async function enviarImagemPendente() {
    if (!imagemArquivoPendente) return $("imagem").value.trim() || null;

    const resposta = await fetchAdmin(`${API}/uploads/imagens`, {
        method: "POST",
        headers: {
            "Content-Type": imagemArquivoPendente.type,
            "Accept": "application/json"
        },
        body: imagemArquivoPendente
    });
    const resultado = await resposta.json();
    if (!resposta.ok) {
        throw new Error(resultado.detail || "Não foi possível enviar a imagem.");
    }
    return resultado.url;
}

async function carregarCategorias() {
    const resposta = await fetchAdmin(`${API}/categorias/`);

    if (!resposta.ok) {
        throw new Error("Não foi possível carregar as categorias.");
    }

    categorias = await resposta.json();

    $("categoria").innerHTML = '<option value="">Selecione uma categoria</option>';
    $("filtroCategoria").innerHTML = '<option value="">Todas as categorias</option>';

    categorias.forEach(categoria => {
        const optionForm = document.createElement("option");
        optionForm.value = categoria.id;
        optionForm.textContent = categoria.nome;
        $("categoria").appendChild(optionForm);

        const optionFilter = document.createElement("option");
        optionFilter.value = categoria.id;
        optionFilter.textContent = categoria.nome;
        $("filtroCategoria").appendChild(optionFilter);
    });
}

async function carregarProdutos() {
    $("listaProdutos").innerHTML = '<div class="loading">Carregando ofertas...</div>';

    try {
        const resposta = await fetchAdmin(`${API}/produtos/`);

        if (!resposta.ok) {
            throw new Error(`HTTP ${resposta.status}`);
        }

        produtos = await resposta.json();

        atualizarResumo();
        renderizarProdutos();
    } catch (erro) {
        console.error(erro);
        $("listaProdutos").innerHTML =
            '<div class="error">Não foi possível carregar as ofertas. Verifique o backend.</div>';
    }
}

function atualizarResumo() {
    $("statTotal").textContent = produtos.length;

    $("statDesconto").textContent =
        produtos.filter(p => Number(p.desconto) > 0).length;

    const lojas = new Set(
        produtos
            .map(p => String(p.loja || "").trim())
            .filter(Boolean)
    );

    $("statLojas").textContent = lojas.size;
}

function produtosFiltrados() {
    const busca = $("buscaProdutos").value.trim().toLowerCase();
    const categoria = $("filtroCategoria").value;
    const loja = $("filtroLoja").value;

    return produtos.filter(produto => {
        const nome = String(produto.nome || "").toLowerCase();

        const correspondeBusca =
            !busca ||
            nome.includes(busca) ||
            String(produto.loja || "").toLowerCase().includes(busca);

        const correspondeCategoria =
            !categoria ||
            String(produto.categoria_id) === String(categoria);

        const correspondeLoja =
            !loja ||
            String(produto.loja) === loja;

        return correspondeBusca && correspondeCategoria && correspondeLoja;
    });
}

function renderizarProdutos() {
    const lista = produtosFiltrados();

    $("contadorProdutos").textContent =
        `${lista.length} ${lista.length === 1 ? "oferta" : "ofertas"}`;

    if (!lista.length) {
        $("listaProdutos").innerHTML =
            '<div class="empty">Nenhuma oferta encontrada.</div>';
        return;
    }

    $("listaProdutos").innerHTML = lista.map(produto => {
        const imagem = produto.imagem
            ? `<img src="${escapeHtml(produto.imagem)}"
                    alt="${escapeHtml(produto.nome)}"
                    onerror="this.style.display='none';this.parentElement.textContent='Sem imagem';">`
            : "Sem imagem";

        const precoAntigo = produto.preco_antigo != null
            ? `<del>${moeda(produto.preco_antigo)}</del>`
            : "";

        const desconto = Number(produto.desconto) > 0
            ? `<span class="discount-badge">${Number(produto.desconto).toFixed(0)}% OFF</span>`
            : `<span class="product-category">Sem desconto</span>`;

        return `
            <article class="product-row">
                <div class="product-thumb">${imagem}</div>

                <div class="product-name">
                    <strong title="${escapeHtml(produto.nome)}">
                        ${escapeHtml(produto.nome)}
                    </strong>
                    <span>${escapeHtml(produto.loja || "Sem loja")}</span>
                </div>

                <div class="product-category">
                    ${escapeHtml(categoriaNome(produto.categoria_id))}
                </div>

                <div class="product-price">
                    ${precoAntigo}
                    <strong>${moeda(produto.preco_atual)}</strong>
                </div>

                <div>${desconto}</div>

                <div class="actions">
                    <a class="action-btn"
                       href="oferta.html?id=${encodeURIComponent(produto.id)}"
                       target="_blank" rel="noopener">
                        Ver
                    </a>
                    <button class="action-btn"
                            type="button"
                            data-action="edit"
                            data-id="${produto.id}">
                        Editar
                    </button>
                    <button class="action-btn delete"
                            type="button"
                            data-action="delete"
                            data-id="${produto.id}">
                        Excluir
                    </button>
                </div>
            </article>
        `;
    }).join("");
}

function preencherFormulario(produto) {
    editandoId = produto.id;

    $("formTitle").textContent = "Editar oferta";
    $("btnSalvar").textContent = "Salvar alterações";
    $("btnCancelarEdicao").classList.remove("hidden");

    $("nomeProduto").value = produto.nome ?? "";
    $("categoria").value = produto.categoria_id ?? "";
    $("descricao").value = produto.descricao ?? "";
    $("precoAntigo").value = produto.preco_antigo ?? "";
    $("precoAtual").value = produto.preco_atual ?? "";
    $("desconto").value = produto.desconto ?? "";
    $("imagem").value = produto.imagem ?? "";
    $("loja").value = produto.loja ?? "";
    $("avaliacao").value = produto.avaliacao ?? "";
    $("linkProduto").value = produto.link_produto ?? "";
    $("linkAfiliado").value = produto.link_afiliado ?? "";

    limparPreview();
    $("imagem").value = produto.imagem ?? "";
    atualizarPreview();
    $("formPanel").scrollIntoView({ behavior: "smooth", block: "start" });
    $("nomeProduto").focus();
}

function limparFormulario() {
    editandoId = null;

    $("offerForm").reset();
    $("formTitle").textContent = "Nova oferta";
    $("btnSalvar").textContent = "Cadastrar oferta";
    $("btnCancelarEdicao").classList.add("hidden");
    $("desconto").value = "";
    limparPreview();
    mostrarMensagem("");
}

function dadosDoFormulario() {
    const nome = $("nomeProduto").value.trim();
    const precoAtual = numero($("precoAtual").value);
    const categoriaId = Number($("categoria").value);
    const loja = $("loja").value;

    if (!nome) throw new Error("Digite o nome do produto.");
    if (precoAtual === null || precoAtual <= 0) {
        throw new Error("Digite um preço atual válido.");
    }
    if (!Number.isInteger(categoriaId) || categoriaId <= 0) {
        throw new Error("Selecione uma categoria.");
    }
    if (!loja) throw new Error("Selecione uma loja.");

    const precoAntigo = numero($("precoAntigo").value);

    if (precoAntigo !== null && precoAtual > precoAntigo) {
        throw new Error("O preço atual não pode ser maior que o preço antigo.");
    }

    return {
        nome,
        descricao: $("descricao").value.trim() || null,
        preco_antigo: precoAntigo,
        preco_atual: precoAtual,
        desconto: numero($("desconto").value),
        imagem: $("imagem").value.trim() || null,
        categoria_id: categoriaId,
        loja,
        link_produto: $("linkProduto").value.trim() || null,
        link_afiliado: $("linkAfiliado").value.trim() || null,
        avaliacao: numero($("avaliacao").value)
    };
}

async function salvarProduto(event) {
    event.preventDefault();

    try {
        const dados = dadosDoFormulario();

        const url = editandoId
            ? `${API}/produtos/${editandoId}`
            : `${API}/produtos/`;

        const method = editandoId ? "PUT" : "POST";

        $("btnSalvar").disabled = true;
        $("btnSalvar").textContent = editandoId
            ? "Salvando..."
            : "Cadastrando...";

        dados.imagem = await enviarImagemPendente();

        const resposta = await fetchAdmin(url, {
            method,
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(dados)
        });

        const resultado = await resposta.json();

        if (!resposta.ok) {
            const detalhe = typeof resultado.detail === "string"
                ? resultado.detail
                : JSON.stringify(resultado.detail || resultado);

            throw new Error(detalhe);
        }

        const mensagem = editandoId
            ? "Oferta atualizada com sucesso."
            : "Oferta cadastrada com sucesso.";

        limparFormulario();
        toast(mensagem);
        await carregarProdutos();
    } catch (erro) {
        console.error(erro);
        mostrarMensagem(erro.message, "error");
    } finally {
        $("btnSalvar").disabled = false;
        $("btnSalvar").textContent =
            editandoId ? "Salvar alterações" : "Cadastrar oferta";
    }
}

function abrirModalExclusao(produto) {
    produtoParaExcluir = produto;

    $("modalTitle").textContent = "Excluir oferta?";
    $("modalText").textContent =
        `A oferta "${produto.nome}" será excluída permanentemente.`;

    $("confirmModal").classList.remove("hidden");
    $("confirmModal").setAttribute("aria-hidden", "false");
}

function fecharModal() {
    produtoParaExcluir = null;
    $("confirmModal").classList.add("hidden");
    $("confirmModal").setAttribute("aria-hidden", "true");
}

async function excluirProduto() {
    if (!produtoParaExcluir) return;

    const id = produtoParaExcluir.id;

    try {
        $("btnModalExcluir").disabled = true;
        $("btnModalExcluir").textContent = "Excluindo...";

        const resposta = await fetchAdmin(`${API}/produtos/${id}`, {
            method: "DELETE"
        });

        const resultado = await resposta.json();

        if (!resposta.ok) {
            throw new Error(resultado.detail || "Não foi possível excluir.");
        }

        fecharModal();
        toast("Oferta excluída com sucesso.");

        if (editandoId === id) {
            limparFormulario();
        }

        await carregarProdutos();
    } catch (erro) {
        console.error(erro);
        toast(`Erro: ${erro.message}`);
    } finally {
        $("btnModalExcluir").disabled = false;
        $("btnModalExcluir").textContent = "Excluir";
    }
}

function tratarAcaoProduto(event) {
    const botao = event.target.closest("[data-action]");
    if (!botao) return;

    const id = Number(botao.dataset.id);
    const produto = produtos.find(p => Number(p.id) === id);

    if (!produto) return;

    if (botao.dataset.action === "edit") {
        preencherFormulario(produto);
    }

    if (botao.dataset.action === "delete") {
        abrirModalExclusao(produto);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    $("adminLoginForm").addEventListener("submit", entrarNoPainel);
    $("btnLogout").addEventListener("click", () => {
        sessionStorage.removeItem(ADMIN_TOKEN_KEY);
        location.reload();
    });
    $("precoAntigo").addEventListener("input", calcularDesconto);
    $("precoAtual").addEventListener("input", calcularDesconto);
    $("imagem").addEventListener("input", atualizarPreview);
    $("imagemArquivo").addEventListener("change", event => {
        selecionarImagemArquivo(event.target.files?.[0]);
    });
    const imageDropzone = $("imageDropzone");
    ["dragenter", "dragover"].forEach(type => imageDropzone.addEventListener(type, event => {
        event.preventDefault();
        imageDropzone.classList.add("dragging");
    }));
    ["dragleave", "drop"].forEach(type => imageDropzone.addEventListener(type, event => {
        event.preventDefault();
        imageDropzone.classList.remove("dragging");
    }));
    imageDropzone.addEventListener("drop", event => {
        const file = event.dataTransfer?.files?.[0];
        if (!file) return;
        const transfer = new DataTransfer();
        transfer.items.add(file);
        $("imagemArquivo").files = transfer.files;
        selecionarImagemArquivo(file);
    });

    $("offerForm").addEventListener("submit", salvarProduto);
    $("mercadoLivreSearchForm").addEventListener("submit", buscarNoMercadoLivre);
    $("mercadoLivreResults").addEventListener("click", usarResultadoMercadoLivre);

    $("btnLimpar").addEventListener("click", limparFormulario);
    $("btnCancelarEdicao").addEventListener("click", limparFormulario);

    $("btnAtualizar").addEventListener("click", async () => {
        $("btnAtualizar").disabled = true;
        try {
            await carregarProdutos();
            toast("Lista atualizada.");
        } finally {
            $("btnAtualizar").disabled = false;
        }
    });

    $("buscaProdutos").addEventListener("input", renderizarProdutos);
    $("filtroCategoria").addEventListener("change", renderizarProdutos);
    $("filtroLoja").addEventListener("change", renderizarProdutos);

    $("listaProdutos").addEventListener("click", tratarAcaoProduto);

    $("btnModalCancelar").addEventListener("click", fecharModal);
    $("btnModalExcluir").addEventListener("click", excluirProduto);

    $("confirmModal").addEventListener("click", event => {
        if (event.target.classList.contains("modal-backdrop")) {
            fecharModal();
        }
    });

    try {
        await prepararAutenticacao();
        await carregarCategorias();
        await carregarProdutos();
    } catch (erro) {
        console.error(erro);
        $("listaProdutos").innerHTML =
            '<div class="error">Não foi possível iniciar o painel.</div>';
    }
});
