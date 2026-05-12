// src/modules/reservations.js
import { el, render, badge, btn, toast, confirm, tableRow } from "../utils/dom.js";
import { filterByText, filterByStatus, statusBadge } from "../utils/fp.js";
import { getReservations, saveReservations, getRooms, genId } from "../data/store.js";
import { openModal, closeModal, createModal } from "../components/modal.js";

let searchQuery = "";
let activeFilter = "all";

export function renderReservations(page) {
  const tbody = document.createElement("tbody");
  refreshTable(tbody);

  const topbar = el(
    "div",
    { class: "topbar" },
    el("span", { class: "topbar-title" }, "Minhas Reservas"),
  );

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

  const content = el("div", { class: "content" }, table);
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
  actionsCell.appendChild(btn("Ver", "btn-sm", () => {}));

  return tableRow([
    r.room,
    `${r.date} · ${r.time}`,
    r.purpose,
    r.requester,
    badge(statusLabel, statusBadge(r.status)),
    actionsCell,
  ]);
}