import * as store from './store.js';
import { state } from './store.js';
import { addMonths, currentMonth, dateInMonth, uid, todayISO } from './utils.js';
import { confirmDialog, toast } from './ui.js';

/** Gera ~6 meses de dados fictícios ao redor do mês atual. */
export async function loadDemo() {
  if (state.transactions.length || state.cards.length) {
    const ok = await confirmDialog({
      title: 'Carregar dados de exemplo?',
      message: 'Isso substitui seus dados atuais. Exporte um backup antes, se precisar.',
      confirmText: 'Substituir',
      danger: true,
    });
    if (!ok) return;
  }
  const now = currentMonth();
  const today = todayISO();
  const start = addMonths(now, -5);
  const nubank = { id: uid(), name: 'Nubank Ultravioleta', brand: 'Mastercard', last4: '4821', expiry: addMonths(now, 30), limit: 12000, closingDay: 3, dueDay: 10, color: 'violet', miles: true, pointsPerUnit: 2.2, pointsUnit: 'USD', program: 'Nubank Rewards' };
  const itau = { id: uid(), name: 'Itaú Azul Infinite', brand: 'Visa', last4: '0937', expiry: addMonths(now, 2), limit: 25000, closingDay: 28, dueDay: 5, color: 'blue', miles: true, pointsPerUnit: 2.5, pointsUnit: 'USD', program: 'Livelo' };
  const inter = { id: uid(), name: 'Inter Gold', brand: 'Mastercard', last4: '1150', expiry: addMonths(now, 40), limit: 3500, closingDay: 20, dueDay: 27, color: 'orange', miles: false, pointsPerUnit: 0, pointsUnit: 'USD', program: '' };

  const tx = [];
  const add = (o) => tx.push({ id: uid(), installments: 1, recurring: false, endMonth: '', notes: '', cardId: null, ...o });

  add({ type: 'income', description: 'Salário', amount: 8500, date: dateInMonth(start, 5), category: 'salario', method: 'deposito', recurring: true });
  add({ type: 'expense', description: 'Aluguel', amount: 2200, date: dateInMonth(start, 10), category: 'moradia', method: 'boleto', recurring: true });
  add({ type: 'expense', description: 'Condomínio', amount: 480, date: dateInMonth(start, 10), category: 'moradia', method: 'pix', recurring: true });
  add({ type: 'expense', description: 'Internet fibra', amount: 119.9, date: dateInMonth(start, 15), category: 'contas', method: 'debito', recurring: true });
  add({ type: 'expense', description: 'Academia', amount: 129.9, date: dateInMonth(start, 8), category: 'saude', method: 'cartao', cardId: inter.id, recurring: true });
  add({ type: 'expense', description: 'Netflix', amount: 44.9, date: dateInMonth(start, 12), category: 'assinaturas', method: 'cartao', cardId: nubank.id, recurring: true });
  add({ type: 'expense', description: 'Spotify', amount: 23.9, date: dateInMonth(start, 18), category: 'assinaturas', method: 'cartao', cardId: nubank.id, recurring: true });
  add({ type: 'expense', description: 'Reserva de emergência', amount: 800, date: dateInMonth(start, 6), category: 'investimento', method: 'pix', recurring: true });
  add({ type: 'expense', description: 'iPhone', amount: 6480, date: dateInMonth(addMonths(now, -3), 14), category: 'compras', method: 'cartao', cardId: itau.id, installments: 10 });
  add({ type: 'expense', description: 'Passagens Lisboa', amount: 4200, date: dateInMonth(addMonths(now, -1), 22), category: 'viagem', method: 'cartao', cardId: itau.id, installments: 6 });

  const rnd = (seed) => {
    let s = seed;
    return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  };
  const r = rnd(42);
  for (let i = 0; i < 6; i++) {
    const m = addMonths(start, i);
    const last = m === now ? Number(today.slice(8, 10)) : 28;
    const day = () => 1 + Math.floor(r() * last);
    const pick = (a, b) => Math.round((a + r() * (b - a)) * 100) / 100;
    for (let k = 0; k < 4; k++) add({ type: 'expense', description: 'Mercado', amount: pick(180, 520), date: dateInMonth(m, day()), category: 'mercado', method: 'cartao', cardId: itau.id });
    for (let k = 0; k < 6; k++) add({ type: 'expense', description: ['Uber', '99', 'Combustível'][k % 3], amount: pick(18, 160), date: dateInMonth(m, day()), category: 'transporte', method: k % 2 ? 'pix' : 'cartao', cardId: k % 2 ? null : nubank.id });
    for (let k = 0; k < 5; k++) add({ type: 'expense', description: ['iFood', 'Restaurante', 'Padaria', 'Café'][k % 4], amount: pick(22, 190), date: dateInMonth(m, day()), category: 'alimentacao', method: k % 3 ? 'cartao' : 'pix', cardId: k % 3 ? nubank.id : null });
    add({ type: 'expense', description: 'Farmácia', amount: pick(40, 210), date: dateInMonth(m, day()), category: 'saude', method: 'debito' });
    add({ type: 'expense', description: 'Cinema / bar', amount: pick(80, 320), date: dateInMonth(m, day()), category: 'lazer', method: 'cartao', cardId: inter.id });
    add({ type: 'expense', description: 'Conta de luz', amount: pick(140, 260), date: dateInMonth(m, Math.min(20, last)), category: 'contas', method: 'pix' });
    if (i % 2 === 1) add({ type: 'income', description: 'Freelance', amount: pick(900, 2600), date: dateInMonth(m, day()), category: 'freelance', method: 'pix' });
    if (i === 3) add({ type: 'income', description: 'Venda bicicleta', amount: 1200, date: dateInMonth(m, day()), category: 'venda', method: 'pix' });
  }

  try {
    await store.replaceAll({ cards: [nubank, itau, inter], transactions: tx, settings: state.settings });
    toast('Dados de exemplo carregados', 'success');
  } catch { /* erro já exibido */ }
}
