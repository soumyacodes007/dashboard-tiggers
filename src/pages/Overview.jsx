// Overview: before a wallet, what Triggers is and three ways to start; after, what's next and what fired.
import { TEMPLATES } from 'arkiv-triggers';
import { I } from '../ui/icons.jsx';
import { Addr, Empty, Panel, StateIcon, Stat, cx, useNow } from '../ui/kit.jsx';
import { ActTag, resultText, receiptTone, whenInfo } from '../ui/rules.jsx';
import { setUi, useStore } from '../lib/store.js';
import { go, href } from '../lib/router.js';
import { DOCS, FAUCET, MONL, WDL, ago, blockTime, greeting, ruleState, span, when } from '../lib/format.js';

const TPL_ICONS = { 'expiry-telegram': ['clock', 'send'], 'time-webhook': ['calendar', 'webhook'], 'keep-alive': ['hourglass', 'refresh-cw'] };
const TPL_TEXT = {
  'expiry-telegram': ['When an entity expires', 'Telegram me'],
  'time-webhook': ['At a date and time', 'Call my webhook'],
  'keep-alive': ['1 day before it expires', 'Extend it 30 days'],
};
export function pickTemplate(id) {
  sessionStorage.setItem('trg.template', id);
  go('rules/new');
}

function Templates() {
  return (
    <div className="grid3">
      {TEMPLATES.map(t => (
        <button key={t.id} className="panel tpl" onClick={() => pickTemplate(t.id)}>
          <div className="flow">
            <span>
              <I n={TPL_ICONS[t.id][0]} s={15} />
              {TPL_TEXT[t.id][0]}
            </span>
            <span className="arrow">
              <I n="arrow-right" s={13} style={{ transform: 'rotate(90deg)' }} />
            </span>
            <span>
              <I n={TPL_ICONS[t.id][1]} s={15} />
              {TPL_TEXT[t.id][1]}
            </span>
          </div>
          <p>{t.description}</p>
        </button>
      ))}
    </div>
  );
}

function WorkersPanel() {
  const { workers, workersLoaded, wallet } = useStore();
  useNow(5000);
  const list = [...workers].sort((a, b) => Number(b.online) - Number(a.online)).slice(0, 5);
  return (
    <Panel
      title="Workers"
      body={false}
      acts={
        <a className="btn btn-sm btn-ghost" href={href('workers')}>
          All workers
        </a>
      }
    >
      {list.length ? (
        list.map(w => (
          <div key={w.key} className="lrow static">
            <span className="pdot" style={{ '--c': w.online ? 'var(--green)' : 'var(--text-4)', borderRadius: '50%' }} />
            <Addr a={w.worker} you={wallet && w.operatorVerified && w.operator?.toLowerCase() === wallet.address.toLowerCase()} />
            <span className="sp" />
            <span className="row faint" style={{ gap: 6 }}>
              {w.actions.includes('telegram') && <I n="send" s={13} />}
              {w.actions.includes('webhook') && <I n="webhook" s={13} />}
            </span>
            <span className="faint" style={{ fontSize: 12, width: 64, textAlign: 'right' }}>
              {w.online ? 'online' : 'offline'}
            </span>
          </div>
        ))
      ) : (
        <div className="panel-b">
          <Empty sm icon="server" title={workersLoaded ? 'No workers online' : 'Looking for workers…'} text={workersLoaded ? 'Rules wait safely until a worker comes back.' : 'Reading heartbeats from Arkiv.'} />
        </div>
      )}
    </Panel>
  );
}

function Landing() {
  const { workers } = useStore();
  const online = workers.filter(w => w.online);
  return (
    <div className="page">
      <div className="hero">
        <span className="pill-ind live" style={{ '--c': online.length ? 'var(--green)' : 'var(--text-4)' }}>
          <i />
          {online.length ? `${online.length} worker${online.length > 1 ? 's' : ''} online on Tiramisu` : 'Arkiv Tiramisu testnet'}
        </span>
        <h1>Do something when data on Arkiv changes.</h1>
        <p>Arkiv sends no event when an entity expires. Write a rule, and an open network of workers fires it at the right block and leaves a signed receipt anyone can check.</p>
        <div className="acts">
          <button className="btn btn-primary btn-lg" onClick={() => setUi({ modal: { type: 'connect' } })}>
            <I n="wallet" s={15} />
            Connect wallet
          </button>
          <a className="btn btn-secondary btn-lg" href={DOCS} target="_blank" rel="noreferrer">
            <I n="book-open" s={15} />
            Read the docs
          </a>
        </div>
      </div>
      <div className="row" style={{ marginBottom: 10 }}>
        <h2 className="sec">Start from a template</h2>
      </div>
      <Templates />
      <div className="row" style={{ margin: '28px 0 10px' }}>
        <h2 className="sec">How it works</h2>
      </div>
      <div className="grid3" style={{ marginBottom: 16 }}>
        {[
          ['01', 'You write a rule', 'Rules are entities on Arkiv, signed by your wallet. No server, no account: your wallet is the account.'],
          ['02', 'A worker fires it', 'Workers watch deadlines, take a 60-second claim so a rule fires once, and run one action from a fixed menu.'],
          ['03', 'A receipt proves it', 'Each action leaves a signed receipt on Arkiv with the worker as its creator. Anyone can audit it.'],
        ].map(([n, t, d]) => (
          <div key={n} className="panel howto">
            <span className="n">{n}</span>
            <h3>{t}</h3>
            <p>{d}</p>
          </div>
        ))}
      </div>
      <WorkersPanel />
    </div>
  );
}

function Checklist() {
  const { wallet, balance, telegram, rules, receipts } = useStore();
  const items = [
    ['Connect a wallet', !!wallet, null],
    ['Get test GLM', balance != null && balance > 0n, <a key="f" className="btn btn-sm btn-secondary" href={FAUCET} target="_blank" rel="noreferrer">Faucet</a>],
    ['Connect Telegram', !!telegram, <a key="t" className="btn btn-sm btn-secondary" href={href('connections')}>Connect</a>],
    ['Create your first rule', rules.length > 0, <a key="r" className="btn btn-sm btn-secondary" href={href('rules/new')}>Create</a>],
    ['See a rule fire', receipts.length > 0, null],
  ];
  const done = items.filter(i => i[1]).length;
  if (done === items.length) return null;
  return (
    <Panel title="Get started" acts={<span className="faint num" style={{ fontSize: 12 }}>{done} of {items.length}</span>}>
      <div className="prog" style={{ marginBottom: 10 }} role="progressbar" aria-valuenow={done} aria-valuemax={items.length}>
        <i style={{ '--p': done / items.length }} />
      </div>
      <div className="checks">
        {items.map(([t, ok, btn], i) => (
          <div key={t} className={cx('c row', ok && 'ok')} style={{ minHeight: 30 }}>
            <I n={ok ? 'circle-check' : 'circle-dashed'} s={15} style={{ color: ok ? 'var(--green)' : 'var(--text-4)' }} />
            <span className="grow" style={ok ? { color: 'var(--text-3)', textDecoration: 'line-through' } : { color: 'var(--text)' }}>
              {t}
            </span>
            {!ok && items.slice(0, i).every(x => x[1]) && btn}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Dashboard() {
  const { rules, receipts, workers, clock, rulesLoaded, rulesError } = useStore();
  useNow(1000);
  const now = new Date();
  const states = rules.map(r => ruleState(r, clock));
  const active = rules.filter((_, i) => states[i] === 'active' || states[i] === 'firing');
  const next = [...active].sort((a, b) => (a.deadline < b.deadline ? -1 : 1));
  const weekAgo = Date.now() - 7 * 864e5;
  const recent = receipts.filter(r => (blockTime(r.firedAt, clock) || 0) >= weekAgo);
  const failed = rules.filter((_, i) => states[i] === 'failed');
  const online = workers.filter(w => w.online);
  const firstD = next[0] && blockTime(next[0].deadline, clock);
  const ruleOf = k => rules.find(r => r.key.toLowerCase() === k.toLowerCase());
  return (
    <div className="page">
      <div className="ph">
        <div>
          <h1>{greeting()}</h1>
          <p>
            <span className="num">
              {WDL[now.getDay()]}, {MONL[now.getMonth()]} {now.getDate()}
            </span>{' '}
            · {active.length ? `${active.length} rule${active.length > 1 ? 's' : ''} waiting to fire on Tiramisu.` : 'Nothing is scheduled yet.'}
          </p>
        </div>
        <div className="acts">
          <a className="btn btn-secondary hide-m" href={href('activity')}>
            <I n="activity" s={14} />
            Activity
          </a>
          <a className="btn btn-primary" href={href('rules/new')}>
            <I n="plus" s={14} />
            New rule
          </a>
        </div>
      </div>
      <div className="stats" style={{ marginBottom: 16 }}>
        <Stat icon="zap" k="Active rules" v={active.length} d={firstD ? `next in ${span(firstD - Date.now())}` : 'none scheduled'} onClick={() => go('rules')} />
        <Stat icon="circle-check" k="Fired" v={recent.filter(r => r.status !== 'failed').length} d="last 7 days" tone="up" onClick={() => go('activity')} />
        <Stat icon="circle-x" k="Failed" v={failed.length} vStyle={failed.length ? { color: 'var(--red)' } : undefined} d={failed.length ? 'need attention' : 'all delivered'} tone={failed.length ? 'bad' : ''} onClick={() => go('rules')} />
        <Stat icon="server" k="Workers online" v={online.length} d={`${online.filter(w => w.actions.includes('telegram')).length} can send Telegram`} onClick={() => go('workers')} />
      </div>
      <div className="grid2">
        <div className="stack">
          <Panel
            title="Next to fire"
            body={false}
            acts={
              <a className="btn btn-sm btn-ghost" href={href('rules')}>
                All rules
              </a>
            }
          >
            {next.length ? (
              next.slice(0, 6).map(r => {
                const w = whenInfo(r, clock);
                return (
                  <a key={r.key} className="lrow" href={href('rules/' + r.key)}>
                    <StateIcon state={w.st} />
                    <span className="grow trunc">{r.name || 'Untitled rule'}</span>
                    <span className="hide-m">
                      <ActTag action={r.action} />
                    </span>
                    <span className="cd" style={{ width: 92, textAlign: 'right', fontSize: 12.5, color: w.st === 'firing' ? 'var(--amber)' : 'var(--text-2)' }}>
                      {w.top}
                    </span>
                  </a>
                );
              })
            ) : (
              <div className="panel-b">
                <Empty sm icon="timer" title={rulesLoaded ? 'Nothing scheduled' : rulesError ? "Couldn't load your rules" : 'Loading your rules…'} text={rulesLoaded ? 'Rules you create show up here with a live countdown.' : rulesError ? 'Retrying on its own in a moment.' : 'Reading them from Arkiv.'}>
                  {rulesLoaded && (
                    <a className="btn btn-primary btn-sm" href={href('rules/new')}>
                      <I n="plus" s={14} />
                      New rule
                    </a>
                  )}
                </Empty>
              </div>
            )}
          </Panel>
          <Panel
            title="Recent receipts"
            body={false}
            acts={
              <a className="btn btn-sm btn-ghost" href={href('activity')}>
                View all
              </a>
            }
          >
            {receipts.length ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="perm-t" style={{ minWidth: 520 }}>
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: 14, textAlign: 'left' }}>Rule</th>
                      <th style={{ textAlign: 'left' }}>Result</th>
                      <th style={{ textAlign: 'left' }}>Fired</th>
                      <th style={{ textAlign: 'right', paddingRight: 14 }}>Worker</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipts.slice(0, 6).map(x => (
                      <tr key={x.key} style={{ cursor: 'pointer' }} onClick={() => go('rules/' + x.rule)}>
                        <td style={{ paddingLeft: 14, textAlign: 'left' }}>
                          <b style={{ fontWeight: 500 }}>{ruleOf(x.rule)?.name || 'Deleted rule'}</b>
                        </td>
                        <td style={{ textAlign: 'left' }}>
                          <span className={`badge ${receiptTone(x.status)}`}>
                            <span className="dot" />
                            {resultText(x).slice(0, 32)}
                          </span>
                        </td>
                        <td style={{ textAlign: 'left' }} className="muted num">
                          {when(blockTime(x.firedAt, clock))}
                        </td>
                        <td style={{ textAlign: 'right', paddingRight: 14 }} className="mono faint">
                          {x.worker.slice(0, 6)}…{x.worker.slice(-4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="panel-b">
                <Empty sm icon="receipt" title="No receipts yet" text="When a worker fires one of your rules, its signed receipt lands here." />
              </div>
            )}
          </Panel>
        </div>
        <div className="stack">
          <Checklist />
          <Panel
            title="Live activity"
            acts={
              <a className="btn btn-sm btn-ghost" href={href('activity')}>
                Open
              </a>
            }
          >
            {receipts.length ? (
              <div className="feed lined">
                {receipts.slice(0, 6).map(x => (
                  <div key={x.key} className="fitem" style={{ cursor: 'pointer' }} onClick={() => go('rules/' + x.rule)}>
                    <StateIcon state={x.status === 'ok' ? 'fired' : x.status === 'failed' ? 'failed' : 'skipped'} />
                    <div className="grow">
                      <b>{ruleOf(x.rule)?.name || 'A rule'}</b> <span className="muted">fired ·</span> <span className="muted">{resultText(x)}</span>
                    </div>
                    <time>{ago(blockTime(x.firedAt, clock))}</time>
                  </div>
                ))}
              </div>
            ) : (
              <p className="faint" style={{ fontSize: 12.5, margin: 0 }}>
                Receipts appear here the moment a worker writes them.
              </p>
            )}
          </Panel>
          <WorkersPanel />
        </div>
      </div>
    </div>
  );
}

export function Overview() {
  const { wallet, restoring } = useStore();
  if (restoring) return <div className="page" />;
  return wallet ? <Dashboard /> : <Landing />;
}
