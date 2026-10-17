// Formatting: addresses, block heights as times, countdowns, and every rule as one plain sentence.
import { ACTIONS } from 'arkiv-triggers';

export const EXPLORER = 'https://tiramisu.explorer.arkiv.network';
export const FAUCET = 'https://hub.arkiv.network/faucet';
export const DOCS = 'https://github.com/soumyacodes007/arkiv-triggers#readme';
export const BLOCK_MS = 2000;

export const short = (a, n = 4) => (a ? `${a.slice(0, 2 + n)}…${a.slice(-n)}` : '');
export const lower = a => (a || '').toLowerCase();
export const sameAddr = (a, b) => !!a && !!b && lower(a) === lower(b);
export const addrUrl = a => `${EXPLORER}/address/${a}`;
export const txUrl = h => `${EXPLORER}/tx/${h}`;
export const fmtNum = n => Number(n).toLocaleString('en-US');

/** The block expected now, extrapolated from the last clock reading (2 s per block). */
export function headNow(clock) {
  if (!clock) return 0n;
  return clock.block + BigInt(Math.max(0, Math.floor((Date.now() - clock.timeMs) / (clock.blockMs || BLOCK_MS))));
}
export function blockTime(block, clock) {
  if (!clock || block == null) return null;
  return new Date(clock.timeMs + Number(BigInt(block) - clock.block) * (clock.blockMs || BLOCK_MS));
}
export function blockAt(date, clock) {
  const ms = +date - clock.timeMs;
  return clock.block + BigInt(Math.ceil(ms / (clock.blockMs || BLOCK_MS)));
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const WDL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function clockTime(d) {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
/** "5:00 PM", "Tomorrow 9:00 AM", "18 Oct, 5:00 PM". */
export function when(d) {
  if (!d) return '—';
  const now = new Date();
  const day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(now)) / 864e5);
  if (diff === 0) return clockTime(d);
  if (diff === 1) return `Tomorrow ${clockTime(d)}`;
  if (diff === -1) return `Yesterday ${clockTime(d)}`;
  return `${d.getDate()} ${MON[d.getMonth()]}, ${clockTime(d)}`;
}
export function tzName() {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value || '';
  } catch {
    return '';
  }
}

/** "2h 14m", "45s", "3d 2h". */
export function span(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}
export function ago(d) {
  if (!d) return '';
  const s = Math.round((Date.now() - d) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** How early a rule fires, as people say it. */
export function offsetText(blocks) {
  const b = Number(blocks || 0);
  if (!b) return '';
  return span(b * BLOCK_MS).replace(/ 0+[smh]$/, '').replace(/ 00s$/, '');
}

export const ACTION_ICON = { telegram: 'send', webhook: 'webhook', receipt: 'receipt', extend: 'hourglass' };
export const actionLabel = a => ACTIONS[a]?.label || a;

/** "When 0xab12…cd34 expires (1h early) → Telegram me". */
export function ruleSentence(r, opt = {}) {
  const t = r.trigger;
  const early = t?.offset ? ` (${offsetText(t.offset)} early)` : '';
  const whenText =
    t?.on === 'expire'
      ? t.target
        ? `When ${short(t.target, 4)} expires${early}`
        : `When an entity expires${early}`
      : t?.on === 'block'
        ? `At ${opt.clock ? when(blockTime(t.fireAt, opt.clock)) : 'block ' + fmtNum(t.fireAt)}${early}`
        : 'When…';
  const then = r.action === 'extend' && r.extendDays ? `extend it ${r.extendDays} days` : (actionLabel(r.action) || '…').replace(/^\w/, c => c.toLowerCase());
  return `${whenText} → ${then}`;
}

/** Status of a rule for display: what the person cares about, not the raw receipt. */
export function ruleState(rule, clock) {
  if (rule.status === 'fired') {
    const ok = rule.receipts.find(r => r.status === 'ok');
    return ok ? 'fired' : 'skipped';
  }
  if (rule.status === 'failed') return 'failed';
  if (rule.deadline == null) return 'waiting';
  return headNow(clock) >= rule.deadline ? 'firing' : 'active';
}
export const STATE = {
  active: { name: 'Active', c: 'var(--accent)', icon: 'circle-dot' },
  firing: { name: 'Firing', c: 'var(--amber)', icon: 'loader' },
  fired: { name: 'Fired', c: 'var(--green)', icon: 'circle-check' },
  skipped: { name: 'Skipped', c: 'var(--text-3)', icon: 'circle-slash' },
  failed: { name: 'Failed', c: 'var(--red)', icon: 'circle-x' },
  waiting: { name: 'Waiting', c: 'var(--text-3)', icon: 'circle-dashed' },
  draft: { name: 'Draft', c: 'var(--text-4)', icon: 'circle-dashed' },
};

/** JSON with bigints, for raw views and drafts. */
export const toJson = (v, space = 2) => JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? x.toString() : x), space);

export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}
