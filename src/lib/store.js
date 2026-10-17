// One app-wide store. Everything comes from Arkiv: a snapshot on load, then one WebSocket feed
// (the SDK's watch) for receipts and rules, and a slow poll for heartbeats and the block clock.
// Nothing here needs a server.
import { useSyncExternalStore } from 'react';
import { createPublicClient } from '@arkiv-network/sdk';
import { tiramisu } from '@arkiv-network/sdk/chains';
import { http } from 'viem';
import { DEFAULT_RPC_URL, createTriggers } from 'arkiv-triggers';
import { forgetWallet, restoreWallet } from './wallet.js';
import { sameAddr } from './format.js';

export const APP = 'triggers-dashboard';
const PREFS_KEY = 'trg.prefs';
const TG_KEY = 'trg.telegram';
const DRAFTS_KEY = 'trg.drafts';

const read = (k, d) => {
  try {
    return JSON.parse(localStorage.getItem(k) || 'null') ?? d;
  } catch {
    return d;
  }
};
const write = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* storage blocked: keep it in memory */
  }
};

let state = {
  wallet: null,
  restoring: true,
  balance: null,
  clock: null,
  rules: [],
  rulesLoaded: false,
  receipts: [],
  workers: [],
  workersLoaded: false,
  live: 'off',
  error: null,
  /** Arkiv is answering 429 to this browser (its anonymous read budget is used up). */
  limited: false,
  rulesError: null,
  prefs: { theme: 'system', accent: 'indigo', defaultWorker: 'any', ...read(PREFS_KEY, {}) },
  telegram: read(TG_KEY, null),
  drafts: read(DRAFTS_KEY, []),
  /** Receipts that arrived while the person was not on the Activity page. */
  unseen: 0,
  ui: { palette: false, modal: null, collapsed: false, mnav: false },
};
const subs = new Set();
export const getState = () => state;
export function set(patch) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  subs.forEach(f => f());
}
export const setUi = patch => set(s => ({ ui: { ...s.ui, ...patch } }));
export function useStore(sel = s => s) {
  return useSyncExternalStore(
    f => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => sel(state),
  );
}

/** Reads need no wallet; writes use the connected one. A browser cannot hold an access key, so reads use
 * Arkiv's anonymous budget. viem retries are off: with them a 429 waits out Retry-After and looks frozen
 * (friction #10); without them it fails in about a second, and the store retries on its own schedule. */
const rpcEnv = import.meta.env.VITE_ARKIV_RPC_URL;
export const RPC_URL = rpcEnv ? (rpcEnv.startsWith('/') ? location.origin + rpcEnv : rpcEnv) : DEFAULT_RPC_URL;
const publicClient = createPublicClient({ chain: tiramisu, transport: http(RPC_URL, { retryCount: 0, timeout: 20_000 }) });
const reader = createTriggers({ app: APP, publicClient });
let writer = null;
const isLimit = e => /429|ANON_COST_LIMITED|QUOTA_EXCEEDED|rate-limit/i.test(`${e?.status} ${e?.details} ${e?.message}`);
const ok = () => state.limited && set({ limited: false });
const failed = e => set({ error: e, limited: isLimit(e) || state.limited });
export const triggers = () => writer || reader;

export function setPrefs(p) {
  set(s => ({ prefs: { ...s.prefs, ...p } }));
  write(PREFS_KEY, state.prefs);
}
export function setTelegram(t) {
  set({ telegram: t });
  write(TG_KEY, t);
}
export function saveDraft(d) {
  const drafts = [d, ...state.drafts.filter(x => x.id !== d.id)].slice(0, 20);
  set({ drafts });
  write(DRAFTS_KEY, drafts);
}
export function dropDraft(id) {
  const drafts = state.drafts.filter(x => x.id !== id);
  set({ drafts });
  write(DRAFTS_KEY, drafts);
}

// ---- public data: clock and workers -------------------------------------------------------------

export async function loadClock() {
  try {
    const c = await reader.clock();
    set({ clock: { block: c.block, timeMs: c.timeMs, blockMs: (c.blockSeconds || 2) * 1000 } });
    ok();
  } catch (e) {
    failed(e);
  }
}
export async function loadWorkers() {
  try {
    set({ workers: await reader.listWorkers(), workersLoaded: true });
    ok();
  } catch (e) {
    failed(e);
  }
}

// ---- my data: rules and receipts ------------------------------------------------------------------

export async function loadMine() {
  const me = state.wallet?.address;
  if (!me) return;
  try {
    const [rules, receipts] = await Promise.all([reader.listRules({ creator: me }), reader.listReceipts({ creator: me })]);
    if (!sameAddr(state.wallet?.address, me)) return;
    set({ rules, receipts, rulesLoaded: true, rulesError: null });
    ok();
  } catch (e) {
    failed(e);
    set({ rulesError: isLimit(e) ? 'Arkiv is limiting reads from this browser right now.' : 'Arkiv did not answer.' });
  }
}
export async function loadBalance() {
  const me = state.wallet?.address;
  if (!me) return;
  try {
    set({ balance: await reader.reader.getBalance({ address: me }) });
  } catch {
    /* balance is a nicety */
  }
}

let stopWatch = null;
const receiptListeners = new Set();
/** Called for every receipt that arrives live (toasts use it). */
export const onLiveReceipt = f => (receiptListeners.add(f), () => receiptListeners.delete(f));

function startWatch() {
  stopWatch?.();
  const me = state.wallet?.address;
  if (!me) return;
  set({ live: 'connecting' });
  stopWatch = reader.watch({
    creator: me,
    minIntervalMs: 8000,
    onStatus: s => set({ live: s }),
    onRule: r => {
      if (state.rules.some(x => sameAddr(x.key, r.key))) return;
      void loadMine();
    },
    onReceipt: r => {
      if (state.receipts.some(x => x.key === r.key)) return;
      set(s => ({
        receipts: [r, ...s.receipts],
        rules: s.rules.map(x =>
          sameAddr(x.key, r.rule) ? { ...x, receipts: [r, ...x.receipts], status: r.status === 'failed' && x.status !== 'fired' ? 'failed' : 'fired' } : x,
        ),
        unseen: s.unseen + 1,
      }));
      receiptListeners.forEach(f => f(r));
      void loadBalance();
    },
    onError: () => {},
  });
}

// ---- wallet ---------------------------------------------------------------------------------------

export function adoptWallet(w) {
  writer = createTriggers({ wallet: w.client, app: APP, publicClient });
  set({ wallet: w, rules: [], receipts: [], rulesLoaded: false, rulesError: null, balance: null, unseen: 0, error: null });
  void loadMine();
  void loadBalance();
  startWatch();
  w.provider?.on?.('accountsChanged', a => {
    if (!a?.length) disconnect();
    else if (!sameAddr(a[0], state.wallet?.address)) location.reload();
  });
}
export function disconnect() {
  stopWatch?.();
  stopWatch = null;
  writer = null;
  forgetWallet();
  set({ wallet: null, rules: [], receipts: [], rulesLoaded: false, balance: null, live: 'off' });
}

// ---- writes ---------------------------------------------------------------------------------------

/** Publishes one or more rules in one transaction, then reloads them from Arkiv. */
export async function publishRules(inputs) {
  const t = triggers();
  const res = inputs.length === 1 ? await t.createRule(inputs[0]) : await t.createRules(inputs);
  const keys = res.keys || [res.key];
  await loadMine();
  void loadBalance();
  return { keys, txHash: res.txHash, warnings: res.warnings };
}
export async function deleteRule(key) {
  const res = await triggers().deleteRule(key);
  set(s => ({ rules: s.rules.filter(r => !sameAddr(r.key, key)) }));
  void loadBalance();
  return res;
}

// ---- boot -----------------------------------------------------------------------------------------

let booted = false;
export function boot() {
  if (booted) return;
  booted = true;
  void loadClock();
  void loadWorkers();
  setInterval(loadClock, 30_000);
  setInterval(loadWorkers, 30_000);
  setInterval(() => state.wallet && loadBalance(), 60_000);
  setInterval(() => state.wallet && (!state.rulesLoaded || state.rulesError) && loadMine(), 30_000);
  restoreWallet()
    .then(w => w && adoptWallet(w))
    .catch(() => {})
    .finally(() => set({ restoring: false }));
}
