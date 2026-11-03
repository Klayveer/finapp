import { addMonths, monthOf, monthDiff, dateInMonth, todayISO, round2 } from './utils.js';

/*
 * Regras de competência
 * - Entradas/saídas comuns contam no mês da data.
 * - Compras no cartão contam no mês em que a FATURA VENCE (fluxo de caixa real).
 *   Compra no dia do fechamento ou depois vai para a fatura seguinte.
 * - Parcelas: uma por fatura, a última absorve os centavos.
 * - Recorrentes: repetem todo mês a partir da data inicial, até `endMonth` (inclusive), se houver.
 */

const dayOf = (iso) => Number(iso.slice(8, 10));

/** Mês (YYYY-MM) da fatura que vence e cobra uma compra feita em `iso`. */
export function invoiceMonth(card, iso) {
  const closing = Number(card.closingDay) || 1;
  const due = Number(card.dueDay) || 10;
  let m = monthOf(iso);
  if (dayOf(iso) >= closing) m = addMonths(m, 1); // mês em que a fatura fecha
  if (due <= closing) m = addMonths(m, 1); // vencimento cai no mês seguinte ao fechamento
  return m;
}
export const closingDateOf = (card, mk) =>
  dateInMonth(Number(card.dueDay) <= Number(card.closingDay) ? addMonths(mk, -1) : mk, Number(card.closingDay));
export const dueDateOf = (card, mk) => dateInMonth(mk, Number(card.dueDay));
/** Fatura atualmente aberta (recebendo compras de hoje). */
export const openInvoiceMonth = (card) => invoiceMonth(card, todayISO());

function installmentValue(total, n, i) {
  if (n <= 1) return round2(total);
  const base = Math.floor((total * 100) / n) / 100;
  return i < n - 1 ? base : round2(total - base * (n - 1));
}

function startMonthOf(t, card) {
  return card ? invoiceMonth(card, t.date) : monthOf(t.date);
}

/** Todos os lançamentos efetivos de um mês (já expandindo parcelas e recorrências). */
export function entriesForMonth(state, mk) {
  const cards = new Map(state.cards.map((c) => [c.id, c]));
  const out = [];
  for (const t of state.transactions) {
    const card = t.type === 'expense' && t.method === 'cartao' ? cards.get(t.cardId) || null : null;
    const start = startMonthOf(t, card);
    const diff = monthDiff(start, mk);
    if (diff < 0) continue;
    const shiftedDate = diff === 0 ? t.date : dateInMonth(addMonths(monthOf(t.date), diff), dayOf(t.date));
    if (t.recurring) {
      if (t.endMonth && mk > t.endMonth) continue;
      out.push({ tx: t, card, amount: Number(t.amount), date: shiftedDate, recurring: true, installment: 0, installments: 1 });
    } else {
      const n = card ? Math.max(1, Number(t.installments) || 1) : 1;
      if (diff >= n) continue;
      out.push({
        tx: t,
        card,
        amount: installmentValue(Number(t.amount), n, diff),
        date: shiftedDate,
        recurring: false,
        installment: n > 1 ? diff + 1 : 0,
        installments: n,
      });
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || (b.tx.createdAt || '').localeCompare(a.tx.createdAt || ''));
}

export function summarize(state, mk) {
  const entries = entriesForMonth(state, mk);
  let income = 0, expense = 0, fixedIncome = 0, fixedExpense = 0;
  const byCategory = new Map();
  const byMethod = new Map();
  for (const e of entries) {
    if (e.tx.type === 'income') {
      income += e.amount;
      if (e.recurring) fixedIncome += e.amount;
    } else {
      expense += e.amount;
      if (e.recurring || e.installment) fixedExpense += e.amount;
      byCategory.set(e.tx.category, (byCategory.get(e.tx.category) || 0) + e.amount);
      byMethod.set(e.tx.method, (byMethod.get(e.tx.method) || 0) + e.amount);
    }
  }
  return {
    entries,
    income: round2(income),
    expense: round2(expense),
    balance: round2(income - expense),
    fixedIncome: round2(fixedIncome),
    fixedExpense: round2(fixedExpense),
    byCategory: [...byCategory].map(([id, value]) => ({ id, value })).sort((a, b) => b.value - a.value),
    byMethod: [...byMethod].map(([id, value]) => ({ id, value })).sort((a, b) => b.value - a.value),
  };
}

export function pointsFor(card, amount, settings) {
  if (!card?.miles) return 0;
  const rate = Number(card.pointsPerUnit) || 0;
  if (card.pointsUnit === 'BRL') return amount * rate;
  const usd = Number(settings?.dollarRate) || 5.5;
  return (amount / usd) * rate;
}

/** Limite comprometido: tudo que ainda vai ser cobrado a partir da fatura aberta. */
export function usedLimit(state, card) {
  const open = openInvoiceMonth(card);
  let used = 0;
  for (const t of state.transactions) {
    if (t.type !== 'expense' || t.method !== 'cartao' || t.cardId !== card.id) continue;
    const start = invoiceMonth(card, t.date);
    if (t.recurring) {
      if (start <= open && (!t.endMonth || open <= t.endMonth)) used += Number(t.amount);
      continue;
    }
    const n = Math.max(1, Number(t.installments) || 1);
    for (let i = 0; i < n; i++) if (addMonths(start, i) >= open) used += installmentValue(Number(t.amount), n, i);
  }
  return round2(used);
}

export function invoice(state, card, mk) {
  // Na fatura, ordena pela data real da compra (ano/mês/dia), mais recente primeiro.
  const entries = entriesForMonth(state, mk)
    .filter((e) => e.card?.id === card.id)
    .sort((a, b) => b.tx.date.localeCompare(a.tx.date) || (b.tx.createdAt || '').localeCompare(a.tx.createdAt || ''));
  const total = round2(entries.reduce((s, e) => s + e.amount, 0));
  const open = openInvoiceMonth(card);
  const status = mk < open ? 'fechada' : mk === open ? 'aberta' : 'futura';
  return {
    entries,
    total,
    points: Math.floor(pointsFor(card, total, state.settings)),
    closing: closingDateOf(card, mk),
    due: dueDateOf(card, mk),
    status,
  };
}

/** Pontos estimados acumulados em todas as faturas até a aberta. */
export function accruedPoints(state, card) {
  if (!card.miles) return 0;
  const txs = state.transactions.filter((t) => t.method === 'cartao' && t.cardId === card.id && t.type === 'expense');
  if (!txs.length) return 0;
  const open = openInvoiceMonth(card);
  let first = open;
  for (const t of txs) {
    const s = invoiceMonth(card, t.date);
    if (s < first) first = s;
  }
  let total = 0;
  for (let m = first, guard = 0; m <= open && guard < 240; m = addMonths(m, 1), guard++) {
    total += invoice(state, card, m).total;
  }
  return Math.floor(pointsFor(card, total, state.settings));
}

export function expiryStatus(card) {
  if (!card.expiry) return null;
  const now = monthOf(todayISO());
  const diff = monthDiff(now, card.expiry);
  if (diff < 0) return { level: 'expired', label: 'Vencido' };
  if (diff <= 2) return { level: 'soon', label: 'Vence em breve' };
  return null;
}
