// src/utils/dom.js
// ─────────────────────────────────────────────────────────────
// Utilitários para manipulação do DOM (sem framework)
// Criação dinâmica de componentes via createElement / appendChild
// ─────────────────────────────────────────────────────────────

/**
 * Cria um elemento com atributos e filhos.
 * @param {string}           tag
 * @param {Object}           [attrs]
 * @param {...(Node|string)} children
 * @returns {HTMLElement}
 */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);

  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') {
      node.className = v;
    } else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'style' && typeof v === 'object') {
      Object.assign(node.style, v);
    } else {
      node.setAttribute(k, v);
    }
  });

  children.forEach((child) => {
    if (child == null) return;
    node.appendChild(
      typeof child === 'string' || typeof child === 'number'
        ? document.createTextNode(child)
        : child,
    );
  });

  return node;
}

/**
 * Esvazia um elemento e injeta novo conteúdo (Node ou string).
 * @param {HTMLElement} container
 * @param {...(Node|string)} nodes
 */
export function render(container, ...nodes) {
  container.innerHTML = '';
  nodes.forEach((n) => {
    if (n == null) return;
    container.appendChild(
      typeof n === 'string' || typeof n === 'number'
        ? document.createTextNode(n)
        : n,
    );
  });
}

/**
 * Cria um <span> de badge.
 * @param {string} text
 * @param {string} cssClass
 * @returns {HTMLElement}
 */
export function badge(text, cssClass) {
  return el('span', { class: `badge ${cssClass}` }, text);
}

/**
 * Cria um botão.
 * @param {string}   text
 * @param {string}   cssClass
 * @param {Function} onClick
 * @returns {HTMLElement}
 */
export function btn(text, cssClass, onClick) {
  return el('button', { class: `btn ${cssClass}`, onClick }, text);
}

/**
 * Exibe um toast de feedback.
 * @param {string} message
 * @param {'success'|'error'|''} type
 */
export function toast(message, type = '') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = el('div', { class: 'toast-container' });
    document.body.appendChild(container);
  }
  const t = el('div', { class: `toast ${type}` }, message);
  container.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

/**
 * Confirma uma ação com dialog nativo.
 * @param {string}   message
 * @param {Function} onConfirm
 */
export function confirm(message, onConfirm) {
  if (window.confirm(message)) onConfirm();
}

/**
 * Cria um seletor de data em formato brasileiro dd/mm/aaaa, combinando:
 * - Um `<input type="text">` visível com máscara automática (digite só
 *   os números, as barras entram sozinhas).
 * - Um botão com ícone de calendário que abre o picker nativo do navegador
 *   via `showPicker()` num `<input type="date">` oculto.
 *
 * O wrapper retornado expõe `.value` (getter/setter) que proxia para o
 * input visível, mantendo compatibilidade com o restante do código que
 * faz `dateField.value`.
 * @returns {HTMLElement & {value:string}}
 */
export function dateField() {
  const text = el('input', {
    type: 'text',
    class: 'form-input',
    placeholder: 'dd/mm/aaaa',
    inputmode: 'numeric',
    autocomplete: 'off',
    maxlength: '10',
    style: { flex: '1' },
  });
  text.addEventListener('input', (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
    let out = digits;
    if (digits.length > 4) {
      out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    } else if (digits.length > 2) {
      out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    e.target.value = out;
  });

  // Input nativo escondido — usado só para abrir o picker do navegador.
  const hidden = el('input', {
    type: 'date',
    'aria-hidden': 'true',
    tabindex: '-1',
    style: {
      position: 'absolute',
      width: '1px',
      height: '1px',
      opacity: '0',
      pointerEvents: 'none',
      border: '0',
      padding: '0',
    },
  });
  hidden.addEventListener('change', () => {
    if (!hidden.value) return;
    const [y, m, d] = hidden.value.split('-');
    text.value = `${d}/${m}/${y}`;
  });

  // Ícone SVG de calendário (criado com namespace correto).
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5');
  svg.innerHTML =
    '<rect x="2" y="3" width="12" height="11" rx="1.5"/>' +
    '<path d="M5 2v2M11 2v2M2 7h12"/>';

  const calBtn = el(
    'button',
    {
      type: 'button',
      class: 'btn btn-icon date-picker-btn',
      'aria-label': 'Abrir calendário',
      onClick: () => {
        const m = text.value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (m) hidden.value = `${m[3]}-${m[2]}-${m[1]}`;
        if (typeof hidden.showPicker === 'function') hidden.showPicker();
        else hidden.focus();
      },
    },
    svg,
  );

  const wrapper = el(
    'div',
    {
      class: 'date-input-wrap',
      style: {
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      },
    },
    text,
    calBtn,
    hidden,
  );

  Object.defineProperty(wrapper, 'value', {
    get: () => text.value,
    set: (v) => {
      text.value = v;
    },
  });

  return wrapper;
}

/**
 * Cria uma linha de tabela (<tr>) a partir de células.
 * @param {Array<Node|string>} cells
 * @returns {HTMLElement}
 */
export function tableRow(cells) {
  const tr = document.createElement('tr');
  cells.forEach((cell) => {
    const td = document.createElement('td');
    if (cell instanceof Node) td.appendChild(cell);
    else td.textContent = cell;
    tr.appendChild(td);
  });
  return tr;
}
