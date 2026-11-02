import { CONFIG } from './config.js';
import { uid } from './utils.js';

const DEFAULT_SETTINGS = { id: 'settings', dollarRate: 5.5 };

export const state = {
  user: null,
  cards: [],
  transactions: [],
  settings: { ...DEFAULT_SETTINGS },
};

export const cloudEnabled = Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);
export const mode = cloudEnabled ? 'cloud' : 'local';

const listeners = new Set();
const errorListeners = new Set();
export const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));
export const onError = (fn) => errorListeners.add(fn);
const emit = () => listeners.forEach((fn) => fn());
const fail = (err) => errorListeners.forEach((fn) => fn(err));

/* ------------------------------------------------------------------ */
/* Backend local (localStorage)                                        */
/* ------------------------------------------------------------------ */
const LS = {
  account: 'finapp:account',
  session: 'finapp:session',
  data: (email) => `finapp:data:${email}`,
};
const readLS = (k, fallback) => {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};
const writeLS = (k, v) => localStorage.setItem(k, JSON.stringify(v));

async function sha256(text) {
  if (!crypto.subtle) throw new Error('Abra o app via https ou localhost para usar o login.');
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const local = {
  hasAccount: () => Boolean(readLS(LS.account)),
  async getUser() {
    const s = readLS(LS.session);
    const a = readLS(LS.account);
    return s && a && s.email === a.email ? { id: 'local', email: a.email } : null;
  },
  async signUp(email, password) {
    if (readLS(LS.account)) throw new Error('Já existe uma conta neste navegador. Entre com ela.');
    const salt = uid();
    writeLS(LS.account, { email, salt, hash: await sha256(salt + password) });
    writeLS(LS.session, { email });
    return { user: { id: 'local', email } };
  },
  async signIn(email, password) {
    const a = readLS(LS.account);
    if (!a || a.email !== email || a.hash !== (await sha256(a.salt + password))) throw new Error('E-mail ou senha incorretos.');
    writeLS(LS.session, { email });
    return { user: { id: 'local', email } };
  },
  async signOut() {
    localStorage.removeItem(LS.session);
  },
  async load() {
    return readLS(LS.data(state.user.email), { cards: [], transactions: [], settings: {} });
  },
  async persist() {
    writeLS(LS.data(state.user.email), { cards: state.cards, transactions: state.transactions, settings: state.settings });
  },
  upsert() { return this.persist(); },
  remove() { return this.persist(); },
  replaceAll() { return this.persist(); },
};

/* ------------------------------------------------------------------ */
/* Backend nuvem (Supabase)                                            */
/* ------------------------------------------------------------------ */
let sb = null;
async function client() {
  if (!sb) {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
    sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  }
  return sb;
}
const ok = ({ data, error }) => {
  if (error) throw new Error(translateError(error.message));
  return data;
};
function translateError(msg = '') {
  if (/invalid login/i.test(msg)) return 'E-mail ou senha incorretos.';
  if (/email not confirmed/i.test(msg)) return 'Confirme seu e-mail antes de entrar (veja sua caixa de entrada).';
  if (/already registered/i.test(msg)) return 'Este e-mail já tem conta. Use "Entrar".';
  if (/password should be/i.test(msg)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/signups not allowed/i.test(msg)) return 'Novos cadastros estão desativados neste app.';
  if (/failed to fetch/i.test(msg)) return 'Sem conexão com o servidor. Verifique sua internet.';
  return msg || 'Algo deu errado.';
}
const toRow = (kind, rec) => ({ user_id: state.user.id, id: rec.id, kind, data: rec, updated_at: new Date().toISOString() });

const cloud = {
  hasAccount: () => true,
  async getUser() {
    const c = await client();
    const { data } = await c.auth.getSession();
    const u = data.session?.user;
    return u ? { id: u.id, email: u.email } : null;
  },
  async signUp(email, password) {
    const c = await client();
    const data = ok(await c.auth.signUp({ email, password }));
    if (!data.session) return { needsConfirmation: true };
    return { user: { id: data.user.id, email: data.user.email } };
  },
  async signIn(email, password) {
    const c = await client();
    const data = ok(await c.auth.signInWithPassword({ email, password }));
    return { user: { id: data.user.id, email: data.user.email } };
  },
  async signOut() {
    const c = await client();
    await c.auth.signOut();
  },
  async load() {
    const c = await client();
    const result = { cards: [], transactions: [], settings: {} };
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const rows = ok(await c.from('records').select('id,kind,data').order('id').range(from, from + PAGE - 1));
      for (const r of rows) {
        if (r.kind === 'settings') result.settings = r.data;
        else if (result[r.kind]) result[r.kind].push(r.data);
      }
      if (rows.length < PAGE) break;
    }
    return result;
  },
  async upsert(kind, rec) {
    const c = await client();
    ok(await c.from('records').upsert(toRow(kind, rec), { onConflict: 'user_id,id' }));
  },
  async remove(kind, id) {
    const c = await client();
    ok(await c.from('records').delete().eq('id', id));
  },
  async replaceAll() {
    const c = await client();
    ok(await c.from('records').delete().eq('user_id', state.user.id));
    const rows = [
      ...state.cards.map((r) => toRow('cards', r)),
      ...state.transactions.map((r) => toRow('transactions', r)),
      toRow('settings', state.settings),
    ];
    for (let i = 0; i < rows.length; i += 500) ok(await c.from('records').insert(rows.slice(i, i + 500)));
  },
};

const backend = cloudEnabled ? cloud : local;

/* ------------------------------------------------------------------ */
/* API pública                                                         */
/* ------------------------------------------------------------------ */
export const auth = {
  hasLocalAccount: () => local.hasAccount(),
  async restore() {
    state.user = await backend.getUser();
    return state.user;
  },
  async signIn(email, password) {
    const r = await backend.signIn(email.trim().toLowerCase(), password);
    state.user = r.user;
    return r;
  },
  async signUp(email, password) {
    const r = await backend.signUp(email.trim().toLowerCase(), password);
    if (r.user) state.user = r.user;
    return r;
  },
  async signOut() {
    await backend.signOut();
    state.user = null;
    state.cards = [];
    state.transactions = [];
    state.settings = { ...DEFAULT_SETTINGS };
  },
};

function applyData(d) {
  state.cards = Array.isArray(d.cards) ? d.cards : [];
  state.transactions = Array.isArray(d.transactions) ? d.transactions : [];
  state.settings = { ...DEFAULT_SETTINGS, ...(d.settings || {}), id: 'settings' };
}

export async function loadData() {
  applyData(await backend.load());
  emit();
}

async function persist(fn, rollback) {
  try {
    await fn();
  } catch (err) {
    rollback?.();
    emit();
    fail(err);
    throw err;
  }
}

export async function upsert(kind, rec) {
  const list = state[kind];
  const now = new Date().toISOString();
  const i = list.findIndex((x) => x.id === rec.id);
  const prev = i >= 0 ? list[i] : null;
  const next = { ...prev, ...rec, id: rec.id || uid(), updatedAt: now, createdAt: prev?.createdAt || rec.createdAt || now };
  if (i >= 0) list[i] = next;
  else list.push(next);
  emit();
  await persist(
    () => backend.upsert(kind, next),
    () => {
      const j = list.findIndex((x) => x.id === next.id);
      if (prev) list[j] = prev;
      else list.splice(j, 1);
    },
  );
  return next;
}

export async function remove(kind, id) {
  const list = state[kind];
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) return;
  const [prev] = list.splice(i, 1);
  emit();
  await persist(() => backend.remove(kind, id), () => list.splice(i, 0, prev));
}

export async function saveSettings(patch) {
  const prev = state.settings;
  state.settings = { ...prev, ...patch, id: 'settings' };
  emit();
  await persist(() => backend.upsert('settings', state.settings), () => (state.settings = prev));
}

export async function replaceAll(data) {
  const prev = { cards: state.cards, transactions: state.transactions, settings: state.settings };
  applyData(data);
  emit();
  await persist(() => backend.replaceAll(), () => applyData(prev));
}

export const exportData = () => ({
  app: 'finapp',
  version: 1,
  exportedAt: new Date().toISOString(),
  cards: state.cards,
  transactions: state.transactions,
  settings: state.settings,
});
