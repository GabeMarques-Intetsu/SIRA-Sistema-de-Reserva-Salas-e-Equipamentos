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

/**
 * Converte um pathname absoluto (incluindo a BASE do Vite) no nome puro
 * da página usado pelo roteador.
 * Ex: '/SIRA/dashboard' → 'dashboard'; '/dashboard' → 'dashboard'; '/' → ''.
 * @param {string} pathname
 * @returns {string}
 */
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

/**
 * Adiciona o atributo `data-label` (com o texto do cabeçalho) em cada `<td>`
 * das tabelas dentro do container. O CSS responsivo usa esse atributo para
 * transformar as tabelas em "cards" empilhados no mobile.
 * @param {HTMLElement} container
 */
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

/**
 * Renderiza a tela de login inline (sem framework). Lê o e-mail digitado,
 * dispara `login()` no store e recarrega a app em caso de sucesso. Também
 * oferece o link para a tela de solicitação de cadastro.
 * Usa as classes do `auth.css` para respeitar o tema claro/escuro.
 */
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

/**
 * Renderiza a tela de solicitação de cadastro de professor.
 * Valida nome e e-mail obrigatórios, gera um ID `su-<timestamp>` e persiste
 * em `localStorage["sira:signups"]` com `approved: false` — o cadastro fica
 * pendente até o admin aprovar pela tela de Usuários.
 */
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

/**
 * Inicializa a aplicação:
 * 1. Tenta restaurar a sessão a partir do `localStorage`.
 * 2. Se não houver usuário logado, mostra a tela de login.
 * 3. Caso contrário, monta o shell (sidebar + main + overlay), instala o
 *    roteador (history.pushState + popstate), expõe `window.navigatePage`
 *    para redirecionamentos programáticos e renderiza a página inicial.
 */
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

  /**
   * Navega para a página solicitada. Inclui:
   * - RBAC: professor é redirecionado para `calendario` se tentar acessar
   *   uma página exclusiva de admin.
   * - History API: atualiza a URL via `pushState` (sem reload).
   * - Renderização: limpa o container e invoca o renderer mapeado.
   * - Acessibilidade: aplica `data-label` nas tabelas para layout mobile.
   * @param {string} pageName
   */
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

  // Expõe a navegação para módulos que disparam redirecionamento programático
  // (reservations.js, novaReserva.js, calendar.js chamam window.navigatePage).
  window.navigatePage = navigate;

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
