// src/modules/rooms.js
// ─────────────────────────────────────────────────────────────
// Módulo: Salas e Espaços — CRUD de salas
// Demonstra: filter, map, DOM dinâmico, LocalStorage
// ─────────────────────────────────────────────────────────────

import { el, render, btn, toast, confirm } from '../utils/dom.js';
import {
  filterByText,
  filterRoomsByStatus,
  roomStatusInfo,
} from '../utils/fp.js';
import { getRooms, saveRooms, genId } from '../data/store.js';
import { openModal, closeModal, createModal } from '../components/modal.js';

let searchQuery = '';
let activeFilter = 'all';

/**
 * Renderiza a página de salas.
 * @param {HTMLElement} page
 */
export function renderRooms(page) {
  const searchInput = el('input', {
    type: 'text',
    placeholder: 'Buscar sala...',
  });
  // Tratamento de evento
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    refreshGrid(grid);
  });

  const topbar = el(
    'div',
    { class: 'topbar' },
    el('span', { class: 'topbar-title' }, 'Salas e Espaços'),
    el('div', { class: 'search-box' }, searchIcon(), searchInput),
    btn('Exportar lista', '', () =>
      toast('Exportação em desenvolvimento.', ''),
    ),
    btn('+ Cadastrar Sala', 'btn-primary', () => openRoomModal(null, grid)),
  );

  // Filtros via Array.map()
  const FILTERS = [
    { key: 'all', label: 'Todas' },
    { key: 'free', label: 'Disponíveis' },
    { key: 'busy', label: 'Ocupadas' },
    { key: 'maintenance', label: 'Em manutenção' },
  ];

  const chips = FILTERS.map((f) => {
    const chip = el(
      'div',
      { class: `filter-chip${f.key === 'all' ? ' active' : ''}` },
      f.label,
    );
    chip.addEventListener('click', () => {
      document
        .querySelectorAll('#filter-rooms .filter-chip')
        .forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilter = f.key;
      refreshGrid(grid);
    });
    return chip;
  });

  const filterRow = el(
    'div',
    { class: 'filter-row', id: 'filter-rooms' },
    ...chips,
  );

  const grid = el('div', { class: 'rooms-grid' });
  refreshGrid(grid);

  const content = el('div', { class: 'content' }, filterRow, grid);
  render(page, topbar, content);
}

// ── Atualiza o grid de salas ──────────────────────────────────

function refreshGrid(grid) {
  const all = getRooms();

  // Encadeamento funcional: filter + filter via helper
  const filtered = filterRoomsByStatus(
    filterByText(all, searchQuery, ['name', 'block']),
    activeFilter,
  );

  // Card "adicionar" sempre no final
  const addCard = el(
    'div',
    { class: 'room-card dashed', onClick: () => openRoomModal(null, grid) },
    el(
      'span',
      { style: { fontSize: '22px', color: 'var(--text-tertiary)' } },
      '+',
    ),
    el(
      'span',
      { style: { fontSize: '13px', color: 'var(--text-tertiary)' } },
      'Adicionar sala',
    ),
  );

  // Array.map para criar cards
  const cards = filtered.map((r) => buildRoomCard(r, grid));

  render(grid, ...cards, addCard);
}

// ── Constrói um card de sala ──────────────────────────────────

function buildRoomCard(r, grid) {
  const info = roomStatusInfo(r.status);

  const card = el(
    'div',
    {
      class: 'room-card',
      style: { cursor: 'pointer' },
      onClick: () => showRoomDetailsOverlay(r),
    },
    el(
      'div',
      {},
      el('span', { class: `status-dot ${info.dotClass}` }),
      el(
        'span',
        { style: { fontSize: '11px', color: info.labelColor } },
        info.label,
      ),
    ),
    el('div', { class: 'room-name' }, r.name),
    el(
      'div',
      { class: 'room-meta' },
      `${r.type} · Cap. ${r.capacity} · ${r.block}`,
    ),
    // Array.join para listar recursos
    el(
      'div',
      { class: 'room-meta', style: { marginTop: '4px' } },
      r.resources.join(' · '),
    ),
    el(
      'div',
      { class: 'room-actions' },
      btn('Editar', 'btn-sm', (e) => {
        e.stopPropagation();
        openRoomModal(r, grid);
      }),
      btn('Excluir', 'btn-sm btn-danger', (e) => {
        e.stopPropagation();
        deleteRoom(r.id, grid);
      }),
    ),
  );

  return card;
}

function showRoomDetailsOverlay(room) {
  const info = roomStatusInfo(room.status);
  const statusBadge = el(
    'span',
    {
      style: {
        display: 'inline-block',
        background:
          info.labelColor.endsWith('A44') || room.status === 'free'
            ? '#E6F4EA'
            : '#FEE2E2', // rough heuristic, could be improved
        color: info.labelColor,
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: 'bold',
      },
    },
    info.label,
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
      el('strong', {}, 'Nome do espaço: '),
      room.name,
    ),
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
    id: 'modal-room-info-overlay',
    title: `Detalhes: ${room.name}`,
    body,
    actions: [
      { label: 'Fechar', onClick: () => closeModal('modal-room-info-overlay') },
    ],
  });

  openModal('modal-room-info-overlay');
}

// ── Modal: Criar / Editar sala ────────────────────────────────

function openRoomModal(room, grid) {
  const isEdit = !!room;

  const nameInput = el('input', {
    type: 'text',
    class: 'form-input',
    placeholder: 'Ex: LCC 3',
    value: room?.name ?? '',
  });
  const typeInput = el(
    'select',
    { class: 'form-input' },
    el('option', { value: 'Sala' }, 'Sala'),
    el('option', { value: 'Laboratório' }, 'Laboratório'),
    el('option', { value: 'Auditório' }, 'Auditório'),
  );
  if (room?.type) typeInput.value = room.type;

  const capInput = el('input', {
    type: 'number',
    class: 'form-input',
    placeholder: '40',
    value: room?.capacity ?? '',
  });
  const blockInput = el('input', {
    type: 'text',
    class: 'form-input',
    placeholder: 'Bloco A',
    value: room?.block ?? '',
  });

  const RESOURCES = [
    'Projetor',
    'Computadores',
    'Ar-condicionado',
    'Lousa digital',
    'Microfone',
  ];
  const checkboxes = RESOURCES.map((res) => {
    const checked = room?.resources?.includes(res);
    const wrapper = el(
      'label',
      {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '13px',
          cursor: 'pointer',
          marginBottom: '6px',
        },
      },
      el('input', {
        type: 'checkbox',
        value: res,
        ...(checked ? { checked: 'checked' } : {}),
      }),
      res,
    );
    return wrapper;
  });

  const body = el(
    'div',
    {},
    el(
      'div',
      { class: 'form-row' },
      formField('Nome do espaço', nameInput),
      formField('Tipo', typeInput),
    ),
    el(
      'div',
      { class: 'form-row' },
      formField('Capacidade', capInput),
      formField('Bloco / Localização', blockInput),
    ),
    el(
      'div',
      { class: 'form-field' },
      el('label', { class: 'form-label' }, 'Recursos disponíveis'),
      el('div', { style: { marginTop: '4px' } }, ...checkboxes),
    ),
  );

  createModal({
    id: 'modal-sala',
    title: isEdit ? 'Editar Espaço' : 'Cadastrar Espaço',
    body,
    actions: [
      { label: 'Cancelar', onClick: () => closeModal('modal-sala') },
      {
        label: isEdit ? 'Salvar alterações' : 'Salvar',
        primary: true,
        onClick: () => {
          const name = nameInput.value.trim();
          const type = typeInput.value;
          const cap = parseInt(capInput.value);
          const block = blockInput.value.trim();

          if (!name || !cap || !block) {
            toast('Preencha todos os campos obrigatórios.', 'error');
            return;
          }

          // Array.filter para selecionar recursos marcados
          const resources = RESOURCES.filter(
            (_, i) =>
              checkboxes[i].querySelector('input[type=checkbox]').checked,
          );

          const all = getRooms();
          const oldStatus = room?.status || 'free';

          if (isEdit) {
            // Array.map para atualização imutável
            const updated = all.map((r) =>
              r.id === room.id
                ? {
                    ...r,
                    name,
                    type,
                    capacity: cap,
                    block,
                    resources,
                    status: oldStatus,
                  }
                : r,
            );
            saveRooms(updated);
            toast('Espaço atualizado.', 'success');
          } else {
            saveRooms([
              ...all,
              {
                id: genId('room'),
                name,
                type,
                capacity: cap,
                block,
                resources,
                status: 'free',
              },
            ]);
            toast('Espaço cadastrado.', 'success');
          }

          closeModal('modal-sala');
          refreshGrid(grid);
        },
      },
    ],
  });

  openModal('modal-sala');
}

// ── Deletar sala ──────────────────────────────────────────────

function deleteRoom(id, grid) {
  confirm('Deseja excluir esta sala permanentemente?', () => {
    // Array.filter para remoção imutável
    saveRooms(getRooms().filter((r) => r.id !== id));
    refreshGrid(grid);
    toast('Sala removida.', 'success');
  });
}

// ── Helpers ───────────────────────────────────────────────────

function formField(label, input) {
  return el(
    'div',
    { class: 'form-field' },
    el('label', { class: 'form-label' }, label),
    input,
  );
}

function searchIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '13');
  svg.setAttribute('height', '13');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5');
  svg.innerHTML = '<circle cx="7" cy="7" r="5"/><path d="M11 11l3 3"/>';
  return svg;
}
