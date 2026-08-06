// ==UserScript==
// @name         Shopee — Painel de Atendimento
// @namespace    empresa-shopee-chat
// @version      2.1
// @description  Painel de ações no chat da Shopee
// @match        https://seller.shopee.com.br/new-webchat/*
// @grant        GM_xmlhttpRequest
// @connect      api.trello.com
// @updateURL    https://raw.githubusercontent.com/italoBer/trello-automacoes/refs/heads/main/tampermonkey/shopee-chat.js
// @downloadURL  https://raw.githubusercontent.com/italoBer/trello-automacoes/refs/heads/main/tampermonkey/shopee-chat.js
// ==/UserScript==

(function () {
    'use strict';

    // ============================================================
    // ⚙️ CONFIGURAÇÃO
    // ============================================================

    // ID do quadro do Trello — resolvido em tempo de execução, NÃO fica no código
    // (o repositório é público). Ordem: localStorage → auto-detecção pelo nome do
    // quadro na conta. Se não resolver, o painel mostra aviso e o botão ⚙️ deixa
    // configurar/trocar o quadro a qualquer momento (sem console, sem travar).
    let BOARD_ID = null;
    const CHAVE_BOARD = "sp_chat_board_id";

    // Aceita tanto o ID puro quanto uma URL colada (trello.com/b/ID/nome)
    function extrairBoardId(txt) {
        const t = (txt || "").trim();
        const m = t.match(/trello\.com\/b\/([^/\s]+)/i);
        return (m ? m[1] : t).trim();
    }

    async function detectarBoardAuto() {
        try {
            // filter=open: ignora quadros fechados/arquivados na detecção
            const boards = await api("GET", "/members/me/boards?filter=open&fields=name,shortLink");
            const candidatos = (boards || []).filter(b =>
                (b.name || "").toLowerCase().includes("shopee")
            );
            if (candidatos.length === 1) return candidatos[0].shortLink;
        } catch { /* ignora — cai na configuração manual */ }
        return null;
    }

    async function resolverBoardId() {
        if (BOARD_ID) return BOARD_ID;
        const salvo = localStorage.getItem(CHAVE_BOARD);
        if (salvo) { BOARD_ID = salvo; return BOARD_ID; }
        const auto = await detectarBoardAuto();
        if (auto) { BOARD_ID = auto; localStorage.setItem(CHAVE_BOARD, auto); return BOARD_ID; }
        return null; // não resolveu — o painel vai pedir configuração pela ⚙️
    }

    // Listas de destino
    const LISTA_INICIAL         = "INICIAL";
    const LISTA_EXPORTANDO      = "EXPORTANDO";
    const LISTA_EXPORTADO       = "Exportado";
    const LISTA_DESENVOLVIMENTO = "DESENVOLVIMENTO";
    const LISTA_ACOES           = "AÇÕES";
    const LISTA_FALTA_INFO      = "FALTA INFORMAÇÕES";
    const LISTA_RECLAMACOES     = "PROBLEMAS/RECLAMAÇÕES";
    const LISTA_AGUARDANDO      = "AGUARDANDO APROVAÇÃO";
    const LISTA_AGUARDANDO_ALT  = "AGUARDANDO APROVAÇÃO DA ALTERAÇÃO";
    const LISTA_CORRECAO        = "CORREÇÃO";
    const LISTA_CONFERINDO      = "CONFERINDO";
    const LISTA_FINALIZADO      = "FINALIZADO";

    // Etiquetas
    const ETIQUETA_SEM_LOGO     = "sem logo";
    const ETIQUETA_MAIS_COMPRAS = "mais compras";

    // ── Classes da Shopee (ofuscadas — atualizar se quebrarem) ──
    const SEL = {
        NOME_ATIVO:   'UcYjICexD_',
        ID_PEDIDO:    'H3yGQe9QZ2',
        NOME_LISTA:   '_2-B1ORyky',
        PAI_NOME:     'fFASPd5FTs',
        PAI_ID:       'fBhVGqTe_L',
    };

    // ── Listas por modo (usa includes — funciona com emojis) ──
    const LISTAS_INICIAL = ["INICIAL", "FALTA INFORMAÇÕES"];

    const LISTAS_DESENVOLVIMENTO = [
        "DESENVOLVIMENTO", "AÇÕES",
    ];

    const LISTAS_ALTERACAO = [
        "ALTERAÇÕES", "ALTERAÇÃO", "CORREÇÃO",
    ];

    const LISTAS_AGUARDANDO = [
        "AGUARDANDO APROVAÇÃO",
    ];

    const LISTAS_EXPORTANDO = [
        "EXPORTANDO",
    ];

    const LISTAS_FAZENDO_CROQUI = [
        "FAZENDO CROQUI", "CROQUI PRONTO",
    ];

    const LISTAS_CONFERINDO = ["CONFERINDO"];
    const LISTAS_FINALIZADO = ["FINALIZADO"];

    // ============================================================
    // FIM DA CONFIGURAÇÃO
    // ============================================================

    const CHAVE_CREDS     = { key: "trello_key", token: "trello_token" };
    const CHAVE_LISTA_ALT = "sp_chat_lista_alteracao";
    const PAINEL_ID       = "sp-painel-atendimento";

    function norm(nome) { return (nome || "").trim().toUpperCase(); }
    // Match com word boundary pra funcionar com emojis sem falsos positivos
    function listaEm(nome, lista) {
        const nomeN = norm(nome);
        return lista.some(l => {
            const lN = norm(l);
            // Começa com
            if (nomeN.startsWith(lN)) {
                const charAfter = nomeN[lN.length];
                return !charAfter || !/[A-ZÀ-Ý]/.test(charAfter);
            }
            // Contém como palavra separada
            const idx = nomeN.indexOf(lN);
            if (idx === -1) return false;
            if (idx > 0 && /[A-ZÀ-Ý]/.test(nomeN[idx - 1])) return false;
            const charAfter = nomeN[idx + lN.length];
            return !charAfter || !/[A-ZÀ-Ý]/.test(charAfter);
        });
    }

    // Extrai só o nome do cliente do título (último trecho após " - "), p/ comparar por igualdade
    function nomeClienteDoCard(nomeCard) {
        const p = (nomeCard || "").split(" - ");
        return (p.length > 1 ? p[p.length - 1] : (nomeCard || "")).trim().toLowerCase();
    }

    function getKey()   { return localStorage.getItem(CHAVE_CREDS.key); }
    function getToken() { return localStorage.getItem(CHAVE_CREDS.token); }

    function garantirCredenciais() {
        if (getKey() && getToken()) return true;
        const key   = prompt("Digite sua API KEY do Trello:");
        const token = prompt("Digite seu TOKEN do Trello:");
        if (!key || !token) { alert("❌ Credenciais obrigatórias."); return false; }
        localStorage.setItem(CHAVE_CREDS.key, key);
        localStorage.setItem(CHAVE_CREDS.token, token);
        return true;
    }

    function redefinirCredenciais() {
        localStorage.removeItem(CHAVE_CREDS.key);
        localStorage.removeItem(CHAVE_CREDS.token);
    }

    // Overlay de configuração do quadro (e reset de credenciais) — sem precisar de console
    function configurarQuadro(aoSalvar) {
        if (document.getElementById("sp-cfg-overlay")) return;
        const atual = localStorage.getItem(CHAVE_BOARD) || "";
        const overlay = document.createElement("div");
        overlay.id = "sp-cfg-overlay";
        Object.assign(overlay.style, {
            position: "fixed", inset: "0", background: "rgba(0,0,0,0.8)",
            zIndex: "99999999", display: "flex", alignItems: "center", justifyContent: "center"
        });
        overlay.innerHTML = `
        <div style="background:#111;border:1px solid #333;border-radius:12px;padding:24px;
            width:320px;max-width:90%;color:#fff;font-family:'IBM Plex Mono',monospace;font-size:12px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                <span style="color:#ee4d2d;font-weight:bold;letter-spacing:1px">⚙️ CONFIGURAR QUADRO</span>
                <button id="sp-cfg-x" style="background:none;border:none;color:#888;font-size:16px;cursor:pointer">✕</button>
            </div>
            <label style="color:#aaa;font-size:11px">ID do quadro do Trello</label>
            <input id="sp-cfg-id" value="${atual}" placeholder="cole o ID ou a URL do quadro"
                style="width:100%;background:#1e1e1e;border:1px solid #444;border-radius:8px;
                padding:9px;color:#fff;font-family:inherit;font-size:12px;margin:6px 0 4px">
            <div style="color:#666;font-size:10px;margin-bottom:10px">Está na URL: trello.com/b/<b>ESTE_PEDAÇO</b>/nome</div>
            <button id="sp-cfg-auto" style="width:100%;background:#1e1e1e;border:1px dashed #555;border-radius:8px;
                padding:8px;color:#aaa;cursor:pointer;font-family:inherit;font-size:11px;margin-bottom:14px">
                🔍 Detectar automaticamente
            </button>
            <button id="sp-cfg-salvar" style="width:100%;background:#ee4d2d;border:none;border-radius:8px;
                padding:10px;color:#fff;font-weight:bold;font-family:inherit;font-size:12px;cursor:pointer;margin-bottom:12px">
                Salvar
            </button>
            <button id="sp-cfg-creds" style="width:100%;background:transparent;border:1px solid #444;border-radius:8px;
                padding:8px;color:#888;cursor:pointer;font-family:inherit;font-size:11px">
                🔑 Redefinir credenciais do Trello
            </button>
        </div>`;
        document.body.appendChild(overlay);
        const fechar = () => overlay.remove();
        document.getElementById("sp-cfg-x").onclick = fechar;
        overlay.onclick = e => { if (e.target === overlay) fechar(); };

        document.getElementById("sp-cfg-auto").onclick = async () => {
            const btnA = document.getElementById("sp-cfg-auto");
            btnA.innerText = "🔍 Detectando...";
            const auto = await detectarBoardAuto();
            if (auto) { document.getElementById("sp-cfg-id").value = auto; btnA.innerText = "✅ Encontrado"; }
            else btnA.innerText = "❌ Não achei — cole manualmente";
        };
        document.getElementById("sp-cfg-salvar").onclick = () => {
            const id = extrairBoardId(document.getElementById("sp-cfg-id").value);
            if (!id) { alert("❌ Informe o ID do quadro."); return; }
            localStorage.setItem(CHAVE_BOARD, id);
            BOARD_ID = id;
            fechar();
            if (aoSalvar) aoSalvar();
        };
        document.getElementById("sp-cfg-creds").onclick = () => {
            if (!confirm("Redefinir as credenciais do Trello (key/token)?")) return;
            redefinirCredenciais();
            fechar();
            location.reload();
        };
    }

    // fetch nativo primeiro (não depende do Tampermonkey); GM de reserva p/ CSP restritiva
    function api(method, path, body) {
        const sep = path.includes("?") ? "&" : "?";
        const url = `https://api.trello.com/1${path}${sep}key=${getKey()}&token=${getToken()}`;
        const opts = { method, headers: { "Content-Type": "application/json" } };
        if (body) opts.body = JSON.stringify(body);
        return fetch(url, opts)
            .then(r => r.text().then(t => t ? JSON.parse(t) : {}))
            .catch(() => new Promise((resolve, reject) => {
                if (typeof GM_xmlhttpRequest === "undefined") return reject(new Error("sem rede"));
                GM_xmlhttpRequest({
                    method, url,
                    headers: { "Content-Type": "application/json" },
                    data: body ? JSON.stringify(body) : undefined,
                    timeout: 30000,
                    ontimeout: () => reject(new Error("timeout")),
                    onload: r => { try { resolve(r.responseText ? JSON.parse(r.responseText) : {}); } catch(e) { reject(e); } },
                    onerror: reject
                });
            }));
    }

    // ─── Detectar comprador ativo ───────────────────────────────
    function getNomeAtivo() {
        // Tenta pelo seletor conhecido
        const el = document.querySelector(`.${SEL.NOME_ATIVO}`);
        if (el) {
            const t = el.innerText?.trim();
            if (t && t.length >= 3 && t.length <= 40) return t;
        }
        // Fallback: procura no topo do chat por posição
        const todos = [...document.querySelectorAll('*')].filter(e => {
            if (e.children.length > 0) return false;
            const t = e.innerText?.trim();
            if (!t || t.length < 3 || t.length > 40) return false;
            const r = e.getBoundingClientRect();
            return r.top > 60 && r.top < 160 && r.left > 300 && r.left < 600;
        });
        // Pega o primeiro que pareça um username (sem espaço, sem $)
        const username = todos.find(e => /^[a-z0-9._-]+$/i.test(e.innerText.trim()));
        return username?.innerText?.trim() || null;
    }

    function getIdPedido() {
        // Tenta pelo seletor conhecido
        const el = document.querySelector(`.${SEL.ID_PEDIDO}`);
        if (el) {
            const t = el.innerText?.trim();
            if (t && /^[A-Z0-9]{10,}$/i.test(t)) return t;
        }
        // Fallback: procura qualquer ID alfanumérico longo no painel direito
        const ids = [...document.querySelectorAll('*')].filter(e => {
            if (e.children.length > 0) return false;
            const t = e.innerText?.trim();
            return t && /^[A-Z0-9]{12,}$/i.test(t);
        });
        // Filtra os que estão no lado direito da tela (painel de detalhes)
        const direita = ids.find(e => {
            const r = e.getBoundingClientRect();
            return r.left > 500;
        });
        return direita?.innerText?.trim() || null;
    }

    // ─── Trello ─────────────────────────────────────────────────
    async function buscarCardPorNome(nomeComprador) {
        const cards = await api("GET", `/boards/${BOARD_ID}/cards?fields=name,desc,idList,url,idLabels`);
        // Primeiro: busca por ID do pedido na descrição
        const idPedido = getIdPedido();
        if (idPedido) {
            const porId = cards.find(c => (c.desc || "").includes(idPedido));
            if (porId) return { card: porId, allCards: cards };
        }
        // Segundo: busca pelo nome do comprador no título do card
        const nomeNorm = nomeComprador.toLowerCase();
        const porNome = cards.find(c => c.name.toLowerCase().includes(nomeNorm));
        return { card: porNome || null, allCards: cards };
    }

    async function buscarListas() {
        return await api("GET", `/boards/${BOARD_ID}/lists?fields=name`);
    }

    async function buscarEtiquetas() {
        return await api("GET", `/boards/${BOARD_ID}/labels`);
    }

    function encontrarLista(listas, nome) {
        const nomeN = norm(nome);
        // 1. Exato (ignora emojis no final)
        const exato = listas.find(l => {
            const limpo = norm(l.name).replace(/[^A-ZÀ-Ý0-9\s/]/g, '').trim();
            return limpo === nomeN;
        });
        if (exato) return exato;
        // 2. Começa com o nome (ex: "AÇÕES 🔶" começa com "AÇÕES")
        const comeca = listas.find(l => norm(l.name).startsWith(nomeN));
        if (comeca) return comeca;
        // 3. Inclui como palavra separada (após espaço ou início)
        return listas.find(l => {
            const ln = norm(l.name);
            const idx = ln.indexOf(nomeN);
            if (idx === -1) return false;
            if (idx > 0 && /[A-ZÀ-Ý]/.test(ln[idx - 1])) return false; // não no meio de palavra
            const charAfter = ln[idx + nomeN.length];
            return !charAfter || !/[A-ZÀ-Ý]/.test(charAfter);
        });
    }

    function encontrarListasAlteracao(listas) {
        return listas.filter(l => LISTAS_ALTERACAO.some(a => norm(l.name).includes(norm(a))));
    }

    async function moverCard(cardId, listId) {
        return await api("PUT", `/cards/${cardId}`, { idList: listId });
    }

    async function adicionarEtiqueta(cardId, labelId) {
        return await api("POST", `/cards/${cardId}/idLabels`, { value: labelId });
    }

    async function removerEtiqueta(cardId, labelId) {
        return await api("DELETE", `/cards/${cardId}/idLabels/${labelId}`);
    }

    // ─── UI ─────────────────────────────────────────────────────
    function confirmar(titulo, mensagem) {
        return new Promise(resolve => {
            const overlay = document.createElement("div");
            Object.assign(overlay.style, {
                position: "fixed", inset: "0", background: "rgba(0,0,0,0.75)",
                zIndex: "99999999", display: "flex", alignItems: "center", justifyContent: "center"
            });
            overlay.innerHTML = `
            <div style="background:#1a1a1a;border:1px solid #ee4d2d;border-radius:12px;
                padding:20px 24px;max-width:300px;font-family:'IBM Plex Mono',monospace;color:#fff;font-size:12px">
                <div style="color:#ee4d2d;font-weight:bold;margin-bottom:10px;font-size:13px">${titulo}</div>
                <div style="color:#ccc;margin-bottom:16px;line-height:1.5">${mensagem}</div>
                <div style="display:flex;gap:8px;justify-content:flex-end">
                    <button id="spconf-cancelar" style="background:#1e1e1e;border:2px solid #aaa;border-radius:6px;
                        padding:7px 16px;color:#fff;cursor:pointer;font-family:inherit;font-size:12px">✕ Cancelar</button>
                    <button id="spconf-ok" style="background:#ee4d2d;border:1px solid #ff6b47;border-radius:6px;
                        padding:7px 16px;color:#fff;cursor:pointer;font-family:inherit;font-size:12px">Confirmar</button>
                </div>
            </div>`;
            document.body.appendChild(overlay);
            document.getElementById("spconf-cancelar").onclick = () => { overlay.remove(); resolve(false); };
            document.getElementById("spconf-ok").onclick       = () => { overlay.remove(); resolve(true); };
            overlay.onclick = e => { if (e.target === overlay) { overlay.remove(); resolve(false); } };
        });
    }

    function toast(msg, tipo = "ok") {
        const t = document.createElement("div");
        Object.assign(t.style, {
            position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)",
            background: tipo === "ok" ? "#2e7d32" : tipo === "erro" ? "#b71c1c" : "#ee4d2d",
            color: "#fff", padding: "10px 20px", borderRadius: "8px", fontFamily: "monospace",
            fontSize: "13px", zIndex: "9999999", boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            transition: "opacity 0.4s ease", opacity: "1"
        });
        t.innerText = msg;
        document.body.appendChild(t);
        setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 400); }, 3000);
    }

    // ─── Painel principal ───────────────────────────────────────
    let _ultimoNome = null;

    async function criarPainel() {
        const nomeComprador = getNomeAtivo();
        if (!nomeComprador) return;
        if (nomeComprador === _ultimoNome && document.getElementById(PAINEL_ID)) return;
        _ultimoNome = nomeComprador;

        // Remove painel anterior
        document.getElementById(PAINEL_ID)?.remove();

        if (!garantirCredenciais()) return;

        const painel = document.createElement("div");
        painel.id = PAINEL_ID;
        const pos = JSON.parse(localStorage.getItem("sp_painel_pos") || "null");
        Object.assign(painel.style, {
            position: "fixed",
            top:  (pos ? pos.top  : 60) + "px",
            left: (pos ? pos.left : window.innerWidth - 256) + "px",
            width: "240px", background: "#111", border: "1px solid #333",
            borderRadius: "12px", padding: "16px", zIndex: "999999", color: "#fff",
            fontFamily: "'IBM Plex Mono', monospace, sans-serif", fontSize: "12px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)", userSelect: "none"
        });

        painel.innerHTML = `
            <div id="sp-drag" style="display:flex;justify-content:space-between;align-items:center;
                margin-bottom:12px;cursor:grab;padding-bottom:8px;border-bottom:1px solid #222">
                <span style="color:#ee4d2d;font-weight:bold;font-size:13px;letter-spacing:1px">🔧 SHOPEE</span>
                <div style="display:flex;gap:8px;align-items:center">
                    <button id="sp-config" title="Configurar quadro / credenciais" style="background:none;border:none;color:#888;cursor:pointer;font-size:14px;padding:0;line-height:1">⚙️</button>
                    <button id="sp-fechar" style="background:none;border:none;color:#888;cursor:pointer;font-size:16px;padding:0;line-height:1">✕</button>
                </div>
            </div>
            <div id="sp-status" style="color:#ccc;font-size:11px;margin-bottom:12px">🔍 Buscando card...</div>
            <div id="sp-mais-compras" style="display:none;margin-bottom:10px"></div>
            <div id="sp-acoes" style="display:none;flex-direction:column;gap:8px"></div>
        `;
        document.body.appendChild(painel);
        document.getElementById("sp-fechar").onclick = () => { painel.remove(); _ultimoNome = null; };
        document.getElementById("sp-config").onclick = () =>
            configurarQuadro(() => { _ultimoNome = null; painel.remove(); criarPainel(); });

        // Drag
        const drag = document.getElementById("sp-drag");
        let dragging = false, sx, sy, sl, st;
        drag.addEventListener("mousedown", e => {
            if (e.target.id === "sp-fechar" || e.target.id === "sp-config") return;
            dragging = true; sx = e.clientX; sy = e.clientY;
            sl = parseInt(painel.style.left) || 0; st = parseInt(painel.style.top) || 0;
            drag.style.cursor = "grabbing"; e.preventDefault();
        });
        document.addEventListener("mousemove", e => {
            if (!dragging) return;
            painel.style.left = Math.max(0, Math.min(window.innerWidth  - painel.offsetWidth,  sl + e.clientX - sx)) + "px";
            painel.style.top  = Math.max(0, Math.min(window.innerHeight - painel.offsetHeight, st + e.clientY - sy)) + "px";
        });
        document.addEventListener("mouseup", () => {
            if (!dragging) return;
            dragging = false; drag.style.cursor = "grab";
            localStorage.setItem("sp_painel_pos", JSON.stringify({
                top: parseInt(painel.style.top), left: parseInt(painel.style.left)
            }));
        });

        // Resolve o quadro; se não der, avisa e abre a config (⚙️) — nunca buga calado
        if (!(await resolverBoardId())) {
            document.getElementById("sp-status").innerHTML =
                `<span style="color:#ee4d2d">⚠️ Quadro não configurado.</span><br>` +
                `<span style="color:#888">Clique na ⚙️ para informar o quadro do Trello.</span>`;
            configurarQuadro(() => { _ultimoNome = null; painel.remove(); criarPainel(); });
            return;
        }

        // Buscar dados
        let card, allCards, listas, etiquetas;
        try {
            const resultado = await buscarCardPorNome(nomeComprador);
            card = resultado.card;
            allCards = resultado.allCards;
            [listas, etiquetas] = await Promise.all([buscarListas(), buscarEtiquetas()]);
        } catch {
            document.getElementById("sp-status").innerText = "❌ Erro ao buscar dados.";
            return;
        }

        const statusEl       = document.getElementById("sp-status");
        const maisComprasEl  = document.getElementById("sp-mais-compras");
        const acoesEl        = document.getElementById("sp-acoes");

        if (!card) {
            const idPedido = getIdPedido();
            statusEl.innerHTML = `<span style="color:#ef5350">❌ Card não encontrado</span><br>
                <span style="color:#888">Comprador: ${nomeComprador}</span>
                ${idPedido ? `<br><span style="color:#888">ID: ${idPedido}</span>` : ''}`;
            return;
        }

        const listaAtual     = listas.find(l => l.id === card.idList);
        const listaAtualNome = listaAtual?.name || "—";

        const modoComprou    = norm(listaAtualNome).startsWith("COMPROU");        // v1.4
        const modoCancelando = norm(listaAtualNome).startsWith("CANCELANDO");     // v1.4
        const modoReclamacoes = norm(listaAtualNome) === norm(LISTA_RECLAMACOES); // v1.9
        // v2.0: no quadro da Shopee é FALTA INFORMAÇÕES que faz o papel de
        // PROBLEMAS/RECLAMAÇÕES — mesmas ações de volta pro fluxo.
        const modoFaltaInfo  = norm(listaAtualNome) === norm(LISTA_FALTA_INFO);
        const modoInicial    = listaEm(listaAtualNome, LISTAS_INICIAL);
        const modoDesenv     = listaEm(listaAtualNome, LISTAS_DESENVOLVIMENTO);
        const modoAlteracao  = listaEm(listaAtualNome, LISTAS_ALTERACAO);
        const modoAguardando = listaEm(listaAtualNome, LISTAS_AGUARDANDO);
        const modoExportando = listaEm(listaAtualNome, LISTAS_EXPORTANDO);
        const modoFazCroqui  = listaEm(listaAtualNome, LISTAS_FAZENDO_CROQUI);
        const modoConferindo = listaEm(listaAtualNome, LISTAS_CONFERINDO);
        const modoFinalizado = listaEm(listaAtualNome, LISTAS_FINALIZADO);

        const listaInicial_       = encontrarLista(listas, LISTA_INICIAL);        // v1.9
        const listaExportando_    = encontrarLista(listas, LISTA_EXPORTANDO);
        const listaExportado_     = encontrarLista(listas, LISTA_EXPORTADO);
        const listaDesenv_        = encontrarLista(listas, LISTA_DESENVOLVIMENTO);
        const listaAcoes_         = encontrarLista(listas, LISTA_ACOES);
        const listaFaltaInfo_     = encontrarLista(listas, LISTA_FALTA_INFO);
        const listaReclamacoes_   = encontrarLista(listas, LISTA_RECLAMACOES);
        const listaAguardando_    = encontrarLista(listas, LISTA_AGUARDANDO);
        const listaAguardandoAlt_ = encontrarLista(listas, LISTA_AGUARDANDO_ALT);
        const listaCorrecao_      = encontrarLista(listas, LISTA_CORRECAO);
        const listaConferindo_    = encontrarLista(listas, LISTA_CONFERINDO);
        const listaFinalizado_    = encontrarLista(listas, LISTA_FINALIZADO);
        const listasAlt           = encontrarListasAlteracao(listas);
        const listaCancelando_    = listas.find(l => norm(l.name).startsWith("CANCELANDO"));  // v1.4

        const etqSemLogo     = etiquetas.find(e => (e.name || "").toLowerCase().includes(ETIQUETA_SEM_LOGO));
        const etqMaisCompras = etiquetas.find(e => (e.name || "").toLowerCase().includes(ETIQUETA_MAIS_COMPRAS));
        const cardTemSemLogo = etqSemLogo && (card.idLabels || []).includes(etqSemLogo.id);

        // Detectar mais compras — v1.9: compara o NOME DO CLIENTE por igualdade
        // (antes "contém" casava clientes diferentes com nome parecido)
        const nomeCliente = nomeClienteDoCard(card.name);
        const outrosCards = allCards.filter(c =>
            c.id !== card.id && nomeCliente.length >= 4 && nomeClienteDoCard(c.name) === nomeCliente
        );

        if (outrosCards.length > 0) {
            maisComprasEl.style.display = "inline-block";
            maisComprasEl.innerHTML = `
                <span style="background:#0047b3;border-radius:10px;
                    padding:2px 8px;font-size:10px;color:#b3d4ff;white-space:nowrap">
                    🔁 ${outrosCards.length} outro(s) pedido(s)
                </span>
            `;
        }

        statusEl.innerHTML = `
            <div style="color:#eee;margin-bottom:4px;word-break:break-word;font-size:11px">${card.name}</div>
            <div style="color:#aaa;font-size:11px">📋 ${listaAtualNome}</div>
        `;

        function btn(label, cor, fn) {
            const b = document.createElement("button");
            b.innerText = label;
            Object.assign(b.style, {
                background: "#1e1e1e", border: `1px solid ${cor}`, borderRadius: "8px",
                padding: "8px 10px", cursor: "pointer", color: "#eee", fontFamily: "inherit",
                fontSize: "12px", textAlign: "left", transition: "background 0.15s", width: "100%"
            });
            b.onmouseenter = () => b.style.background = "#2a2a2a";
            b.onmouseleave = () => b.style.background = "#1e1e1e";
            b.onclick = fn;
            return b;
        }

        async function mover(listaId, listaNome) {
            try {
                await moverCard(card.id, listaId);
                statusEl.innerHTML = `<span style="color:#ccc">✅ ${listaNome}</span>`;
                toast(`✅ ${listaNome}`);
            } catch { toast("❌ Erro ao mover card", "erro"); }
        }

        async function moverConfirmar(listaId, listaNome, titulo, msg) {
            const ok = await confirmar(titulo, msg || `Mover para<br><strong>${listaNome}</strong>?`);
            if (!ok) return;
            await mover(listaId, listaNome);
        }

        function btnEtiquetaSemLogo() {
            return btn(
                cardTemSemLogo ? "🏷️ Remover etiqueta sem logo" : "🏷️ Adicionar etiqueta sem logo",
                "#546e7a", async () => {
                    try {
                        cardTemSemLogo
                            ? await removerEtiqueta(card.id, etqSemLogo.id)
                            : await adicionarEtiqueta(card.id, etqSemLogo.id);
                        toast(`🏷️ Etiqueta ${cardTemSemLogo ? "removida" : "adicionada"}`);
                    } catch { toast("❌ Erro", "erro"); }
                }
            );
        }

        function selectAlteracao(comConfirmacao) {
            const div = document.createElement("div");
            div.style.cssText = "display:flex;flex-direction:column;gap:4px";
            const savedAlt = localStorage.getItem(CHAVE_LISTA_ALT);
            const sel = document.createElement("select");
            Object.assign(sel.style, {
                background: "#1e1e1e", border: "1px solid #ef6c00", borderRadius: "8px",
                padding: "7px 10px", color: "#eee", fontFamily: "inherit",
                fontSize: "12px", width: "100%", cursor: "pointer"
            });
            listasAlt.forEach(l => {
                const opt = document.createElement("option");
                opt.value = l.id; opt.text = l.name;
                if (l.id === savedAlt) opt.selected = true;
                sel.appendChild(opt);
            });
            sel.onchange = () => localStorage.setItem(CHAVE_LISTA_ALT, sel.value);
            const b = btn("🔄 Pediu alteração", "#ef6c00", async () => {
                const listId   = sel.value;
                const listNome = sel.options[sel.selectedIndex].text;
                localStorage.setItem(CHAVE_LISTA_ALT, listId);
                if (comConfirmacao) {
                    await moverConfirmar(listId, listNome, "⚠️ Fora do fluxo",
                        `Card em <strong>${listaAtualNome}</strong>.<br>Mover para <strong>${listNome}</strong>?`);
                } else {
                    await mover(listId, listNome);
                }
            });
            div.appendChild(sel); div.appendChild(b);
            return div;
        }

        acoesEl.style.display = "flex";

        // ── COMPROU ── (v1.4) — início do fluxo, mesmas ações da INICIAL
        if (modoComprou) {
            if (listaDesenv_)  acoesEl.appendChild(btn("📋 Desenvolvimento", "#6a1b9a", () => mover(listaDesenv_.id, LISTA_DESENVOLVIMENTO)));
            if (listaAcoes_)   acoesEl.appendChild(btn("♻️ Ações", "#00695c",           () => mover(listaAcoes_.id, LISTA_ACOES)));
            if (listaInicial_) acoesEl.appendChild(btn("🟢 Inicial", "#33691e",         () => mover(listaInicial_.id, LISTA_INICIAL)));  // v1.9
        }

        // ── PROBLEMAS/RECLAMAÇÕES e FALTA INFORMAÇÕES ── (v1.9) — volta pro fluxo
        // Vem antes da INICIAL porque FALTA INFORMAÇÕES também está em LISTAS_INICIAL.
        // v2.0: além de Ações/Inicial, volta direto pra Desenvolvimento, Alterações
        // ou Exportando — o problema pode ter sido resolvido em qualquer etapa.
        else if (modoReclamacoes || modoFaltaInfo) {
            if (listaAcoes_)   acoesEl.appendChild(btn("♻️ Ações", "#00695c",           () => mover(listaAcoes_.id, LISTA_ACOES)));
            if (listaInicial_) acoesEl.appendChild(btn("🟢 Inicial", "#33691e",         () => mover(listaInicial_.id, LISTA_INICIAL)));
            if (listaDesenv_)  acoesEl.appendChild(btn("📋 Desenvolvimento", "#6a1b9a", () => mover(listaDesenv_.id, LISTA_DESENVOLVIMENTO)));  // v2.0
            if (listasAlt.length > 0) acoesEl.appendChild(selectAlteracao(false));                                                              // v2.0
            // v2.1: quem sai da reclamação pra Exportando passa pela aprovação —
            // mesmos dois botões da lista AGUARDANDO APROVAÇÃO.
            if (listaExportando_) {
                acoesEl.appendChild(btn("✅ Aprovado", "#2e7d32", () => mover(listaExportando_.id, LISTA_EXPORTANDO)));
                acoesEl.appendChild(btn("✅ Aprovado sem logo", "#1565c0", async () => {
                    await mover(listaExportando_.id, LISTA_EXPORTANDO);
                    if (etqSemLogo) await adicionarEtiqueta(card.id, etqSemLogo.id);
                }));
            }
        }

        // ── INICIAL ──
        else if (modoInicial) {
            if (listaDesenv_)  acoesEl.appendChild(btn("📋 Desenvolvimento", "#6a1b9a", () => mover(listaDesenv_.id, LISTA_DESENVOLVIMENTO)));
            if (listaAcoes_)   acoesEl.appendChild(btn("♻️ Ações", "#00695c",           () => mover(listaAcoes_.id, LISTA_ACOES)));
        }

        // ── CANCELANDO ── (v1.9) — volta pro fluxo: Ações ou Inicial
        else if (modoCancelando) {
            if (listaAcoes_)   acoesEl.appendChild(btn("♻️ Ações", "#00695c",           () => mover(listaAcoes_.id, LISTA_ACOES)));
            if (listaInicial_) acoesEl.appendChild(btn("🟢 Inicial", "#33691e",         () => mover(listaInicial_.id, LISTA_INICIAL)));
        }

        // ── DESENVOLVIMENTO ──
        else if (modoDesenv) {
            if (listaAguardando_) acoesEl.appendChild(btn("⏳ Aguardando Aprovação", "#f9a825",  () => mover(listaAguardando_.id, LISTA_AGUARDANDO)));
            if (listaAcoes_)      acoesEl.appendChild(btn("♻️ Ações", "#00695c", () =>
                moverConfirmar(listaAcoes_.id, LISTA_ACOES, "⚠️ Mover para Ações",
                    `Mover card para <strong>${LISTA_ACOES}</strong>?`)));
        }

        // ── AGUARDANDO APROVAÇÃO ──
        else if (modoAguardando) {
            if (listaExportando_) {
                acoesEl.appendChild(btn("✅ Aprovado", "#2e7d32", () => mover(listaExportando_.id, LISTA_EXPORTANDO)));
                acoesEl.appendChild(btn("✅ Aprovado sem logo", "#1565c0", async () => {
                    await mover(listaExportando_.id, LISTA_EXPORTANDO);
                    if (etqSemLogo) await adicionarEtiqueta(card.id, etqSemLogo.id);
                }));
            }
            if (etqSemLogo) acoesEl.appendChild(btnEtiquetaSemLogo());
            if (listasAlt.length > 0) acoesEl.appendChild(selectAlteracao(false));
            if (listaAcoes_) acoesEl.appendChild(btn("♻️ Ações", "#00695c", () =>           // v1.4
                moverConfirmar(listaAcoes_.id, LISTA_ACOES, "⚠️ Mover para Ações",
                    `Mover card para <strong>${LISTA_ACOES}</strong>?`)));
        }

        // ── ALTERAÇÃO ──
        else if (modoAlteracao) {
            if (listaAguardandoAlt_) acoesEl.appendChild(btn("⏳ Aguardando Ap. Alteração", "#f9a825", () => mover(listaAguardandoAlt_.id, LISTA_AGUARDANDO_ALT)));
        }

        // ── EXPORTANDO ──
        else if (modoExportando) {
            if (listaExportado_)  acoesEl.appendChild(btn("📦 Exportado", "#2e7d32",   () => mover(listaExportado_.id, LISTA_EXPORTADO)));
            if (listaCorrecao_)   acoesEl.appendChild(btn("🔧 Correção", "#ef6c00",    () => mover(listaCorrecao_.id, LISTA_CORRECAO)));
        }

        // ── FAZENDO CROQUI ──
        else if (modoFazCroqui) {
            if (listaConferindo_) acoesEl.appendChild(btn("🔍 Conferindo", "#0288d1",   () => mover(listaConferindo_.id, LISTA_CONFERINDO)));
            if (listaCorrecao_)   acoesEl.appendChild(btn("🔧 Correção", "#ef6c00",     () => mover(listaCorrecao_.id, LISTA_CORRECAO)));
            if (listaExportando_) acoesEl.appendChild(btn("🖨️ Exportando", "#7b1fa2",  () =>
                moverConfirmar(listaExportando_.id, LISTA_EXPORTANDO, "⚠️ Voltar para Exportando",
                    `Mover card para <strong>${LISTA_EXPORTANDO}</strong>?`)));
        }

        // ── CONFERINDO ──
        else if (modoConferindo) {
            if (listaFinalizado_) acoesEl.appendChild(btn("✅ Finalizado", "#2e7d32",  () => mover(listaFinalizado_.id, LISTA_FINALIZADO)));
            if (listaCorrecao_)   acoesEl.appendChild(btn("🔧 Correção", "#ef6c00",    () => mover(listaCorrecao_.id, LISTA_CORRECAO)));
        }

        // ── FINALIZADO ──
        else if (modoFinalizado) {
            // Sem ações diretas
        }

        // ── OUTRAS ──
        else {
            if (listaExportando_) {
                acoesEl.appendChild(btn("✅ Aprovado", "#2e7d32", () =>
                    moverConfirmar(listaExportando_.id, LISTA_EXPORTANDO, "⚠️ Fora do fluxo",
                        `Card em <strong>${listaAtualNome}</strong>.<br>Mover para <strong>${LISTA_EXPORTANDO}</strong>?`)));
            }
            if (etqSemLogo) acoesEl.appendChild(btnEtiquetaSemLogo());
            if (listasAlt.length > 0) acoesEl.appendChild(selectAlteracao(true));
            if (listaAguardando_) acoesEl.appendChild(btn("⏳ Aguardando Aprovação", "#f9a825", () =>
                moverConfirmar(listaAguardando_.id, LISTA_AGUARDANDO, "⚠️ Fora do fluxo",
                    `Card em <strong>${listaAtualNome}</strong>.<br>Mover para <strong>${LISTA_AGUARDANDO}</strong>?`)));
            if (listaDesenv_) acoesEl.appendChild(btn("📋 Desenvolvimento", "#6a1b9a", () =>
                moverConfirmar(listaDesenv_.id, LISTA_DESENVOLVIMENTO, "⚠️ Fora do fluxo",
                    `Card em <strong>${listaAtualNome}</strong>.<br>Mover para <strong>${LISTA_DESENVOLVIMENTO}</strong>?`)));
            if (listaCorrecao_) acoesEl.appendChild(btn("🔧 Correção", "#ef6c00", () =>
                moverConfirmar(listaCorrecao_.id, LISTA_CORRECAO, "⚠️ Fora do fluxo",
                    `Card em <strong>${listaAtualNome}</strong>.<br>Mover para <strong>${LISTA_CORRECAO}</strong>?`)));
            if (listaConferindo_) acoesEl.appendChild(btn("🔍 Conferindo", "#0288d1", () =>
                moverConfirmar(listaConferindo_.id, LISTA_CONFERINDO, "⚠️ Fora do fluxo",
                    `Card em <strong>${listaAtualNome}</strong>.<br>Mover para <strong>${LISTA_CONFERINDO}</strong>?`)));
            if (listaFinalizado_) acoesEl.appendChild(btn("✅ Finalizado", "#2e7d32", () =>
                moverConfirmar(listaFinalizado_.id, LISTA_FINALIZADO, "⚠️ Fora do fluxo",
                    `Card em <strong>${listaAtualNome}</strong>.<br>Mover para <strong>${LISTA_FINALIZADO}</strong>?`)));
        }

        // ── FALTA INFORMAÇÕES — sempre aparece (exceto se já está nela), sempre pede confirmação ──
        if (listaFaltaInfo_ && !norm(listaAtualNome).includes("FALTA INFORMAÇÕES")) {
            acoesEl.appendChild(btn("❓ Falta informações", "#546e7a", () =>
                moverConfirmar(listaFaltaInfo_.id, LISTA_FALTA_INFO, "⚠️ Falta informações",
                    `Mover card para<br><strong>${LISTA_FALTA_INFO}</strong>?`)));
        }

        // ── CANCELANDO — sempre aparece (exceto se já está), pede confirmação ── (v1.4)
        if (listaCancelando_ && !modoCancelando) {
            acoesEl.appendChild(btn("🚫 Cancelando", "#d84315", () =>
                moverConfirmar(listaCancelando_.id, listaCancelando_.name, "⚠️ Cancelando",
                    `Mover card para<br><strong>${listaCancelando_.name}</strong>?`)));
        }

        // ── MAIS COMPRAS — sempre ──
        // v1.9: usa o mesmo critério de nome exato do badge (outrosCards) e, como
        // cliente com mais compras costuma ser revenda/franquia, também marca "sem logo".
        if (etqMaisCompras) {
            acoesEl.appendChild(btn("🔎 Rastrear mais compras", "#7b1fa2", async () => {
                try {
                    if (nomeCliente.length < 4) { toast("⚠️ Nome muito curto", "info"); return; }
                    if (outrosCards.length === 0) { toast("✅ Nenhum outro card do mesmo cliente", "info"); return; }
                    const todos = [card, ...outrosCards];
                    await Promise.all(todos.flatMap(c => {
                        const tarefas = [];
                        if (!(c.idLabels || []).includes(etqMaisCompras.id))
                            tarefas.push(adicionarEtiqueta(c.id, etqMaisCompras.id));
                        if (etqSemLogo && !(c.idLabels || []).includes(etqSemLogo.id))
                            tarefas.push(adicionarEtiqueta(c.id, etqSemLogo.id));
                        return tarefas;
                    }));
                    statusEl.innerHTML = `<span style="color:#ce93d8">🏷️ Mais compras + sem logo: ${todos.length} card(s)</span>`;
                    toast(`🏷️ ${todos.length} card(s) marcados (mais compras + sem logo)`);
                } catch { toast("❌ Erro ao rastrear", "erro"); }
            }));
        }
    }

    // ─── Observar troca de conversa ─────────────────────────────
    let _checkInterval = null;

    function iniciar() {
        // Checa a cada 1.5s se o comprador ativo mudou
        _checkInterval = setInterval(() => {
            const nome = getNomeAtivo();
            if (nome && nome !== _ultimoNome) {
                criarPainel();
            }
        }, 1500);
    }

    // Aguarda a página carregar
    function init() {
        const iv = setInterval(() => {
            const nome = getNomeAtivo();
            if (nome) {
                clearInterval(iv);
                criarPainel();
                iniciar();
            }
        }, 1000);
        // Fallback: tenta de qualquer jeito após 6s
        setTimeout(() => {
            clearInterval(iv);
            iniciar();
        }, 6000);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

})();