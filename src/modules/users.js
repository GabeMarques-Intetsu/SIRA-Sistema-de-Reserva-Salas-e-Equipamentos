// src/modules/users.js
// ─────────────────────────────────────────────────────────────
// Módulo: Usuários — CRUD
// ─────────────────────────────────────────────────────────────

import { el, render, btn, toast, confirm, tableRow } from '../utils/dom.js';
import { filterByText, roleLabel, initials } from '../utils/fp.js';
import { getUsers, saveUsers, genId } from '../data/store.js';
import { openModal, closeModal, createModal } from '../components/modal.js';

let searchQuery = '';

/**
 * Renderiza o CRUD de Usuários (admin) no container fornecido pelo
 * roteador. Topbar com busca, botão de solicitações pendentes e adicionar,
 * tabela com avatar/nome/e-mail/perfil e ações Editar/Remover.
 * @param {HTMLElement} page
 */
export function renderUsers(page) {
  const searchInput = el('input', {
    type: 'text',
    placeholder: 'Buscar usuário...',
  });
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    refreshTable(tbody);
  });

  const topbar = el(
    'div',
    { class: 'topbar' },
    el('span', { class: 'topbar-title' }, 'Usuários'),
    el('div', { class: 'search-box' }, searchIcon(), searchInput),
    btn('Solicitações de Cadastro', 'btn-primary', () =>
      renderSignupsModal(tbody),
    ),
    btn('+ Adicionar Usuário', 'btn-primary', () => openUserModal(null, tbody)),
  );

  const tbody = document.createElement('tbody');
  refreshTable(tbody);

  const table = el(
    'div',
    { class: 'table-wrap' },
    el(
      'table',
      {},
      el(
        'thead',
        {},
        el(
          'tr',
          {},
          el('th', {}, 'Nome'),
          el('th', {}, 'E-mail'),
          el('th', {}, 'Perfil'),
          el('th', {}, 'Ações'),
        ),
      ),
      tbody,
    ),
  );

  const content = el('div', { class: 'content' }, table);
  render(page, topbar, content);
}

/**
 * Re-renderiza a tabela de usuários aplicando o filtro de texto sobre os
 * campos `name`, `email` e `role`. Mostra estado vazio quando nada é
 * encontrado.
 * @param {HTMLTableSectionElement} tbody
 */
function refreshTable(tbody) {
  const all = getUsers();
  const filtered = filterByText(all, searchQuery, ['name', 'email', 'role']);

  render(
    tbody,
    ...(filtered.length
      ? filtered.map((u) => buildRow(u, tbody))
      : [
          el(
            'tr',
            {},
            el(
              'td',
              {
                colspan: '4',
                style: {
                  textAlign: 'center',
                  color: 'var(--text-tertiary)',
                  padding: '32px',
                },
              },
              'Nenhum usuário encontrado.',
            ),
          ),
        ]),
  );
}

/**
 * Constrói uma linha `<tr>` para a tabela de usuários com avatar (iniciais),
 * nome, e-mail, rótulo legível do perfil e ações Editar/Remover.
 * @param {object} u - usuário
 * @param {HTMLTableSectionElement} tbody
 * @returns {HTMLTableRowElement}
 */
function buildRow(u, tbody) {
  const nameCell = el(
    'div',
    { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
    el(
      'div',
      {
        class: 'avatar',
        style: { width: '26px', height: '26px', fontSize: '10px' },
      },
      initials(u.name),
    ),
    u.name,
  );

  const actionsCell = el(
    'div',
    { class: 'actions-row' },
    btn('Editar', 'btn-sm', () => openUserModal(u, tbody)),
    btn('Remover', 'btn-sm btn-danger', () => deleteUser(u.id, tbody)),
  );

  return tableRow([nameCell, u.email, roleLabel(u.role), actionsCell]);
}

/**
 * Abre o modal de criação ou edição de usuário. Quando `user` é `null`,
 * funciona como cadastro; caso contrário, pré-popula e altera título/botão.
 * Valida nome e e-mail, persiste com `saveUsers` (cria via `[...all, novo]`
 * ou atualiza via `map` imutável).
 * @param {object|null} user
 * @param {HTMLTableSectionElement} tbody
 */
function openUserModal(user, tbody) {
  const isEdit = !!user;

  const nameInput = el('input', {
    type: 'text',
    class: 'form-input',
    value: user?.name ?? '',
  });
  const emailInput = el('input', {
    type: 'email',
    class: 'form-input',
    value: user?.email ?? '',
  });

  const ROLES = ['professor', 'admin'];
  const roleSelect = el(
    'select',
    { class: 'form-input' },
    ...ROLES.map((r) => {
      const o = document.createElement('option');
      o.value = r;
      o.textContent = roleLabel(r);
      if (r === user?.role) o.selected = true;
      return o;
    }),
  );

  const body = el(
    'div',
    {},
    formField('Nome completo', nameInput),
    formField('E-mail institucional', emailInput),
    formField('Perfil de acesso', roleSelect),
  );

  createModal({
    id: 'modal-usuario',
    title: isEdit ? 'Editar Usuário' : 'Adicionar Usuário',
    body,
    actions: [
      { label: 'Cancelar', onClick: () => closeModal('modal-usuario') },
      {
        label: isEdit ? 'Salvar' : 'Adicionar',
        primary: true,
        onClick: () => {
          const name = nameInput.value.trim();
          const email = emailInput.value.trim();
          const role = roleSelect.value;

          if (!name || !email) {
            toast('Preencha nome e e-mail.', 'error');
            return;
          }

          const all = getUsers();
          if (isEdit) {
            saveUsers(
              all.map((u) =>
                u.id === user.id ? { ...u, name, email, role } : u,
              ),
            );
            toast('Usuário atualizado.', 'success');
          } else {
            saveUsers([...all, { id: genId('u'), name, email, role }]);
            toast('Usuário adicionado.', 'success');
          }

          closeModal('modal-usuario');
          refreshTable(tbody);
        },
      },
    ],
  });

  openModal('modal-usuario');
}

/**
 * Abre um modal listando as solicitações de cadastro pendentes
 * (armazenadas em `localStorage["sira:signups"]` pela tela de signup).
 * Para cada solicitação, oferece "Aprovar" (move para a lista de usuários
 * via `saveUsers`) ou "Recusar" (remove da lista de signups).
 * @param {HTMLTableSectionElement} tbody
 */
function renderSignupsModal(tbody) {
  let signups = [];
  try {
    signups = JSON.parse(localStorage.getItem('sira:signups') || '[]');
  } catch (e) {}

  const pending = signups.filter((s) => !s.approved);

  if (pending.length === 0) {
    toast('Nenhum cadastro pendente.', '');
    return;
  }

  const list = el(
    'div',
    { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
    ...pending.map((s) => {
      return el(
        'div',
        {
          class: 'room-card',
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          },
        },
        el(
          'div',
          {},
          el('strong', {}, s.name),
          el(
            'div',
            { style: { fontSize: '12px', color: '#666' } },
            s.email + ' - ' + roleLabel(s.role),
          ),
        ),
        el(
          'div',
          { style: { display: 'flex', gap: '5px' } },
          btn('Aprovar', 'btn-primary btn-sm', () => {
            s.approved = true;
            localStorage.setItem('sira:signups', JSON.stringify(signups));
            const allUsers = getUsers();
            saveUsers([
              ...allUsers,
              { id: genId('u'), name: s.name, email: s.email, role: s.role },
            ]);
            toast('Usuário aprovado e cadastrado.', 'success');
            closeModal('modal-signups');
            refreshTable(tbody);
            renderSignupsModal(tbody); // reopen if more left
          }),
          btn('Recusar', 'btn-danger btn-sm', () => {
            signups = signups.filter((x) => x.id !== s.id);
            localStorage.setItem('sira:signups', JSON.stringify(signups));
            toast('Cadastro recusado.', 'success');
            closeModal('modal-signups');
            refreshTable(tbody);
            renderSignupsModal(tbody);
          }),
        ),
      );
    }),
  );

  createModal({
    id: 'modal-signups',
    title: 'Solicitações de Cadastro',
    body: list,
    actions: [{ label: 'Fechar', onClick: () => closeModal('modal-signups') }],
  });

  openModal('modal-signups');
}

/**
 * Remove um usuário após confirmação. Aplica `filter` imutável e persiste
 * com `saveUsers`.
 * @param {string} id
 * @param {HTMLTableSectionElement} tbody
 */
function deleteUser(id, tbody) {
  confirm('Deseja remover este usuário?', () => {
    saveUsers(getUsers().filter((u) => u.id !== id));
    refreshTable(tbody);
    toast('Usuário removido.', 'success');
  });
}

/**
 * Encapsula um par `<label>` + input com o estilo padrão de formulário.
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
 * Cria o ícone SVG da lupa usado dentro do `.search-box`.
 * @returns {SVGElement}
 */
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
