// [Apresentação] Importação dos estilos globais e componentes de UI
import './style.css';
import './home.css';
import './auth.css';

import { el } from './utils/dom.js';
import { createSidebar } from './components/sidebar.js';
import { initModalListeners } from './components/modal.js';

// [Apresentação] Importação modular das páginas (View Layer)
import { renderDashboard } from './modules/dashboard.js';
import { renderCalendar } from './modules/calendar.js';
import { renderReservations } from './modules/reservations.js';
import { renderApprovals } from './modules/approvals.js';
import { renderRooms } from './modules/rooms.js';
import { renderUsers } from './modules/users.js';
import { renderNotifications } from './modules/notifications.js';
import { renderNovaReserva } from './modules/novaReserva.js';

import { tryRestoreSession, login, CURRENT_USER } from './data/store.js';

// ── SPA routing fallback (GitHub Pages 404 → index.html) ──
// public/404.html grava o path original em sessionStorage e redireciona
// pra raiz do app. Aqui restauramos a URL antes do roteador rodar.
(function restoreSpaRedirect() {
  const saved = sessionStorage.getItem('sira:spa-redirect');
  if (!saved) return;
  sessionStorage.removeItem('sira:spa-redirect');
  // Só restaura se o path salvo for diferente da URL atual (evita loop)
  if (
    saved !==
    window.location.pathname + window.location.search + window.location.hash
  ) {
    window.history.replaceState(null, '', saved);
  }
})();

// Base configurada no vite.config.js — em dev é '/', em produção '/SIRA/'.
// Usada pelo roteador para casar URLs absolutas com nomes de página.
const BASE = import.meta.env.BASE_URL || '/';

// Converte um pathname absoluto (com base) em nome de página puro.
// Ex: '/SIRA/dashboard' → 'dashboard'; '/dashboard' → 'dashboard'; '/' → ''.
function pathToPage(pathname) {
  let p = pathname;
  if (BASE !== '/' && p.startsWith(BASE)) p = p.slice(BASE.length);
  return p.replace(/^\/+|\/+$/g, '');
}

// [Apresentação] Roteador Funcional (Dispatcher): Mapeamos strings para funções de renderização.
const PAGE_RENDERERS = {
  dashboard: renderDashboard,
  calendario: renderCalendar,
  reservas: renderReservations,
  aprovacoes: renderApprovals,
  salas: renderRooms,
  usuarios: renderUsers,
  notificacoes: renderNotifications,
  novaReserva: renderNovaReserva,
};

// ── T-08.3: ADICIONA DATA-LABEL NAS CÉLULAS PARA RESPONSIVIDADE MOBILE ──
// [Apresentação] Esta função percorre as tabelas e injeta o texto do cabeçalho em cada célula.
// Isso permite que o CSS transforme a tabela em "cards" no celular usando pseudo-elementos.
function addTableLabels(container) {
  container.querySelectorAll('table').forEach((table) => {
    const headers = [...table.querySelectorAll('thead th')].map((th) =>
      th.textContent.trim(),
    );
    table.querySelectorAll('tbody tr').forEach((tr) => {
      [...tr.querySelectorAll('td')].forEach((td, i) => {
        if (headers[i]) td.setAttribute('data-label', headers[i]);
      });
    });
  });
}

// T-03.2 — Tela de login inline em src/main.js: usa as classes do auth.css
// (.auth-container, .auth-input, .auth-btn-primary, .auth-btn-secondary) para
// que o tema claro/escuro e a paleta global sejam respeitados.
function renderLogin() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const loginBox = el(
    'div',
    { class: 'auth-container' },
    el('h1', { class: 'auth-heading' }, 'SIRA'),
    el(
      'p',
      { class: 'auth-description' },
      'Sistema de Reserva de Salas — entre com seu e-mail institucional.',
    ),
    el('input', {
      id: 'emailInput',
      class: 'auth-input',
      placeholder: 'email@ifpb.edu.br',
      type: 'email',
      autocomplete: 'username',
      onKeydown: (ev) => {
        if (ev.key === 'Enter') document.getElementById('loginBtn')?.click();
      },
    }),
    el(
      'button',
      {
        id: 'loginBtn',
        class: 'auth-btn auth-btn-primary',
        onClick: () => {
          const email = document
            .getElementById('emailInput')
            .value.trim()
            .toLowerCase();
          if (!email) {
            alert('Informe um e-mail válido.');
            return;
          }
          if (login(email)) location.reload();
          else alert('Usuário não encontrado.');
        },
      },
      'Entrar',
    ),
    el(
      'button',
      {
        class: 'auth-btn auth-btn-secondary',
        onClick: () => renderSignup(),
      },
      'Solicitar cadastro',
    ),
  );
  app.appendChild(loginBox);
}

// T-04.1 — Tela de solicitação de cadastro de professor (renderSignup).
// T-04.2 — Validação de nome + e-mail obrigatórios.
// T-04.3 — Geração de ID su-<timestamp> e persistência em
// localStorage["sira:signups"] com approved:false.
function renderSignup() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const signupBox = el(
    'div',
    { class: 'auth-container' },
    el('h1', { class: 'auth-heading' }, 'Solicitar cadastro'),
    el(
      'p',
      { class: 'auth-description' },
      'Sua solicitação ficará pendente até a aprovação do administrador.',
    ),
    el('input', {
      id: 'signupName',
      class: 'auth-input',
      placeholder: 'Nome completo',
      autocomplete: 'name',
    }),
    el('input', {
      id: 'signupEmail',
      class: 'auth-input',
      placeholder: 'email@ifpb.edu.br',
      type: 'email',
      autocomplete: 'email',
    }),
    el(
      'select',
      { id: 'signupRole', class: 'auth-select' },
      el('option', { value: 'professor' }, 'Professor'),
    ),
    el(
      'button',
      {
        class: 'auth-btn auth-btn-primary',
        onClick: () => {
          const name = document.getElementById('signupName').value.trim();
          const email = document
            .getElementById('signupEmail')
            .value.trim()
            .toLowerCase();
          const role = document.getElementById('signupRole').value;
          if (!name || !email) {
            alert('Preencha nome e e-mail.');
            return;
          }
          const signups = JSON.parse(
            localStorage.getItem('sira:signups') || '[]',
          );
          signups.push({
            id: `su-${Date.now()}`,
            name,
            email,
            role,
            approved: false,
          });
          localStorage.setItem('sira:signups', JSON.stringify(signups));
          alert('Solicitação enviada. Aguarde aprovação do administrador.');
          renderLogin();
        },
      },
      'Enviar solicitação',
    ),
    el(
      'button',
      {
        class: 'auth-btn auth-btn-back',
        onClick: () => renderLogin(),
      },
      '← Voltar ao login',
    ),
  );
  app.appendChild(signupBox);
}

function bootstrap() {
  tryRestoreSession();

  if (!CURRENT_USER) {
    renderLogin();
    return;
  }

  const app = document.getElementById('app');
  app.innerHTML = '';

  const shell = el('div', { class: 'sira-shell' });
  const sidebarContainer = document.createElement('div');
  const main = el('div', { class: 'main' });

  const pageContainer = el('div', {
    class: 'page active',
    style: {
      display: 'flex',
      flexDirection: 'column',
      flex: '1',
      overflow: 'hidden',
    },
  });

  main.appendChild(pageContainer);

  // ── T-08.2: OVERLAY DE FECHAMENTO ──
  const overlay = el('div', { class: 'sidebar-overlay' });
  overlay.addEventListener('click', () => {
    sidebarContainer.querySelector('.sidebar')?.classList.remove('open');
    overlay.classList.remove('open');
  });
  document.body.appendChild(overlay);

  // [Apresentação] Função de Navegação Centralizada com Camada de Segurança e Mobile Labels
  function navigate(pageName) {
    if (!CURRENT_USER) return;

    const isAdmin = CURRENT_USER.role === 'admin';
    const allowedForUser = ['reservas', 'calendario', 'novaReserva'];

    if (!isAdmin && !allowedForUser.includes(pageName)) {
      pageName = 'calendario';
    }

    const renderer = PAGE_RENDERERS[pageName];
    if (!renderer) return;

    const targetPath = `${BASE}${pageName}`.replace(/\/{2,}/g, '/');
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }

    pageContainer.innerHTML = '';
    renderer(pageContainer);

    // T-08.3: Aplica labels de acessibilidade/responsividade nas tabelas da nova página
    addTableLabels(pageContainer);
  }

  // ── T-08.1: INJETAR BOTÃO HAMBÚRGUER DINÂMICO ──
  const topbarObserver = new MutationObserver(() => {
    const topbar = pageContainer.querySelector('.topbar');
    if (topbar && !topbar.querySelector('.hamburger')) {
      const hbtn = el(
        'button',
        {
          class: 'hamburger',
          onClick: () => {
            sidebarContainer.querySelector('.sidebar')?.classList.add('open');
            overlay.classList.add('open');
          },
        },
        el('span', {}),
      );
      topbar.prepend(hbtn);
    }
  });
  topbarObserver.observe(pageContainer, { childList: true, subtree: true });

  createSidebar(sidebarContainer, CURRENT_USER, navigate, () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('sira-theme', isDark ? 'dark' : 'light');
  });

  shell.appendChild(sidebarContainer);
  shell.appendChild(main);
  app.appendChild(shell);

  initModalListeners();

  window.addEventListener('popstate', () => {
    let path = pathToPage(window.location.pathname);
    if (!path || !PAGE_RENDERERS[path]) path = 'calendario';
    navigate(path);
  });

  let initialPage = pathToPage(window.location.pathname);
  if (!PAGE_RENDERERS[initialPage]) initialPage = 'calendario';

  navigate(initialPage);
}

bootstrap();
