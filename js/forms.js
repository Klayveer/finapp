import * as store from './store.js';
import { state } from './store.js';
import { openModal, confirmDialog, toast } from './ui.js';
import { esc, todayISO, money, monthOf, addMonths, uid, monthLabel } from './utils.js';
import { icon } from './icons.js';
import {
  EXPENSE_CATEGORIES, INCOME_CATEGORIES, EXPENSE_METHODS, INCOME_METHODS, METHODS,
  CARD_BRANDS, CARD_COLORS, cardGradient, MILES_PROGRAMS,
} from './catalog.js';
import { invoiceMonth } from './finance.js';

const options = (list, selected) =>
  list.map((o) => `<option value="${esc(o.value)}" ${o.value === selected ? 'selected' : ''}>${esc(o.label)}</option>`).join('');

/* ------------------------------------------------------------------ */
/* Transação                                                           */
/* ------------------------------------------------------------------ */
/**
 * @param {object} opts
 *  - tx: transação existente (edição)
 *  - preset: { type, method, cardId, recurring, category }
 *  - month: mês em exibição (para "encerrar recorrência")
 */
export function openTransactionForm({ tx = null, preset = {}, month } = {}) {
  const editing = Boolean(tx);
  const t = {
    type: 'expense',
    amount: '',
    description: '',
    date: todayISO(),
    category: '',
    method: 'pix',
    cardId: state.cards[0]?.id || '',
    installments: 1,
    recurring: false,
    endMonth: '',
    notes: '',
    ...preset,
    ...(tx || {}),
  };
  if (preset.method === 'cartao' && !t.cardId) t.cardId = state.cards[0]?.id || '';

  const title = editing ? 'Editar lançamento' : t.recurring && t.type === 'income' ? 'Nova renda recorrente' : 'Novo lançamento';

  openModal({
    title,
    body: `
    <form class="form" novalidate>
      <div class="seg seg-full" role="radiogroup" aria-label="Tipo">
        <button type="button" role="radio" data-type="expense">${icon('down', 16)} Saída</button>
        <button type="button" role="radio" data-type="income">${icon('up', 16)} Entrada</button>
      </div>

      <label class="field field-amount">
        <span>Valor</span>
        <div class="amount-input"><em>R$</em><input name="amount" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0,00" value="${esc(t.amount)}" required autofocus></div>
      </label>

      <label class="field"><span>Descrição</span>
        <input class="input" name="description" maxlength="80" placeholder="Ex.: Mercado, Salário, Uber…" value="${esc(t.description)}" required autocomplete="off" list="desc-suggestions">
        <datalist id="desc-suggestions">${[...new Set(state.transactions.map((x) => x.description))].slice(0, 60).map((d) => `<option value="${esc(d)}">`).join('')}</datalist>
      </label>

      <div class="row2">
        <label class="field"><span data-date-label>Data</span><input class="input" type="date" name="date" value="${esc(t.date)}" required></label>
        <label class="field"><span>Categoria</span><select class="input" name="category"></select></label>
      </div>

      <label class="field"><span>Forma de pagamento</span><select class="input" name="method"></select></label>

      <div class="row2" data-card-fields hidden>
        <label class="field"><span>Cartão</span><select class="input" name="cardId">${options(state.cards.map((c) => ({ value: c.id, label: c.name + (c.last4 ? ` ·· ${c.last4}` : '') })), t.cardId)}</select></label>
        <label class="field" data-installments><span>Parcelas</span><select class="input" name="installments">${options(Array.from({ length: 24 }, (_, i) => ({ value: String(i + 1), label: i === 0 ? 'À vista' : `${i + 1}x` })), String(t.installments || 1))}</select></label>
      </div>
      <p class="hint" data-card-hint hidden></p>

      <label class="switch">
        <input type="checkbox" name="recurring" ${t.recurring ? 'checked' : ''}>
        <span class="switch-ui"></span>
        <span><strong>Repetir todo mês</strong><small>Salário, aluguel, assinaturas…</small></span>
      </label>
      <label class="field" data-rec-fields hidden><span>Última ocorrência (opcional)</span><input class="input" type="month" name="endMonth" value="${esc(t.endMonth || '')}"></label>

      <label class="field"><span>Observação (opcional)</span><input class="input" name="notes" maxlength="140" value="${esc(t.notes || '')}"></label>

      <p class="form-error" role="alert" hidden></p>

      <div class="form-actions">
        ${editing ? `<button class="btn btn-ghost btn-danger-text" type="button" data-delete>${icon('trash', 16)} Excluir</button>` : ''}
        ${editing && t.recurring && month ? `<button class="btn btn-ghost" type="button" data-end>Encerrar em ${esc(monthLabel(month))}</button>` : ''}
        <span class="spacer"></span>
        <button class="btn btn-ghost" type="button" data-close>Cancelar</button>
        <button class="btn btn-primary" type="submit">${editing ? 'Salvar' : 'Adicionar'}</button>
      </div>
    </form>`,
    onMount(m, close) {
      const f = m.querySelector('form');
      const el = (n) => f.elements[n];
      let type = t.type;

      const sync = () => {
        m.querySelectorAll('[data-type]').forEach((b) => {
          b.classList.toggle('on', b.dataset.type === type);
          b.setAttribute('aria-checked', b.dataset.type === type);
        });
        const cats = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
        const curCat = el('category').value || t.category;
        el('category').innerHTML = options(cats.map((c) => ({ value: c.id, label: c.name })), cats.some((c) => c.id === curCat) ? curCat : cats[0].id);

        const methods = (type === 'income' ? INCOME_METHODS : EXPENSE_METHODS).filter((x) => x !== 'cartao' || state.cards.length);
        const curMethod = el('method').value || t.method;
        el('method').innerHTML = options(methods.map((x) => ({ value: x, label: METHODS[x] })), methods.includes(curMethod) ? curMethod : methods[0]);

        const isCard = type === 'expense' && el('method').value === 'cartao';
        const rec = el('recurring').checked;
        m.querySelector('[data-card-fields]').hidden = !isCard;
        m.querySelector('[data-installments]').hidden = rec;
        m.querySelector('[data-rec-fields]').hidden = !rec;
        m.querySelector('[data-date-label]').textContent = rec ? 'Primeira ocorrência' : isCard ? 'Data da compra' : 'Data';

        const hint = m.querySelector('[data-card-hint]');
        const card = state.cards.find((c) => c.id === el('cardId').value);
        if (isCard && card && el('date').value) {
          const inv = invoiceMonth(card, el('date').value);
          const n = rec ? 1 : Number(el('installments').value);
          const amount = Number(el('amount').value) || 0;
          hint.hidden = false;
          hint.innerHTML = `Entra na fatura de <strong>${esc(monthLabel(inv))}</strong>${n > 1 ? ` até ${esc(monthLabel(addMonths(inv, n - 1)))} · ${n}x de ${money(amount / n)}` : ''}.`;
        } else hint.hidden = true;
      };
      sync();

      m.querySelectorAll('[data-type]').forEach((b) => b.addEventListener('click', () => { type = b.dataset.type; sync(); }));
      ['method', 'recurring', 'cardId', 'installments', 'date', 'amount'].forEach((n) => el(n).addEventListener('input', sync));

      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const err = m.querySelector('.form-error');
        const amount = Math.round(Number(el('amount').value) * 100) / 100;
        const description = el('description').value.trim();
        const date = el('date').value;
        const problem = !(amount > 0) ? 'Informe um valor maior que zero.' : !description ? 'Dê uma descrição.' : !date ? 'Escolha a data.' : '';
        if (problem) {
          err.textContent = problem;
          err.hidden = false;
          return;
        }
        const method = el('method').value;
        const isCard = type === 'expense' && method === 'cartao';
        const recurring = el('recurring').checked;
        const endMonth = recurring ? el('endMonth').value || '' : '';
        if (endMonth && endMonth < monthOf(date)) {
          err.textContent = 'A última ocorrência não pode ser antes da primeira.';
          err.hidden = false;
          return;
        }
        const rec = {
          id: tx?.id || uid(),
          type,
          amount,
          description,
          date,
          category: el('category').value,
          method,
          cardId: isCard ? el('cardId').value : null,
          installments: isCard && !recurring ? Number(el('installments').value) : 1,
          recurring,
          endMonth,
          notes: el('notes').value.trim(),
        };
        close();
        try {
          await store.upsert('transactions', rec);
          toast(editing ? 'Lançamento atualizado' : 'Lançamento adicionado', 'success');
        } catch { /* erro já exibido */ }
      });

      m.querySelector('[data-delete]')?.addEventListener('click', async () => {
        const okDel = await confirmDialog({
          title: 'Excluir lançamento?',
          message: t.recurring ? 'Isso remove todas as ocorrências (passadas e futuras). Para manter o histórico, use "Encerrar".' : t.installments > 1 ? 'Isso remove todas as parcelas desta compra.' : 'Essa ação não pode ser desfeita.',
          confirmText: 'Excluir',
          danger: true,
        });
        if (!okDel) return;
        close();
        try {
          await store.remove('transactions', tx.id);
          toast('Lançamento excluído', 'success');
        } catch { /* */ }
      });

      m.querySelector('[data-end]')?.addEventListener('click', async () => {
        close();
        try {
          await store.upsert('transactions', { ...tx, endMonth: month });
          toast(`Recorrência encerrada em ${monthLabel(month)}`, 'success');
        } catch { /* */ }
      });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Cartão                                                              */
/* ------------------------------------------------------------------ */
export function openCardForm({ card = null, onSaved, onDeleted } = {}) {
  const editing = Boolean(card);
  const c = {
    name: '', brand: 'Mastercard', last4: '', expiry: '', limit: '', closingDay: 1, dueDay: 10,
    color: CARD_COLORS[state.cards.length % CARD_COLORS.length].id,
    miles: false, pointsPerUnit: 1, pointsUnit: 'USD', program: '',
    ...(card || {}),
  };
  const days = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: `Dia ${i + 1}` }));

  openModal({
    title: editing ? 'Editar cartão' : 'Novo cartão',
    body: `
    <form class="form" novalidate>
      <div class="cc-preview" style="background:${cardGradient(c.color)}" data-preview>
        <span class="cc-brand" data-p-brand>${esc(c.brand)}</span>
        <span class="cc-chip"></span>
        <span class="cc-name" data-p-name>${esc(c.name || 'Nome do cartão')}</span>
        <span class="cc-num" data-p-num>•••• ${esc(c.last4 || '0000')}</span>
      </div>

      <label class="field"><span>Nome do cartão</span><input class="input" name="name" maxlength="40" placeholder="Ex.: Nubank Ultravioleta" value="${esc(c.name)}" required autofocus></label>
      <div class="row2">
        <label class="field"><span>Bandeira</span><select class="input" name="brand">${options(CARD_BRANDS.map((b) => ({ value: b, label: b })), c.brand)}</select></label>
        <label class="field"><span>Final (4 dígitos)</span><input class="input" name="last4" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" placeholder="1234" value="${esc(c.last4)}"></label>
      </div>
      <div class="row2">
        <label class="field"><span>Validade</span><input class="input" type="month" name="expiry" value="${esc(c.expiry)}"></label>
        <label class="field"><span>Limite</span><div class="amount-input sm"><em>R$</em><input name="limit" type="number" inputmode="decimal" step="0.01" min="0" value="${esc(c.limit)}" placeholder="0,00"></div></label>
      </div>
      <div class="row2">
        <label class="field"><span>Fechamento da fatura</span><select class="input" name="closingDay">${options(days, String(c.closingDay))}</select></label>
        <label class="field"><span>Vencimento</span><select class="input" name="dueDay">${options(days, String(c.dueDay))}</select></label>
      </div>

      <fieldset class="field"><legend>Cor</legend>
        <div class="swatches">${CARD_COLORS.map((x) => `<label class="swatch" style="background:${cardGradient(x.id)}"><input type="radio" name="color" value="${x.id}" ${x.id === c.color ? 'checked' : ''} aria-label="${x.id}"></label>`).join('')}</div>
      </fieldset>

      <label class="switch">
        <input type="checkbox" name="miles" ${c.miles ? 'checked' : ''}>
        <span class="switch-ui"></span>
        <span><strong>Acumula pontos / milhas</strong><small>Calcula pontos gerados em cada fatura</small></span>
      </label>
      <div class="row3" data-miles hidden>
        <label class="field"><span>Pontos</span><input class="input" name="pointsPerUnit" type="number" step="0.1" min="0" value="${esc(c.pointsPerUnit)}"></label>
        <label class="field"><span>a cada</span><select class="input" name="pointsUnit">${options([{ value: 'USD', label: 'US$ 1' }, { value: 'BRL', label: 'R$ 1' }], c.pointsUnit)}</select></label>
        <label class="field"><span>Programa</span><input class="input" name="program" list="programs" value="${esc(c.program)}" placeholder="Livelo"><datalist id="programs">${MILES_PROGRAMS.map((p) => `<option value="${esc(p)}">`).join('')}</datalist></label>
      </div>

      <p class="form-error" role="alert" hidden></p>
      <div class="form-actions">
        ${editing ? `<button class="btn btn-ghost btn-danger-text" type="button" data-delete>${icon('trash', 16)} Excluir</button>` : ''}
        <span class="spacer"></span>
        <button class="btn btn-ghost" type="button" data-close>Cancelar</button>
        <button class="btn btn-primary" type="submit">${editing ? 'Salvar' : 'Adicionar cartão'}</button>
      </div>
    </form>`,
    onMount(m, close) {
      const f = m.querySelector('form');
      const el = (n) => f.elements[n];
      const sync = () => {
        m.querySelector('[data-miles]').hidden = !el('miles').checked;
        m.querySelector('[data-preview]').style.background = cardGradient(f.querySelector('[name=color]:checked')?.value);
        m.querySelector('[data-p-name]').textContent = el('name').value || 'Nome do cartão';
        m.querySelector('[data-p-brand]').textContent = el('brand').value;
        m.querySelector('[data-p-num]').textContent = `•••• ${el('last4').value || '0000'}`;
      };
      sync();
      f.addEventListener('input', sync);
      el('last4').addEventListener('input', () => (el('last4').value = el('last4').value.replace(/\D/g, '').slice(0, 4)));

      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const err = m.querySelector('.form-error');
        const name = el('name').value.trim();
        if (!name) {
          err.textContent = 'Dê um nome ao cartão.';
          err.hidden = false;
          return;
        }
        const rec = {
          id: card?.id || uid(),
          name,
          brand: el('brand').value,
          last4: el('last4').value,
          expiry: el('expiry').value,
          limit: Number(el('limit').value) || 0,
          closingDay: Number(el('closingDay').value),
          dueDay: Number(el('dueDay').value),
          color: f.querySelector('[name=color]:checked')?.value || 'graphite',
          miles: el('miles').checked,
          pointsPerUnit: Number(el('pointsPerUnit').value) || 0,
          pointsUnit: el('pointsUnit').value,
          program: el('program').value.trim(),
        };
        close();
        try {
          const saved = await store.upsert('cards', rec);
          toast(editing ? 'Cartão atualizado' : 'Cartão adicionado', 'success');
          onSaved?.(saved);
        } catch { /* */ }
      });

      m.querySelector('[data-delete]')?.addEventListener('click', async () => {
        const linked = state.transactions.filter((t) => t.cardId === card.id);
        const okDel = await confirmDialog({
          title: `Excluir ${card.name}?`,
          message: linked.length
            ? `As ${linked.length} compras deste cartão também serão excluídas.`
            : 'Essa ação não pode ser desfeita.',
          confirmText: 'Excluir cartão',
          danger: true,
        });
        if (!okDel) return;
        close();
        try {
          for (const t of linked) await store.remove('transactions', t.id);
          await store.remove('cards', card.id);
          toast('Cartão excluído', 'success');
          onDeleted?.();
        } catch { /* */ }
      });
    },
  });
}
