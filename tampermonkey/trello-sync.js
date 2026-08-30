// ==UserScript==
// @name         Vendas → Trello (ML + Shopee)
// @namespace    vendas-trello
// @version      3.0
// @match        https://*.mercadolivre.com.br/vendas/omni/*
// @match        https://*.mercadolibre.com.br/vendas/omni/*
// @match        https://seller.shopee.com.br/portal/sale/*
// @grant        GM_setValue
// @grant        GM_getValue
// @updateURL    https://raw.githubusercontent.com/italoBer/trello-automacoes/main/tampermonkey/trello-sync.js
// @downloadURL  https://raw.githubusercontent.com/italoBer/trello-automacoes/main/tampermonkey/trello-sync.js
// ==/UserScript==
// v2.4: detecção de kits ("N UNIDADES" no título / "-NUNI" no SKU / "KIT COM N")
//       — TOTAL do card conta unidades reais (espelha trello-sync v1.5 da empresa).

(function () {
  'use strict';

  // Guard: não rodar em páginas de mensagens
  if (location.pathname.includes('/mensagens')) return;

  // ─── Credenciais (salvas localmente no Tampermonkey) ─────────
  function getCreds() {
    return {
      API_KEY:              GM_getValue('API_KEY', ''),
      API_TOKEN:            GM_getValue('API_TOKEN', ''),
      LABEL_RECLAM:         GM_getValue('LABEL_RECLAM', ''),
      LABEL_MAIS:           GM_getValue('LABEL_MAIS', ''),
      LABEL_SEM_LOGO:       GM_getValue('LABEL_SEM_LOGO', ''),
      BOARD_ID_ML:          GM_getValue('BOARD_ID_ML', ''),
      BOARD_ID_SHOPEE:      GM_getValue('BOARD_ID_SHOPEE', ''),
      LABEL_RECLAM_SHOPEE:  GM_getValue('LABEL_RECLAM_SHOPEE', ''),
      LABEL_MAIS_SHOPEE:    GM_getValue('LABEL_MAIS_SHOPEE', ''),
      LABEL_SEM_LOGO_SHOPEE: GM_getValue('LABEL_SEM_LOGO_SHOPEE', ''),
      // ── Automação (separado por plataforma) ──
      AUTO_INTERVALO:       GM_getValue(`AUTO_INTERVALO_${PLATAFORMA}`, GM_getValue('AUTO_INTERVALO', '0')),
      ULTIMA_LISTA:         GM_getValue(`ULTIMA_LISTA_${PLATAFORMA}`, ''),
      AUTO_LISTA_NOME:      GM_getValue(`AUTO_LISTA_NOME_${PLATAFORMA}`, ''),
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
      padding: '28px 32px', width: '440px', maxHeight: '85vh', overflowY: 'auto',
      fontFamily: 'monospace', fontSize: '13px', color: '#f0f0f0',
      boxShadow: '0 8px 40px rgba(0,0,0,.9)',
    });

    const titulo = document.createElement('div');
    titulo.textContent = '⚙️ Configuração — Vendas → Trello';
    Object.assign(titulo.style, { fontWeight: 'bold', fontSize: '15px', marginBottom: '6px', color: '#ffe000' });
    box.appendChild(titulo);

    // Indicador da plataforma atual
    const platInd = document.createElement('div');
    platInd.textContent = `📌 Plataforma detectada: ${PLATAFORMA.toUpperCase()} → Board: ${cfg.BOARD_ID || '(vazio)'}`;
    Object.assign(platInd.style, {
      fontSize: '10px', color: PLATAFORMA === 'shopee' ? '#ee4d2d' : '#ffe000',
      background: '#1a1a1a', borderRadius: '6px', padding: '4px 8px',
      marginBottom: '14px', border: '1px solid #333',
    });
    box.appendChild(platInd);

    const sub = document.createElement('div');
    sub.textContent = 'Preencha uma vez. Fica salvo só no seu Tampermonkey.';
    Object.assign(sub.style, { color: '#888', fontSize: '11px', marginBottom: '20px' });
    box.appendChild(sub);

    const creds = getCreds();

    // ── Campos de credenciais ──
    const campos = [
      { key: 'API_KEY',         label: 'Trello API Key',               placeholder: '32 caracteres',  hint: 'Acesse trello.com/power-ups/admin' },
      { key: 'API_TOKEN',       label: 'Trello Token',                 placeholder: '64 caracteres',  hint: 'Gerado na mesma página da API Key' },
      { key: 'BOARD_ID_ML',     label: 'Board ID — Mercado Livre',     placeholder: 'ex: oCfs01Yk',   hint: 'URL do quadro: trello.com/b/oCfs01Yk/nome' },
      { key: 'BOARD_ID_SHOPEE', label: 'Board ID — Shopee',            placeholder: 'ex: fvvPPcP3',   hint: 'URL do quadro: trello.com/b/fvvPPcP3/nome' },
    ];

    const camposLabelsML = [
      { key: 'LABEL_RECLAM',    label: 'Etiq. Reclamação (ML)',         placeholder: 'detectada pelo nome', hint: 'Deixe vazio: acha sozinho pelo nome no quadro' },
      { key: 'LABEL_MAIS',      label: 'Etiq. Mais Compras (ML)',       placeholder: 'detectada pelo nome', hint: 'Deixe vazio: acha sozinho pelo nome no quadro' },
      { key: 'LABEL_SEM_LOGO',  label: 'Etiq. Sem Logo (ML)',           placeholder: 'detectada pelo nome', hint: 'Deixe vazio: acha sozinho a etiqueta "sem logo"' },
    ];

    const camposLabelsShopee = [
      { key: 'LABEL_RECLAM_SHOPEE', label: 'Etiq. Reclamação (Shopee)',  placeholder: 'detectada pelo nome', hint: 'Deixe vazio: acha sozinho pelo nome no quadro' },
      { key: 'LABEL_MAIS_SHOPEE',   label: 'Etiq. Mais Compras (Shopee)', placeholder: 'detectada pelo nome', hint: 'Deixe vazio: acha sozinho pelo nome no quadro' },
      { key: 'LABEL_SEM_LOGO_SHOPEE', label: 'Etiq. Sem Logo (Shopee)',   placeholder: 'detectada pelo nome', hint: 'Deixe vazio: acha sozinho a etiqueta "sem logo"' },
    ];

    const inputs = {};

    function addSeparator(texto) {
      const sep = document.createElement('div');
      sep.textContent = texto;
      Object.assign(sep.style, {
        fontSize: '11px', color: '#ffe000', fontWeight: 'bold', letterSpacing: '.1em',
        textTransform: 'uppercase', margin: '18px 0 12px', paddingBottom: '6px',
        borderBottom: '1px solid #333',
      });
      box.appendChild(sep);
    }

    function addCampos(lista) {
      lista.forEach(({ key, label, placeholder, hint }) => {
        const lbl = document.createElement('div');
        lbl.textContent = label;
        Object.assign(lbl.style, { fontSize: '10px', color: '#aaa', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '5px' });
        box.appendChild(lbl);

        const inp = document.createElement('input');
        inp.type = key.includes('TOKEN') ? 'password' : 'text';
        inp.placeholder = placeholder;
        inp.value = creds[key] || '';
        Object.assign(inp.style, {
          width: '100%', padding: '9px 12px', background: '#1a1a1a',
          border: '1px solid #333', borderRadius: '7px', color: '#fff',
          fontFamily: 'monospace', fontSize: '12px', marginBottom: '4px',
          outline: 'none', boxSizing: 'border-box',
        });
        box.appendChild(inp);
        if (hint) {
          const h = document.createElement('div');
          h.textContent = '→ ' + hint;
          Object.assign(h.style, { fontSize: '10px', color: '#666', marginBottom: '12px', fontFamily: 'monospace' });
          box.appendChild(h);
        }
        inputs[key] = inp;
      });
    }

    // Credenciais base
    addCampos(campos);

    // Labels ML
    addSeparator('🏷️ Etiquetas — Mercado Livre');
    addCampos(camposLabelsML);

    // Labels Shopee
    addSeparator('🏷️ Etiquetas — Shopee');
    addCampos(camposLabelsShopee);

    // ── Automação ──
    addSeparator(`🤖 Automação — ${PLATAFORMA.toUpperCase()}`);

    // Intervalo
    const lblAuto = document.createElement('div');
    lblAuto.textContent = 'Intervalo entre execuções (segundos)';
    Object.assign(lblAuto.style, { fontSize: '10px', color: '#aaa', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '5px' });
    box.appendChild(lblAuto);

    const autoRow = document.createElement('div');
    Object.assign(autoRow.style, { display: 'flex', gap: '6px', marginBottom: '4px' });

    const inpAuto = document.createElement('input');
    inpAuto.type = 'number';
    inpAuto.min = '0';
    inpAuto.placeholder = '0 = desligado';
    inpAuto.value = creds.AUTO_INTERVALO || '0';
    Object.assign(inpAuto.style, {
      flex: '1', padding: '9px 12px', background: '#1a1a1a',
      border: '1px solid #333', borderRadius: '7px', color: '#fff',
      fontFamily: 'monospace', fontSize: '12px', boxSizing: 'border-box', outline: 'none',
    });
    autoRow.appendChild(inpAuto);
    inputs._inpAuto = inpAuto;

    // Botões de atalho
    [30, 60, 300, 600].forEach(seg => {
      const b = document.createElement('button');
      b.textContent = seg < 60 ? `${seg}s` : `${seg/60}m`;
      Object.assign(b.style, {
        padding: '6px 10px', background: '#222', border: '1px solid #444',
        borderRadius: '6px', color: '#ccc', cursor: 'pointer', fontFamily: 'monospace',
        fontSize: '11px',
      });
      b.addEventListener('click', (e) => { e.preventDefault(); inpAuto.value = seg; });
      autoRow.appendChild(b);
    });
    box.appendChild(autoRow);

    const hAuto = document.createElement('div');
    hAuto.textContent = '→ 0 = desligado. Recarrega a página e executa automaticamente.';
    Object.assign(hAuto.style, { fontSize: '10px', color: '#666', marginBottom: '12px', fontFamily: 'monospace' });
    box.appendChild(hAuto);

    // Lista padrão para auto-run
    const lblLista = document.createElement('div');
    lblLista.textContent = 'Lista padrão (destino dos cards)';
    Object.assign(lblLista.style, { fontSize: '10px', color: '#aaa', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '5px' });
    box.appendChild(lblLista);

    const listaRow = document.createElement('div');
    Object.assign(listaRow.style, { display: 'flex', gap: '6px', marginBottom: '4px' });

    const selLista = document.createElement('select');
    selLista.id = '__vt_sel_lista__';
    Object.assign(selLista.style, {
      flex: '1', padding: '9px 12px', background: '#1a1a1a',
      border: '1px solid #333', borderRadius: '7px', color: '#fff',
      fontFamily: 'monospace', fontSize: '12px', boxSizing: 'border-box', cursor: 'pointer',
    });
    const optPlaceholder = document.createElement('option');
    optPlaceholder.textContent = '— Clique "Buscar" para carregar —';
    optPlaceholder.value = '';
    selLista.appendChild(optPlaceholder);
    listaRow.appendChild(selLista);

    const btnBuscar = document.createElement('button');
    btnBuscar.textContent = '🔍 Buscar';
    Object.assign(btnBuscar.style, {
      padding: '6px 14px', background: '#222', border: '1px solid #444',
      borderRadius: '6px', color: '#ccc', cursor: 'pointer', fontFamily: 'monospace',
      fontSize: '11px', whiteSpace: 'nowrap',
    });
    btnBuscar.addEventListener('click', async (e) => {
      e.preventDefault();
      const k = inputs.API_KEY.value.trim();
      const t = inputs.API_TOKEN.value.trim();
      const boardML = inputs.BOARD_ID_ML.value.trim();
      const boardSP = inputs.BOARD_ID_SHOPEE.value.trim();
      const boardId = PLATAFORMA === 'ml' ? boardML : boardSP;
      if (!k || !t || !boardId) {
        btnBuscar.textContent = '❌ Preencha creds';
        setTimeout(() => btnBuscar.textContent = '🔍 Buscar', 2000);
        return;
      }
      btnBuscar.textContent = '⏳...';
      try {
        const res = await fetch(`https://api.trello.com/1/boards/${boardId}/lists?key=${k}&token=${t}`);
        const listas = await res.json();
        selLista.innerHTML = '';
        const savedNome = creds.AUTO_LISTA_NOME || '';
        listas.forEach(l => {
          const o = document.createElement('option');
          o.value = l.name; o.textContent = l.name;
          if (l.name === savedNome) o.selected = true;
          selLista.appendChild(o);
        });
        btnBuscar.textContent = `✔ ${listas.length} listas`;
      } catch {
        btnBuscar.textContent = '❌ Erro';
        setTimeout(() => btnBuscar.textContent = '🔍 Buscar', 2000);
      }
    });
    listaRow.appendChild(btnBuscar);
    box.appendChild(listaRow);

    const hLista = document.createElement('div');
    hLista.textContent = '→ Lista onde os cards serão criados automaticamente. Busque e selecione pelo nome.';
    Object.assign(hLista.style, { fontSize: '10px', color: '#666', marginBottom: '12px', fontFamily: 'monospace' });
    box.appendChild(hLista);
    inputs._selLista = selLista;

    // ── Botões ──
    const btnRow = document.createElement('div');
    Object.assign(btnRow.style, { display: 'flex', gap: '10px', marginTop: '16px' });

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
        ['API_KEY','API_TOKEN','BOARD_ID_ML','BOARD_ID_SHOPEE'].forEach(k => {
          inputs[k].style.borderColor = !inputs[k].value.trim() ? '#f87171' : '#333';
        });
        return;
      }
      // Salvar campos de texto
      ['API_KEY','API_TOKEN','BOARD_ID_ML','BOARD_ID_SHOPEE',
       'LABEL_RECLAM','LABEL_MAIS','LABEL_SEM_LOGO',
       'LABEL_RECLAM_SHOPEE','LABEL_MAIS_SHOPEE','LABEL_SEM_LOGO_SHOPEE'
      ].forEach(key => GM_setValue(key, inputs[key].value.trim()));
      _etqCache = null; // config mudou: refaz a resolução das etiquetas

      // Salvar automação (por plataforma)
      GM_setValue(`AUTO_INTERVALO_${PLATAFORMA}`, inpAuto.value.trim() || '0');

      if (selLista.value) GM_setValue(`AUTO_LISTA_NOME_${PLATAFORMA}`, selLista.value);

      overlay.remove();
      atualizarBotaoAuto(); // atualiza visual do botão
      if (aoSalvar) aoSalvar();
    });
    btnRow.appendChild(btnSalvar);

    const btnFechar = document.createElement('button');
    btnFechar.textContent = 'Fechar';
    Object.assign(btnFechar.style, {
      padding: '11px 18px', background: 'transparent', border: '1px solid #333',
      borderRadius: '7px', color: '#888', cursor: 'pointer', fontFamily: 'monospace', fontSize: '13px',
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
    ui.appendChild(el('div', { color: '#999', fontSize: '12px' }, 'Aguarde...'));
  }

  function showMsg(titulo, msg, cor) {
    const ui = criarUI();
    ui.appendChild(el('div', { color: cor || cfg.ACCENT, fontWeight: 'bold', marginBottom: '8px' }, titulo));
    ui.appendChild(el('div', { color: '#999', fontSize: '12px', marginBottom: '14px' }, msg));
    const b = mkBtn('Fechar', { background: 'transparent', border: '1px solid #2a2a2a', color: '#888' });
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

  // Resolve as etiquetas do quadro da plataforma atual, uma vez por execução.
  let _etqCache = null;
  async function resolverEtiquetas() {
    if (_etqCache) return _etqCache;
    const c = getCreds();
    const manual = PLATAFORMA === 'ml'
      ? { mais: c.LABEL_MAIS,        semLogo: c.LABEL_SEM_LOGO,        reclam: c.LABEL_RECLAM }
      : { mais: c.LABEL_MAIS_SHOPEE, semLogo: c.LABEL_SEM_LOGO_SHOPEE, reclam: c.LABEL_RECLAM_SHOPEE };

    let doQuadro = [];
    try {
      const res = await fetch(
        `https://api.trello.com/1/boards/${cfg.BOARD_ID}/labels?fields=name&key=${c.API_KEY}&token=${c.API_TOKEN}`
      );
      if (res.ok) doQuadro = await res.json();
    } catch { /* sem rede: cai nos IDs manuais, se houver */ }

    _etqCache = escolherEtiquetas(manual, doQuadro);
    return _etqCache;
  }

  // Variantes da busca de cards, da mais completa pra mais básica:
  //   1ª — filter=all traz arquivados (cliente com pedido antigo arquivado não
  //        volta a parecer novo) e idLabels permite etiquetar retroativo;
  //   2ª — sem filter, caso o quadro/API recuse esse parâmetro;
  //   3ª — a forma antiga, que sempre funcionou.
  // A v2.6 mandava só a 1ª e, quando o Trello recusava, a sincronização inteira
  // morria com "Erro ao consultar o Trello". Agora degrada em vez de travar.
  const VARIANTES_CARDS = [
    'filter=all&fields=name,desc,idLabels',
    'fields=name,desc,idLabels',
    'fields=name,desc',
  ];

  let _varianteOk = null; // a que funcionou: tenta ela primeiro nas próximas

  async function buscarCardsComFallback(base, fetchFn) {
    const ordem = _varianteOk
      ? [_varianteOk, ...VARIANTES_CARDS.filter(v => v !== _varianteOk)]
      : VARIANTES_CARDS.slice();

    const erros = [];
    for (const q of ordem) {
      try {
        const res = await fetchFn(`${base}?${q}`);
        if (!res.ok) { erros.push(`${q} → HTTP ${res.status}`); continue; }
        const dados = await res.json();
        if (!Array.isArray(dados)) { erros.push(`${q} → resposta não é lista`); continue; }
        _varianteOk = q;
        return { cards: dados, variante: q, erros };
      } catch (e) {
        erros.push(`${q} → ${e.message}`);
      }
    }
    throw new Error(`Trello recusou a busca de cards:\n${erros.join('\n')}`);
  }

  // ─── Trello API ───────────────────────────────────────────────
  async function getTrelloCards() {
    const { API_KEY, API_TOKEN } = getCreds();
    const { cards, variante, erros } = await buscarCardsComFallback(
      `https://api.trello.com/1/boards/${cfg.BOARD_ID}/cards`,
      url => fetch(`${url}&key=${API_KEY}&token=${API_TOKEN}`)
    );
    if (erros.length) console.warn('[VT] variantes recusadas:', erros, '→ usando:', variante);
    return cards;
  }

  async function getDadosExistentes() {
    const cards = await getTrelloCards();
    const existentes = new Set();
    const cardsPorCliente = new Map();

    cards.forEach(c => {
      const txt = (c.name || '') + ' ' + (c.desc || '');
      (txt.match(/https?:\/\/\S+/g) || []).forEach(l => existentes.add(l.trim()));
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

  async function getListas() {
    const { API_KEY, API_TOKEN } = getCreds();
    const res = await fetch(
      `https://api.trello.com/1/boards/${cfg.BOARD_ID}/lists?key=${API_KEY}&token=${API_TOKEN}`
    );
    if (!res.ok) throw new Error(`listas: HTTP ${res.status} (confira Board ID / chave / token)`);
    const todas = await res.json();
    return todas.filter(cfg.FILTRO_LISTAS);
  }

  async function criarCard(p, listId) {
    const creds = getCreds();
    const labels = [];

    // ── v1.3: etiquetas por plataforma (v2.7: resolvidas pelo nome no quadro) ──
    const etq = await resolverEtiquetas();
    if (p.isReclamacao && etq.reclam) labels.push(etq.reclam);
    // Mais compras costuma ser revenda/franquia — vai junto com "sem logo",
    // mesmo par que o botão 🔎 Rastrear do painel de chat aplica.
    if (p.maisCompras && etq.mais)    labels.push(etq.mais);
    if (p.maisCompras && etq.semLogo) labels.push(etq.semLogo);

    const body = { name: p.nome, desc: p.desc, idList: listId };
    if (p.dueDate)     body.due      = p.dueDate;
    if (labels.length) body.idLabels = labels;

    const res = await fetch(
      `https://api.trello.com/1/cards?key=${creds.API_KEY}&token=${creds.API_TOKEN}`,
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

  let _expandindo = false; // trava contra reentrância (auto-run sobreposto)

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
      // v2.5: usa a propriedade .href (sempre absoluta) em vez de getAttribute —
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

      // v2.5: dedup pelo ID da venda, não pela URL inteira. O ML trocou o domínio
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

  // ─── Paginação ─────────────────────────────────────────────
  function temProximaPagina() {
    // ML: verifica se o botão "Seguinte" NÃO está desabilitado
    const mlNextDisabled = document.querySelector(
      '.andes-pagination__button--next.andes-pagination__button--disabled'
    );
    if (mlNextDisabled) return null;

    const todos = [...document.querySelectorAll('a, button')];
    return todos.find(e => {
      const t = e.innerText.trim().toLowerCase();
      return (t === 'seguinte' || t === 'next' || t === '>')
        && !e.disabled && !e.closest('[disabled]') && e.offsetParent !== null;
    }) || document.querySelector(
      '.andes-pagination__button--next:not(.andes-pagination__button--disabled) a, ' +
      'button.shopee-mini-page-controller__next-btn:not([disabled])'
    ) || null;
  }

  function clicarProximaPagina() {
    const btn = temProximaPagina();
    if (btn) { btn.click(); return true; }
    return false;
  }

  // Navega até a última página (para modo decrescente)

  function getPaginaAtual() {
    // ML: classe --current
    const atual = document.querySelector(
      '.andes-pagination__button--current, [class*="pagination"] [class*="current"], [class*="pagination"] [class*="active"]'
    );
    if (atual) {
      const n = parseInt(atual.innerText.trim());
      if (!isNaN(n)) return n;
    }
    // Fallback: se não tem paginação, é página 1
    return 1;
  }

  function paginaTemConteudo() {
    // Verifica se a página tem cards de venda visíveis
    if (PLATAFORMA === 'ml') {
      return document.querySelectorAll('.row-card-container').length > 0;
    } else {
      return document.querySelectorAll('.order-card').length > 0;
    }
  }

  // ─── UI: preview ──────────────────────────────────────────────
  function showPreview(novos, jaExistem, listas) {
    const ui = criarUI();

    const header = el('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' });
    header.appendChild(el('span', { color: cfg.ACCENT, fontWeight: 'bold' }, cfg.LABEL));
    header.appendChild(el('span', { color: '#999', fontSize: '11px' }, `${novos.length} novo(s) · ${jaExistem} já existe(m)`));
    ui.appendChild(header);

    // Indicador do board
    ui.appendChild(el('div', { color: '#666', fontSize: '10px', marginBottom: '12px' },
      `📌 Board: ${cfg.BOARD_ID}`));

    const wrap = el('div', { maxHeight: '220px', overflowY: 'auto', marginBottom: '14px' });
    novos.forEach(p => {
      const item = el('div', { padding: '10px', background: '#1a1a1a', borderRadius: '7px', marginBottom: '6px' });

      const top = el('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' });
      top.appendChild(el('span', { color: '#fff', fontWeight: 'bold' }, p.nome));
      if (p.data) top.appendChild(el('span', { color: '#999', fontSize: '11px' }, p.data));
      item.appendChild(top);

      p.itens.forEach(it => {
        const linha = el('div', { fontSize: '11px', color: '#bbb', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' });
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
      ui.appendChild(el('div', { padding: '8px 10px', background: '#1a1a1a', borderRadius: '7px', marginBottom: '12px', color: '#999', fontSize: '11px', textAlign: 'center' }, `⏭ ${jaExistem} já existem no Trello`));

    ui.appendChild(el('div', { color: '#bbb', fontSize: '11px', marginBottom: '6px' }, 'ENVIAR PARA A LISTA:'));
    const sel = document.createElement('select');
    Object.assign(sel.style, { width: '100%', padding: '10px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '7px', color: '#fff', fontFamily: 'monospace', fontSize: '13px', marginBottom: '10px', cursor: 'pointer' });
    const ultimaLista = getCreds().ULTIMA_LISTA;
    listas.forEach(l => {
      const o = document.createElement('option');
      o.value = l.id; o.textContent = l.name;
      if (l.id === ultimaLista) o.selected = true;
      sel.appendChild(o);
    });
    ui.appendChild(sel);

    const bEnviar = mkBtn(`🚀 Criar ${novos.length} card(s) no Trello`, { background: PLATAFORMA === 'ml' ? '#0052cc' : cfg.ACCENT, color: '#fff' });
    bEnviar.addEventListener('click', async () => {
      GM_setValue(`ULTIMA_LISTA_${PLATAFORMA}`, sel.value); // salva última lista usada
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

    // ── v1.3: botão de paginação manual ──
    if (temProximaPagina()) {
      const bPag = mkBtn('📄 Próxima página →', { background: '#1a1a2a', border: '1px solid #3a3a6a', color: '#9a9aff' });
      bPag.addEventListener('click', () => { clicarProximaPagina(); });
      ui.appendChild(bPag);
    }

    const bFechar = mkBtn('Fechar', { background: 'transparent', border: '1px solid #2a2a2a', color: '#888' });
    bFechar.addEventListener('click', rm);
    ui.appendChild(bFechar);
  }

  function showFeito(ok, err, ignorados, retro = 0) {
    const ui = criarUI();
    ui.appendChild(el('div', { color: cfg.ACCENT, fontWeight: 'bold', marginBottom: '12px' }, cfg.LABEL));
    const box = el('div', { padding: '14px', background: '#1a1a1a', borderRadius: '7px', textAlign: 'center', marginBottom: '14px' });
    box.appendChild(el('div', { color: '#34d399', fontSize: '15px', marginBottom: '6px' }, `✔ ${ok} card(s) criado(s)`));
    if (ignorados > 0) box.appendChild(el('div', { color: '#999', fontSize: '12px', marginBottom: '4px' }, `⏭ ${ignorados} já existiam`));
    if (retro > 0) box.appendChild(el('div', { color: '#7ab8ff', fontSize: '12px', marginBottom: '4px' }, `🔁 ${retro} card(s) antigo(s) etiquetado(s)`));
    if (err) box.appendChild(el('div', { color: '#f87171' }, `✘ ${err} erro(s)`));
    ui.appendChild(box);

    // ── v1.3: botão de próxima página no resultado ──
    if (temProximaPagina()) {
      const bPag = mkBtn('📄 Próxima página →', { background: '#1a1a2a', border: '1px solid #3a3a6a', color: '#9a9aff' });
      bPag.addEventListener('click', () => { clicarProximaPagina(); });
      ui.appendChild(bPag);
    }

    const b = mkBtn('Fechar', { background: 'transparent', border: '1px solid #2a2a2a', color: '#888' });
    b.addEventListener('click', rm);
    ui.appendChild(b);
  }

  // ─── Roda (manual) ────────────────────────────────────────────
  async function rodar() {
    const creds = getCreds();
    if (credsFaltando(creds)) {
      mostrarSetup(() => rodar());
      return;
    }

    // Validação: boards diferentes
    if (creds.BOARD_ID_ML === creds.BOARD_ID_SHOPEE) {
      showMsg('⚠️ Board IDs iguais!',
        `O Board ML e Shopee estão com o mesmo ID (${creds.BOARD_ID_ML}). Abra ⚙️ e corrija.`, '#f87171');
      return;
    }

    // Log da plataforma/board
    console.log(`[VT] Plataforma: ${PLATAFORMA} | Board: ${cfg.BOARD_ID}`);

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
      // Mostra o motivo real — antes era só "Erro ao consultar o Trello" e não
      // dava pra saber se era credencial, board errado ou parâmetro recusado.
      .catch(e => { console.error(e); rm(); alert(`Erro ao consultar o Trello.\n\n${e && e.message ? e.message : e}`); });
  }

  // ─── Auto-run ──────────────────────────────────────────────
  let _autoTimer = null;
  let _autoAbortado = false;       // cancela countdown de 5s
  let _autoParar = false;          // para após terminar execução atual

  // v3.0 — TRAVA DE SESSÃO.
  // O automático não liga sozinho ao abrir o navegador: alguém precisa clicar
  // em ▶ nesta aba. A marca vive no sessionStorage, então fechar o navegador
  // (ou abrir outra aba) volta ao estado desarmado. Isso evita o caso ruim de
  // uma máquina esquecida ligada criando card sozinha no dia seguinte — e faz
  // o ⏹ Parar ser definitivo: depois dele, F5 não ressuscita o robô.
  const CHAVE_ARMADO = `vt_auto_armado_${PLATAFORMA}`;

  function autoArmado() {
    try { return sessionStorage.getItem(CHAVE_ARMADO) === '1'; }
    catch { return false; }
  }

  function armarAuto(ligado) {
    try {
      if (ligado) sessionStorage.setItem(CHAVE_ARMADO, '1');
      else sessionStorage.removeItem(CHAVE_ARMADO);
    } catch { /* navegador bloqueando storage: segue desarmado */ }
    atualizarBtnControle();
  }

  function logAuto(msg) {
    console.log(`[VT Auto] ${msg}`);
  }

  async function processarPagina(listaId) {
    if (PLATAFORMA === 'ml') await mlExpandirPacotes();
    const pedidos = PLATAFORMA === 'ml' ? mlScrape() : spScrape();
    if (pedidos.length === 0) {
      logAuto(`Pág ${getPaginaAtual() || '?'}: nenhum pedido.`);
      return;
    }
    const { existentes, cardsPorCliente } = await getDadosExistentes();
    const novos = marcarMaisCompras(
      pedidos.filter(p => !existentes.has(p._chave)),
      cardsPorCliente
    );
    // v3.0: antes, falha de criação era engolida em silêncio. No automático
    // isso é perigoso — uma configuração errada erra em lote parecendo que
    // funcionou. Agora conta, registra o motivo e mostra no indicador.
    let ok = 0, erros = 0, ultimoErro = '';
    for (const p of novos) {
      try {
        const c = await criarCard(p, listaId);
        if (c && c.id) ok++;
        else { erros++; ultimoErro = 'resposta sem id'; }
      } catch (e) {
        erros++;
        ultimoErro = (e && e.message) ? e.message : String(e);
      }
      await new Promise(r => setTimeout(r, 250));
    }
    let retro = 0;
    try { retro = await etiquetarAnteriores(novos); } catch { /* acessório */ }
    logAuto(`${ok} criados, ${erros} com erro, ${pedidos.length - novos.length} já existiam${retro ? `, ${retro} antigo(s) etiquetado(s)` : ''}.`);
    if (erros) {
      logAuto('Último erro: ' + ultimoErro);
      atualizarIndicador(`⚠️ ${ok} ok · ${erros} erro(s)`);
      // Erro em todos: quase sempre credencial ou lista errada. Para, em vez
      // de repetir o problema no próximo ciclo.
      if (ok === 0 && erros > 0) {
        logAuto('Nenhum card criado. Parando o automático para não repetir o erro.');
        pararAuto();
      }
    } else {
      atualizarIndicador(`✔ ${ok} criado(s)`);
    }
  }

  async function rodarAutomatico() {
    const creds = getCreds();
    if (credsFaltando(creds)) { logAuto('Credenciais faltando.'); return; }

    // Safety: boards iguais = config errada
    if (creds.BOARD_ID_ML === creds.BOARD_ID_SHOPEE) {
      logAuto('ERRO: Board ML e Shopee com mesmo ID! Auto-run pausado.');
      atualizarIndicador('⚠️ Boards iguais');
      return;
    }

    // Resolver lista
    let listaId = creds.ULTIMA_LISTA;
    if (creds.AUTO_LISTA_NOME) {
      try {
        const res = await fetch(
          `https://api.trello.com/1/boards/${cfg.BOARD_ID}/lists?key=${creds.API_KEY}&token=${creds.API_TOKEN}`
        );
        const listas = await res.json();
        const match = listas.find(l => l.name === creds.AUTO_LISTA_NOME);
        if (match) { listaId = match.id; logAuto(`Lista: "${match.name}"`); }
        else { logAuto(`Lista "${creds.AUTO_LISTA_NOME}" não encontrada.`); }
      } catch (e) { logAuto('Erro listas: ' + e.message); }
    }
    if (!listaId) {
      logAuto('Nenhuma lista configurada. Abra ⚙️.');
      atualizarIndicador('⚠️ Configure lista');
      agendarProximoAuto();
      return;
    }

    atualizarIndicador('🔄 Executando...');
    logAuto(`Plataforma: ${PLATAFORMA} | Board: ${cfg.BOARD_ID}`);

    try {
      // Verificar se a página tem conteúdo (não está com erro)
      if (!paginaTemConteudo()) {
        logAuto('Página sem conteúdo (possível erro). Recarregando...');
        atualizarIndicador('⚠️ Recarregando...');
        setTimeout(() => location.reload(), 3000);
        return;
      }

      // v3.0: o automático processa apenas a página aberta. A varredura que
      // andava sozinha pelas páginas foi removida — ela dependia das classes
      // de paginação do Mercado Livre, nunca funcionou na Shopee, e navegar
      // sozinho é justamente o que torna um erro difícil de perceber.
      // Para outras páginas, use o botão "Próxima página" e rode de novo.
      logAuto('Processando a página aberta...');
      atualizarIndicador('🔄 Processando...');
      await processarPagina(listaId);

      if (_autoParar) {
        logAuto('Parado pelo usuário.');
        atualizarIndicador('⏹ Parado');
        atualizarBtnControle();
        return;
      }

      agendarProximoAuto();

    } catch (e) {
      logAuto('Erro: ' + e.message);
      atualizarIndicador('❌ Erro');
      agendarProximoAuto();
    }
  }

  function agendarProximoAuto() {
    if (_autoParar) {
      logAuto('Parado. Não vai agendar.');
      atualizarIndicador('⏹ Parado');
      atualizarBtnControle();
      return;
    }
    const seg = parseInt(getCreds().AUTO_INTERVALO) || 0;
    if (seg <= 0) return;
    const label = seg >= 60 ? `${Math.round(seg/60)}min` : `${seg}s`;
    logAuto(`Próxima execução em ${label}.`);
    atualizarIndicador(`⏰ ${label}`);
    _autoTimer = setTimeout(() => {
      logAuto('Recarregando página...');
      location.reload();
    }, seg * 1000);
  }

  function pararAuto() {
    _autoParar = true;
    if (_autoTimer) { clearTimeout(_autoTimer); _autoTimer = null; }
    armarAuto(false); // desarma a sessão: F5 depois disso não religa sozinho
    logAuto('Stop solicitado. Vai parar após terminar.');
    atualizarIndicador('⏳ Parando...');
    atualizarBtnControle();
  }

  function desativarAuto() {
    _autoParar = true;
    _autoAbortado = true;
    if (_autoTimer) { clearTimeout(_autoTimer); _autoTimer = null; }
    GM_setValue(`AUTO_INTERVALO_${PLATAFORMA}`, '0');
    armarAuto(false);
    logAuto('Auto-run desativado.');
    atualizarIndicador('');
    const ind = document.getElementById(BTN_ID + '_auto');
    if (ind) ind.style.display = 'none';
    atualizarBtnControle();
  }

  function atualizarBtnControle() {
    const autoAtivo = (parseInt(getCreds().AUTO_INTERVALO) || 0) > 0;
    const armado = autoArmado();
    const btnPlay = document.getElementById(BTN_ID + '_play');
    const btnStop = document.getElementById(BTN_ID + '_stop');
    const btnOff  = document.getElementById(BTN_ID + '_off');
    // ▶ enquanto desarmado, ⏹ enquanto rodando, 🔴 sempre que houver intervalo
    if (btnPlay) btnPlay.style.display = (autoAtivo && !armado) ? 'block' : 'none';
    if (btnStop) btnStop.style.display = (autoAtivo && armado && !_autoParar) ? 'block' : 'none';
    if (btnOff)  btnOff.style.display  = autoAtivo ? 'block' : 'none';
  }

  function iniciarAutoRun() {
    const seg = parseInt(getCreds().AUTO_INTERVALO) || 0;
    if (seg <= 0) return;
    const label = seg >= 60 ? `${Math.round(seg/60)}min` : `${seg}s`;

    logAuto(`Auto-run ativo: a cada ${label}.`);

    // Mostra aviso com opção de cancelar antes de executar
    const aviso = document.createElement('div');
    aviso.id = '__vt_auto_aviso__';
    Object.assign(aviso.style, {
      position: 'fixed', bottom: '60px', left: '20px', zIndex: '99998',
      background: '#1a1a2a', border: '1px solid #3a3a6a', borderRadius: '10px',
      padding: '10px 16px', fontFamily: 'monospace', fontSize: '12px',
      color: '#9a9aff', display: 'flex', alignItems: 'center', gap: '10px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
    });

    let countdown = 5;
    const txt = document.createElement('span');
    txt.textContent = `🤖 Auto-executando em ${countdown}s...`;
    aviso.appendChild(txt);

    const btnCancel = document.createElement('button');
    btnCancel.textContent = '✕';
    Object.assign(btnCancel.style, {
      background: 'transparent', border: '1px solid #555', borderRadius: '4px',
      color: '#aaa', cursor: 'pointer', padding: '2px 8px', fontFamily: 'monospace', fontSize: '12px',
    });
    btnCancel.addEventListener('click', () => {
      _autoAbortado = true;
      aviso.remove();
      atualizarIndicador('⏸ Pausado');
      logAuto('Auto-run cancelado pelo usuário.');
    });
    aviso.appendChild(btnCancel);
    document.body.appendChild(aviso);

    const iv = setInterval(() => {
      countdown--;
      if (_autoAbortado) { clearInterval(iv); aviso.remove(); return; }
      if (countdown <= 0) {
        clearInterval(iv);
        aviso.remove();
        rodarAutomatico();
      } else {
        txt.textContent = `🤖 Auto-executando em ${countdown}s...`;
      }
    }, 1000);
  }

  // ─── Indicador auto-run (v1.3) ───────────────────────────────
  function atualizarIndicador(texto) {
    const ind = document.getElementById(BTN_ID + '_auto');
    if (ind) ind.textContent = texto;
  }

  function atualizarBotaoAuto() {
    const seg = parseInt(getCreds().AUTO_INTERVALO) || 0;
    const ind = document.getElementById(BTN_ID + '_auto');
    if (ind) {
      const label = seg >= 60 ? `⏰ ${Math.round(seg/60)}min` : `⏰ ${seg}s`;
      ind.textContent = seg > 0 ? label : '';
      ind.style.display = seg > 0 ? 'block' : 'none';
    }
  }

  // ─── Botão ────────────────────────────────────────────────────
  function adicionarBotao() {
    if (document.getElementById(BTN_ID)) return;

    const wrap = document.createElement('div');
    wrap.id = BTN_ID + '_wrap';
    Object.assign(wrap.style, {
      position: 'fixed', bottom: '20px', left: '20px', zIndex: '99999',
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px',
    });

    // Indicador de auto-run (em cima dos botões)
    const autoInd = document.createElement('div');
    autoInd.id = BTN_ID + '_auto';
    const _seg = parseInt(getCreds().AUTO_INTERVALO) || 0;
    const _lbl = _seg >= 60 ? `⏰ ${Math.round(_seg/60)}min` : `⏰ ${_seg}s`;
    autoInd.textContent = _seg > 0 ? _lbl : '';
    Object.assign(autoInd.style, {
      fontSize: '10px', color: '#9a9aff', fontFamily: 'monospace',
      background: '#1a1a2a', borderRadius: '6px', padding: '3px 8px',
      display: _seg > 0 ? 'inline-block' : 'none',
    });
    wrap.appendChild(autoInd);

    // Linha de botões
    const row = el('div', { display: 'flex', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', borderRadius: '10px' });

    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.textContent = `📋 ${cfg.LABEL}`;
    Object.assign(btn.style, {
      background: cfg.BTN_COR, color: cfg.BTN_TEXTO_COR,
      border: 'none', borderRadius: '10px 0 0 10px', padding: '12px 18px',
      fontFamily: 'monospace', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
    });
    btn.addEventListener('click', rodar);
    row.appendChild(btn);

    const btnCfg = document.createElement('button');
    btnCfg.id = BTN_ID + '_cfg';
    btnCfg.textContent = '⚙️';
    Object.assign(btnCfg.style, {
      background: '#333', color: '#fff',
      border: 'none', borderLeft: '1px solid #555',
      borderRadius: '0', padding: '12px 10px',
      fontFamily: 'monospace', fontSize: '13px', cursor: 'pointer',
    });
    btnCfg.addEventListener('click', () => mostrarSetup(null));
    row.appendChild(btnCfg);

    // Controles do automático. Só aparecem se houver intervalo configurado.
    // ▶ Armar: o automático só passa a rodar depois deste clique, e só nesta aba.
    const autoAtivo = (parseInt(getCreds().AUTO_INTERVALO) || 0) > 0;
    if (!autoAtivo) btnCfg.style.borderRadius = '0 10px 10px 0';

    const btnPlay = document.createElement('button');
    btnPlay.id = BTN_ID + '_play';
    btnPlay.textContent = '▶';
    btnPlay.title = 'Iniciar o automático nesta aba';
    Object.assign(btnPlay.style, {
      background: '#1a2a1a', color: '#6bbe8c',
      border: 'none', borderLeft: '1px solid #555',
      borderRadius: '0', padding: '12px 10px',
      fontFamily: 'monospace', fontSize: '13px', cursor: 'pointer',
      display: (autoAtivo && !autoArmado()) ? 'block' : 'none',
    });
    btnPlay.addEventListener('click', () => {
      _autoParar = false;
      _autoAbortado = false;
      armarAuto(true);
      logAuto('Automático armado nesta aba.');
      iniciarAutoRun();
    });
    row.appendChild(btnPlay);

    const btnStop = document.createElement('button');
    btnStop.id = BTN_ID + '_stop';
    btnStop.textContent = '⏹';
    btnStop.title = 'Parar após terminar';
    Object.assign(btnStop.style, {
      background: '#2a2a1a', color: '#f9a825',
      border: 'none', borderLeft: '1px solid #555',
      borderRadius: '0', padding: '12px 10px',
      fontFamily: 'monospace', fontSize: '13px', cursor: 'pointer',
      display: (autoAtivo && autoArmado()) ? 'block' : 'none',
    });
    btnStop.addEventListener('click', () => pararAuto());
    row.appendChild(btnStop);

    // Botão 🔴 Desativar (desliga auto-run na config)
    const btnOff = document.createElement('button');
    btnOff.id = BTN_ID + '_off';
    btnOff.textContent = '🔴';
    btnOff.title = 'Desativar auto-run';
    Object.assign(btnOff.style, {
      background: '#2a1a1a', color: '#f87171',
      border: 'none', borderLeft: '1px solid #555',
      borderRadius: '0 10px 10px 0', padding: '12px 10px',
      fontFamily: 'monospace', fontSize: '13px', cursor: 'pointer',
      display: autoAtivo ? 'block' : 'none',
    });
    btnOff.addEventListener('click', () => desativarAuto());
    row.appendChild(btnOff);

    wrap.appendChild(row);

    document.body.appendChild(wrap);
  }

  function init() {
    console.log(`[VT] Iniciado: ${PLATAFORMA.toUpperCase()} → Board: ${cfg.BOARD_ID || '(não configurado)'}`);
    adicionarBotao();
    new MutationObserver(() => adicionarBotao()).observe(document.body, { childList: true, subtree: false });

    // ── Auto-run na inicialização ──
    // v3.0: só continua se alguém tiver armado com ▶ nesta aba. Abrir o
    // navegador não é suficiente — é isso que impede a máquina esquecida
    // ligada de sair sincronizando sozinha.
    const seg = parseInt(getCreds().AUTO_INTERVALO) || 0;
    if (seg > 0 && !credsFaltando(getCreds())) {
      if (autoArmado()) {
        setTimeout(() => iniciarAutoRun(), 3000);
      } else {
        logAuto('Automático configurado, mas desarmado. Clique em ▶ para iniciar.');
        atualizarIndicador('▶ parado');
      }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
