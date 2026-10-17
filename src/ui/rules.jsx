// Pieces every rule list shares: the sentence row, the "when" cell and the action tag.
import { I } from './icons.jsx';
import { Menu, MenuItem, StateIcon, copy, useNow } from './kit.jsx';
import { go, href } from '../lib/router.js';
import { ACTION_ICON, actionLabel, ago, blockTime, ruleSentence, ruleState, short, span, when } from '../lib/format.js';
import { setUi, useStore } from '../lib/store.js';

export function ActTag({ action }) {
  return (
    <span className="act-tag">
      <I n={ACTION_ICON[action] || 'zap'} s={14} />
      {actionLabel(action)}
    </span>
  );
}

/** What a person wants to know about timing: when it fires, or when it fired and how. */
export function whenInfo(rule, clock) {
  const st = ruleState(rule, clock);
  const last = rule.receipts?.[0];
  const d = blockTime(rule.deadline, clock);
  if (st === 'active') return { top: d ? `in ${span(d - Date.now())}` : '—', sub: d ? when(d) : '', st };
  if (st === 'firing') return { top: 'Firing now…', sub: d ? `due ${when(d)}` : '', st };
  if (st === 'waiting') return { top: 'Target not found', sub: 'expired or deleted', st };
  const fd = last ? blockTime(last.firedAt, clock) : null;
  if (st === 'failed') return { top: 'Failed', sub: last?.result?.error ? last.result.error.slice(0, 40) : fd ? ago(fd) : '', st };
  return { top: st === 'skipped' ? 'Skipped' : `Fired ${fd ? ago(fd) : ''}`, sub: last ? `by ${short(last.worker)}` : '', st };
}

export function RuleRow({ rule, onDelete }) {
  const clock = useStore(s => s.clock);
  useNow(1000);
  const w = whenInfo(rule, clock);
  return (
    <div className="rrow" role="link" tabIndex={0} onClick={() => go('rules/' + rule.key)} onKeyDown={e => e.key === 'Enter' && go('rules/' + rule.key)}>
      <StateIcon state={w.st} s={16} />
      <div style={{ minWidth: 0 }}>
        <div className="t trunc">{rule.name || 'Untitled rule'}</div>
        <div className="s trunc">{ruleSentence(rule, { clock })}</div>
      </div>
      <div className="hide-sm">
        <ActTag action={rule.action} />
      </div>
      <div className="w hide-sm">
        <span className="cd">{w.top}</span>
        <span className="m trunc">{w.sub}</span>
      </div>
      <div className="hide-sm faint mono" style={{ fontSize: 11.5 }}>
        {rule.worker === 'any' ? <span style={{ fontFamily: 'var(--font)', fontSize: 12.5 }}>Any worker</span> : short(rule.worker)}
      </div>
      <div onClick={e => e.stopPropagation()}>
        <Menu
          width={200}
          align="right"
          trigger={p => (
            <button className="ibtn ibtn-sm" {...p} aria-label="Rule options">
              <I n="ellipsis" s={15} />
            </button>
          )}
        >
          <MenuItem icon="arrow-right" href={href('rules/' + rule.key)}>
            Open
          </MenuItem>
          <MenuItem icon="copy-plus" onClick={() => duplicate(rule)}>
            Duplicate
          </MenuItem>
          <MenuItem icon="copy" onClick={() => copy(rule.key, 'Rule key copied')}>
            Copy rule key
          </MenuItem>
          {onDelete !== false && (
            <>
              <div className="msep" />
              <MenuItem icon="trash-2" danger onClick={() => setUi({ modal: { type: 'delete', rule } })}>
                Delete rule
              </MenuItem>
            </>
          )}
        </Menu>
      </div>
    </div>
  );
}

/** Opens the editor filled from an existing rule. */
export function duplicate(rule) {
  sessionStorage.setItem('trg.duplicate', JSON.stringify(rule, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
  go('rules/new');
}

/** A receipt in a few words: "Telegram sent", "200 OK in 182 ms", "Skipped: the target was deleted". */
export function resultText(r) {
  const x = r.result || {};
  if (r.status === 'skipped') return r.reason ? r.reason.replace(/^\w/, c => c.toUpperCase()) : 'Skipped';
  if (r.status === 'failed') return x.error ? `Failed: ${x.error}` : 'Failed';
  const ms = x.latencyMs != null ? ` in ${x.latencyMs} ms` : '';
  if (r.action === 'telegram') return `Telegram sent${ms}`;
  if (r.action === 'webhook') return `${x.code || 200} OK${ms}`;
  if (r.action === 'extend') return 'Target extended';
  return 'Receipt recorded';
}
export const receiptTone = s => (s === 'ok' ? 'green' : s === 'failed' ? 'red' : 'gray');
