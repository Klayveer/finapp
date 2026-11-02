import * as store from './store.js';
import { state, mode } from './store.js';
import { icon } from './icons.js';
import { toast } from './ui.js';
import { currentMonth, esc } from './utils.js';
import { renderLogin, logo } from './views/login.js';
import { renderDashboard } from './views/dashboard.js';
import { renderTransactions } from './views/transactions.js';
import { renderCards } from './views/cards.js';
import { renderSettings } from './views/settings.js';

const app = document.getElementById('app');

const ROUTES = {
  painel: { label: 'Painel', icon: 'dashboard', render: renderDashboard },
  transacoes: { label: 'Transações', icon: 'swap', render: renderTransactions },
  cartoes: { label: 'Cartões', icon: 'card', render: renderCards },
  ajustes: { label: 'Ajustes', icon: 'settings', render: renderSettings },
};

const ctx = {
  month: currentMonth(),
  setMonth(m) {
    ctx.month = m;
    render();
  },
  refresh: () => render(),
  logout: async () => {
    await store.auth.signOut();
    unsubscribe?.();
    unsubscribe = null;
    location.hash = '';
    showLogin();
  },
};

let unsubscribe = null;
let main = null;

store.onError((err) => toast(err.message || 'Falha ao salvar. Tente de novo.', 'error'));

function currentRoute() {
  const key = location.hash.replace(/^#\/?/, '').split('?')[0];
  return ROUTES[key] ? key : 'painel';
}

function render() {
  if (!main) return;
  const key = currentRoute();
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === key));
  document.title = `${ROUTES[key].label} · FinApp`;
  const scroll = window.scrollY;
  const sameRoute = main.dataset.route === key;
  main.dataset.route = key;
  ROUTES[key].render(main, ctx);
  window.scrollTo(0, sameRoute ? scroll : 0);
}

function showLogin() {
  main = null;
  renderLogin(app, { onLoggedIn: enter });
}

async function enter() {
  app.innerHTML = '<div class="boot"><span class="spinner"></span></div>';
  try {
    await store.loadData();
  } catch (err) {
    app.innerHTML = `<div class="boot"><div class="panel"><strong>Não foi possível carregar seus dados</strong><p class="muted">${esc(err.message)}</p><button class="btn btn-primary" onclick="location.reload()">Tentar novamente</button></div></div>`;
    return;
  }
  showShell();
}

function showShell() {
  const nav = Object.entries(ROUTES)
    .map(([k, r]) => `<a href="#/${k}" data-nav="${k}">${icon(r.icon, 20)}<span>${r.label}</span></a>`)
    .join('');
  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <a class="brand" href="#/painel">${logo()}<span>FinApp</span></a>
        <nav class="nav" aria-label="Principal">${nav}</nav>
        <div class="sidebar-foot">
          <span class="user-pill" title="${esc(state.user.email)}">${icon(mode === 'cloud' ? 'cloud' : 'device', 14)}<span>${esc(state.user.email)}</span></span>
          <button class="icon-btn" data-logout aria-label="Sair" title="Sair">${icon('logout')}</button>
        </div>
      </aside>
      <main class="main" id="main"></main>
      <nav class="tabbar" aria-label="Principal">${nav}</nav>
    </div>`;
  main = document.getElementById('main');
  app.querySelector('[data-logout]').onclick = ctx.logout;
  unsubscribe?.();
  unsubscribe = store.subscribe(render);
  render();
}

window.addEventListener('hashchange', render);

(async function boot() {
  try {
    const user = await store.auth.restore();
    if (user) return enter();
  } catch (err) {
    console.error(err);
  }
  showLogin();
})();
