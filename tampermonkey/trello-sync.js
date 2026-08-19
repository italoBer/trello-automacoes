// ==UserScript==
// @name         Vendas → Trello (ML + Shopee)
// @namespace    vendas-trello
// @version      2.1
// @match        https://*.mercadolivre.com.br/vendas/omni/*
// @match        https://*.mercadolibre.com.br/vendas/omni/*
// @match        https://seller.shopee.com.br/portal/sale/*
// @grant        GM_setValue
// @grant        GM_getValue
// @updateURL    https://raw.githubusercontent.com/italoBer/trello-automacoes/main/tampermonkey/trello-sync.js
// @downloadURL  https://raw.githubusercontent.com/italoBer/trello-automacoes/main/tampermonkey/trello-sync.js
// ==/UserScript==

(function () {
  'use strict';

  // Guard: não rodar em páginas de mensagens (o painel de chat tem script próprio)
  if (location.pathname.includes('/mensagens')) return;

  // ─── Credenciais (salvas localmente no Tampermonkey) ─────────
  function getCreds() {
    return {
      API_KEY:         GM_getValue('API_KEY', ''),
      API_TOKEN:       GM_getValue('API_TOKEN', ''),
      LABEL_RECLAM:    GM_getValue('LABEL_RECLAM', ''),
      LABEL_MAIS:      GM_getValue('LABEL_MAIS', ''),
      LABEL_SEM_LOGO:  GM_getValue('LABEL_SEM_LOGO', ''),
      BOARD_ID_ML:     GM_getValue('BOARD_ID_ML', ''),
      BOARD_ID_SHOPEE: GM_getValue('BOARD_ID_SHOPEE', ''),
    };
  }

  function credsFaltando(c) {
    return !c.API_KEY || !c.API_TOKEN || !c.BOARD_ID_ML || !c.BOARD_ID_SHOPEE;
  }

  function mostrarSetup(aoSalvar) {
    document.getElementById('__vt_setup__')?.remove();

    const overlay = document.createElement('div');
    overlay.id = '__vt_setup__';
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', zIndex: '999999',
      background: 'rgba(0,0,0,0.7)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    });

    const box = document.createElement('div');
    Object.assign(box.style, {
      background: '#111', border: '1px solid #333', borderRadius: '16px',
      padding: '28px 32px', width: '420px', fontFamily: 'monospace',
      fontSize: '13px', color: '#f0f0f0', boxShadow: '0 8px 40px rgba(0,0,0,.9)',
    });

    const titulo = document.createElement('div');
    titulo.textContent = '⚙️ Configuração — Vendas → Trello';
    Object.assign(titulo.style, { fontWeight: 'bold', fontSize: '15px', marginBottom: '6px', color: '#ffe000' });
    box.appendChild(titulo);

    const sub = document.createElement('div');
    sub.textContent = 'Preencha uma vez. Fica salvo só no seu Tampermonkey.';
    Object.assign(sub.style, { color: '#666', fontSize: '11px', marginBottom: '20px' });
    box.appendChild(sub);

    const creds = getCreds();

    const campos = [
      { key: 'API_KEY',         label: 'Trello API Key',             placeholder: '32 caracteres',  hint: 'Acesse trello.com/power-ups/admin' },
      { key: 'API_TOKEN',       label: 'Trello Token',               placeholder: '64 caracteres',  hint: 'Gerado na mesma página da API Key' },
      { key: 'BOARD_ID_ML',     label: 'Board ID — Mercado Livre',   placeholder: 'ex: aBcD1234',   hint: 'URL do quadro: trello.com/b/SEU_ID/nome' },
      { key: 'BOARD_ID_SHOPEE', label: 'Board ID — Shopee',          placeholder: 'ex: eFgH5678',   hint: 'URL do quadro: trello.com/b/SEU_ID/nome' },
      { key: 'LABEL_RECLAM',    label: 'ID Etiqueta Reclamação (ML)', placeholder: 'detectada pelo nome', hint: 'Deixe vazio: acha sozinho a etiqueta "Reclamação"' },
      { key: 'LABEL_MAIS',      label: 'ID Etiqueta Mais Compras',   placeholder: 'detectada pelo nome', hint: 'Deixe vazio: acha sozinho a etiqueta "mais compras"' },
      { key: 'LABEL_SEM_LOGO',  label: 'ID Etiqueta Sem Logo',       placeholder: 'detectada pelo nome', hint: 'Deixe vazio: acha sozinho a etiqueta "sem logo"' },
    ];

    const inputs = {};
    campos.forEach(({ key, label, placeholder, hint }) => {
      const lbl = document.createElement('div');
      lbl.textContent = label;
      Object.assign(lbl.style, { fontSize: '10px', color: '#888', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '5px' });
      box.appendChild(lbl);

      const inp = document.createElement('input');
      inp.type = key.includes('TOKEN') ? 'password' : 'text';
      inp.placeholder = placeholder;
      inp.value = creds[key] || '';
      Object.assign(inp.style, {
        width: '100%', padding: '9px 12px', background: '#1a1a1a',
        border: '1px solid #333', borderRadius: '7px', color: '#fff',
        fontFamily: 'monospace', fontSize: '12px', marginBottom: '12px',
        outline: 'none', boxSizing: 'border-box',
      });
      box.appendChild(inp);
      if (hint) {
        const h = document.createElement('div');
        h.textContent = '→ ' + hint;
        Object.assign(h.style, { fontSize: '10px', color: '#555', marginTop: '-8px', marginBottom: '12px', fontFamily: 'monospace' });
        box.appendChild(h);
      }
      inputs[key] = inp;
    });

    const btnRow = document.createElement('div');
    Object.assign(btnRow.style, { display: 'flex', gap: '10px', marginTop: '4px' });

    const btnSalvar = document.createElement('button');
    btnSalvar.textContent = '💾 Salvar';
    Object.assign(btnSalvar.style, {
      flex: '1', padding: '11px', background: '#ffe000', border: 'none',
      borderRadius: '7px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'monospace', fontSize: '13px',
    });
    btnSalvar.addEventListener('click', () => {
      const ok = inputs.API_KEY.value.trim() && inputs.API_TOKEN.value.trim() &&
                 inputs.BOARD_ID_ML.value.trim() && inputs.BOARD_ID_SHOPEE.value.trim();
      if (!ok) {
        inputs.API_KEY.style.borderColor = !inputs.API_KEY.value.trim() ? '#f87171' : '#333';
        inputs.API_TOKEN.style.borderColor = !inputs.API_TOKEN.value.trim() ? '#f87171' : '#333';
        inputs.BOARD_ID_ML.style.borderColor = !inputs.BOARD_ID_ML.value.trim() ? '#f87171' : '#333';
        inputs.BOARD_ID_SHOPEE.style.borderColor = !inputs.BOARD_ID_SHOPEE.value.trim() ? '#f87171' : '#333';
        return;
      }
      Object.keys(inputs).forEach(key => GM_setValue(key, inputs[key].value.trim()));
      _etqCache = null; // config mudou: refaz a resolução das etiquetas
      overlay.remove();
      if (aoSalvar) aoSalvar();
    });
    btnRow.appendChild(btnSalvar);

    const btnFechar = document.createElement('button');
    btnFechar.textContent = 'Fechar';
    Object.assign(btnFechar.style, {
      padding: '11px 18px', background: 'transparent', border: '1px solid #333',
      borderRadius: '7px', color: '#666', cursor: 'pointer', fontFamily: 'monospace', fontSize: '13px',
    });
    btnFechar.addEventListener('click', () => overlay.remove());
    btnRow.appendChild(btnFechar);

    box.appendChild(btnRow);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }
  // ──────────────────────────────────────────────────────────────

  const PLATAFORMA = location.hostname.includes('shopee') ? 'shopee' : 'ml';

  const CFG = {
    ml: {
      get BOARD_ID()  { return getCreds().BOARD_ID_ML; },
      FILTRO_LISTAS: l => l.name.toLowerCase().includes('comprou'),
      BTN_COR:       '#ffe000',
      BTN_TEXTO_COR: '#000',
      ACCENT:        '#ffe000',
      LABEL:         'ML → Trello',
    },
    shopee: {
      get BOARD_ID()  { return getCreds().BOARD_ID_SHOPEE; },
      FILTRO_LISTAS: l => ['comprou','entregar','entragar'].some(f => l.name.toLowerCase().includes(f)),
      BTN_COR:       '#ee4d2d',
      BTN_TEXTO_COR: '#fff',
      ACCENT:        '#ee4d2d',
      LABEL:         'Shopee → Trello',
    },
  };

  const cfg = CFG[PLATAFORMA];
  const UI_ID  = '__vt_ui__';
  const BTN_ID = '__vt_btn__';

  // ─── Helpers UI ───────────────────────────────────────────────
  function rm() { document.getElementById(UI_ID)?.remove(); }

  function el(tag, styles = {}, text = '') {
    const e = document.createElement(tag);
    Object.assign(e.style, styles);
    if (text) e.textContent = text;
    return e;
  }

  function mkBtn(texto, css = {}) {
    return el('button', {
      width: '100%', padding: '11px', border: 'none', borderRadius: '7px',
      fontWeight: 'bold', cursor: 'pointer', fontFamily: 'monospace',
      fontSize: '13px', marginTop: '8px', ...css,
    }, texto);
  }

  function formatarData(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function criarUI() {
    rm();
    const ui = document.createElement('div');
    ui.id = UI_ID;
    Object.assign(ui.style, {
      position: 'fixed', bottom: '70px', left: '20px', zIndex: '99999',
      background: '#111', border: '1px solid #2a2a2a', borderRadius: '14px',
      padding: '20px 24px', width: '360px', fontFamily: 'monospace', fontSize: '13px',
      boxShadow: '0 8px 40px rgba(0,0,0,.8)', color: '#f0f0f0',
    });
    document.body.appendChild(ui);
    return ui;
  }

  function showLoading(msg) {
    const ui = criarUI();
    ui.appendChild(el('div', { color: cfg.ACCENT, fontWeight: 'bold', marginBottom: '8px' }, `⏳ ${msg}`));
    ui.appendChild(el('div', { color: '#555', fontSize: '12px' }, 'Aguarde...'));
  }

  function showMsg(titulo, msg, cor) {
    const ui = criarUI();
    ui.appendChild(el('div', { color: cor || cfg.ACCENT, fontWeight: 'bold', marginBottom: '8px' }, titulo));
    ui.appendChild(el('div', { color: '#666', fontSize: '12px', marginBottom: '14px' }, msg));
    const b = mkBtn('Fechar', { background: 'transparent', border: '1px solid #2a2a2a', color: '#555' });
    b.addEventListener('click', rm);
    ui.appendChild(b);
  }

  // ─── Mais compras ─────────────────────────────────────────────
  // Tamanho mínimo do nome pra valer como cliente — evita que card com nome
  // curto/lixo ("ana", "-", "x") case com meio mundo. Mesmo critério do chat.
  const MIN_NOME = 4;

  // Nome do cliente normalizado, para comparar pedido novo × card existente.
  // 1) A equipe renomeia o card pra "PREFIXO - Nome do Cliente", então corta
  //    tudo antes do primeiro " - " (mesmo critério do painel de chat).
  // 2) Tira acento e espaço duplo: "JOSÉ  SILVA" e "jose silva" são o mesmo.
  function nomeCliente(nome) {
    const partes = (nome || '').split(' - ');
    const base = partes.length > 1 ? partes.slice(1).join(' - ') : (nome || '');
    return base
      .normalize('NFD').replace(/\p{Diacritic}/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  // Decide quem é "mais compras". Puro de propósito — é o que os testes cobrem.
  // Marca se o cliente já tem card no quadro OU se o mesmo nome aparece mais de
  // uma vez na própria leva (revendedor que fez 3 pedidos de uma vez não tinha
  // card anterior nenhum, e antes disso os 3 saíam sem etiqueta).
  function marcarMaisCompras(candidatos, cardsPorCliente) {
    const naLeva = new Map();
    candidatos.forEach(p => {
      const n = nomeCliente(p.nome);
      naLeva.set(n, (naLeva.get(n) || 0) + 1);
    });

    return candidatos.map(p => {
      const n = nomeCliente(p.nome);
      const anteriores = cardsPorCliente.get(n) || [];
      return {
        ...p,
        _cliente: n,
        _anteriores: anteriores,
        maisCompras: n.length >= MIN_NOME && (anteriores.length > 0 || naLeva.get(n) > 1),
      };
    });
  }

  // ─── Etiquetas ────────────────────────────────────────────────
  // Nomes como aparecem no quadro. Mesma convenção dos painéis de chat, que
  // nunca precisaram de ID configurado — acham a etiqueta pelo nome.
  const ETQ_NOMES = {
    mais:    'mais compras',
    semLogo: 'sem logo',
    reclam:  'reclama',      // pega "Reclamação" e "Reclamacao"
  };

  function normTxt(s) {
    return (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase();
  }

  // Puro: decide qual ID usar pra cada etiqueta.
  // ID colado no ⚙️ vence (override); senão procura pelo NOME no quadro.
  // Assim o setup manual vira opcional em vez de obrigatório.
  function escolherEtiquetas(manual, doQuadro) {
    const acharPorNome = alvo => {
      const a = normTxt(alvo);
      const achada = (doQuadro || []).find(l => normTxt(l.name).includes(a));
      return achada ? achada.id : '';
    };
    return {
      mais:    manual.mais    || acharPorNome(ETQ_NOMES.mais),
      semLogo: manual.semLogo || acharPorNome(ETQ_NOMES.semLogo),
      reclam:  manual.reclam  || acharPorNome(ETQ_NOMES.reclam),
    };
  }

  // Quais cards ANTIGOS precisam ganhar etiqueta, e quais. Só devolve o que está
  // faltando — card que já tem as duas não entra, pra não gastar requisição.
  // Também puro; a parte de rede é a etiquetarAnteriores() logo abaixo.
  function alvosRetroativos(novos, labelMais, labelSemLogo) {
    const alvos = new Map(); // cardId -> [labelId]
    novos.filter(p => p.maisCompras).forEach(p => {
      (p._anteriores || []).forEach(c => {
        const faltando = [labelMais, labelSemLogo]
          .filter(l => l && !(c.idLabels || []).includes(l));
        if (!faltando.length) return;
        const atual = alvos.get(c.id) || [];
        faltando.forEach(l => { if (!atual.includes(l)) atual.push(l); });
        alvos.set(c.id, atual);
      });
    });
    return alvos;
  }

  // ─── Trello API ───────────────────────────────────────────────
  async function getTrelloCards() {
    const { API_KEY, API_TOKEN } = getCreds();
    // filter=all inclui arquivados. Sem isso, cliente cujo pedido antigo já foi
    // arquivado voltava a parecer cliente novo (e o pedido antigo podia até ser
    // recriado como duplicado). idLabels é o que permite etiquetar retroativo.
    const res = await fetch(
      `https://api.trello.com/1/boards/${cfg.BOARD_ID}/cards?filter=all&fields=name,desc,idLabels&key=${API_KEY}&token=${API_TOKEN}`
    );
    return res.json();
  }

  // Retorna: { existentes: Set<chave>, cardsPorCliente: Map<nomeNorm, [{id, idLabels}]> }
  async function getDadosExistentes() {
    const cards = await getTrelloCards();
    const existentes = new Set();
    const cardsPorCliente = new Map();

    cards.forEach(c => {
      const txt = (c.name || '') + ' ' + (c.desc || '');
      // Links ML
      (txt.match(/https?:\/\/\S+/g) || []).forEach(l => existentes.add(l.trim()));
      // IDs alfanuméricos Shopee + ID da venda ML (dedup)
      (txt.match(/[A-Z0-9]{10,}/g) || []).forEach(id => existentes.add(id));
      // Cliente normalizado — antes isso guardava o nome CRU do card, então
      // qualquer card renomeado pra "PREFIXO - Nome" nunca mais casava.
      const nome = nomeCliente(c.name);
      if (nome.length >= MIN_NOME) {
        if (!cardsPorCliente.has(nome)) cardsPorCliente.set(nome, []);
        cardsPorCliente.get(nome).push({ id: c.id, idLabels: c.idLabels || [] });
      }
    });

    return { existentes, cardsPorCliente };
  }

  // Resolve as etiquetas do quadro uma vez por execução (rede + escolherEtiquetas).
  let _etqCache = null;
  async function resolverEtiquetas() {
    if (_etqCache) return _etqCache;
    const { API_KEY, API_TOKEN, LABEL_RECLAM, LABEL_MAIS, LABEL_SEM_LOGO } = getCreds();
    let doQuadro = [];
    try {
      const res = await fetch(
        `https://api.trello.com/1/boards/${cfg.BOARD_ID}/labels?fields=name&key=${API_KEY}&token=${API_TOKEN}`
      );
      if (res.ok) doQuadro = await res.json();
    } catch { /* sem rede: cai nos IDs manuais, se houver */ }

    _etqCache = escolherEtiquetas(
      { mais: LABEL_MAIS, semLogo: LABEL_SEM_LOGO, reclam: LABEL_RECLAM },
      doQuadro
    );
    return _etqCache;
  }

  async function getListas() {
    const { API_KEY, API_TOKEN } = getCreds();
    const res = await fetch(
      `https://api.trello.com/1/boards/${cfg.BOARD_ID}/lists?key=${API_KEY}&token=${API_TOKEN}`
    );
    const todas = await res.json();
    return todas.filter(cfg.FILTRO_LISTAS);
  }

  async function criarCard(p, listId) {
    const { API_KEY, API_TOKEN } = getCreds();
    const etq = await resolverEtiquetas();
    const labels = [];
    if (p.isReclamacao && PLATAFORMA === 'ml' && etq.reclam) labels.push(etq.reclam);
    // Mais compras costuma ser revenda/franquia — vai junto com "sem logo",
    // mesmo par que o botão 🔎 Rastrear do painel de chat aplica.
    if (p.maisCompras && etq.mais)    labels.push(etq.mais);
    if (p.maisCompras && etq.semLogo) labels.push(etq.semLogo);

    const body = { name: p.nome, desc: p.desc, idList: listId };
    if (p.dueDate)     body.due      = p.dueDate;
    if (labels.length) body.idLabels = labels;

    const res = await fetch(
      `https://api.trello.com/1/cards?key=${API_KEY}&token=${API_TOKEN}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );
    return res.json();
  }

  // Aplica as etiquetas que faltam nos cards ANTIGOS do mesmo cliente.
  // Antes só o pedido novo era marcado, então o quadro ficava com um card do
  // par etiquetado e o outro não. Devolve quantos cards foram atualizados.
  async function etiquetarAnteriores(novos) {
    const { API_KEY, API_TOKEN } = getCreds();
    const etq = await resolverEtiquetas();
    const alvos = alvosRetroativos(novos, etq.mais, etq.semLogo);

    let atualizados = 0;
    for (const [cardId, labels] of alvos) {
      let algum = false;
      for (const labelId of labels) {
        try {
          const res = await fetch(
            `https://api.trello.com/1/cards/${cardId}/idLabels?value=${labelId}&key=${API_KEY}&token=${API_TOKEN}`,
            { method: 'POST' }
          );
          if (res.ok) algum = true;
        } catch { /* etiqueta é acessório: não derruba a criação dos cards */ }
        await new Promise(r => setTimeout(r, 120));
      }
      if (algum) atualizados++;
    }
    return atualizados;
  }

  // ─── Kits ─────────────────────────────────────────────────────
  // Anúncios tipo "Kit Completo 2 UNIDADES" vendem x1 mas contêm N unidades.
  // Detecta N no título ou SKU (ex: "2 UNIDADES", "2 UN", SKU "…-2UNI", "KIT COM 2")
  // para o TOTAL refletir unidades reais (qtd comprada × unidades por kit).
  function unidadesPorKit(titulo, sku) {
    const t = ' ' + ((titulo || '') + ' ' + (sku || '')).toUpperCase() + ' ';
    let m = t.match(/(\d+)\s*(?:UNIDADES?|UNID|UNI|UN|PE[ÇC]AS?)\b/);
    if (!m) m = t.match(/KIT\s*(?:COM|C\/)\s*(\d+)\b/);
    return m ? Math.max(1, parseInt(m[1])) : 1;
  }

  // ─── ML: scrape ───────────────────────────────────────────────
  const MESES = { janeiro:1,fevereiro:2,março:3,abril:4,maio:5,junho:6,julho:7,agosto:8,setembro:9,outubro:10,novembro:11,dezembro:12 };
  const BOTOES_ML = ['já estou com o produto', 'já tenho os produtos'];

  function mlDueDate(card) {
    const textos = [...card.querySelectorAll('*')]
      .filter(e => e.children.length === 0 && e.innerText).map(e => e.innerText.trim());
    for (const t of textos) {
      const m = t.match(/até o dia\s+(\d{1,2})\s+de\s+(\w+)/i);
      if (m) {
        const dia = parseInt(m[1]), mes = MESES[m[2].toLowerCase()];
        if (!mes) continue;
        const ano = new Date().getFullYear();
        const d = new Date(ano, mes - 1, dia, 23, 59, 0);
        if (d < new Date()) d.setFullYear(ano + 1);
        return d.toISOString();
      }
    }
    return null;
  }

  function mlItens(card) {
    // Tenta os seletores em ordem; usa o primeiro que retornar resultado.
    // Blinda contra o ML renomear classes (ex.: mudança de jul/2026).
    const firstMatch = (...sels) => {
      for (const s of sels) { const r = [...card.querySelectorAll(s)]; if (r.length) return r; }
      return [];
    };

    const labels = firstMatch('.label').map(l => l.innerText.trim());
    const skus   = firstMatch('.sc-product-data__sku', '.sku')
                     .map(s => s.innerText.replace('SKU:', '').trim());

    // Quantidade — primário: classe nova; fallback: classe antiga; último recurso: texto visível "N unidade(s)"
    let unidades = firstMatch('.sc-product-data__qty', '.unit')
                     .map(u => u.innerText.trim()).filter(Boolean);
    if (unidades.length === 0) {
      unidades = ((card.innerText || '').match(/\d+\s*unidades?/gi) || []).map(s => s.trim());
    }

    const isPacote = labels[0]?.toLowerCase().includes('pacote');

    if (isPacote) {
      const itens = [];
      for (let i = 1; i < labels.length; i++)
        itens.push({ titulo: labels[i] || '', sku: skus[i-1] || '', qtd: unidades[i] || '1 unidade' });
      const totalNum = itens.reduce((acc, it) => acc + (parseInt(it.qtd) || 1) * unidadesPorKit(it.titulo, it.sku), 0);
      const temKit = itens.some(it => unidadesPorKit(it.titulo, it.sku) > 1);
      // Com kit no pacote, o total do ML conta itens (não unidades) — usa o calculado
      const totalQtd = temKit
        ? `${totalNum} unidade${totalNum !== 1 ? 's' : ''}`
        : (unidades[0] || `${totalNum} unidade${totalNum !== 1 ? 's' : ''}`);
      return { itens, totalQtd, isPacote: true, temKit };
    }

    const itens = labels.map((titulo, i) => ({ titulo, sku: skus[i] || '', qtd: unidades[i] || '1 unidade' }));
    const totalNum = itens.reduce((acc, it) => acc + (parseInt(it.qtd) || 1) * unidadesPorKit(it.titulo, it.sku), 0);
    const temKit = itens.some(it => unidadesPorKit(it.titulo, it.sku) > 1);
    return { itens, totalQtd: `${totalNum} unidade${totalNum !== 1 ? 's' : ''}`, isPacote: false, temKit };
  }

  let _expandindo = false; // trava contra reentrância

  async function mlExpandirPacotes() {
    if (_expandindo) return;
    _expandindo = true;
    try {
      let n = 0;
      document.querySelectorAll('.row-card-container').forEach(card => {
        const labels = [...card.querySelectorAll('.label')].map(l => l.innerText.trim());
        if (!labels[0]?.toLowerCase().includes('pacote')) return;
        // Já expandido? SKU novo do ML (.sc-product-data__sku) ou o antigo (.sku)
        if (card.querySelectorAll('.sc-product-data__sku, .sku').length > 0) return;
        const t = card.querySelector('.toggle-button');
        if (t) { t.click(); n++; }
      });
      if (n > 0) await new Promise(r => setTimeout(r, 600));
    } finally {
      _expandindo = false;
    }
  }

  function mlScrape() {
    const mapa = new Map();
    document.querySelectorAll('.row-card-container').forEach(card => {
      const botoes = [...card.querySelectorAll('button, a')].map(b => b.innerText.trim().toLowerCase());
      const isPersonalizado = botoes.some(b => BOTOES_ML.some(p => b.includes(p)));
      const isReclamacao    = botoes.some(b => b.includes('atender reclamação'));
      if (!isPersonalizado && !isReclamacao) return;

      const nome    = card.querySelector('.buyer-name')?.innerText.trim();
      // v1.9: usa a propriedade .href (sempre absoluta) em vez de getAttribute —
      // se o ML emitir href relativo, o link ia pro card quebrado.
      let   link    = card.querySelector('.right-column__messenger a')?.href;
      if (link) link = link.replace(/&amp;/g, '&');
      const data    = card.querySelector('.left-column__order-date')?.innerText.trim() || '';
      const orderId = card.querySelector('.left-column__pack-id')?.innerText.trim() || '';
      if (!nome || !link) return;

      const dueDate = mlDueDate(card);
      const { itens, totalQtd, isPacote, temKit } = mlItens(card);
      const desc = [
        isReclamacao ? '⚠️ RECLAMAÇÃO ABERTA' : '',
        `**Comprador:** ${nome}`,
        `**Data:** ${data}`,
        `**Pedido:** ${orderId}`,
        `**Chat ML:** ${link}`,
        '',
        '**ITENS:**',
        ...itens.map(it => `- ${it.titulo}${it.sku ? ` | SKU: ${it.sku}` : ''} | ${it.qtd}`),
        '',
        `**TOTAL:** ${totalQtd}`,
      ].filter(l => l !== '').join('\n');

      // v1.9: dedup pelo ID da venda, não pela URL inteira. O ML trocou o domínio
      // (www → vendedores), então comparar URL faria todo card antigo parecer novo
      // e duplicaria o quadro. O ID já é capturado dos cards antigos pelo regex de
      // IDs em getDadosExistentes(), então funciona com os dois formatos de link.
      const vendaId = link.match(/mensagens\/(\d+)/)?.[1];
      mapa.set(link, { nome, link, data, orderId, dueDate, itens, totalQtd, isPacote, temKit, isReclamacao, desc, _chave: vendaId || link });
    });
    return [...mapa.values()];
  }

  // ─── Shopee: scrape ───────────────────────────────────────────
  function spDueDate(card) {
    const txt = card.querySelector('.status-description')?.innerText?.trim() || '';
    const m = txt.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!m) return null;
    const d = new Date(parseInt(m[3]), parseInt(m[2])-1, parseInt(m[1]), 23, 59, 0);
    return d.toISOString();
  }

  function spItens(card) {
    const nomes = [...card.querySelectorAll('.item-name')].map(e => e.innerText.trim());
    const skus  = [...card.querySelectorAll('.item-description')].map(e => e.innerText.trim());
    const qtds  = [...card.querySelectorAll('.item-amount')].map(e => e.innerText.trim());
    const itens = nomes.map((titulo, i) => ({ titulo, sku: skus[i] || '', qtd: qtds[i] || 'x1' }));
    const totalNum = itens.reduce((acc, it) => {
      const n = parseInt(String(it.qtd).replace(/x/i, ''));
      return acc + (isNaN(n) ? 1 : n) * unidadesPorKit(it.titulo, it.sku);
    }, 0);
    const temKit = itens.some(it => unidadesPorKit(it.titulo, it.sku) > 1);
    return { itens, totalQtd: `${totalNum} unidade${totalNum !== 1 ? 's' : ''}`, temKit };
  }

  function spScrape() {
    const mapa = new Map();
    document.querySelectorAll('.order-card').forEach(card => {
      const sobEncomenda = [...card.querySelectorAll('*')]
        .some(e => e.children.length === 0 && e.innerText?.trim() === 'Sob encomenda');
      if (!sobEncomenda) return;

      const nome     = card.querySelector('.buyer-username')?.innerText?.trim();
      const snTexto  = card.querySelector('.order-sn')?.innerText?.trim() || '';
      const idMatch  = snTexto.match(/ID do Pedido\s+(\S+)/i);
      const pedidoId = idMatch ? idMatch[1] : null;
      if (!nome || !pedidoId) return;

      const dueDate = spDueDate(card);
      const { itens, totalQtd, temKit } = spItens(card);
      const desc = [
        `**Comprador:** ${nome}`,
        `**ID do Pedido:** ${pedidoId}`,
        `**Croqui:** marrom`,
        '',
        '**ITENS:**',
        ...itens.map(it => `- ${it.titulo}${it.sku ? ` | SKU: ${it.sku}` : ''} | ${it.qtd}`),
        '',
        `**TOTAL:** ${totalQtd}`,
      ].join('\n');

      mapa.set(pedidoId, { nome, pedidoId, itens, totalQtd, temKit, dueDate, desc, _chave: pedidoId });
    });
    return [...mapa.values()];
  }

  // ─── UI: preview ──────────────────────────────────────────────
  function showPreview(novos, jaExistem, listas) {
    const ui = criarUI();

    const header = el('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' });
    header.appendChild(el('span', { color: cfg.ACCENT, fontWeight: 'bold' }, cfg.LABEL));
    header.appendChild(el('span', { color: '#555', fontSize: '11px' }, `${novos.length} novo(s) · ${jaExistem} já existe(m)`));
    ui.appendChild(header);

    const wrap = el('div', { maxHeight: '220px', overflowY: 'auto', marginBottom: '14px' });
    novos.forEach(p => {
      const item = el('div', { padding: '10px', background: '#1a1a1a', borderRadius: '7px', marginBottom: '6px' });

      const top = el('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' });
      top.appendChild(el('span', { color: '#fff', fontWeight: 'bold' }, p.nome));
      if (p.data) top.appendChild(el('span', { color: '#555', fontSize: '11px' }, p.data));
      item.appendChild(top);

      p.itens.forEach(it => {
        const linha = el('div', { fontSize: '11px', color: '#888', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' });
        linha.textContent = `• ${it.titulo}${it.sku ? ' | '+it.sku : ''} | ${it.qtd}`;
        item.appendChild(linha);
      });

      const chips = el('div', { display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' });

      if (p.isReclamacao)
        chips.appendChild(el('div', { padding: '2px 8px', background: '#2a0000', border: '1px solid #7a0000', borderRadius: '4px', color: '#ff5c5c', fontSize: '11px', fontWeight: 'bold' }, '⚠️ Reclamação'));

      if (p.maisCompras)
        chips.appendChild(el('div', { padding: '2px 8px', background: '#001a3a', border: '1px solid #0047b3', borderRadius: '4px', color: '#7ab8ff', fontSize: '11px', fontWeight: 'bold' }, '🔁 Mais compras'));

      chips.appendChild(el('div', { padding: '2px 8px', background: '#1e2a1e', border: '1px solid #2a4a2a', borderRadius: '4px', color: '#34d399', fontSize: '11px' }, `📦 ${p.totalQtd}`));

      if (p.temKit)
        chips.appendChild(el('div', { padding: '2px 8px', background: '#2a1a2a', border: '1px solid #7a447a', borderRadius: '4px', color: '#e879f9', fontSize: '11px', fontWeight: 'bold' }, '🧩 Kit — total ajustado'));

      if (p.isPacote)
        chips.appendChild(el('div', { padding: '2px 8px', background: '#1a1a2a', border: '1px solid #2a2a5a', borderRadius: '4px', color: '#7a9fff', fontSize: '11px' }, '🔀 Pacote'));
      else if (p.itens?.length > 1)
        chips.appendChild(el('div', { padding: '2px 8px', background: '#1a1a2a', border: '1px solid #2a2a5a', borderRadius: '4px', color: '#7a9fff', fontSize: '11px' }, `🔀 ${p.itens.length} itens`));

      if (p.dueDate)
        chips.appendChild(el('div', { padding: '2px 8px', background: '#2a1a00', border: '1px solid #7a4400', borderRadius: '4px', color: '#ffaa00', fontSize: '11px' }, `📅 Vence ${formatarData(p.dueDate)}`));

      item.appendChild(chips);
      wrap.appendChild(item);
    });
    ui.appendChild(wrap);

    if (jaExistem > 0)
      ui.appendChild(el('div', { padding: '8px 10px', background: '#1a1a1a', borderRadius: '7px', marginBottom: '12px', color: '#666', fontSize: '11px', textAlign: 'center' }, `⏭ ${jaExistem} já existem no Trello`));

    ui.appendChild(el('div', { color: '#888', fontSize: '11px', marginBottom: '6px' }, 'ENVIAR PARA A LISTA:'));
    const sel = document.createElement('select');
    Object.assign(sel.style, { width: '100%', padding: '10px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '7px', color: '#fff', fontFamily: 'monospace', fontSize: '13px', marginBottom: '10px', cursor: 'pointer' });
    listas.forEach(l => { const o = document.createElement('option'); o.value = l.id; o.textContent = l.name; sel.appendChild(o); });
    ui.appendChild(sel);

    const bEnviar = mkBtn(`🚀 Criar ${novos.length} card(s) no Trello`, { background: PLATAFORMA === 'ml' ? '#0052cc' : cfg.ACCENT, color: '#fff' });
    bEnviar.addEventListener('click', async () => {
      showLoading('Criando cards...');
      let ok = 0, err = 0;
      for (const p of novos) {
        try { const c = await criarCard(p, sel.value); if (c.id) ok++; else err++; }
        catch { err++; }
        await new Promise(r => setTimeout(r, 250));
      }
      let retro = 0;
      try {
        showLoading('Etiquetando pedidos anteriores...');
        retro = await etiquetarAnteriores(novos);
      } catch { /* já criou os cards; etiqueta retroativa é o extra */ }
      showFeito(ok, err, jaExistem, retro);
    });
    ui.appendChild(bEnviar);

    const bFechar = mkBtn('Fechar', { background: 'transparent', border: '1px solid #2a2a2a', color: '#555' });
    bFechar.addEventListener('click', rm);
    ui.appendChild(bFechar);
  }

  function showFeito(ok, err, ignorados, retro = 0) {
    const ui = criarUI();
    ui.appendChild(el('div', { color: cfg.ACCENT, fontWeight: 'bold', marginBottom: '12px' }, cfg.LABEL));
    const box = el('div', { padding: '14px', background: '#1a1a1a', borderRadius: '7px', textAlign: 'center', marginBottom: '14px' });
    box.appendChild(el('div', { color: '#34d399', fontSize: '15px', marginBottom: '6px' }, `✔ ${ok} card(s) criado(s)`));
    if (ignorados > 0) box.appendChild(el('div', { color: '#888', fontSize: '12px', marginBottom: '4px' }, `⏭ ${ignorados} já existiam`));
    if (retro > 0) box.appendChild(el('div', { color: '#7ab8ff', fontSize: '12px', marginBottom: '4px' }, `🔁 ${retro} card(s) antigo(s) etiquetado(s)`));
    if (err) box.appendChild(el('div', { color: '#f87171' }, `✘ ${err} erro(s)`));
    ui.appendChild(box);
    const b = mkBtn('Fechar', { background: 'transparent', border: '1px solid #2a2a2a', color: '#555' });
    b.addEventListener('click', rm);
    ui.appendChild(b);
  }

  // ─── Roda ─────────────────────────────────────────────────────
  async function rodar() {
    const creds = getCreds();
    if (credsFaltando(creds)) {
      mostrarSetup(() => rodar());
      return;
    }

    if (PLATAFORMA === 'ml') {
      showLoading('Expandindo pacotes...');
      await mlExpandirPacotes();
    }

    const pedidos = PLATAFORMA === 'ml' ? mlScrape() : spScrape();
    if (!pedidos.length) {
      showMsg('⚠ Nenhum pedido encontrado', 'Role a página para carregar todos os pedidos e tente novamente.');
      return;
    }

    showLoading('Verificando duplicados no Trello...');
    Promise.all([getDadosExistentes(), getListas()])
      .then(([{ existentes, cardsPorCliente }, listas]) => {
        const novos = marcarMaisCompras(
          pedidos.filter(p => !existentes.has(p._chave)),
          cardsPorCliente
        );

        const jaExistem = pedidos.length - novos.length;
        if (!novos.length) { showMsg('✔ Tudo já está no Trello!', 'Todos os pedidos já têm card criado.', '#34d399'); return; }
        showPreview(novos, jaExistem, listas);
      })
      .catch(e => { console.error(e); rm(); alert('Erro ao consultar o Trello.'); });
  }

  // ─── Botão ────────────────────────────────────────────────────
  function adicionarBotao() {
    if (document.getElementById(BTN_ID)) return;

    const wrap = document.createElement('div');
    wrap.id = BTN_ID + '_wrap';
    Object.assign(wrap.style, {
      position: 'fixed', bottom: '20px', left: '20px', zIndex: '99999',
      display: 'flex', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', borderRadius: '10px',
    });

    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.textContent = `📋 ${cfg.LABEL}`;
    Object.assign(btn.style, {
      background: cfg.BTN_COR, color: cfg.BTN_TEXTO_COR,
      border: 'none', borderRadius: '10px 0 0 10px', padding: '12px 18px',
      fontFamily: 'monospace', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
    });
    btn.addEventListener('click', rodar);
    wrap.appendChild(btn);

    const btnCfg = document.createElement('button');
    btnCfg.id = BTN_ID + '_cfg';
    btnCfg.textContent = '⚙️';
    Object.assign(btnCfg.style, {
      background: '#333', color: '#fff',
      border: 'none', borderLeft: '1px solid #555',
      borderRadius: '0 10px 10px 0', padding: '12px 10px',
      fontFamily: 'monospace', fontSize: '13px', cursor: 'pointer',
    });
    btnCfg.addEventListener('click', () => mostrarSetup(null));
    wrap.appendChild(btnCfg);

    document.body.appendChild(wrap);
  }

  function init() {
    adicionarBotao();
    new MutationObserver(() => adicionarBotao()).observe(document.body, { childList: true, subtree: false });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();