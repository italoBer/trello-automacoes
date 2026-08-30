// ==UserScript==
// @name         ML — Abrir Mensagens
// @namespace    empresa-ml-msgs
// @version      1.3
// @description  Abre todas as conversas de clientes na página de pós-venda do ML
// @match        https://*.mercadolivre.com.br/post-purchase/post-sales*
// @grant        GM_openInTab
// @updateURL    https://raw.githubusercontent.com/italoBer/trello-automacoes/main/tampermonkey/ml-mensagens.js
// @downloadURL  https://raw.githubusercontent.com/italoBer/trello-automacoes/main/tampermonkey/ml-mensagens.js
// ==/UserScript==

(function () {
  'use strict';

  const BTN_ID = '__ml_abrir_msgs__';

  function coletarLinks() {
    const links = new Set();

    // 1. Botões "Conferir mensagem" que são links <a>
    document.querySelectorAll('a').forEach(a => {
      const texto = a.innerText.trim().toLowerCase();
      if (texto.includes('conferir mensagem') || texto.includes('ver mensagem') || texto.includes('responder')) {
        const href = a.href;
        if (href && href.includes('mercadolivre.com.br')) {
          links.add(href);
        }
      }
    });

    // 2. Se não achou links <a>, procura botões <button> com texto similar
    // e tenta pegar o link do card pai
    if (links.size === 0) {
      document.querySelectorAll('button').forEach(btn => {
        const texto = btn.innerText.trim().toLowerCase();
        if (texto.includes('conferir mensagem') || texto.includes('ver mensagem')) {
          // Tenta achar link de mensagem no card pai
          const card = btn.closest('[class*="card"], [class*="item"], [class*="row"], [class*="sale"]') || btn.parentElement?.parentElement?.parentElement;
          if (card) {
            const linkEl = card.querySelector('a[href*="mensagens"], a[href*="messages"], a[href*="chat"]');
            if (linkEl) {
              links.add(linkEl.href);
            }
          }
        }
      });
    }

    // 3. Fallback: qualquer link que contenha /mensagens/ na página
    if (links.size === 0) {
      document.querySelectorAll('a[href*="mensagens"], a[href*="/messages"]').forEach(a => {
        if (a.href && !a.href.includes('#')) {
          links.add(a.href);
        }
      });
    }

    return [...links];
  }

  // Abre uma aba em background.
  // v1.2: usa GM_openInTab. O jeito antigo (criar um <a target="_blank"> e
  // disparar um clique sintético com ctrlKey) abria só a PRIMEIRA aba: o
  // navegador ignora ctrlKey em evento não-confiável e cada aba nova consome a
  // "ativação do usuário", então o bloqueador de pop-up barra da segunda em
  // diante. O GM_openInTab não passa pelo bloqueador.
  function abrirAba(url) {
    if (typeof GM_openInTab === 'function') {
      GM_openInTab(url, { active: false, insert: true, setParent: true });
      return true;
    }
    // Fallback (só cai aqui se o @grant falhar) — depende de pop-up liberado
    window.open(url, '_blank', 'noopener');
    return false;
  }

  function abrirTodas() {
    const links = coletarLinks();

    if (links.length === 0) {
      mostrarToast('⚠️ Nenhuma conversa encontrada nesta página.', 'warn');
      return;
    }

    // Confirmação
    const ok = confirm(`Abrir ${links.length} conversa(s) em novas abas?`);
    if (!ok) return;

    let abertos = 0;
    let viaGM = true;
    links.forEach((link, i) => {
      setTimeout(() => {
        if (!abrirAba(link)) viaGM = false;

        abertos++;
        atualizarProgresso(abertos, links.length);
        if (abertos === links.length) {
          setTimeout(() => {
            mostrarToast(
              viaGM
                ? `✅ ${abertos} conversa(s) aberta(s) em background!`
                : `⚠️ ${abertos} tentativa(s) — libere pop-ups pra este site se faltar aba`,
              viaGM ? 'ok' : 'warn'
            );
          }, 300);
        }
      }, i * 400);
    });
  }

  function atualizarProgresso(atual, total) {
    let prog = document.getElementById('__ml_msg_prog__');
    if (!prog) {
      prog = document.createElement('div');
      prog.id = '__ml_msg_prog__';
      Object.assign(prog.style, {
        position: 'fixed', bottom: '80px', right: '20px', zIndex: '99999',
        background: '#1a1a2a', border: '1px solid #3483fa', borderRadius: '8px',
        padding: '8px 16px', fontFamily: 'monospace', fontSize: '13px',
        color: '#7ab8ff', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      });
      document.body.appendChild(prog);
    }
    prog.textContent = `💬 Abrindo ${atual}/${total}...`;
    if (atual >= total) {
      setTimeout(() => prog.remove(), 2000);
    }
  }

  function mostrarToast(msg, tipo) {
    const t = document.createElement('div');
    Object.assign(t.style, {
      position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
      background: tipo === 'ok' ? '#2e7d32' : tipo === 'warn' ? '#f57f17' : '#333',
      color: '#fff', padding: '12px 24px', borderRadius: '8px', fontFamily: 'monospace',
      fontSize: '14px', zIndex: '999999', boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      transition: 'opacity 0.4s', opacity: '1',
    });
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 3500);
  }

  function criarBotao() {
    if (document.getElementById(BTN_ID)) return;

    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.textContent = '💬 Abrir todas as conversas';
    Object.assign(btn.style, {
      position: 'fixed', bottom: '20px', right: '20px', zIndex: '99999',
      background: '#3483fa', color: '#fff',
      border: 'none', borderRadius: '10px', padding: '14px 20px',
      fontFamily: 'monospace', fontSize: '14px', fontWeight: 'bold',
      cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      transition: 'transform 0.15s, background 0.15s',
    });
    btn.onmouseenter = () => { btn.style.background = '#2968c8'; btn.style.transform = 'scale(1.03)'; };
    btn.onmouseleave = () => { btn.style.background = '#3483fa'; btn.style.transform = 'scale(1)'; };
    btn.addEventListener('click', abrirTodas);
    document.body.appendChild(btn);
  }

  // Init — espera a página carregar
  function init() {
    criarBotao();
    new MutationObserver(() => criarBotao()).observe(document.body, { childList: true, subtree: false });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
