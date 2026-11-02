import { auth, mode } from '../store.js';
import { esc } from '../utils.js';
import { icon } from '../icons.js';

export function renderLogin(root, { onLoggedIn }) {
  let isSignUp = mode === 'local' && !auth.hasLocalAccount();

  const draw = (message = '', kind = 'error') => {
    root.innerHTML = `
    <main class="auth">
      <div class="auth-card">
        <div class="brand brand-lg">${logo()}<span>FinApp</span></div>
        <h1>${isSignUp ? 'Criar sua conta' : 'Bem-vindo de volta'}</h1>
        <p class="muted">${isSignUp ? 'Seus dados financeiros, protegidos por senha.' : 'Entre para ver suas finanças.'}</p>
        <form class="form" novalidate>
          <label class="field"><span>E-mail</span><input class="input" type="email" name="email" autocomplete="email" required autofocus></label>
          <label class="field"><span>Senha</span><input class="input" type="password" name="password" autocomplete="${isSignUp ? 'new-password' : 'current-password'}" minlength="6" required></label>
          ${isSignUp ? '<label class="field"><span>Confirmar senha</span><input class="input" type="password" name="confirm" autocomplete="new-password" required></label>' : ''}
          ${message ? `<p class="${kind === 'error' ? 'form-error' : 'form-info'}" role="alert">${esc(message)}</p>` : ''}
          <button class="btn btn-primary btn-block" type="submit">${isSignUp ? 'Criar conta' : 'Entrar'}</button>
        </form>
        ${mode === 'cloud' ? `<button class="link-btn" type="button" data-toggle>${isSignUp ? 'Já tenho conta · Entrar' : 'Primeiro acesso? Criar conta'}</button>` : ''}
        <div class="auth-mode">
          ${mode === 'cloud'
            ? `${icon('cloud', 14)}<span>Conta na nuvem · seus dados sincronizam entre dispositivos</span>`
            : `${icon('device', 14)}<span>Modo local · dados salvos apenas neste navegador. Veja o README para ativar a nuvem.</span>`}
        </div>
      </div>
    </main>`;

    const form = root.querySelector('form');
    root.querySelector('[data-toggle]')?.addEventListener('click', () => {
      isSignUp = !isSignUp;
      draw();
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = form.elements.email.value.trim();
      const password = form.elements.password.value;
      if (!/^\S+@\S+\.\S+$/.test(email)) return draw('Digite um e-mail válido.');
      if (password.length < 6) return draw('A senha precisa ter pelo menos 6 caracteres.');
      if (isSignUp && password !== form.elements.confirm.value) return draw('As senhas não conferem.');
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner sm"></span>';
      try {
        if (isSignUp) {
          const r = await auth.signUp(email, password);
          if (r.needsConfirmation) {
            isSignUp = false;
            return draw('Conta criada! Confirme pelo link enviado ao seu e-mail e depois entre.', 'info');
          }
        } else {
          await auth.signIn(email, password);
        }
        onLoggedIn();
      } catch (err) {
        draw(err.message || 'Não foi possível entrar.');
        root.querySelector('[name=email]').value = email;
      }
    });
  };
  draw();
}

export const logo = () =>
  `<svg width="28" height="28" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="16" fill="currentColor"/><path d="M20 44V20h24M20 32h16" stroke="var(--bg)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;
