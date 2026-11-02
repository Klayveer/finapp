import * as store from '../store.js';
import { state, mode } from '../store.js';
import { esc, money } from '../utils.js';
import { confirmDialog, toast } from '../ui.js';
import { icon } from '../icons.js';
import { loadDemo } from '../demo.js';

export function renderSettings(el, ctx) {
  const theme = (() => { try { return localStorage.getItem('finapp:theme') || 'system'; } catch { return 'system'; } })();

  el.innerHTML = `
    <header class="page-head"><div><p class="eyebrow">Ajustes</p><h1>Preferências</h1></div></header>

    <section class="settings">
      <article class="panel">
        <header class="panel-head"><h2>Conta</h2></header>
        <div class="setting">
          <div><strong>${esc(state.user.email)}</strong>
          <span class="muted small">${mode === 'cloud' ? 'Sincronizado na nuvem (Supabase)' : 'Modo local · dados apenas neste navegador'}</span></div>
          <button class="btn btn-ghost" data-logout>${icon('logout', 16)} Sair</button>
        </div>
      </article>

      <article class="panel">
        <header class="panel-head"><h2>Aparência</h2></header>
        <div class="setting">
          <div><strong>Tema</strong><span class="muted small">Segue o sistema por padrão</span></div>
          <div class="seg" role="radiogroup" aria-label="Tema">
            ${[['system', 'Sistema'], ['light', 'Claro'], ['dark', 'Escuro']].map(([v, l]) => `<button type="button" data-theme-opt="${v}" class="${theme === v ? 'on' : ''}">${l}</button>`).join('')}
          </div>
        </div>
      </article>

      <article class="panel">
        <header class="panel-head"><h2>Milhas</h2></header>
        <form class="setting" data-dollar>
          <div><strong>Cotação do dólar</strong><span class="muted small">Usada para estimar pontos de cartões que pontuam por US$. Atual: ${money(state.settings.dollarRate)}</span></div>
          <div class="inline-form">
            <div class="amount-input sm"><em>R$</em><input name="rate" type="number" step="0.01" min="0.01" value="${esc(state.settings.dollarRate)}" aria-label="Cotação do dólar"></div>
            <button class="btn btn-ghost" type="submit">Salvar</button>
          </div>
        </form>
      </article>

      <article class="panel">
        <header class="panel-head"><h2>Dados</h2></header>
        <div class="setting">
          <div><strong>Exportar backup</strong><span class="muted small">${state.transactions.length} lançamentos · ${state.cards.length} cartões, em um arquivo JSON</span></div>
          <button class="btn btn-ghost" data-export>${icon('download', 16)} Exportar</button>
        </div>
        <div class="setting">
          <div><strong>Importar backup</strong><span class="muted small">Substitui todos os dados atuais pelos do arquivo</span></div>
          <label class="btn btn-ghost">${icon('upload', 16)} Importar<input type="file" accept="application/json,.json" data-import hidden></label>
        </div>
        <div class="setting">
          <div><strong>Dados de exemplo</strong><span class="muted small">Preenche o app com um mês fictício para explorar</span></div>
          <button class="btn btn-ghost" data-demo>Carregar</button>
        </div>
        <div class="setting">
          <div><strong>Apagar tudo</strong><span class="muted small">Remove todos os lançamentos e cartões</span></div>
          <button class="btn btn-ghost btn-danger-text" data-wipe>${icon('trash', 16)} Apagar</button>
        </div>
      </article>
    </section>`;

  el.querySelector('[data-logout]').onclick = () => ctx.logout();

  el.querySelectorAll('[data-theme-opt]').forEach((b) =>
    b.addEventListener('click', () => {
      const v = b.dataset.themeOpt;
      try { localStorage.setItem('finapp:theme', v); } catch { /* */ }
      if (v === 'system') delete document.documentElement.dataset.theme;
      else document.documentElement.dataset.theme = v;
      renderSettings(el, ctx);
    }),
  );

  el.querySelector('[data-dollar]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const rate = Number(e.target.elements.rate.value);
    if (!(rate > 0)) return toast('Informe uma cotação válida', 'error');
    try {
      await store.saveSettings({ dollarRate: rate });
      toast('Cotação atualizada', 'success');
    } catch { /* */ }
  });

  el.querySelector('[data-export]').onclick = () => {
    const blob = new Blob([JSON.stringify(store.exportData(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `finapp-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  el.querySelector('[data-import]').onchange = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data.app !== 'finapp' || !Array.isArray(data.transactions) || !Array.isArray(data.cards)) throw new Error('Arquivo não é um backup do FinApp.');
      const okImp = await confirmDialog({
        title: 'Importar backup?',
        message: `${data.transactions.length} lançamentos e ${data.cards.length} cartões vão substituir os dados atuais.`,
        confirmText: 'Importar',
      });
      if (!okImp) return;
      await store.replaceAll(data);
      toast('Backup importado', 'success');
    } catch (err) {
      toast(err.message || 'Não foi possível importar', 'error');
    }
  };

  el.querySelector('[data-demo]').onclick = loadDemo;

  el.querySelector('[data-wipe]').onclick = async () => {
    const okWipe = await confirmDialog({
      title: 'Apagar todos os dados?',
      message: 'Lançamentos e cartões serão removidos. Exporte um backup antes se quiser guardar.',
      confirmText: 'Apagar tudo',
      danger: true,
    });
    if (!okWipe) return;
    try {
      await store.replaceAll({ cards: [], transactions: [], settings: state.settings });
      toast('Dados apagados', 'success');
    } catch { /* */ }
  };
}
