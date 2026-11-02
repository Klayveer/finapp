import { state } from '../store.js';
import { summarize, invoice, usedLimit } from '../finance.js';
import { addMonths, money, monthShort, monthLabel, esc, int, pct, fmtDate, currentMonth } from '../utils.js';
import { categoryName, methodName, cardGradient } from '../catalog.js';
import { mountGroupedBars, hbars, meter } from '../charts.js';
import { monthNav, bindMonthNav, emptyState } from '../ui.js';
import { openTransactionForm } from '../forms.js';
import { icon } from '../icons.js';
import { loadDemo } from '../demo.js';

export function renderDashboard(el, ctx) {
  const mk = ctx.month;
  const s = summarize(state, mk);
  const prev = summarize(state, addMonths(mk, -1));
  const history = Array.from({ length: 6 }, (_, i) => addMonths(mk, i - 5)).map((m) => {
    const x = m === mk ? s : summarize(state, m);
    return { m, label: monthShort(m), title: monthLabel(m), current: m === mk, values: { income: x.income, expense: x.expense }, balance: x.balance };
  });
  const savingsRate = s.income > 0 ? Math.round((s.balance / s.income) * 100) : null;
  const yearBalance = Array.from({ length: Number(mk.slice(5)) }, (_, i) => `${mk.slice(0, 4)}-${String(i + 1).padStart(2, '0')}`)
    .reduce((acc, m) => acc + (m === mk ? s.balance : summarize(state, m).balance), 0);

  const hasData = state.transactions.length > 0;

  const delta = (cur, before, invert = false) => {
    if (!before) return '<span class="delta">—</span>';
    const d = Math.round(((cur - before) / before) * 100);
    if (d === 0) return '<span class="delta">igual ao mês anterior</span>';
    const good = invert ? d < 0 : d > 0;
    return `<span class="delta ${good ? 'good' : 'bad'}">${icon(d > 0 ? 'up' : 'down', 13)}${Math.abs(d)}% vs. ${monthShort(addMonths(mk, -1)).toLowerCase()}</span>`;
  };

  const cats = s.byCategory.slice(0, 6).map((c) => ({ label: categoryName(c.id), value: c.value }));
  const rest = s.byCategory.slice(6).reduce((a, c) => a + c.value, 0);
  if (rest > 0) cats.push({ label: 'Outras categorias', value: rest });

  const methods = s.byMethod.map((x) => ({ label: methodName(x.id), value: x.value }));

  const top = s.entries.filter((e) => e.tx.type === 'expense').sort((a, b) => b.amount - a.amount).slice(0, 5);

  const cardsHTML = state.cards
    .map((c) => {
      const inv = invoice(state, c, mk);
      const used = usedLimit(state, c);
      return `<a class="mini-card" href="#/cartoes?id=${encodeURIComponent(c.id)}">
        <span class="mini-cc" style="background:${cardGradient(c.color)}"></span>
        <span class="mini-body">
          <span class="row-between"><strong>${esc(c.name)}</strong><span class="num">${money(inv.total)}</span></span>
          <span class="row-between muted small"><span>Vence ${fmtDate(inv.due)} · ${inv.status}</span>${c.miles ? `<span>${icon('plane', 12)} ${int(inv.points)} pts</span>` : ''}</span>
          ${c.limit ? `${meter(used, c.limit, { label: 'Limite usado' })}<span class="muted small">${money(Math.max(0, c.limit - used))} disponível de ${money(c.limit)}</span>` : ''}
        </span>
      </a>`;
    })
    .join('');

  const pointsMonth = state.cards.reduce((a, c) => a + invoice(state, c, mk).points, 0);

  el.innerHTML = `
    <header class="page-head">
      <div>
        <p class="eyebrow">Painel</p>
        <h1>${mk === currentMonth() ? 'Seu mês' : esc(monthLabel(mk))}</h1>
      </div>
      <div class="page-actions">
        ${monthNav(mk)}
        <button class="btn btn-primary" data-new>${icon('plus', 16)}<span class="hide-sm">Lançamento</span></button>
      </div>
    </header>

    ${hasData ? '' : `<section class="panel">${emptyState('Comece pelo seu salário', 'Cadastre suas rendas recorrentes, seus cartões e seus gastos. O painel se monta sozinho.', `<div class="row-gap"><button class="btn btn-primary" data-salary>${icon('repeat', 16)} Cadastrar salário</button><button class="btn btn-ghost" data-demo>Ver com dados de exemplo</button></div>`)}</section>`}

    <section class="kpis">
      <article class="kpi kpi-hero">
        <span class="kpi-label">Saldo do mês</span>
        <span class="kpi-value ${s.balance < 0 ? 'neg' : ''}">${money(s.balance)}</span>
        <span class="kpi-foot">${savingsRate === null ? 'Sem entradas no mês' : savingsRate >= 0 ? `Você guardou ${savingsRate}% do que entrou` : `Gastou ${Math.abs(savingsRate)}% a mais do que entrou`}</span>
      </article>
      <article class="kpi">
        <span class="kpi-label"><i class="dot" style="background:var(--income)"></i>Entradas</span>
        <span class="kpi-value">${money(s.income)}</span>
        ${delta(s.income, prev.income)}
      </article>
      <article class="kpi">
        <span class="kpi-label"><i class="dot" style="background:var(--expense)"></i>Saídas</span>
        <span class="kpi-value">${money(s.expense)}</span>
        ${delta(s.expense, prev.expense, true)}
      </article>
      <article class="kpi">
        <span class="kpi-label">Acumulado em ${mk.slice(0, 4)}</span>
        <span class="kpi-value ${yearBalance < 0 ? 'neg' : ''}">${money(yearBalance)}</span>
        <span class="kpi-foot">Comprometido fixo: ${money(s.fixedExpense)}</span>
      </article>
    </section>

    <section class="grid-2">
      <article class="panel span-2">
        <header class="panel-head"><h2>Entradas x saídas</h2><span class="muted small">últimos 6 meses</span></header>
        <div data-chart></div>
      </article>

      <article class="panel">
        <header class="panel-head"><h2>Onde vai seu dinheiro</h2><span class="muted small">${money(s.expense)}</span></header>
        ${cats.length ? hbars(cats, { total: s.expense }) : '<p class="muted small">Nenhuma saída neste mês.</p>'}
      </article>

      <article class="panel">
        <header class="panel-head"><h2>Como você paga</h2></header>
        ${methods.length ? hbars(methods, { color: 'var(--neutral-bar)', total: s.expense }) : '<p class="muted small">Nenhuma saída neste mês.</p>'}
        <div class="split-stat">
          <div><span class="muted small">Gastos fixos e parcelas</span><strong>${money(s.fixedExpense)}</strong><span class="muted small">${pct(s.fixedExpense, s.expense)}% das saídas</span></div>
          <div><span class="muted small">Gastos variáveis</span><strong>${money(s.expense - s.fixedExpense)}</strong><span class="muted small">${pct(s.expense - s.fixedExpense, s.expense)}% das saídas</span></div>
        </div>
      </article>

      <article class="panel">
        <header class="panel-head"><h2>Cartões</h2>${pointsMonth ? `<span class="chip">${icon('plane', 13)} ${int(pointsMonth)} pts no mês</span>` : ''}</header>
        ${state.cards.length ? `<div class="mini-cards">${cardsHTML}</div>` : `<p class="muted small">Nenhum cartão ainda. <a href="#/cartoes">Adicionar cartão</a></p>`}
      </article>

      <article class="panel">
        <header class="panel-head"><h2>Maiores gastos</h2><a class="small" href="#/transacoes">Ver todos</a></header>
        ${top.length ? `<ul class="rows compact">${top.map(rowCompact).join('')}</ul>` : '<p class="muted small">Nada por aqui ainda.</p>'}
      </article>
    </section>`;

  bindMonthNav(el, ctx);
  el.querySelector('[data-new]').onclick = () => openTransactionForm({ month: mk });
  el.querySelector('[data-salary]')?.addEventListener('click', () =>
    openTransactionForm({ preset: { type: 'income', recurring: true, category: 'salario', method: 'deposito', description: 'Salário' } }),
  );
  el.querySelector('[data-demo]')?.addEventListener('click', loadDemo);
  el.querySelectorAll('[data-tx]').forEach((r) =>
    r.addEventListener('click', () => openTransactionForm({ tx: state.transactions.find((t) => t.id === r.dataset.tx), month: mk })),
  );

  mountGroupedBars(el.querySelector('[data-chart]'), history, [
    { key: 'income', name: 'Entradas', color: 'var(--income)' },
    { key: 'expense', name: 'Saídas', color: 'var(--expense)' },
  ], {
    footer: (d) => `<div class="tip-row tip-total"><span>Saldo</span><b>${money(d.balance)}</b></div>`,
  });
}

function rowCompact(e) {
  return `<li><button class="row" data-tx="${esc(e.tx.id)}">
    <span class="row-main"><strong>${esc(e.tx.description)}</strong><span class="muted small">${esc(categoryName(e.tx.category))} · ${fmtDate(e.date)}${e.installment ? ` · ${e.installment}/${e.installments}` : ''}</span></span>
    <span class="num">${money(e.amount)}</span>
  </button></li>`;
}
