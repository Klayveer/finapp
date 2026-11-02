export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brlCompact = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });
const intFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

export const money = (v) => brl.format(v || 0);
export const moneyCompact = (v) => (Math.abs(v) < 1000 ? brl.format(Math.round(v || 0)).replace(/,00$/, '') : brlCompact.format(v || 0));
export const int = (v) => intFmt.format(Math.floor(v || 0));
export const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

export const pad = (n) => String(n).padStart(2, '0');

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const monthOf = (iso) => iso.slice(0, 7);
export const currentMonth = () => monthOf(todayISO());

export function addMonths(mk, n) {
  let [y, m] = mk.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  y = Math.floor(total / 12);
  m = (total % 12) + 1;
  return `${y}-${pad(m)}`;
}

/** Quantidade de meses de `a` até `b` (b - a). */
export function monthDiff(a, b) {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return (by - ay) * 12 + (bm - am);
}

export const daysInMonth = (mk) => {
  const [y, m] = mk.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};
export const dateInMonth = (mk, day) => `${mk}-${pad(Math.min(Math.max(1, day || 1), daysInMonth(mk)))}`;

export const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const monthLabel = (mk) => {
  const [y, m] = mk.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};
export const monthShort = (mk) => {
  const [y, m] = mk.split('-').map(Number);
  return `${MONTHS[m - 1].slice(0, 3)}${String(y) !== currentMonth().slice(0, 4) ? ' ' + String(y).slice(2) : ''}`;
};

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const fmtDate = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
export const fmtDayHeader = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  const wd = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  const today = todayISO();
  if (iso === today) return `Hoje · ${wd}`;
  return `${pad(d)} de ${MONTHS[m - 1].toLowerCase()} · ${wd}`;
};
/** "2028-03" → "03/28" */
export const fmtExpiry = (ym) => (ym ? `${ym.slice(5, 7)}/${ym.slice(2, 4)}` : '—');

export const pct = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0);

export function debounce(fn, ms = 200) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}
