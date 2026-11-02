import { state } from '../store.js';
import { summarize } from '../finance.js';
import { money, esc, fmtDayHeader, monthLabel, debounce } from '../utils.js';
import { categoryName, methodName, EXPENSE_CATEGORIES, INCOME_CATEGORIES, METHODS } from '../catalog.js';
import { monthNav, bindMonthNav, emptyState } from '../ui.js';
import { openTransactionForm } from '../forms.js';
import { icon } from '../icons.js';

// Filtros sobrevivem a re-renderizações.
const filters = { type: 'all', method: '', category: '', q: '' };

export function renderTransactions(el, ctx) {
  const mk = ctx.month;
  const s = summarize(state, mk);
  const q = filters.q.trim().toLowerCase();
  const list = s.entries.filter(
    (e) =>
      (filters.type === 'all' || e.tx.type === filters.type) &&
      (!filters.method || e.tx.method === filters.method) &&
      (!filters.category || e.tx.category === filters.category) &&
      (!q || e.tx.description.toLowerCase().includes(q) || (e.tx.notes || '').toLowerCase().includes(q) || (e.card?.name || '').toLowerCase().includes(q)),
  );
  const fIn = list.filter((e) => e.tx.type === 'income').reduce((a, e) => a + e.amount, 0);
  const fOut = list.filter((e) => e.tx.type === 'expense').reduce((a, e) => a + e.amount, 0);

  const byDay = new Map();
  for (const e of list) {
    if (!byDay.has(e.date)) byDay.set(e.date, []);
    byDay.get(e.date).push(e);
  }

  const recurring = state.transactions
    .filter((t) => t.recurring && (!t.endMonth || t.endMonth >= mk) && t.date.slice(0, 7) <= mk)
    .sort((a, b) => (a.type === b.type ? b.amount - a.amount : a.type === 'income' ? -1 : 1));
  const recIn = recurring.filter((t) => t.type === 'income').reduce((a, t) => a + Number(t.amount), 0);
  const recOut = recurring.filter((t) => t.type === 'expense').reduce((a, t) => a + Number(t.amount), 0);

  const allCats = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES.filter((c) => !EXPENSE_CATEGORIES.some((x) => x.id === c.id))];

  el.innerHTML = `
    <header class="page-head">
      <div>
        <p class="eyebrow">Transações</p>
        <h1>${esc(monthLabel(mk))}</h1>
      </div>
      <div class="page-actions">
        ${monthNav(mk)}
        <button class="btn btn-ghost" data-new-income>${icon('up', 16)}<span class="hide-sm">Entrada</span></button>
        <button class="btn btn-primary" data-new-expense>${icon('down', 16)}<span class="hide-sm">Saída</span></button>
      </div>
    </header>

    <section class="stat-strip">
      <div><span class="muted small">Entradas</span><strong>${money(s.income)}</strong></div>
      <div><span class="muted small">Saídas</span><strong>${money(s.expense)}</strong></div>
      <div><span class="muted small">Saldo</span><strong class="${s.balance < 0 ? 'neg' : ''}">${money(s.balance)}</strong></div>
    </section>

    <section class="grid-tx">
      <div class="panel panel-flush">
        <div class="toolbar">
          <div class="seg" role="radiogroup" aria-label="Filtrar tipo">
            ${[['all', 'Tudo'], ['income', 'Entradas'], ['expense', 'Saídas']].map(([v, l]) => `<button type="button" data-ftype="${v}" class="${filters.type === v ? 'on' : ''}">${l}</button>`).join('')}
          </div>
          <label class="search">${icon('search', 16)}<input type="search" placeholder="Buscar" value="${esc(filters.q)}" data-q aria-label="Buscar"></label>
          <select class="input input-sm" data-fmethod aria-label="Forma de pagamento">
            <option value="">Todas as formas</option>
            ${Object.entries(METHODS).map(([v, l]) => `<option value="${v}" ${filters.method === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}
          </select>
          <select class="input input-sm" data-fcat aria-label="Categoria">
            <option value="">Todas as categorias</option>
            ${allCats.map((c) => `<option value="${c.id}" ${filters.category === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
          </select>
        </div>

        ${list.length
          ? `<div class="day-list">${[...byDay]
              .map(
                ([day, items]) => `
            <div class="day">
              <div class="day-head"><span>${esc(fmtDayHeader(day))}</span><span class="num muted">${money(items.reduce((a, e) => a + (e.tx.type === 'income' ? e.amount : -e.amount), 0))}</span></div>
              <ul class="rows">${items.map(row).join('')}</ul>
            </div>`,
              )
              .join('')}</div>
            ${hasFilters() ? `<div class="filter-foot muted small">Filtrado: ${money(fIn)} de entradas · ${money(fOut)} de saídas <button class="link-btn" data-clear>Limpar filtros</button></div>` : ''}`
          : hasFilters()
            ? `<div class="pad">${emptyState('Nada encontrado', 'Nenhum lançamento corresponde aos filtros.', '<button class="btn btn-ghost" data-clear>Limpar filtros</button>')}</div>`
            : `<div class="pad">${emptyState('Nenhum lançamento neste mês', 'Registre entradas, Pix, compras no cartão e contas.', '')}</div>`}
      </div>

      <aside class="panel">
        <header class="panel-head"><h2>Fixos mensais</h2><button class="icon-btn" data-new-rec aria-label="Nova recorrência" title="Nova renda/gasto recorrente">${icon('plus')}</button></header>
        <div class="split-stat tight">
          <div><span class="muted small">Renda fixa</span><strong>${money(recIn)}</strong></div>
          <div><span class="muted small">Gasto fixo</span><strong>${money(recOut)}</strong></div>
        </div>
        ${recurring.length
          ? `<ul class="rows compact">${recurring
              .map(
                (t) => `<li><button class="row" data-tx="${esc(t.id)}">
                  <span class="tx-icon ${t.type}">${icon(t.type === 'income' ? 'up' : 'down', 14)}</span>
                  <span class="row-main"><strong>${esc(t.description)}</strong><span class="muted small">Todo dia ${Number(t.date.slice(8, 10))}${t.endMonth ? ` · até ${esc(monthLabel(t.endMonth))}` : ''}</span></span>
                  <span class="num ${t.type === 'income' ? 'pos' : ''}">${t.type === 'income' ? '+' : '−'}${money(t.amount)}</span>
                </button></li>`,
              )
              .join('')}</ul>`
          : `<p class="muted small">Cadastre seu salário e contas fixas (aluguel, internet, academia) para projetar os próximos meses.</p>`}
        <button class="btn btn-ghost btn-block" data-new-salary>${icon('repeat', 16)} Adicionar renda recorrente</button>
      </aside>
    </section>`;

  bindMonthNav(el, ctx);
  const rerender = () => renderTransactions(el, ctx);
  el.querySelector('[data-new-income]').onclick = () => openTransactionForm({ preset: { type: 'income', method: 'pix' }, month: mk });
  el.querySelector('[data-new-expense]').onclick = () => openTransactionForm({ preset: { type: 'expense', method: 'pix' }, month: mk });
  el.querySelector('[data-new-rec]').onclick = () => openTransactionForm({ preset: { type: 'expense', recurring: true, method: 'boleto' }, month: mk });
  el.querySelector('[data-new-salary]').onclick = () =>
    openTransactionForm({ preset: { type: 'income', recurring: true, category: 'salario', method: 'deposito', description: 'Salário' }, month: mk });
  el.querySelectorAll('[data-tx]').forEach((r) =>
    r.addEventListener('click', () => openTransactionForm({ tx: state.transactions.find((t) => t.id === r.dataset.tx), month: mk })),
  );
  el.querySelectorAll('[data-ftype]').forEach((b) => b.addEventListener('click', () => { filters.type = b.dataset.ftype; rerender(); }));
  el.querySelector('[data-fmethod]').onchange = (e) => { filters.method = e.target.value; rerender(); };
  el.querySelector('[data-fcat]').onchange = (e) => { filters.category = e.target.value; rerender(); };
  const qInput = el.querySelector('[data-q]');
  qInput.addEventListener('input', debounce(() => {
    filters.q = qInput.value;
    rerender();
    const again = el.querySelector('[data-q]');
    again.focus();
    again.setSelectionRange(again.value.length, again.value.length);
  }, 250));
  el.querySelectorAll('[data-clear]').forEach((b) => b.addEventListener('click', () => {
    Object.assign(filters, { type: 'all', method: '', category: '', q: '' });
    rerender();
  }));
}

const hasFilters = () => filters.type !== 'all' || filters.method || filters.category || filters.q.trim();

function row(e) {
  const t = e.tx;
  const meta = [
    categoryName(t.category),
    t.method === 'cartao' && e.card ? e.card.name : methodName(t.method),
    e.installment ? `parcela ${e.installment}/${e.installments}` : '',
  ].filter(Boolean);
  return `<li><button class="row" data-tx="${esc(t.id)}">
    <span class="tx-icon ${t.type}">${icon(t.type === 'income' ? 'up' : t.method === 'cartao' ? 'card' : 'down', 14)}</span>
    <span class="row-main">
      <strong>${esc(t.description)}${e.recurring ? ` <span class="tag" title="Recorrente">${icon('repeat', 11)} fixo</span>` : ''}</strong>
      <span class="muted small">${meta.map(esc).join(' · ')}</span>
    </span>
    <span class="num ${t.type === 'income' ? 'pos' : ''}">${t.type === 'income' ? '+' : '−'}${money(e.amount)}</span>
  </button></li>`;
}
