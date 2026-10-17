// Workers, from their heartbeats on Arkiv: who is online, what each can do, and how to run your own.
import { I } from '../ui/icons.jsx';
import { Addr, Code, Empty, Panel, useNow } from '../ui/kit.jsx';
import { useStore } from '../lib/store.js';
import { href } from '../lib/router.js';
import { ACTION_ICON, actionLabel, blockTime, fmtNum, sameAddr } from '../lib/format.js';

export function Workers() {
  const { workers, workersLoaded, wallet, clock } = useStore();
  useNow(5000);
  const mine = w => wallet && w.operatorVerified && sameAddr(w.operator, wallet.address);
  const list = [...workers].sort((a, b) => Number(mine(b)) - Number(mine(a)) || Number(b.online) - Number(a.online));
  return (
    <div className="page">
      <div className="ph">
        <div>
          <h1>Workers</h1>
          <p>Each worker writes a heartbeat on Arkiv that lives five minutes and is renewed every minute. If it lapses, the worker is offline and others take its rules.</p>
        </div>
        <div className="acts">
          <a className="btn btn-secondary" href={href('settings/workers')}>
            <I n="link" s={14} />
            Link my worker
          </a>
        </div>
      </div>
      <Panel body={false} style={{ marginBottom: 16 }}>
        {list.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="perm-t" style={{ minWidth: 680 }}>
              <thead>
                <tr>
                  <th style={{ paddingLeft: 14, textAlign: 'left' }}>Worker</th>
                  <th style={{ textAlign: 'left' }}>Status</th>
                  <th style={{ textAlign: 'left' }}>Fires</th>
                  <th style={{ textAlign: 'left' }}>Actions</th>
                  <th style={{ textAlign: 'left' }}>Caught up to</th>
                  <th style={{ textAlign: 'right', paddingRight: 14 }}>Version</th>
                </tr>
              </thead>
              <tbody>
                {list.map(w => {
                  const seen = blockTime(w.lastBlock, clock);
                  return (
                    <tr key={w.key}>
                      <td style={{ paddingLeft: 14, textAlign: 'left' }}>
                        <Addr a={w.worker} you={mine(w)} />
                      </td>
                      <td style={{ textAlign: 'left' }}>
                        <span className="pstatus" style={{ '--c': w.online ? 'var(--green)' : 'var(--text-4)' }}>
                          <i />
                          {w.online ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'left' }} className="muted">
                        {w.mode === 'any' ? 'Public rules' : 'Its own rules'}
                      </td>
                      <td style={{ textAlign: 'left' }}>
                        <span className="row" style={{ gap: 8 }}>
                          {w.actions.map(a => (
                            <span key={a} data-tip={actionLabel(a)} className="faint" style={{ display: 'inline-flex' }}>
                              <I n={ACTION_ICON[a]} s={14} />
                            </span>
                          ))}
                        </span>
                      </td>
                      <td style={{ textAlign: 'left' }} className="mono faint" title={seen ? seen.toLocaleString() : ''}>
                        {fmtNum(w.lastBlock)}
                      </td>
                      <td style={{ textAlign: 'right', paddingRight: 14 }} className="mono faint">
                        {w.version.replace('arkiv-triggers/', 'v')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="panel-b">
            <Empty icon="server" title={workersLoaded ? 'No workers online' : 'Reading heartbeats…'} text={workersLoaded ? 'Rules wait safely on Arkiv until a worker comes online. You can run one in a minute; see below.' : ''} />
          </div>
        )}
      </Panel>
      <div className="grid2" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
        <Panel title="Run your own worker">
          <p className="muted" style={{ fontSize: 13, margin: '0 0 10px', lineHeight: 1.5 }}>
            The worker is open source. It needs only its own wallet with a little test GLM; it makes outgoing connections only, so it runs fine on a laptop.
          </p>
          <Code>{`npx arkiv-triggers new-key        # a fresh worker wallet
WORKER_KEY=0x… npx arkiv-triggers  # run it`}</Code>
          <p className="faint" style={{ fontSize: 12, margin: '10px 0 0' }}>
            Or in your backend: <span className="mono">startWorker({'{ privateKey }'})</span> from <span className="mono">arkiv-triggers/worker</span>, or the Docker image.
          </p>
        </Panel>
        <Panel title="How workers agree">
          <ol className="steps-ol">
            <li>A few blocks before a deadline, a worker writes a 60-second <b>claim</b> on Arkiv.</li>
            <li>The earliest claim wins. Others back off, so a rule fires once.</li>
            <li>At the deadline block it confirms, acts, and writes a signed <b>receipt</b>.</li>
            <li>If it crashes, its claim lapses and another worker takes over.</li>
          </ol>
        </Panel>
      </div>
    </div>
  );
}
