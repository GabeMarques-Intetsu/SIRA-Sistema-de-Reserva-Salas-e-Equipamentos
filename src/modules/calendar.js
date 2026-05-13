// src/modules/calendar.js
// ─────────────────────────────────────────────────────────────
// Módulo: Home — Painel de Reservas estilo calendário
// Layout baseado no wireframe: header com ações rápidas +
// info do usuário + calendário semanal como painel principal
// ─────────────────────────────────────────────────────────────

import { el, render, btn, dateField } from '../utils/dom.js';
import {
  getReservations,
  getRooms,
  saveReservations,
  genId,
  CURRENT_USER,
} from '../data/store.js';
import { openModal, closeModal, createModal } from '../components/modal.js';

/**
 * Identifica se uma reserva pertence ao usuário logado.
 * Compara por `requesterEmail` (identidade estável) e cai para o `requester`
 * (nome) nos registros legados que não tinham e-mail.
 * @param {{requesterEmail?:string, requester?:string}} r
 * @returns {boolean}
 */
function isMine(r) {
  if (!CURRENT_USER) return false;
  if (r.requesterEmail) return r.requesterEmail === CURRENT_USER.email;
  return r.requester === CURRENT_USER.name;
}

const DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const HOURS = [
  '07:00',
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
];

/**
 * Calcula a lista de 7 datas (Seg → Dom) da semana atual deslocada por
 * `offset` (em semanas). `offset = 0` retorna a semana corrente, `-1` a
 * anterior, `+1` a próxima.
 * @param {number} [offset=0]
 * @returns {Date[]}
 */
function getWeekDates(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return d;
  });
}

/**
 * Converte uma lista de reservas em eventos posicionados no grid (dia × hora)
 * da semana exibida. Reservas que cobrem múltiplas horas geram um evento por
 * bloco contíguo. Aceita datas no formato dd/mm/aaaa (com matching de ano)
 * e dd/mm legado.
 * @param {Array<object>} reservations
 * @param {Date[]} weekDates - resultado de `getWeekDates`
 * @returns {Array<{day:number, hour:number, label:string, sub:string, color:string, id:string}>}
 */
function reservationsToEvents(reservations, weekDates) {
  const COLOR_MAP = { approved: 'green', pending: 'amber', rejected: 'pink' };
  return reservations.flatMap((r) => {
    // Aceita dd/mm/aaaa (formato atual) e dd/mm legado (sem ano).
    const [dd, mm, yyyy] = (r.date ?? '').split('/').map(Number);
    const dayIdx = weekDates.findIndex(
      (d) =>
        d.getDate() === dd &&
        d.getMonth() + 1 === mm &&
        (yyyy ? d.getFullYear() === yyyy : true),
    );
    if (dayIdx === -1) return [];
    const match = (r.time ?? '').match(/(\d{1,2})[h:]/);
    if (!match) return [];
    const startHour = parseInt(match[1]);
    const hourIdx = HOURS.findIndex((h) => parseInt(h) === startHour);
    if (hourIdx === -1) return [];

    // LINHA CORRIGIDA AQUI ABAIXO:
    const endMatch = (r.time ?? '').match(/[-–](\d{1,2})[h:]/);

    const endHour = endMatch ? parseInt(endMatch[1]) : startHour + 1;
    const blocks = Math.max(1, endHour - startHour);
    return Array.from({ length: blocks }, (_, b) => ({
      day: dayIdx + 1,
      hour: hourIdx + b,
      label: r.room,
      sub: r.purpose,
      color: COLOR_MAP[r.status] ?? 'blue',
      id: r.id,
    }));
  });
}

let weekOffset = 0;

/**
 * Renderiza o módulo Calendário (página inicial pós-login) no container
 * fornecido pelo roteador. Apenas delega para `rebuildCalendar`.
 * @param {HTMLElement} page
 */
export function renderCalendar(page) {
  rebuildCalendar(page);
}

/**
 * Constrói o fragmento DOM da página do calendário (topbar, navegação de
 * semana, sidebar "Suas reservas" e o grid semanal de eventos). Não toca o
 * DOM diretamente — retorna o fragmento para `rebuildCalendar` montar.
 * @param {HTMLElement} page - usado pelos handlers para forçar rerender
 * @returns {DocumentFragment}
 */
function buildFragment(page) {
  const weekDates = getWeekDates(weekOffset);
  const reservations = getReservations();
  const events = reservationsToEvents(reservations, weekDates);
  const monthYear = weekDates[0].toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });

  // ── TOPBAR ──
  const topbar = el(
    'div',
    { class: 'topbar home-topbar' },
    el('span', { class: 'topbar-title home-brand' }, 'SIRA — IFPB'),
    el(
      'div',
      { class: 'home-actions' },
      btn('+ Nova Reserva', 'btn-primary', () => {
        window.navigatePage('novaReserva');
      }),
      btn('✕ Cancelar reserva', 'btn home-btn-cancel', () =>
        openCancelModal(page),
      ),
    ),
  );

  // ── USER STRIP ──
  const userStrip = el(
    'div',
    { class: 'home-week-nav' },
    btn('‹', 'btn btn-icon btn-sm', () => {
      weekOffset--;
      rebuildCalendar(page);
    }),
    el(
      'span',
      { class: 'home-month-label' },
      monthYear.charAt(0).toUpperCase() + monthYear.slice(1),
    ),
    btn('›', 'btn btn-icon btn-sm', () => {
      weekOffset++;
      rebuildCalendar(page);
    }),
    btn('Hoje', 'btn btn-sm', () => {
      weekOffset = 0;
      rebuildCalendar(page);
    }),
  );

  // ── SUAS RESERVAS (sidebar) ──
  const myRes = reservations.filter(isMine).slice(0, 6);
  const DOT = {
    approved: 'res-dot-green',
    pending: 'res-dot-amber',
    rejected: 'res-dot-red',
  };

  const resItems = myRes.length
    ? myRes.map((r) =>
        el(
          'div',
          { class: 'home-res-item' },
          el('span', { class: `res-dot ${DOT[r.status] ?? ''}` }),
          el(
            'div',
            { class: 'home-res-text' },
            el('span', { class: 'home-res-room' }, r.room),
            el('span', { class: 'home-res-meta' }, `${r.date} · ${r.time}`),
          ),
        ),
      )
    : [el('div', { class: 'home-res-empty' }, 'Sem reservas.')];

  const sidebar = el(
    'div',
    { class: 'home-sidebar' },
    el('div', { class: 'home-sidebar-title' }, 'Suas reservas'),
    el('div', { class: 'home-res-list' }, ...resItems),
  );

  // ── CALENDÁRIO ──
  const daysHeader = el(
    'div',
    { class: 'cal-days-header' },
    el('div', { class: 'cal-day-label' }),
    ...weekDates.map((d, i) => {
      const today = d.toDateString() === new Date().toDateString();
      return el(
        'div',
        { class: `cal-day-label${today ? ' cal-today' : ''}` },
        el('span', { class: 'cal-day-name' }, DAYS[i]),
        el(
          'span',
          { class: `cal-day-num${today ? ' cal-today-num' : ''}` },
          d.getDate(),
        ),
      );
    }),
  );

  const timeCol = el(
    'div',
    { class: 'time-col' },
    ...HOURS.map((h) => el('div', { class: 'time-slot' }, h)),
  );

  const dayCols = DAYS.map((_, dayIdx) =>
    el(
      'div',
      { class: 'day-col' },
      ...HOURS.map((_, hourIdx) => {
        const ev = events.find(
          (e) => e.day === dayIdx + 1 && e.hour === hourIdx,
        );
        const cell = el('div', { class: 'cal-cell' });
        if (ev) {
          const isContinuation = events.some(
            (e) => e.id === ev.id && e.hour === hourIdx - 1,
          );

          cell.appendChild(
            el(
              'div',
              {
                class: `event event-${ev.color}`,
                style: isContinuation
                  ? { borderTop: 'none', paddingTop: '0' }
                  : {},
              },
              ...(!isContinuation
                ? [
                    el('span', { class: 'event-label' }, ev.label),
                    ...(ev.sub
                      ? [el('span', { class: 'event-sub' }, ev.sub)]
                      : []),
                  ]
                : []),
            ),
          );
        }
        return cell;
      }),
    ),
  );

  const calGrid = el(
    'div',
    { class: 'cal-grid' },
    daysHeader,
    el('div', { class: 'cal-body' }, timeCol, ...dayCols),
  );

  // ── MOUNT ──
  const body = el(
    'div',
    { class: 'home-body' },
    el(
      'div',
      { class: 'home-left' },
      userStrip,
      el('div', { class: 'home-cal-panel' }, calGrid),
    ),
    sidebar,
  );

  const frag = document.createDocumentFragment();
  frag.appendChild(topbar);
  frag.appendChild(el('div', { class: 'content home-content' }, body));
  return frag;
}

/**
 * Limpa o container e remonta a árvore do calendário a partir do estado
 * atual de `weekOffset` e das reservas no store.
 * @param {HTMLElement} page
 */
function rebuildCalendar(page) {
  render(page, buildFragment(page));
}

// ── Modal: Reserva rápida ─────────────────────────────────────

/**
 * Abre um modal de reserva rápida (atalho da home, atualmente não exposto
 * na UI). Quando `recorrente` é true, adiciona um seletor de periodicidade
 * (Semanal/Quinzenal/Mensal). Ao confirmar, valida campos, grava no store
 * via `saveReservations` e rerendeniza o calendário.
 * @param {boolean} recorrente
 * @param {HTMLElement} page
 */
function openQuickModal(recorrente, page) {
  const rooms = getRooms();

  const roomSelect = el(
    'select',
    { class: 'form-input' },
    ...rooms.map((r) => {
      const o = document.createElement('option');
      o.value = r.id;
      o.textContent = r.name;
      return o;
    }),
  );
  // Seletor de data em formato brasileiro dd/mm/aaaa, com máscara automática
  // e botão de calendário que abre o picker nativo do navegador.
  const dateInput = dateField();
  const timeSelect = el(
    'select',
    { class: 'form-input' },
    ...[
      '07:00–08:00',
      '08:00–10:00',
      '10:00–12:00',
      '14:00–16:00',
      '16:00–18:00',
    ].map((t) => {
      const o = document.createElement('option');
      o.textContent = t;
      return o;
    }),
  );
  const purposeInput = el('textarea', {
    class: 'form-input',
    rows: '2',
    style: 'resize:none',
  });
  const recurSelect = recorrente
    ? el(
        'select',
        { class: 'form-input' },
        ...['Semanal', 'Quinzenal', 'Mensal'].map((t) => {
          const o = document.createElement('option');
          o.textContent = t;
          return o;
        }),
      )
    : null;

  createModal({
    id: 'modal-quick',
    title: recorrente ? 'Reserva Recorrente' : 'Reserva Pontual',
    body: el(
      'div',
      {},
      formField('Sala', roomSelect),
      el(
        'div',
        { class: 'form-row' },
        formField('Data', dateInput),
        formField('Horário', timeSelect),
      ),
      formField('Finalidade', purposeInput),
      ...(recorrente ? [formField('Recorrência', recurSelect)] : []),
    ),
    actions: [
      { label: 'Cancelar', onClick: () => closeModal('modal-quick') },
      {
        label: 'Enviar solicitação',
        primary: true,
        onClick: () => {
          const room = rooms.find((r) => r.id === roomSelect.value);
          const purpose = purposeInput.value.trim();
          const date = dateInput.value.trim();
          if (!date || !purpose) {
            toastMsg('Preencha data e finalidade.', 'error');
            return;
          }
          // Valida formato dd/mm/aaaa antes de salvar.
          if (!/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
            toastMsg('Data inválida. Use dd/mm/aaaa.', 'error');
            return;
          }
          saveReservations([
            ...getReservations(),
            {
              id: genId('res'),
              room: room.name,
              date,
              time: timeSelect.value,
              purpose,
              requester: CURRENT_USER?.name ?? '',
              requesterEmail: CURRENT_USER?.email ?? '',
              status: 'pending',
            },
          ]);
          closeModal('modal-quick');
          toastMsg('Solicitação enviada!', 'success');
          if (window.updateSidebarBadges) window.updateSidebarBadges();
          rebuildCalendar(page);
        },
      },
    ],
  });
  openModal('modal-quick');
}

// ── Modal: Cancelar ───────────────────────────────────────────

/**
 * Abre um modal listando as reservas ativas (não rejeitadas) do usuário
 * logado para que ele escolha uma para cancelar. Após confirmar, remove a
 * reserva do store e rerendeniza o calendário.
 * @param {HTMLElement} page
 */
function openCancelModal(page) {
  const mine = getReservations().filter(
    (r) => isMine(r) && r.status !== 'rejected',
  );
  if (!mine.length) {
    toastMsg('Sem reservas ativas para cancelar.', 'error');
    return;
  }

  const select = el(
    'select',
    { class: 'form-input' },
    ...mine.map((r) => {
      const o = document.createElement('option');
      o.value = r.id;
      o.textContent = `${r.room} · ${r.date} · ${r.time}`;
      return o;
    }),
  );

  createModal({
    id: 'modal-cancel',
    title: 'Cancelar Reserva',
    body: formField('Selecione a reserva', select),
    actions: [
      { label: 'Voltar', onClick: () => closeModal('modal-cancel') },
      {
        label: 'Confirmar cancelamento',
        primary: false,
        onClick: () => {
          saveReservations(
            getReservations().filter((r) => r.id !== select.value),
          );
          closeModal('modal-cancel');
          toastMsg('Reserva cancelada.', 'success');
          if (window.updateSidebarBadges) window.updateSidebarBadges();
          rebuildCalendar(page);
        },
      },
    ],
  });
  openModal('modal-cancel');
}

// ── Helpers ───────────────────────────────────────────────────

/**
 * Encapsula um par `<label>` + input no padrão visual usado pelos modais.
 * @param {string} label
 * @param {HTMLElement} input
 * @returns {HTMLElement}
 */
function formField(label, input) {
  return el(
    'div',
    { class: 'form-field' },
    el('label', { class: 'form-label' }, label),
    input,
  );
}

/**
 * Versão local de toast (replica `utils/dom.toast`) usada pelos modais do
 * calendário. Cria o container `.toast-container` no body se necessário e
 * remove a notificação após 3 segundos.
 * @param {string} msg
 * @param {'success'|'error'|''} type
 */
function toastMsg(msg, type) {
  let c = document.querySelector('.toast-container');
  if (!c) {
    c = document.createElement('div');
    c.className = 'toast-container';
    document.body.appendChild(c);
  }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}
