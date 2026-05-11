// src/modules/calendar.js
// ─────────────────────────────────────────────────────────────
// Módulo: Home — Painel de Reservas estilo calendário
// Layout baseado no wireframe: header com ações rápidas +
// info do usuário + calendário semanal como painel principal
// ─────────────────────────────────────────────────────────────

import { el, render, btn } from '../utils/dom.js';
import {
  getReservations,
  getRooms,
  saveReservations,
  genId,
} from '../data/store.js';
import { openModal, closeModal, createModal } from '../components/modal.js';

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
