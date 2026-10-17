// Connections: Telegram (sealed to a worker, kept in this browser), webhooks, and what's coming.
import { I } from '../ui/icons.jsx';
import { Code, Panel } from '../ui/kit.jsx';
import { setTelegram, setUi, useStore } from '../lib/store.js';
import { ago, short } from '../lib/format.js';
import { TG_BOT } from '../modals/Telegram.jsx';

export function Connections() {
  const { telegram, workers } = useStore();
  const tgWorker = telegram && workers.find(w => w.worker.toLowerCase() === telegram.worker.toLowerCase());
  return (
    <div className="page" style={{ maxWidth: 920 }}>
      <div className="ph">
        <div>
          <h1>Connections</h1>
          <p>Where rules can reach you. Set one up once and reuse it in every rule.</p>
        </div>
      </div>
      <div className="grid2" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
        <div className="panel ccard">
          <div className="hd">
            <span className="logo-t" style={{ '--c': '#2AABEE' }}>
              <I n="send" s={17} />
            </span>
            <div className="grow">
              <div className="t">Telegram</div>
              <div className="faint" style={{ fontSize: 12 }}>
                via @{TG_BOT}
              </div>
            </div>
            {telegram ? (
              <span className="badge green">
                <span className="dot" />
                Connected
              </span>
            ) : (
              <span className="badge">Not connected</span>
            )}
          </div>
          {telegram ? (
            <>
              <p>
                Sending to chat <b>•••• {telegram.hint}</b>, sealed to worker <span className="mono">{short(telegram.worker)}</span>
                {tgWorker ? (tgWorker.online ? ' (online)' : ' (offline right now)') : ''}. Connected {ago(telegram.at)}.
              </p>
              <div className="row" style={{ gap: 6 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setUi({ modal: { type: 'telegram' } })}>
                  Reconnect
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setTelegram(null)}>
                  Remove
                </button>
              </div>
            </>
          ) : (
            <>
              <p>Tap Start on our bot, paste the code it sends you, and any rule can message you. The code is sealed so only the Telegram worker can read it.</p>
              <button className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setUi({ modal: { type: 'telegram' } })}>
                Connect Telegram
              </button>
            </>
          )}
        </div>
        <div className="panel ccard">
          <div className="hd">
            <span className="logo-t" style={{ '--c': 'var(--text)' }}>
              <I n="webhook" s={17} />
            </span>
            <div className="grow">
              <div className="t">Webhooks</div>
              <div className="faint" style={{ fontSize: 12 }}>
                Your server, n8n, Make, Zapier
              </div>
            </div>
            <span className="badge">No setup</span>
          </div>
          <p>Paste a URL into any rule. Each call is a POST signed by the worker; check it before you trust it:</p>
          <Code>{`import { verifyWebhook } from "arkiv-triggers"

const ok = await verifyWebhook(body, req.headers["x-trg-sig"], [WORKER])`}</Code>
        </div>
        {[
          ['Slack', '#4A154B', 'message-square'],
          ['Discord', '#5865F2', 'message-square'],
        ].map(([n, c, icon]) => (
          <div key={n} className="panel ccard" style={{ opacity: 0.7 }}>
            <div className="hd">
              <span className="logo-t" style={{ '--c': c }}>
                <I n={icon} s={17} />
              </span>
              <div className="grow">
                <div className="t">{n}</div>
              </div>
              <span className="badge">Coming soon</span>
            </div>
            <p>A webhook URL for {n} is a secret, and rules are public, so it needs a sealed connection like Telegram's. It's next on the list.</p>
          </div>
        ))}
      </div>
      <Panel style={{ marginTop: 16 }}>
        <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
          <I n="shield-check" s={16} style={{ color: 'var(--green)', marginTop: 2 }} />
          <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>
            <b style={{ color: 'var(--text)' }}>What stays off Arkiv, on purpose.</b> Rules are public, so they never hold a secret or personal data. Your Telegram chat code is encrypted to one worker's key before it leaves this browser; bot tokens and worker keys live only on the worker's server; drafts and this connection live only in this browser.
          </p>
        </div>
      </Panel>
    </div>
  );
}
