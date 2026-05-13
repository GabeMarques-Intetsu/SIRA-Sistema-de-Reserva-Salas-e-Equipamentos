import { el, render, btn, toast, dateField } from '../utils/dom.js';
import { createModal, openModal, closeModal } from '../components/modal.js';
import {
  getRooms,
  saveRooms,
  getReservations,
  saveReservations,
  getApprovals,
  saveApprovals,
  genId,
  CURRENT_USER,
} from '../data/store.js';

/**
 * Renderiza o formulário de Nova Reserva no container fornecido pelo
 * roteador. Constrói os inputs (datas, horários, recorrência, tipo,
 * finalidade), os botões de dias da semana (visíveis apenas em modo
 * recorrente) e dispara `searchRooms` ao clicar em "Buscar Salas".
 * @param {HTMLElement} page
 */
export function renderNovaReserva(page) {
  const topbar = el(
    'div',
    { class: 'topbar' },
    el('span', { class: 'topbar-title' }, 'Nova Reserva'),
  );

  const dateStart = dateField();
  const dateEnd = dateField();

  const timeStart = el('input', { type: 'time', class: 'form-input' });
  const timeEnd = el('input', { type: 'time', class: 'form-input' });

  const recurSim = el('input', {
    type: 'radio',
    name: 'recurrence',
    value: 'sim',
  });
  const recurNao = el('input', {
    type: 'radio',
    name: 'recurrence',
    value: 'nao',
    checked: true,
  });

  const weekDaysContainer = el('div', {
    style: { display: 'none', gap: '8px', marginTop: '10px' },
  });
  const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const dayButtons = days.map((d) => {
    const b = el(
      'button',
      { class: 'btn btn-sm', style: { minWidth: '40px' } },
      d,
    );
    b.dataset.selected = 'false';
    b.addEventListener('click', (e) => {
      e.preventDefault();
      const isSel = b.dataset.selected === 'true';
      b.dataset.selected = isSel ? 'false' : 'true';
      b.style.backgroundColor = isSel ? '' : 'var(--accent)';
      b.style.color = isSel ? '' : '#fff';
    });
    return b;
  });
  dayButtons.forEach((b) => weekDaysContainer.appendChild(b));

  recurSim.addEventListener(
    'change',
    () => (weekDaysContainer.style.display = 'flex'),
  );
  recurNao.addEventListener(
    'change',
    () => (weekDaysContainer.style.display = 'none'),
  );

  const roomTypeSelect = el(
    'select',
    { class: 'form-input' },
    el('option', { value: '' }, 'Todos os tipos'),
    el('option', { value: 'Sala' }, 'Sala'),
    el('option', { value: 'Laboratório' }, 'Laboratório'),
    el('option', { value: 'Auditório' }, 'Auditório'),
  );

  const purposeInput = el('textarea', {
    class: 'form-input',
    rows: '2',
    placeholder: 'Ex: Aula Magna...',
  });

  const resultsContainer = el('div', {
    class: 'rooms-grid',
    style: { marginTop: '20px' },
  });

  const btnSearch = btn('Buscar Salas', 'btn-primary', (e) => {
    e.preventDefault();
    const isRecurring = recurSim.checked;
    const selectedDays = dayButtons
      .map((b, i) => (b.dataset.selected === 'true' ? i : -1))
      .filter((i) => i >= 0);

    searchRooms(roomTypeSelect.value, resultsContainer, {
      dateStart: dateStart.value,
      dateEnd: dateEnd.value,
      timeStart: timeStart.value,
      timeEnd: timeEnd.value,
      purpose: purposeInput.value,
      isRecurring,
      selectedDays,
    });
  });

  const formWrap = el(
    'div',
    {
      class: 'card',
      style: {
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        maxWidth: '800px',
        margin: '0 auto',
      },
    },
    el(
      'div',
      { class: 'form-row' },
      formField('Data Inicial', dateStart),
      formField('Data Final', dateEnd),
    ),
    el(
      'div',
      { class: 'form-row' },
      formField('Horário Inicial', timeStart),
      formField('Horário Final', timeEnd),
    ),
    formField(
      'Deseja recorrência?',
      el(
        'div',
        { style: { display: 'flex', gap: '16px' } },
        el(
          'label',
          { style: { display: 'flex', alignItems: 'center', gap: '4px' } },
          recurSim,
          'Sim',
        ),
        el(
          'label',
          { style: { display: 'flex', alignItems: 'center', gap: '4px' } },
          recurNao,
          'Não',
        ),
      ),
    ),
    weekDaysContainer,
    formField('Tipo de Espaço', roomTypeSelect),
    formField('Finalidade', purposeInput),
    el(
      'div',
      { style: { display: 'flex', justifyContent: 'flex-end' } },
      btnSearch,
    ),
  );

  const content = el('div', { class: 'content' }, formWrap, resultsContainer);
  render(page, topbar, content);
}

/**
 * Encapsula um par `<label>` + input com o estilo do formulário de Nova
 * Reserva (label menor, espaçamento padrão).
 * @param {string} label
 * @param {HTMLElement} input
 * @returns {HTMLElement}
 */
function formField(label, input) {
  return el(
    'div',
    { class: 'form-group', style: { flex: 1 } },
    el(
      'label',
      {
        class: 'form-label',
        style: {
          display: 'block',
          marginBottom: '8px',
          fontSize: '13px',
          fontWeight: '500',
          color: 'var(--text-secondary)',
        },
      },
      label,
    ),
    input,
  );
}

/**
 * Converte uma string de horário (`"14:00"`, `"14h"`, `"14h30"`) em
 * minutos desde meia-noite. Tolerante a variações de formato.
 * @param {string} tStr
 * @returns {number} minutos totais
 */
function parseTimeStr(tStr) {
  let clean = tStr.trim().toLowerCase();
  if (clean.includes('h')) {
    clean = clean.replace('h', ':');
    if (clean.endsWith(':')) clean += '00';
  }
  const [h, m] = clean.split(':');
  return parseInt(h || 0) * 60 + parseInt(m || 0);
}

/**
 * Converte o índice de dia da semana do JavaScript (0=Dom .. 6=Sáb) para o
 * índice usado pelos botões da UI de recorrência
 * (0=Seg, 1=Ter, 2=Qua, 3=Qui, 4=Sex, 5=Sáb, 6=Dom).
 * @param {number} jsDay
 * @returns {number}
 */
function jsDayToFormIdx(jsDay) {
  return jsDay === 0 ? 6 : jsDay - 1;
}

/**
 * Faz parse de uma string de data no formato brasileiro `dd/mm/aaaa` (ou
 * `dd/mm/aa`, sendo `aa` interpretado como `20aa`) para uma `Date` no fuso
 * local — evita o bug clássico em que `new Date(iso)` é interpretado como
 * UTC e exibe o dia anterior.
 * @param {string} str
 * @returns {Date|null}
 */
function parseDateLocal(str) {
  if (!str) return null;
  const trimmed = str.trim();
  if (!trimmed) return null;
  const [d, m, y] = trimmed.split('/').map(Number);
  if (!d || !m || !y) return null;
  const year = y < 100 ? 2000 + y : y;
  return new Date(year, m - 1, d);
}

/**
 * Formata uma `Date` no padrão brasileiro dd/mm/aaaa.
 * @param {Date} date
 * @returns {string}
 */
function formatDateDdMm(date) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Gera a lista de datas no formato "dd/mm/aaaa" que uma reserva irá ocupar.
 * - Não-recorrente: apenas `dateStart`.
 * - Recorrente: todas as datas entre `dateStart` e `dateEnd` cujo dia da
 *   semana esteja em `selectedDays`. Retorna `[]` se faltar dia selecionado
 *   ou se o range for inválido.
 * @param {{dateStart:string, dateEnd?:string, isRecurring?:boolean, selectedDays?:number[]}} formData
 * @returns {string[]}
 */
function expandReservationDates(formData) {
  const start = parseDateLocal(formData.dateStart);
  if (!start) return [];

  if (!formData.isRecurring) {
    return [formatDateDdMm(start)];
  }

  const end = parseDateLocal(formData.dateEnd) || start;
  if (end < start) return [];
  if (!formData.selectedDays || formData.selectedDays.length === 0) return [];

  const out = [];
  const cur = new Date(start);
  while (cur <= end) {
    if (formData.selectedDays.includes(jsDayToFormIdx(cur.getDay()))) {
      out.push(formatDateDdMm(cur));
    }
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/**
 * Busca salas disponíveis para os critérios informados pelo usuário e
 * renderiza cards no `container`. Filtra por tipo de sala e remove as que
 * tenham conflito de horário em qualquer data do range (para reservas
 * recorrentes). Mostra estado vazio quando nada é encontrado.
 * @param {string} type - tipo de espaço ('' = todos)
 * @param {HTMLElement} container - destino dos cards
 * @param {object} formData - {dateStart, dateEnd, timeStart, timeEnd, purpose, isRecurring, selectedDays}
 */
function searchRooms(type, container, formData) {
  render(container, '');
  let rooms = getRooms();
  if (type) {
    rooms = rooms.filter((r) => r.type === type);
  }

  if (formData.dateStart && formData.timeStart && formData.timeEnd) {
    const startMins = parseTimeStr(formData.timeStart);
    const endMins = parseTimeStr(formData.timeEnd);

    if (startMins >= endMins) {
      toast('O horário final deve ser maior que o inicial.', 'error');
      return;
    }

    const targetDates = expandReservationDates(formData);
    if (targetDates.length === 0) {
      if (formData.isRecurring) {
        toast(
          'Selecione ao menos um dia da semana e uma data final válida.',
          'error',
        );
      }
      return;
    }

    const allRes = getReservations();
    rooms = rooms.filter((room) => {
      // Para recorrência, basta UMA data sobrepor para considerar indisponível.
      return !targetDates.some((date) => {
        const roomRes = allRes.filter(
          (res) =>
            res.room === room.name &&
            res.date === date &&
            res.status !== 'rejected',
        );
        return roomRes.some((res) => {
          const tStr = (res.time || '').replace('–', '-');
          const [t1, t2] = tStr.split('-');
          const resStart = parseTimeStr(t1);
          const resEnd = parseTimeStr(t2);
          return startMins < resEnd && endMins > resStart;
        });
      });
    });
  }

  if (rooms.length === 0) {
    container.appendChild(
      el('div', {}, 'Nenhuma sala encontrada para este tipo.'),
    );
    return;
  }

  rooms.forEach((r) => {
    const card = el(
      'div',
      {
        class: 'room-card',
        style: {
          padding: '16px',
          border: '1px solid var(--border-light)',
          borderRadius: '8px',
          background: 'var(--bg-primary)',
          cursor: 'pointer',
        },
        onClick: () => showRoomDetailsModal(r, formData),
      },
      el(
        'div',
        { style: { fontSize: '15px', fontWeight: '600', marginBottom: '8px' } },
        r.name,
      ),
      el(
        'div',
        {
          style: {
            fontSize: '12px',
            color: 'var(--text-tertiary)',
            marginBottom: '12px',
          },
        },
        `Capacidade: ${r.capacity} · Bloco: ${r.block}`,
      ),
      btn('Reservar', 'btn-primary btn-sm', (e) => {
        e.stopPropagation();
        performReservation(r, formData);
      }),
    );
    container.appendChild(card);
  });
}

/**
 * Abre o modal de detalhes de uma sala selecionada nos resultados de busca.
 * Mostra capacidade, localização, recursos e um badge indicando se a sala
 * está disponível no horário solicitado.
 * @param {object} room
 * @param {object} formData
 */
function showRoomDetailsModal(room, formData) {
  const hasTime = formData.dateStart && formData.timeStart && formData.timeEnd;
  const statusBadgeInfo = hasTime
    ? {
        bg: '#E6F4EA',
        col: '#166534',
        text: 'Disponível no horário solicitado',
      }
    : {
        bg: '#E2E8F0',
        col: '#475569',
        text: 'Preencha o horário para confirmar disponibilidade',
      };

  const statusBadge = el(
    'span',
    {
      style: {
        display: 'inline-block',
        background: statusBadgeInfo.bg,
        color: statusBadgeInfo.col,
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: 'bold',
      },
    },
    statusBadgeInfo.text,
  );

  const body = el(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '8px 0',
      },
    },
    statusBadge,
    el(
      'div',
      { style: { fontSize: '14px' } },
      el('strong', {}, 'Tipo: '),
      room.type,
    ),
    el(
      'div',
      { style: { fontSize: '14px' } },
      el('strong', {}, 'Capacidade: '),
      `${room.capacity} pessoas`,
    ),
    el(
      'div',
      { style: { fontSize: '14px' } },
      el('strong', {}, 'Localização: '),
      room.block,
    ),
    el(
      'div',
      { style: { fontSize: '14px' } },
      el('strong', {}, 'Recursos: '),
      room.resources ? room.resources.join(', ') : 'Nenhum',
    ),
  );

  createModal({
    id: 'modal-room-details',
    title: `Detalhes: ${room.name}`,
    body,
    actions: [
      { label: 'Fechar', onClick: () => closeModal('modal-room-details') },
      {
        label: 'Reservar',
        primary: true,
        onClick: () => {
          closeModal('modal-room-details');
          performReservation(room, formData);
        },
      },
    ],
  });

  openModal('modal-room-details');
}

/**
 * Efetiva a(s) reserva(s) selecionada(s).
 * - Valida campos obrigatórios e horário inicial < final.
 * - Expande as datas (1 para pontual, N para recorrente).
 * - Re-checa overlap em todas as datas antes de salvar.
 * - Cria 1 reserva (pendente) + 1 aprovação por ocorrência. Em modo
 *   recorrente, todas compartilham o mesmo `recurrenceGroupId`.
 * - Exibe toast e navega para "Minhas Reservas" via `window.navigatePage`.
 * @param {object} room
 * @param {object} formData
 */
function performReservation(room, formData) {
  if (
    !formData.dateStart ||
    !formData.timeStart ||
    !formData.timeEnd ||
    !formData.purpose
  ) {
    toast('Preencha data, horários e finalidade antes de reservar.', 'error');
    return;
  }

  const startMins = parseTimeStr(formData.timeStart);
  const endMins = parseTimeStr(formData.timeEnd);

  if (startMins >= endMins) {
    toast('O horário final deve ser maior que o inicial.', 'error');
    return;
  }

  const targetDates = expandReservationDates(formData);
  if (targetDates.length === 0) {
    toast(
      formData.isRecurring
        ? 'Selecione ao menos um dia da semana e uma data final válida.'
        : 'Data inválida.',
      'error',
    );
    return;
  }

  // Re-checa overlap em TODAS as datas antes de salvar (T-15.2)
  const allRes = getReservations();
  const conflict = targetDates.find((date) => {
    const roomRes = allRes.filter(
      (res) =>
        res.room === room.name &&
        res.date === date &&
        res.status !== 'rejected',
    );
    return roomRes.some((res) => {
      const tStr = (res.time || '').replace('–', '-');
      const [t1, t2] = tStr.split('-');
      const resStart = parseTimeStr(t1);
      const resEnd = parseTimeStr(t2);
      return startMins < resEnd && endMins > resStart;
    });
  });

  if (conflict) {
    toast(
      `Conflito em ${conflict}. A sala já está reservada nesse horário.`,
      'error',
    );
    return;
  }

  const formattedTime = `${formData.timeStart}–${formData.timeEnd}`;
  const recurrenceGroupId = formData.isRecurring ? genId('rec') : null;

  // Constrói lote de reservas e aprovações (1 por data ocupada)
  const newReservations = targetDates.map((date) => {
    const id = genId('res');
    return {
      id,
      room: room.name,
      date,
      time: formattedTime,
      purpose: formData.purpose,
      requester: CURRENT_USER.name,
      requesterEmail: CURRENT_USER.email,
      status: 'pending',
      read: true,
      ...(recurrenceGroupId ? { recurrenceGroupId } : {}),
    };
  });

  const newApprovals = newReservations.map((r) => ({
    id: 'ap_' + r.id,
    reservationId: r.id,
    room: r.room,
    date: r.date,
    time: r.time,
    purpose: r.purpose,
    requester: r.requester,
    requesterEmail: r.requesterEmail,
    level: '1º nível',
    read: false,
    ...(recurrenceGroupId ? { recurrenceGroupId } : {}),
  }));

  saveReservations([...getReservations(), ...newReservations]);
  saveApprovals([...getApprovals(), ...newApprovals]);

  // Toast e redirecionamento (T-15.3)
  toast(
    formData.isRecurring
      ? `Sucesso! ${newReservations.length} reservas recorrentes enviadas para aprovação.`
      : 'Sucesso! Sua reserva foi enviada para aprovação.',
    'success',
  );
  if (window.updateSidebarBadges) window.updateSidebarBadges();
  if (typeof window.navigatePage === 'function') {
    window.navigatePage('reservas');
  }
}
