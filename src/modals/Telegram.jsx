// Connect Telegram: tap Start on the bot, paste the chat code, and it is sealed to the worker that holds
// the bot token, here in the browser. Only the sealed text ever goes into a rule; Arkiv never sees the code.
import { useState } from 'react';
import { sealForWorker } from 'arkiv-triggers';
import { I } from '../ui/icons.jsx';
import { Field, Modal, Select, toast } from '../ui/kit.jsx';
import { setTelegram, setUi, useStore } from '../lib/store.js';
import { short } from '../lib/format.js';

export const TG_BOT = import.meta.env.VITE_TG_BOT || 'arku678_bot';

export function TelegramModal() {
  const workers = useStore(s => s.workers).filter(w => w.online && w.actions.includes('telegram') && w.sealKey);
  const [worker, setWorker] = useState(workers[0]?.worker || '');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const close = () => setUi({ modal: null });
  const save = () => {
    const c = code.trim();
    if (!/^-?\d{4,20}$/.test(c)) return setErr('The chat code is the number the bot sent you, like 123456789.');
    const w = workers.find(x => x.worker === worker);
    if (!w) return setErr('Pick a Telegram worker that is online.');
    try {
      setTelegram({ worker: w.worker, sealed: sealForWorker(c, w.sealKey), hint: c.slice(-4), at: Date.now() });
      toast('Telegram connected. Your chat code is sealed to the worker.');
      close();
    } catch (e) {
      setErr(e.message);
    }
  };
  return (
    <Modal
      title="Connect Telegram"
      sub="Once connected, any rule can message you. You only type the message."
      onClose={close}
      footer={
        <>
          <span className="sp" />
          <button className="btn btn-secondary" onClick={close}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save} disabled={!workers.length}>
            Save connection
          </button>
        </>
      }
    >
      {!workers.length ? (
        <div className="alert warn">
          <I n="triangle-alert" s={15} />
          <span>No worker that can send Telegram messages is online right now. Try again in a minute; workers renew their heartbeat every minute.</span>
        </div>
      ) : (
        <>
          <ol className="steps-ol">
            <li>
              Open{' '}
              <a href={`https://t.me/${TG_BOT}?start=link`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontWeight: 500 }}>
                @{TG_BOT}
              </a>{' '}
              in Telegram and tap <b>Start</b>.
            </li>
            <li>The bot replies with your chat code. Paste it below.</li>
          </ol>
          <a className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} href={`https://t.me/${TG_BOT}?start=link`} target="_blank" rel="noreferrer">
            <I n="send" s={14} />
            Open @{TG_BOT}
          </a>
          <Field label="Chat code" htmlFor="tg-code" err={err}>
            <input id="tg-code" className={`input ${err ? 'is-error' : ''}`} inputMode="numeric" placeholder="123456789" value={code} onChange={e => (setCode(e.target.value), setErr(''))} autoFocus />
          </Field>
          {workers.length > 1 && (
            <Field label="Sent by" hint="The worker that holds the bot token. Your code is sealed so only it can read it.">
              <Select value={worker} onChange={setWorker} options={workers.map(w => ({ value: w.worker, label: `Worker ${short(w.worker)}` }))} />
            </Field>
          )}
          <div className="alert info">
            <I n="lock" s={15} />
            <span>
              Your chat code is sealed here in the browser to worker <span className="mono">{short(worker)}</span>. Rules carry only the sealed text, so it never appears on Arkiv in plain form.
            </span>
          </div>
        </>
      )}
    </Modal>
  );
}
