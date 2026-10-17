// Activity: a live, logs-style stream of every receipt for my rules, newest first, grouped by day.
import { useEffect, useRef, useState } from 'react';
import { I } from '../ui/icons.jsx';
import { Empty, Panel, Seg, StateIcon, cx, useNow } from '../ui/kit.jsx';
import { resultText } from '../ui/rules.jsx';
import { set, useStore } from '../lib/store.js';
import { go } from '../lib/router.js';
import { blockTime, short } from '../lib/format.js';
import { ConnectFirst } from './Rules.jsx';

const dayOf = d => {
  if (!d) return 'Earlier';
  const t = new Date();
  const k = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const n = Math.round((k(t) - k(d)) / 864e5);
  return n === 0 ? 'Today' : n === 1 ? 'Yesterday' : n < 7 ? 'This week' : 'Earlier';
};

export function Activity() {
  const { wallet, receipts, rules, clock, live, rulesLoaded } = useStore();
  const [f, setF] = useState('all');
  const [paused, setPaused] = useState(null);
  const seen = useRef(new Set(receipts.map(r => r.key)));
  useNow(15000);
  useEffect(() => set({ unseen: 0 }), [receipts.length]);
  if (!wallet) return <ConnectFirst what="your receipts" />;
  const src = paused || receipts;
  const list = src.filter(r => f === 'all' || r.status === f);
  const ruleOf = k => rules.find(r => r.key.toLowerCase() === k.toLowerCase());
  const groups = {};
  list.forEach(r => (groups[dayOf(blockTime(r.firedAt, clock))] ||= []).push(r));
  const fresh = r => !seen.current.has(r.key) && (seen.current.add(r.key), true);
  return (
    <div className="page" style={{ maxWidth: 920 }}>
      <div className="ph">
        <div>
          <h1>Activity</h1>
          <p>Every receipt for your rules, as workers write them. Each one is signed on Arkiv by the worker that fired it.</p>
        </div>
        <div className="acts">
          <span className={cx('pill-ind', live === 'live' && !paused && 'live')} style={{ '--c': paused ? 'var(--amber)' : live === 'live' ? 'var(--green)' : 'var(--text-4)' }}>
            <i />
            {paused ? 'Paused' : live === 'live' ? 'Live' : 'Connecting'}
          </span>
          <button className="btn btn-secondary" onClick={() => setPaused(p => (p ? null : receipts))}>
            <I n={paused ? 'play' : 'pause'} s={14} />
            {paused ? 'Resume' : 'Pause'}
          </button>
        </div>
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        <Seg
          value={f}
          onChange={setF}
          label="Filter receipts"
          options={[
            ['all', 'All', src.length],
            ['ok', 'Delivered', src.filter(r => r.status === 'ok').length],
            ['failed', 'Failed', src.filter(r => r.status === 'failed').length || ''],
            ['skipped', 'Skipped', src.filter(r => r.status === 'skipped').length || ''],
          ]}
        />
        {paused && receipts.length > paused.length && (
          <button className="btn btn-sm btn-ghost" style={{ marginLeft: 8 }} onClick={() => setPaused(null)}>
            {receipts.length - paused.length} new
          </button>
        )}
      </div>
      {list.length ? (
        Object.entries(groups).map(([day, rows]) => (
          <div key={day} style={{ marginBottom: 14 }}>
            <div className="day-h" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', margin: '0 0 6px 2px' }}>
              {day}
            </div>
            <Panel body={false}>
              {rows.map(r => {
                const d = blockTime(r.firedAt, clock);
                return (
                  <button key={r.key} className={cx('arow', fresh(r) && rulesLoaded && 'new')} onClick={() => go('rules/' + r.rule)}>
                    <time>{d ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '—'}</time>
                    <StateIcon state={r.status === 'ok' ? 'fired' : r.status === 'failed' ? 'failed' : 'skipped'} />
                    <span className="trunc">
                      <b style={{ fontWeight: 500 }}>{ruleOf(r.rule)?.name || 'Deleted rule'}</b> <span className="res">· {resultText(r)}</span>
                    </span>
                    <span className="hide-sm faint mono" style={{ fontSize: 11.5 }}>
                      {r.firedAt >= r.deadline ? `+${r.firedAt - r.deadline} blk` : ''}
                    </span>
                    <span className="hide-sm mono faint" style={{ fontSize: 11.5, textAlign: 'right' }}>
                      {short(r.worker)}
                    </span>
                  </button>
                );
              })}
            </Panel>
          </div>
        ))
      ) : (
        <Panel>
          <Empty icon="activity" title={f === 'all' ? 'No receipts yet' : 'Nothing here'} text={f === 'all' ? 'When a worker fires one of your rules, its receipt streams in here without a refresh.' : 'No receipts with this status.'} />
        </Panel>
      )}
    </div>
  );
}
