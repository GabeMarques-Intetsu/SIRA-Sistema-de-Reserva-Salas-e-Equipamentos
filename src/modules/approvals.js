// src/modules/approvals.js
// ─────────────────────────────────────────────────────────────
// Módulo: Aprovações — fila de solicitações pendentes (Admin)
// US-19 (fila consolidada) + US-20 (aprovar/recusar em 1 clique)
// ─────────────────────────────────────────────────────────────

import { el, render, btn, toast } from '../utils/dom.js';
import {
  getApprovals,
  saveApprovals,
  getReservations,
  saveReservations,
  resolveApproval as resolveApprovalInStore,
  CURRENT_USER,
} from '../data/store.js';

/**
 * Renderiza a tela de aprovações pendentes no container recebido.
 * @param {HTMLElement} page  container alvo (vem do roteador em main.js)
 */
export function renderApprovals(page) {
  const topbar = el(
    'div',
    { class: 'topbar' },
    el('span', { class: 'topbar-title' }, 'Aprovações Pendentes'),
  );

  const list = el('div', {
    style: { display: 'flex', flexDirection: 'column', gap: '10px' },
  });

  // Limpa o badge ao entrar (marca aprovações como lidas).
  let updated = false;
  const approvals = getApprovals().map((a) => {
    if (!a.read) {
      updated = true;
      return { ...a, read: true };
    }
    return a;
  });
  if (updated) {
    saveApprovals(approvals);
    if (window.updateSidebarBadges) window.updateSidebarBadges();
  }

  refreshList(list);

  render(page, topbar, el('div', { class: 'content' }, list));
}

function refreshList(list) {
  const approvals = getApprovals();
  render(
    list,
    ...(approvals.length
      ? approvals.map((a) => buildApprovalCard(a, list))
      : [
          el(
            'div',
            { class: 'empty-state' },
            el('span', {}, '✓ Nenhuma aprovação pendente.'),
          ),
        ]),
  );
}

function buildApprovalCard(a, list) {
  return el(
    'div',
    { class: 'approval-card' },
    el(
      'div',
      {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
      },
      el(
        'span',
        { style: { fontSize: '14px', fontWeight: '500' } },
        `${a.room ?? 'Sala'} — ${a.purpose ?? ''}`,
      ),
      el('span', { class: 'badge badge-pending' }, a.level ?? '1º nível'),
    ),
    el(
      'div',
      { class: 'approval-meta' },
      `Solicitante: ${a.requester ?? a.requesterEmail ?? '-'}\n` +
        `Data: ${a.date ?? '-'} · ${a.time ?? '-'}`,
    ),
    el(
      'div',
      { class: 'approval-actions' },
      btn('✓ Aprovar', 'btn-sm btn-success', () =>
        resolveDecision(a, 'approved', list),
      ),
      btn('✕ Recusar', 'btn-sm btn-danger', () =>
        resolveDecision(a, 'rejected', list),
      ),
    ),
  );
}

// Resolve a decisão propagando para reserva + notificação do solicitante.
// Quando o objeto traz e-mail do dono, usa resolveApproval do store (que
// faz o cross-user). Caso contrário, fallback com filter/map imutáveis.
function resolveDecision(a, decision, list) {
  const isAdmin = CURRENT_USER?.role === 'admin';

  if (isAdmin && (a.requesterEmail || a.userEmail)) {
    resolveApprovalInStore({
      ...a,
      status: decision,
      userEmail: a.userEmail || a.requesterEmail,
    });
  } else {
    // Fallback para seeds antigos sem e-mail do solicitante
    saveApprovals(getApprovals().filter((ap) => ap.id !== a.id));
    const updated = getReservations().map((r) =>
      r.room === a.room && r.date === a.date ? { ...r, status: decision } : r,
    );
    saveReservations(updated);
  }

  refreshList(list);
  if (window.updateSidebarBadges) window.updateSidebarBadges();
  toast(
    decision === 'approved' ? 'Reserva aprovada!' : 'Reserva recusada.',
    decision === 'approved' ? 'success' : 'error',
  );
}
