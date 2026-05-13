import { el } from '../utils/dom.js';
import { initials } from '../utils/fp.js';

// Importando os dados da store para os badges dinâmicos
import {
  getReservations,
  getApprovals,
  getNotifications,
  CURRENT_USER,
} from '../data/store.js';

// Identifica reservas pertencentes ao usuário logado. Compara por e-mail
// (identidade estável) e cai no nome para suportar registros legados.
function isMine(r) {
  if (!CURRENT_USER) return false;
  if (r.requesterEmail) return r.requesterEmail === CURRENT_USER.email;
  return r.requester === CURRENT_USER.name;
}

// Array declarativo: centraliza as páginas.
const NAV_ITEMS = [
  {
    page: 'dashboard',
    label: 'Dashboard',
    icon: svgDashboard,
    section: 'VISÃO GERAL',
  },
  { page: 'calendario', label: 'Calendário', icon: svgCalendar, section: null },
  {
    page: 'novaReserva',
    label: 'Nova Reserva',
    icon: () => makeSvg('<path d="M8 2v12M2 8h12"/>'),
    section: null,
  },
  {
    page: 'reservas',
    label: 'Minhas Reservas',
    icon: svgReserv,
    section: 'RESERVAS',
    badge: () => getReservations().filter((r) => isMine(r) && !r.read).length,
  },
  {
    page: 'aprovacoes',
    label: 'Aprovações',
    icon: svgApproval,
    section: null,
    badge: () => getApprovals().filter((a) => !a.read).length,
  },
  {
    page: 'salas',
    label: 'Salas e Espaços',
    icon: svgRoom,
    section: 'ADMINISTRAÇÃO',
  },
  { page: 'usuarios', label: 'Usuários', icon: svgUser, section: null },
  {
    page: 'notificacoes',
    label: 'Notificações',
    icon: svgBell,
    section: null,
    badge: () => getNotifications().filter((n) => !n.read).length,
    roles: ['admin'],
  },
];

/**
 * Monta a sidebar de navegação no container fornecido.
 * - Aplica RBAC: professor só vê reservas/calendário/nova reserva.
 * - Cada item dispara `onNavigate(page)` ao ser clicado.
 * - Renderiza badges dinâmicos (notificações não lidas, reservas pendentes).
 * - Expõe `window.updateSidebarBadges()` para módulos atualizarem os badges
 *   sem precisar recriar a sidebar.
 * @param {HTMLElement} container
 * @param {{name:string, role:string, email:string}} currentUser
 * @param {(page:string) => void} onNavigate
 * @param {() => void} onToggleDark
 */
export function createSidebar(
  container,
  currentUser,
  onNavigate,
  onToggleDark,
) {
  const sidebar = el('aside', { class: 'sidebar' });

  // ── Montagem do Logo ──
  sidebar.appendChild(
    el(
      'div',
      { class: 'sidebar-logo' },
      el('div', { class: 'logo-mark' }, 'SIRA'),
      el('div', { class: 'logo-sub' }, 'Sistema de Reserva de Salas'),
    ),
  );

  // ── Controle de Acesso (RBAC) ──
  const isAdmin = currentUser.role === 'admin';
  const userItems = NAV_ITEMS.filter((item) => {
    if (isAdmin) return true;
    return ['reservas', 'calendario', 'novaReserva'].includes(item.page);
  });

  // ── Renderização dos Botões ──
  let currentSection = null;

  userItems.forEach((item) => {
    if (item.section !== currentSection) {
      currentSection = item.section;
      if (item.section) {
        sidebar.appendChild(
          el('div', { class: 'sidebar-section' }, item.section),
        );
      }
    }

    const navItem = el(
      'button',
      {
        class: `nav-item${item.page === 'dashboard' ? ' active' : ''}`,
        'data-page': item.page,
        onClick: (e) => {
          document
            .querySelectorAll('.nav-item')
            .forEach((n) => n.classList.remove('active'));
          e.currentTarget.classList.add('active');
          onNavigate(item.page);
        },
      },
      item.icon(),
      item.label,
    );

    if (item.badge) {
      const badgeVal =
        typeof item.badge === 'function' ? item.badge() : item.badge;
      const displayVal = badgeVal > 0 ? badgeVal : '';
      const badgeEl = el(
        'span',
        { class: 'notif-badge', id: `badge-${item.page}` },
        displayVal,
      );
      if (!displayVal) badgeEl.style.display = 'none';
      navItem.appendChild(badgeEl);
    }

    sidebar.appendChild(navItem);
  });

  // ── Rodapé fixo ──
  const bottom = el('div', { class: 'sidebar-bottom' });

  const toggleBtn = el('div', { class: 'dark-toggle', onClick: onToggleDark });
  const toggleRow = el(
    'div',
    {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px 8px',
      },
    },
    el(
      'span',
      { style: { fontSize: '11px', color: 'var(--text-tertiary)' } },
      'Modo escuro',
    ),
    toggleBtn,
  );

  const userPill = el(
    'div',
    { class: 'user-pill' },
    el('div', { class: 'avatar' }, initials(currentUser.name)),
    el(
      'div',
      { style: { flex: 1 } },
      el('div', { class: 'user-name' }, currentUser.name),
      el('div', { class: 'user-role' }, currentUser.role),
    ),
    el(
      'button',
      {
        style: {
          background: 'transparent',
          border: '1px solid var(--border-color)',
          padding: '2px 6px',
          fontSize: '10px',
          borderRadius: '4px',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
        },
        onClick: () => {
          import('../data/store.js').then((m) => {
            m.logout();
            location.reload();
          });
        },
      },
      'Sair',
    ),
  );

  bottom.appendChild(toggleRow);
  bottom.appendChild(userPill);
  sidebar.appendChild(bottom);

  container.appendChild(sidebar);

  // [Apresentação] Expondo API global para que outros módulos (como o de Reservas)
  // possam disparar a atualização dos badges sem precisar recriar a sidebar.
  window.updateSidebarBadges = () => {
    NAV_ITEMS.forEach((item) => {
      if (item.badge) {
        const badgeEl = document.getElementById(`badge-${item.page}`);
        if (badgeEl) {
          const badgeVal =
            typeof item.badge === 'function' ? item.badge() : item.badge;
          if (badgeVal > 0) {
            badgeEl.textContent = badgeVal;
            badgeEl.style.display = '';
          } else {
            badgeEl.style.display = 'none';
          }
        }
      }
    });
  };
}

// ── Factory de SVGs ────────────────────────────────────────
/** Ícone SVG do Dashboard (4 quadrados). */
function svgDashboard() {
  return makeSvg(
    '<rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/>',
  );
}
/** Ícone SVG do Calendário (folha com dias). */
function svgCalendar() {
  return makeSvg(
    '<rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M5 2v2M11 2v2M2 7h12"/>',
  );
}
/** Ícone SVG de Reservas (lista). */
function svgReserv() {
  return makeSvg(
    '<path d="M4 4h8M4 8h8M4 12h5"/><rect x="1" y="1" width="14" height="14" rx="2"/>',
  );
}
/** Ícone SVG de Aprovações (check em círculo). */
function svgApproval() {
  return makeSvg('<path d="M4 8l3 3 5-5"/><circle cx="8" cy="8" r="7"/>');
}
/** Ícone SVG de Salas (porta). */
function svgRoom() {
  return makeSvg(
    '<rect x="2" y="5" width="12" height="8" rx="1"/><path d="M5 5V4a1 1 0 011-1h4a1 1 0 011 1v1M8 9v2"/>',
  );
}
/** Ícone SVG de Usuário (silhueta). */
function svgUser() {
  return makeSvg(
    '<circle cx="8" cy="5" r="3"/><path d="M2 14c0-3 2.7-5 6-5s6 2 6 5"/>',
  );
}
/** Ícone SVG de Integração (não usado atualmente). */
function svgIntegration() {
  return makeSvg(
    '<circle cx="4" cy="8" r="2"/><circle cx="12" cy="8" r="2"/><path d="M6 8h4"/><circle cx="8" cy="3" r="2"/><path d="M8 5v1M8 10v1"/>',
  );
}
/** Ícone SVG de Notificações (sino). */
function svgBell() {
  return makeSvg(
    '<path d="M8 2a5 5 0 00-5 5v3l-1 2h12l-1-2V7a5 5 0 00-5-5zM6.5 13a1.5 1.5 0 003 0"/>',
  );
}

/**
 * Helper para construir um elemento SVG com viewBox e stroke padronizados.
 * Usado pelos factories acima.
 * @param {string} inner - markup interno do SVG (paths, rects, etc.)
 * @returns {SVGElement}
 */
function makeSvg(inner) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5');
  svg.setAttribute('class', 'nav-icon');
  svg.innerHTML = inner;
  return svg;
}
