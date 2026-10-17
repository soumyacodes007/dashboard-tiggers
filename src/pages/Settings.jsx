// Settings in gr8r's layout: account, appearance, linking your own worker, and the network.
import { useState } from 'react';
import { operatorMessage } from 'arkiv-triggers';
import { DEFAULT_RPC_URL, DEFAULT_WS_URL } from 'arkiv-triggers';
import { I } from '../ui/icons.jsx';
import { Addr, Blob, Code, Field, copy, cx, toast } from '../ui/kit.jsx';
import { disconnect, getState, setPrefs, setUi, useStore } from '../lib/store.js';
import { href } from '../lib/router.js';
import { EXPLORER, FAUCET, fmtNum, headNow, sameAddr } from '../lib/format.js';
import { forgetSessionKey, walletError } from '../lib/wallet.js';
import { glm } from '../shell/Shell.jsx';

const NAV = [
  ['Account', [['account', 'Wallet', 'wallet'], ['appearance', 'Appearance', 'sun']]],
  ['Workers', [['workers', 'My workers', 'server']]],
  ['Arkiv', [['network', 'Network', 'globe']]],
];
const srow = (t, d, ctl) => (
  <div className="srow">
    <div>
      <div className="t">{t}</div>
      {d && <div className="d">{d}</div>}
    </div>
    <div className="row">{ctl}</div>
  </div>
);

function Account() {
  const { wallet, balance } = useStore();
  if (!wallet)
    return (
      <div className="sblock" style={{ marginTop: 0 }}>
        {srow(
          'No wallet connected',
          'Connect one to create rules and see your receipts.',
          <button className="btn btn-primary" onClick={() => setUi({ modal: { type: 'connect' } })}>
            Connect wallet
          </button>,
        )}
      </div>
    );
  return (
    <>
      <div className="sblock" style={{ marginTop: 0 }}>
        <div className="row" style={{ gap: 14, marginBottom: 8 }}>
          <Blob a={wallet.address} size={44} />
          <div>
            <div className="mono" style={{ fontSize: 13 }}>
              {wallet.address}
            </div>
            <div className="faint" style={{ fontSize: 12.5, marginTop: 2 }}>
              {wallet.name} · {glm(balance)} test GLM
            </div>
          </div>
        </div>
        {srow(
          'Address',
          'Arkiv records it as the creator of every rule you make.',
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => copy(wallet.address, 'Address copied')}>
              <I n="copy" s={13} />
              Copy
            </button>
            <a className="btn btn-secondary btn-sm" href={`${EXPLORER}/address/${wallet.address}`} target="_blank" rel="noreferrer">
              <I n="arrow-up-right" s={13} />
              Explorer
            </a>
          </>,
        )}
        {srow(
          'Test GLM',
          'Each rule costs about 0.0001 test GLM to write. Free from the faucet.',
          <a className="btn btn-secondary btn-sm" href={FAUCET} target="_blank" rel="noreferrer">
            <I n="sparkles" s={13} />
            Open faucet
          </a>,
        )}
        {srow('Disconnect', 'Forget this wallet on this device. Your rules stay on Arkiv.', <button className="btn btn-secondary btn-sm" onClick={disconnect}>Disconnect</button>)}
      </div>
      {wallet.kind === 'session' && (
        <div className="sblock">
          <h2>Session wallet</h2>
          {srow(
            'Delete the session key',
            'The key exists only in this browser. Deleting it loses access to anything it owns, including its test GLM.',
            <button
              className="btn btn-danger-ghost btn-sm"
              style={{ border: '1px solid color-mix(in srgb,var(--red) 35%,transparent)' }}
              onClick={() => {
                disconnect();
                forgetSessionKey();
                toast('Session key deleted');
              }}
            >
              Delete key
            </button>,
          )}
        </div>
      )}
    </>
  );
}

function Appearance() {
  const { prefs } = useStore();
  const L = { bg: '#FBFAF8', s: '#F2F1EE', t: '#1D1C1A', b: '#E3E1DC', a: '#4B5BD6' };
  const Dk = { bg: '#1D1D1C', s: '#151514', t: '#ECEAE5', b: '#333230', a: '#8E9AF3' };
  const pv = c => (
    <>
      <div className="s" style={{ background: c.s }}>
        <i style={{ background: c.b, width: '70%' }} />
        <i style={{ background: c.a, width: '55%' }} />
        <i style={{ background: c.b, width: '80%' }} />
      </div>
      <div className="m" style={{ background: c.bg }}>
        <i style={{ background: c.t, width: '45%', height: 7 }} />
        <i style={{ background: c.b }} />
        <i style={{ background: c.a, width: '30%', height: 10, marginTop: 4 }} />
      </div>
    </>
  );
  return (
    <>
      <div className="sblock" style={{ marginTop: 0 }}>
        <h2>Theme</h2>
        <div className="themecards" style={{ marginTop: 12 }} role="radiogroup" aria-label="Theme">
          {[
            ['light', 'Light', 'sun'],
            ['dark', 'Dark', 'moon'],
            ['system', 'System', 'monitor'],
          ].map(([k, n, icon]) => (
            <button key={k} className={cx('tcard', prefs.theme === k && 'on')} role="radio" aria-checked={prefs.theme === k} onClick={() => setPrefs({ theme: k })}>
              <div className="tprev" style={k === 'system' ? { display: 'grid', gridTemplateColumns: '1fr 1fr' } : undefined}>
                {k === 'system' ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '30% 1fr' }}>{pv(L)}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '30% 1fr' }}>{pv(Dk)}</div>
                  </>
                ) : (
                  pv(k === 'light' ? L : Dk)
                )}
              </div>
              <span className="row" style={{ fontWeight: 500, fontSize: 13, gap: 6 }}>
                <I n={icon} s={14} />
                {n}
                {prefs.theme === k && (
                  <>
                    <span className="sp" />
                    <span style={{ color: 'var(--accent)' }}>
                      <I n="circle-check" s={15} />
                    </span>
                  </>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="sblock">
        <h2>Accent</h2>
        {srow(
          'Accent colour',
          'Used for links, selection and the primary button.',
          <div className="swatches">
            {[
              ['indigo', '#4b5bd6'],
              ['blue', '#2f6cd4'],
              ['violet', '#7348cc'],
              ['teal', '#1a7f7a'],
              ['rose', '#b93d68'],
              ['graphite', '#34332f'],
            ].map(([k, c]) => (
              <button key={k} type="button" className={cx('sw', prefs.accent === k && 'on')} style={{ '--c': c, width: 22, height: 22 }} onClick={() => setPrefs({ accent: k })} aria-label={k} />
            ))}
          </div>,
        )}
      </div>
    </>
  );
}

function MyWorkers() {
  const { wallet, workers } = useStore();
  const [addr, setAddr] = useState('');
  const [sig, setSig] = useState('');
  const [busy, setBusy] = useState(false);
  const linked = workers.filter(w => wallet && w.operatorVerified && sameAddr(w.operator, wallet.address));
  const valid = /^0x[0-9a-fA-F]{40}$/.test(addr.trim());
  const sign = async () => {
    setBusy(true);
    try {
      const w = getState().wallet;
      const s = await w.client.signMessage({ account: w.client.account || w.address, message: operatorMessage(addr.trim()) });
      setSig(s);
    } catch (e) {
      toast(walletError(e), { kind: 'err' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="sblock" style={{ marginTop: 0 }}>
        <h2>Linked workers</h2>
        {linked.length ? (
          linked.map(w => srow(<Addr a={w.worker} />, w.online ? 'Online · its heartbeat names you as operator, with your signature' : 'Offline', <span className={cx('badge', w.online ? 'green' : '')}>{w.online ? 'Online' : 'Offline'}</span>))
        ) : (
          <p className="faint" style={{ fontSize: 13, margin: '8px 0 0' }}>
            None yet. A linked worker shows up here, and as “My own worker” in the rule editor.
          </p>
        )}
      </div>
      <div className="sblock">
        <h2>Link a worker</h2>
        <p className="muted" style={{ fontSize: 13, margin: '6px 0 14px', lineHeight: 1.5, maxWidth: 560 }}>
          Your wallet signs “I operate worker 0x…”. The worker puts that signature in its heartbeat, so the dashboard can find it on Arkiv with no URL or port, and nobody can fake it.
        </p>
        {!wallet ? (
          <button className="btn btn-primary" onClick={() => setUi({ modal: { type: 'connect' } })}>
            Connect wallet
          </button>
        ) : (
          <div className="col" style={{ gap: 12, maxWidth: 560 }}>
            <Field label="Worker address" htmlFor="lw-addr" hint="Printed when the worker starts: “worker running as 0x…”">
              <div className="row" style={{ gap: 6 }}>
                <input id="lw-addr" className="input mono" style={{ fontSize: 12.5 }} placeholder="0x…" value={addr} onChange={e => (setAddr(e.target.value), setSig(''))} />
                <button className={cx('btn btn-primary', busy && 'is-loading')} disabled={!valid || busy} onClick={sign}>
                  Sign
                </button>
              </div>
            </Field>
            {sig && (
              <>
                <div className="field">
                  <span className="label">Add to the worker's .env, then restart it</span>
                  <Code>{`OPERATOR=${wallet.address}\nOPERATOR_SIG=${sig}\nWORKER_MODE=own`}</Code>
                </div>
                <div className="alert info">
                  <I n="info" s={15} />
                  <span>Both values are public; they only prove the link. The worker's own key stays on its server.</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function Network() {
  const { clock } = useStore();
  return (
    <div className="sblock" style={{ marginTop: 0 }}>
      {srow('Network', 'Arkiv testnet', <span className="badge accent">Tiramisu · 7738577</span>)}
      {srow('Current block', 'About 2 seconds per block', <span className="mono">{clock ? fmtNum(headNow(clock)) : '—'}</span>)}
      {srow('RPC', 'Read straight from the browser on the anonymous quota; no server in between', <span className="mono faint" style={{ fontSize: 12 }}>{DEFAULT_RPC_URL.replace('https://', '')}</span>)}
      {srow('Live feed', 'One WebSocket for receipts and rules', <span className="mono faint" style={{ fontSize: 12 }}>{DEFAULT_WS_URL.replace('wss://', '')}</span>)}
      {srow(
        'Explorer',
        'Every rule, claim and receipt is an entity you can inspect',
        <a className="btn btn-secondary btn-sm" href={EXPLORER} target="_blank" rel="noreferrer">
          <I n="arrow-up-right" s={13} />
          Open
        </a>,
      )}
    </div>
  );
}

export function Settings({ sec }) {
  const title = NAV.flatMap(g => g[1]).find(x => x[0] === sec) || NAV[0][1][0];
  const lead = {
    account: 'The wallet that signs your rules.',
    appearance: 'How Triggers looks on this device.',
    workers: 'Run your own worker and use it from this dashboard.',
    network: 'Where your rules live.',
  }[title[0]];
  return (
    <div className="set">
      <nav className="set-nav" aria-label="Settings">
        {NAV.map(([g, items]) => (
          <div key={g}>
            <div className="gh">{g}</div>
            {items.map(([k, n, icon]) => (
              <a key={k} className={cx('sitem', title[0] === k && 'on')} href={href('settings/' + k)}>
                <I n={icon} s={15} />
                <span>{n}</span>
              </a>
            ))}
          </div>
        ))}
      </nav>
      <div className="set-body">
        <div className="set-in">
          <h1>{title[1]}</h1>
          <p className="lead">{lead}</p>
          {title[0] === 'account' && <Account />}
          {title[0] === 'appearance' && <Appearance />}
          {title[0] === 'workers' && <MyWorkers />}
          {title[0] === 'network' && <Network />}
        </div>
      </div>
    </div>
  );
}
