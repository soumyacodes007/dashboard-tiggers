// The gr8r shell: sidebar, top bar and the mobile bottom bar, with Triggers' navigation.
import { formatEther } from 'viem';
import { I } from '../ui/icons.jsx';
import { Blob, Menu, MenuItem, copy, cx, useNow } from '../ui/kit.jsx';
import { disconnect, setUi, useStore } from '../lib/store.js';
import { go, href, useRoute } from '../lib/router.js';
import { DOCS, FAUCET, addrUrl, blockTime, ruleState, short, span } from '../lib/format.js';

export const ROUTES = {
  overview: ['Overview', 'layout-dashboard'],
  rules: ['Rules', 'zap'],
  activity: ['Activity', 'activity'],
  workers: ['Workers', 'server'],
  connections: ['Connections', 'plug'],
  settings: ['Settings', 'settings'],
};
const MOD = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl';

function SItem({ to, label, icon, ct, dot, on, collapsed }) {
  return (
    <a className={cx('sitem', on && 'on')} href={href(to)} aria-current={on ? 'page' : undefined} data-tip={collapsed ? label : undefined} data-tip-pos="right" onClick={() => setUi({ mnav: false })}>
      <I n={icon} s={16} />
      <span className="trunc">{label}</span>
      {ct ? <span className={cx('ct', dot && 'dotc')}>{ct}</span> : null}
    </a>
  );
}

export const glm = b => (b == null ? '—' : Number(formatEther(b)).toLocaleString('en-US', { maximumFractionDigits: 3 }));

function Sidebar() {
  const route = useRoute();
  const { wallet, rules, workers, clock, unseen, balance, ui } = useStore();
  useNow(1000);
  const active = rules.filter(r => ruleState(r, clock) === 'active');
  const next = [...active].sort((a, b) => (a.deadline < b.deadline ? -1 : 1)).slice(0, 5);
  const online = workers.filter(w => w.online).length;
  const r = route.name;
  return (
    <nav className="side" aria-label="Main">
      <div className="side-top">
        <div className="row" style={{ gap: 2 }}>
          <Menu
            width={240}
            trigger={p => (
              <button className="ws grow" {...p} aria-label="Arkiv Triggers menu">
                <span className="ws-logo trg" style={{ width: 22, height: 22 }}>
                  <I n="zap" s={13} />
                </span>
                <span className="ws-name trunc">Arkiv Triggers</span>
                <span className="chev-d faint">
                  <I n="chevrons-up-down" s={13} />
                </span>
              </button>
            )}
          >
            <div className="mh">Arkiv Triggers</div>
            <MenuItem icon="book-open" href={DOCS}>
              Documentation
            </MenuItem>
            <MenuItem icon="github" href="https://github.com/soumyacodes007/arkiv-triggers">
              Source on GitHub
            </MenuItem>
            <MenuItem icon="box" href="https://www.npmjs.com/package/arkiv-triggers">
              npm package
            </MenuItem>
            <div className="msep" />
            <MenuItem icon="globe" href="https://arkiv.network">
              About Arkiv
            </MenuItem>
          </Menu>
          {!ui.collapsed && (
            <button className="ibtn ibtn-sm hide-m" onClick={() => setUi({ collapsed: true })} data-tip="Collapse sidebar" aria-label="Collapse sidebar">
              <I n="panel-left" s={15} />
            </button>
          )}
        </div>
      </div>
      <div className="side-scroll">
        {ui.collapsed && (
          <button className="sitem" onClick={() => setUi({ collapsed: false })} data-tip="Expand sidebar" data-tip-pos="right" aria-label="Expand sidebar">
            <I n="panel-left" s={16} />
          </button>
        )}
        <SItem to="" label="Overview" icon="layout-dashboard" on={r === 'overview'} collapsed={ui.collapsed} />
        <SItem to="rules" label="Rules" icon="zap" on={r === 'rules' || r === 'rule' || r === 'new'} ct={wallet && active.length} collapsed={ui.collapsed} />
        <SItem to="activity" label="Activity" icon="activity" on={r === 'activity'} ct={unseen || ''} dot collapsed={ui.collapsed} />
        <SItem to="workers" label="Workers" icon="server" on={r === 'workers'} ct={online || ''} collapsed={ui.collapsed} />
        <SItem to="connections" label="Connections" icon="plug" on={r === 'connections'} collapsed={ui.collapsed} />
        {wallet && (
          <div className="sgroup">
            <div className="sgroup-h">
              <span>Next to fire</span>
              <span className="sp" />
              <a className="ibtn ibtn-xs" href={href('rules/new')} data-tip="New rule" aria-label="New rule">
                <I n="plus" s={14} />
              </a>
            </div>
            {next.length ? (
              next.map(x => {
                const d = blockTime(x.deadline, clock);
                return (
                  <a key={x.key} className={cx('sitem', route.params.key === x.key && 'on')} href={href('rules/' + x.key)} data-tip={ui.collapsed ? x.name || 'Rule' : undefined} data-tip-pos="right">
                    <span className="pico" style={{ '--c': 'var(--accent)' }}>
                      <I n="timer" s={12} />
                    </span>
                    <span className="trunc">{x.name || 'Untitled rule'}</span>
                    <span className="ct cd">{d ? span(d - Date.now()) : ''}</span>
                  </a>
                );
              })
            ) : (
              <div className="faint" style={{ fontSize: 12, padding: '4px 10px 2px' }}>
                Nothing scheduled
              </div>
            )}
          </div>
        )}
      </div>
      <div className="side-bot">
        <a className="sitem" href={DOCS} target="_blank" rel="noreferrer" data-tip={ui.collapsed ? 'Docs' : undefined} data-tip-pos="right">
          <I n="book-open" s={16} />
          <span>Docs</span>
          <span className="ct">
            <I n="arrow-up-right" s={12} />
          </span>
        </a>
        <SItem to="settings" label="Settings" icon="settings" on={r === 'settings'} collapsed={ui.collapsed} />
        {wallet ? (
          <a className="sitem" href={href('settings/account')} style={{ height: 36 }}>
            <Blob a={wallet.address} size={20} />
            <span className="trunc mono" style={{ color: 'var(--text)', fontSize: 12 }}>
              {short(wallet.address)}
            </span>
            <span className="ct num">{glm(balance)} GLM</span>
          </a>
        ) : (
          <button className="sitem" onClick={() => setUi({ modal: { type: 'connect' } })} style={{ height: 36 }}>
            <I n="wallet" s={16} />
            <span>Connect wallet</span>
          </button>
        )}
      </div>
    </nav>
  );
}

function crumbs(route, rules) {
  const c = [];
  const n = route.name;
  if (n === 'new' || n === 'rule') {
    c.push(['Rules', 'rules']);
    c.push([n === 'new' ? 'New rule' : rules.find(r => r.key === route.params.key)?.name || 'Rule']);
  } else if (n === 'settings') {
    c.push(['Settings', 'settings']);
  } else c.push([ROUTES[n]?.[0] || 'Not found']);
  return c;
}

function LiveInd() {
  const { live, wallet } = useStore();
  if (!wallet) return null;
  const map = {
    live: ['Live', 'var(--green)', 'Receipts and rules arrive over a WebSocket as workers write them'],
    connecting: ['Connecting', 'var(--amber)', 'Opening the live feed'],
    reconnecting: ['Reconnecting', 'var(--amber)', 'The live feed dropped; reconnecting'],
    off: ['Offline', 'var(--text-4)', 'No live feed'],
  };
  const [t, c, tip] = map[live] || map.off;
  return (
    <span className={cx('pill-ind hide-m', live === 'live' && 'live')} style={{ '--c': c }} data-tip={tip}>
      <i />
      {t}
    </span>
  );
}

function Topbar() {
  const route = useRoute();
  const { wallet, rules, balance } = useStore();
  const cs = crumbs(route, rules);
  return (
    <header className="topbar">
      <button className="ibtn mnav-btn" onClick={() => setUi({ mnav: true })} aria-label="Open navigation">
        <I n="menu" s={17} />
      </button>
      <nav className="crumbs trunc" aria-label="Breadcrumb">
        {cs.flatMap(([label, to], i) => [
          i > 0 && (
            <span key={'s' + i} className="sep">
              /
            </span>
          ),
          to && i < cs.length - 1 ? (
            <button key={i} onClick={() => go(to)}>
              {label}
            </button>
          ) : (
            <button key={i} className="cur" aria-current="page">
              {label}
            </button>
          ),
        ])}
      </nav>
      <span className="sp" />
      <LiveInd />
      <span className="pill-ind hide-m" style={{ '--c': 'var(--accent)' }} data-tip="Arkiv testnet, chain 7738577">
        <i />
        Tiramisu
      </span>
      <button className="topsearch" onClick={() => setUi({ palette: true })} aria-label="Search and commands">
        <I n="search" s={14} />
        <span className="lbltxt">Search or jump to…</span>
        <span className="kbd">{MOD}K</span>
      </button>
      <button className="btn btn-primary btn-sm" onClick={() => go('rules/new')}>
        <I n="plus" s={14} />
        <span className="hide-m">New rule</span>
      </button>
      {wallet ? (
        <Menu
          width={250}
          align="right"
          trigger={p => (
            <button className="ibtn" {...p} aria-label="Account menu" style={{ width: 'auto', padding: '0 2px' }}>
              <Blob a={wallet.address} size={24} />
            </button>
          )}
        >
          <div className="mh" style={{ textTransform: 'none', letterSpacing: 0 }}>
            <div className="mono" style={{ fontSize: 12, color: 'var(--text)' }}>
              {short(wallet.address, 6)}
            </div>
            <div className="faint" style={{ fontWeight: 400, marginTop: 2 }}>
              {wallet.name} · {glm(balance)} GLM
            </div>
          </div>
          <MenuItem icon="copy" onClick={() => copy(wallet.address, 'Address copied')}>
            Copy address
          </MenuItem>
          <MenuItem icon="arrow-up-right" href={addrUrl(wallet.address)}>
            View in explorer
          </MenuItem>
          <MenuItem icon="sparkles" href={FAUCET}>
            Get test GLM
          </MenuItem>
          <MenuItem icon="settings" href={href('settings/account')}>
            Account settings
          </MenuItem>
          <div className="msep" />
          <MenuItem icon="log-out" onClick={disconnect}>
            Disconnect
          </MenuItem>
        </Menu>
      ) : (
        <button className="btn btn-secondary btn-sm hide-m" onClick={() => setUi({ modal: { type: 'connect' } })}>
          <I n="wallet" s={14} />
          Connect
        </button>
      )}
    </header>
  );
}

function BottomNav() {
  const r = useRoute().name;
  const b = (to, name, label, icon) => (
    <button className={r === name ? 'on' : ''} onClick={() => go(to)}>
      <I n={icon} s={19} />
      <span>{label}</span>
    </button>
  );
  return (
    <nav className="bottomnav" aria-label="Primary">
      {b('', 'overview', 'Overview', 'layout-dashboard')}
      {b('rules', 'rules', 'Rules', 'zap')}
      {b('activity', 'activity', 'Activity', 'activity')}
      {b('workers', 'workers', 'Workers', 'server')}
      <button onClick={() => setUi({ mnav: true })}>
        <I n="ellipsis" s={19} />
        <span>More</span>
      </button>
    </nav>
  );
}

export function Shell({ children }) {
  const ui = useStore(s => s.ui);
  const limited = useStore(s => s.limited);
  return (
    <div className={cx('shell', ui.collapsed && 'collapsed', ui.mnav && 'mnav')}>
      <Sidebar />
      {ui.mnav && <div className="side-scrim" onClick={() => setUi({ mnav: false })} />}
      <main className="main" id="main">
        <Topbar />
        {limited && (
          <div className="offline-bar" role="status">
            <I n="wifi-off" s={15} />
            <span>
              <b>Arkiv is limiting reads from this browser.</b> Its free anonymous quota is used up for now, so some data may be a little behind. Retrying every 30 seconds.
            </span>
          </div>
        )}
        <div className="content" id="main-content" tabIndex={-1}>
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
