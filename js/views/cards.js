import { state } from '../store.js';
import { invoice, usedLimit, accruedPoints, expiryStatus, openInvoiceMonth } from '../finance.js';
import { money, esc, int, fmtDate, fmtExpiry, monthLabel, addMonths } from '../utils.js';
import { cardGradient, categoryName } from '../catalog.js';
import { meter } from '../charts.js';
import { emptyState } from '../ui.js';
import { openCardForm, openTransactionForm } from '../forms.js';
import { icon } from '../icons.js';

let selectedId = null;
let invoiceOffset = 0; // 0 = fatura aberta

export function renderCards(el, ctx) {
  const qid = new URLSearchParams(location.hash.split('?')[1] || '').get('id');
  if (qid && state.cards.some((c) => c.id === qid)) {
    if (selectedId !== qid) invoiceOffset = 0;
    selectedId = qid;
  }
  if (!state.cards.some((c) => c.id === selectedId)) selectedId = state.cards[0]?.id || null;
  const card = state.cards.find((c) => c.id === selectedId);

  const totalLimit = state.cards.reduce((a, c) => a + (Number(c.limit) || 0), 0);
  const totalUsed = state.cards.reduce((a, c) => a + usedLimit(state, c), 0);
  const totalPoints = state.cards.reduce((a, c) => a + accruedPoints(state, c), 0);

  el.innerHTML = `
    <header class="page-head">
      <div>
        <p class="eyebrow">Cartões</p>
        <h1>Seus cartões</h1>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost" data-new-card>${icon('plus', 16)}<span class="hide-sm">Cartão</span></button>
        ${state.cards.length ? `<button class="btn btn-primary" data-new-purchase>${icon('card', 16)}<span class="hide-sm">Nova compra</span></button>` : ''}
      </div>
    </header>

    ${state.cards.length
      ? `
    <section class="stat-strip">
      <div><span class="muted small">Limite total</span><strong>${money(totalLimit)}</strong></div>
      <div><span class="muted small">Comprometido</span><strong>${money(totalUsed)}</strong></div>
      <div><span class="muted small">Pontos acumulados (est.)</span><strong>${int(totalPoints)}</strong></div>
    </section>

    <section class="cc-rail" role="tablist" aria-label="Cartões">
      ${state.cards.map((c) => ccVisual(c, c.id === selectedId)).join('')}
      <button class="cc cc-add" data-new-card>${icon('plus', 20)}<span>Adicionar cartão</span></button>
    </section>

    ${card ? detail(card) : ''}`
      : `<section class="panel">${emptyState('Nenhum cartão cadastrado', 'Adicione seus cartões com limite, fechamento, vencimento e programa de pontos.', `<button class="btn btn-primary" data-new-card>${icon('plus', 16)} Adicionar cartão</button>`)}</section>`}
  `;

  el.querySelectorAll('[data-new-card]').forEach((b) =>
    b.addEventListener('click', () => openCardForm({ onSaved: (c) => { selectedId = c.id; invoiceOffset = 0; location.hash = '#/cartoes'; ctx.refresh(); } })),
  );
  el.querySelectorAll('[data-select]').forEach((b) =>
    b.addEventListener('click', () => {
      selectedId = b.dataset.select;
      invoiceOffset = 0;
      if (location.hash !== '#/cartoes') history.replaceState(null, '', '#/cartoes');
      renderCards(el, ctx);
    }),
  );
  el.querySelector('[data-new-purchase]')?.addEventListener('click', () =>
    openTransactionForm({ preset: { type: 'expense', method: 'cartao', cardId: selectedId, category: 'compras' } }),
  );
  el.querySelector('[data-edit-card]')?.addEventListener('click', () => openCardForm({ card }));
  el.querySelectorAll('[data-inv]').forEach((b) =>
    b.addEventListener('click', () => {
      const d = Number(b.dataset.inv);
      invoiceOffset = d === 0 ? 0 : invoiceOffset + d;
      renderCards(el, ctx);
    }),
  );
  el.querySelectorAll('[data-tx]').forEach((r) =>
    r.addEventListener('click', () => openTransactionForm({ tx: state.transactions.find((t) => t.id === r.dataset.tx) })),
  );
}

function ccVisual(c, active) {
  const exp = expiryStatus(c);
  return `<button class="cc ${active ? 'active' : ''}" role="tab" aria-selected="${active}" data-select="${esc(c.id)}" style="background:${cardGradient(c.color)}">
    <span class="cc-top"><span class="cc-brand">${esc(c.brand)}</span>${c.miles ? `<span class="cc-miles">${icon('plane', 12)}</span>` : ''}</span>
    <span class="cc-chip"></span>
    <span class="cc-name">${esc(c.name)}</span>
    <span class="cc-bottom"><span class="cc-num">•••• ${esc(c.last4 || '----')}</span><span class="cc-exp ${exp ? 'warn' : ''}">${fmtExpiry(c.expiry)}</span></span>
  </button>`;
}

function detail(card) {
  const open = openInvoiceMonth(card);
  const mk = addMonths(open, invoiceOffset);
  const inv = invoice(state, card, mk);
  const used = usedLimit(state, card);
  const limit = Number(card.limit) || 0;
  const exp = expiryStatus(card);
  const points = accruedPoints(state, card);
  const statusLabel = { aberta: 'Fatura aberta', fechada: 'Fatura fechada', futura: 'Próxima fatura' }[inv.status];

  return `
  <section class="grid-card">
    <article class="panel">
      <header class="panel-head">
        <h2>${esc(card.name)}</h2>
        <button class="btn btn-ghost btn-sm" data-edit-card>${icon('edit', 14)} Editar</button>
      </header>
      ${exp ? `<p class="notice ${exp.level}">${icon('alert', 14)} ${exp.label}: validade ${fmtExpiry(card.expiry)}</p>` : ''}
      ${limit
        ? `<div class="limit">
          <div class="row-between"><span class="muted small">Limite usado</span><span class="small"><strong>${money(used)}</strong> de ${money(limit)}</span></div>
          ${meter(used, limit, { label: 'Limite usado' })}
          <div class="row-between"><span class="muted small">Disponível</span><strong>${money(Math.max(0, limit - used))}</strong></div>
        </div>`
        : '<p class="muted small">Sem limite cadastrado.</p>'}
      <dl class="facts">
        <div><dt>Bandeira</dt><dd>${esc(card.brand)}</dd></div>
        <div><dt>Final</dt><dd>${esc(card.last4 || '—')}</dd></div>
        <div><dt>Validade</dt><dd>${fmtExpiry(card.expiry)}</dd></div>
        <div><dt>Fecha dia</dt><dd>${card.closingDay}</dd></div>
        <div><dt>Vence dia</dt><dd>${card.dueDay}</dd></div>
        <div><dt>Melhor dia de compra</dt><dd>${card.closingDay}</dd></div>
      </dl>
      ${card.miles
        ? `<div class="miles">
          <div class="miles-icon">${icon('plane', 18)}</div>
          <div><strong>${int(points)} pontos</strong><span class="muted small">acumulados (estimativa)${card.program ? ` · ${esc(card.program)}` : ''}</span></div>
          <span class="chip">${esc(String(card.pointsPerUnit).replace('.', ','))} pt / ${card.pointsUnit === 'BRL' ? 'R$ 1' : 'US$ 1'}</span>
        </div>`
        : '<p class="muted small">Este cartão não acumula pontos.</p>'}
    </article>

    <article class="panel panel-flush">
      <header class="invoice-head">
        <div class="month-nav">
          <button class="icon-btn" data-inv="-1" aria-label="Fatura anterior">${icon('chevL')}</button>
          <button class="month-label" data-inv="0">${esc(monthLabel(mk))}${invoiceOffset ? '<small>ir para a aberta</small>' : ''}</button>
          <button class="icon-btn" data-inv="1" aria-label="Próxima fatura">${icon('chevR')}</button>
        </div>
        <div class="invoice-total">
          <span class="badge ${inv.status}">${statusLabel}</span>
          <strong>${money(inv.total)}</strong>
          <span class="muted small">Fecha ${fmtDate(inv.closing)} · vence ${fmtDate(inv.due)}${card.miles ? ` · ${int(inv.points)} pts` : ''}</span>
        </div>
      </header>
      ${inv.entries.length
        ? `<ul class="rows">${inv.entries
            .map(
              (e) => `<li><button class="row" data-tx="${esc(e.tx.id)}">
              <span class="row-main"><strong>${esc(e.tx.description)}${e.recurring ? ` <span class="tag">${icon('repeat', 11)} fixo</span>` : ''}</strong>
              <span class="muted small">${fmtDate(e.tx.date)} · ${esc(categoryName(e.tx.category))}${e.installment ? ` · parcela ${e.installment}/${e.installments}` : ''}</span></span>
              <span class="num">${money(e.amount)}</span>
            </button></li>`,
            )
            .join('')}</ul>`
        : `<div class="pad">${emptyState('Fatura vazia', 'Nenhuma compra nesta fatura.', '')}</div>`}
    </article>
  </section>`;
}
