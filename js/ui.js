import { esc, monthLabel, addMonths, currentMonth } from './utils.js';
import { icon } from './icons.js';

export function toast(message, kind = 'info') {
  const root = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.innerHTML = `${icon(kind === 'error' ? 'alert' : 'check', 16)}<span>${esc(message)}</span>`;
  root.appendChild(el);
  setTimeout(() => el.classList.add('out'), 3200);
  setTimeout(() => el.remove(), 3600);
}

/**
 * Abre um modal. `onMount(modalEl, close)` recebe o elemento para ligar eventos.
 */
export function openModal({ title, body, onMount, onClose, size = '' }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal ${size}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <header class="modal-head">
        <h2 id="modal-title">${esc(title)}</h2>
        <button class="icon-btn" type="button" data-close aria-label="Fechar">${icon('x')}</button>
      </header>
      <div class="modal-body">${body}</div>
    </div>`;
  const lastFocus = document.activeElement;
  document.body.appendChild(backdrop);
  document.body.classList.add('no-scroll');
  const modal = backdrop.querySelector('.modal');

  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };
  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    onClose?.();
    backdrop.classList.add('closing');
    setTimeout(() => {
      backdrop.remove();
      if (!document.querySelector('.modal-backdrop')) document.body.classList.remove('no-scroll');
      lastFocus?.focus?.();
    }, 140);
  }
  document.addEventListener('keydown', onKey);
  backdrop.addEventListener('mousedown', (e) => {
    if (e.target === backdrop) close();
  });
  modal.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  onMount?.(modal, close);
  requestAnimationFrame(() => modal.querySelector('[autofocus], input:not([type=hidden]), select, button:not([data-close])')?.focus());
  return close;
}

export function confirmDialog({ title, message, confirmText = 'Confirmar', danger = false }) {
  return new Promise((resolve) => {
    let result = false;
    openModal({
      title,
      size: 'modal-sm',
      body: `<p class="muted">${esc(message)}</p>
        <div class="form-actions">
          <button class="btn btn-ghost" type="button" data-close>Cancelar</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" type="button" data-yes autofocus>${esc(confirmText)}</button>
        </div>`,
      onMount(m, close) {
        m.querySelector('[data-yes]').onclick = () => { result = true; close(); };
      },
      onClose: () => resolve(result),
    });
  });
}

export function monthNav(month) {
  const isCurrent = month === currentMonth();
  return `
    <div class="month-nav" role="group" aria-label="Mês">
      <button class="icon-btn" type="button" data-month="-1" aria-label="Mês anterior">${icon('chevL')}</button>
      <button class="month-label" type="button" data-month="0" title="Voltar ao mês atual">${monthLabel(month)}${isCurrent ? '' : '<small>voltar a hoje</small>'}</button>
      <button class="icon-btn" type="button" data-month="1" aria-label="Próximo mês">${icon('chevR')}</button>
    </div>`;
}
export function bindMonthNav(root, ctx) {
  root.querySelectorAll('[data-month]').forEach((b) =>
    b.addEventListener('click', () => {
      const d = Number(b.dataset.month);
      ctx.setMonth(d === 0 ? currentMonth() : addMonths(ctx.month, d));
    }),
  );
}

export const emptyState = (title, text, action = '') => `
  <div class="empty">
    <div class="empty-mark">${icon('wallet', 22)}</div>
    <strong>${esc(title)}</strong>
    <p>${esc(text)}</p>
    ${action}
  </div>`;
