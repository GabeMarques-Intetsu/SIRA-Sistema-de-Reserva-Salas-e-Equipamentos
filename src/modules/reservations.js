// src/modules/reservations.js
import { el, render, badge, btn, toast, confirm, tableRow } from "../utils/dom.js";
import { filterByText, filterByStatus, statusBadge } from "../utils/fp.js";
import { getReservations, saveReservations, getRooms, genId } from "../data/store.js";
import { openModal, closeModal, createModal } from "../components/modal.js";

let searchQuery = "";
let activeFilter = "all";

export function renderReservations(page) {
  let updated = false;
  const reservations = getReservations().map((r) => {
    if (r.requester === "Diego Pessoa" && !r.read) {
      updated = true;
      return { ...r, read: true };
    }
    return r;
  });
  if (updated) {
    saveReservations(reservations);
    if (window.updateSidebarBadges) window.updateSidebarBadges();
  }

  const tbody = document.createElement("tbody");
  refreshTable(tbody);

  const searchInput = el("input", {
    type: "text",
    placeholder: "Buscar reserva...",
  });
  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    refreshTable(tbody);
  });

  const searchBox = el("div", { class: "search-box" }, searchIcon(), searchInput);

  const topbar = el(
    "div",
    { class: "topbar" },
    el("span", { class: "topbar-title" }, "Minhas Reservas"),
    searchBox,
  );

  const FILTERS = [
    { key: "all", label: "Todas" },
    { key: "pending", label: "Pendentes" },
    { key: "approved", label: "Aprovadas" },
    { key: "rejected", label: "Recusadas" },
  ];

  const chips = FILTERS.map((f) => {
    const chip = el(
      "div",
      { class: `filter-chip${f.key === "all" ? " active" : ""}` },
      f.label,
    );
    chip.addEventListener("click", () => {
      document
        .querySelectorAll(".filter-chip")
        .forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      activeFilter = f.key;
      refreshTable(tbody);
    });
    return chip;
  });

  const filterRow = el("div", { class: "filter-row" }, ...chips);

  const table = el(
    "div",
    { class: "table-wrap" },
    el(
      "table",
      {},
      el(
        "thead",
        {},
        el(
          "tr",
          {},
          el("th", {}, "Sala"),
          el("th", {}, "Data / Horário"),
          el("th", {}, "Finalidade"),
          el("th", {}, "Solicitante"),
          el("th", {}, "Status"),
          el("th", {}, "Ações"),
        ),
      ),
      tbody,
    ),
  );

  const content = el("div", { class: "content" }, filterRow, table);
  render(page, topbar, content);
}

function refreshTable(tbody) {
  const all = getReservations();
  const filtered = filterByStatus(
    filterByText(all, searchQuery, ["room", "purpose", "requester"]),
    activeFilter,
  );

  render(
    tbody,
    ...(filtered.length
      ? filtered.map((r) => buildRow(r, tbody))
      : [
          el(
            "tr",
            {},
            el(
              "td",
              {
                colspan: "6",
                style: {
                  textAlign: "center",
                  color: "var(--text-tertiary)",
                  padding: "32px",
                },
              },
              "Nenhuma reserva encontrada.",
            ),
          ),
        ]),
  );
}

function buildRow(r, tbody) {
  const statusLabel =
    { pending: "Pendente", approved: "Aprovada", rejected: "Recusada" }[r.status] ?? r.status;

  const actionsCell = el("div", { class: "actions-row" });
  actionsCell.appendChild(btn("Ver", "btn-sm", () => openViewModal(r)));

  return tableRow([
    r.room,
    `${r.date} · ${r.time}`,
    r.purpose,
    r.requester,
    badge(statusLabel, statusBadge(r.status)),
    actionsCell,
  ]);
}

function openViewModal(r) {
  const statusLabel =
    { pending: "Pendente", approved: "Aprovada", rejected: "Recusada" }[r.status] ?? r.status;

  const body = el(
    "div",
    {},
    infoRow("Sala", r.room),
    infoRow("Data", r.date),
    infoRow("Horário", r.time),
    infoRow("Finalidade", r.purpose),
    infoRow("Solicitante", r.requester),
    infoRow("Status", statusLabel),
  );

  createModal({
    id: "modal-view",
    title: "Detalhes da Reserva",
    body,
    actions: [{ label: "Fechar", onClick: () => closeModal("modal-view") }],
  });

  openModal("modal-view");
}

function infoRow(label, value) {
  return el(
    "div",
    { style: { marginBottom: "10px" } },
    el("span", { style: { fontSize: "11px", color: "var(--text-tertiary)", display: "block" } }, label),
    el("span", { style: { fontSize: "13px" } }, value),
  );
}

function searchIcon() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "13");
  svg.setAttribute("height", "13");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.5");
  svg.innerHTML = '<circle cx="7" cy="7" r="5"/><path d="M11 11l3 3"/>';
  return svg;
}