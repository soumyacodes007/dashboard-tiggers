// The rule editor. Three cards (when, then, details) and a review panel that always shows the rule as a
// sentence, what is still missing, and exactly what will be stored on Arkiv. Nothing touches the wallet
// until Publish; drafts autosave in this browser.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ExpirationTime, str } from '@arkiv-network/sdk';
import { ACTIONS, TEMPLATES, fillMessage, ruleToCreate, ruleWarnings, validateRule } from 'arkiv-triggers';
import { I } from '../ui/icons.jsx';
import { Code, Field, Panel, Seg, Select, cx, toast, useNow } from '../ui/kit.jsx';
import { ActTag } from '../ui/rules.jsx';
import { dropDraft, getState, publishRules, saveDraft, setUi, triggers, useStore } from '../lib/store.js';
import { href } from '../lib/router.js';
import { ACTION_ICON, FAUCET, blockAt, blockTime, fmtNum, headNow, offsetText, ruleSentence, sameAddr, short, span, toJson, tzName, txUrl, when } from '../lib/format.js';
import { walletError } from '../lib/wallet.js';

const HEX64 = /^0x[0-9a-fA-F]{64}$/;
const HEX40 = /^0x[0-9a-fA-F]{40}$/;
const EARLY = { none: 0, '15m': 450, '1h': 1800, '1d': 43200 };
const pad = n => String(n).padStart(2, '0');
const localInput = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const newId = () => 'd' + Math.random().toString(36).slice(2, 9);

function blankForm() {
  return {
    id: newId(),
    name: '',
    on: 'expire',
    target: '',
    early: 'none',
    earlyMin: 30,
    at: localInput(new Date(Date.now() + 10 * 60_000)),
    action: 'telegram',
    message: '⏰ {entity} expires at {time}',
    url: '',
    extendDays: 30,
    who: 'any',
    workerAddr: '',
    retries: 3,
  };
}
function fromTemplate(id) {
  const t = TEMPLATES.find(x => x.id === id);
  const f = blankForm();
  if (!t) return f;
  const off = t.rule.trigger.offsetBlocks || 0;
  return {
    ...f,
    name: { 'expiry-telegram': 'Expiry alert', 'time-webhook': 'Scheduled webhook', 'keep-alive': 'Keep alive' }[id] || '',
    on: t.rule.trigger.on,
    early: Object.entries(EARLY).find(([, b]) => b === off)?.[0] || 'none',
    action: t.rule.action,
    message: t.rule.message || f.message,
    extendDays: t.rule.extendDays || f.extendDays,
  };
}
function fromRule(r, clock) {
  const f = blankForm();
  const off = Number(r.trigger?.offset || 0);
  const early = Object.entries(EARLY).find(([, b]) => b === off)?.[0] || (off ? 'custom' : 'none');
  return {
    ...f,
    name: r.name ? `${r.name} (copy)` : '',
    on: r.trigger.on,
    target: r.trigger.target || '',
    early,
    earlyMin: Math.round((off * 2) / 60) || 30,
    at: r.trigger.on === 'block' && clock ? localInput(blockTime(BigInt(r.trigger.fireAt), clock)) : f.at,
    action: r.action,
    message: r.message || f.message,
    url: r.url || '',
    extendDays: r.extendDays || 30,
    who: r.action === 'telegram' || r.worker === 'any' ? 'any' : 'specific',
    workerAddr: r.worker === 'any' ? '' : r.worker,
    retries: r.retries ?? 3,
  };
}
const offsetOf = f => BigInt(f.early === 'custom' ? Math.max(0, Math.round((Number(f.earlyMin) || 0) * 30)) : EARLY[f.early] || 0);

/** Looks up an entity key as it is typed. */
function useTarget(key, nonce) {
  const [t, setT] = useState({ state: 'empty' });
  useEffect(() => {
    if (!key) return setT({ state: 'empty' });
    if (!HEX64.test(key)) return setT({ state: 'invalid' });
    let live = true;
    setT({ state: 'loading' });
    triggers()
      .reader.getEntity(key)
      .then(e => live && setT({ state: 'ok', expiresAt: e.expiresAt, owner: e.owner, creator: e.creator, type: e.attributes?.type?.value }))
      .catch(() => live && setT({ state: 'missing' }));
    return () => {
      live = false;
    };
  }, [key, nonce]);
  return t;
}

function Step({ n, title, ok, missing, children }) {
  return (
    <section className="panel">
      <div className="step-h">
        <span className={cx('step-n', ok && 'ok')}>{ok ? <I n="check" s={12} /> : n}</span>
        <h2>{title}</h2>
        <span className={cx('step-state', ok ? 'ok' : 'warn')}>{ok ? 'Complete' : missing}</span>
      </div>
      <div className="step-b">{children}</div>
    </section>
  );
}
function Tile({ on, icon, title, desc, onClick, disabled, why }) {
  return (
    <button type="button" className={cx('tile', on && 'on')} onClick={onClick} disabled={disabled} data-tip={disabled ? why : undefined} aria-pressed={on}>
      <span className="tt">
        <I n={icon} s={15} />
        {title}
      </span>
      <span className="td">{desc}</span>
    </button>
  );
}

export function RuleEditor() {
  const { wallet, clock, workers, telegram, balance, drafts } = useStore();
  useNow(1000);
  const [form, setForm] = useState(() => {
    const tpl = sessionStorage.getItem('trg.template');
    const dup = sessionStorage.getItem('trg.duplicate');
    const draft = sessionStorage.getItem('trg.draft');
    const prefill = sessionStorage.getItem('trg.prefill');
    ['trg.template', 'trg.duplicate', 'trg.draft', 'trg.prefill'].forEach(k => sessionStorage.removeItem(k));
    if (dup) return fromRule(JSON.parse(dup), getState().clock);
    if (draft) return drafts.find(d => d.id === draft)?.form || blankForm();
    if (tpl) return fromTemplate(tpl);
    return prefill ? { ...blankForm(), target: prefill } : blankForm();
  });
  const [nonce, setNonce] = useState(0);
  const [phase, setPhase] = useState('edit'); // edit | wallet | writing | done
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');
  const [view, setView] = useState('stored');
  const [makingTarget, setMakingTarget] = useState(false);
  const msgRef = useRef(null);
  // The default message follows the trigger, until the person writes their own.
  const DEFAULT_MSG = { expire: '⏰ {entity} expires at {time}', block: '{rule} fired at {time}' };
  const set = p =>
    setForm(f => {
      const next = { ...f, ...p };
      if (p.on && Object.values(DEFAULT_MSG).includes(f.message)) next.message = DEFAULT_MSG[p.on];
      return next;
    });
  const target = useTarget(form.on === 'expire' ? form.target.trim() : '', nonce);

  // Autosave a draft once the person has typed something of their own.
  const dirty = form.name || form.target || form.url;
  useEffect(() => {
    if (!dirty || phase !== 'edit') return;
    const t = setTimeout(() => saveDraft({ id: form.id, form, updatedAt: Date.now() }), 600);
    return () => clearTimeout(t);
  }, [form, dirty, phase]);

  const tgWorkers = workers.filter(w => w.online && w.actions.includes('telegram'));
  const mine = workers.filter(w => wallet && w.operatorVerified && sameAddr(w.operator, wallet.address));
  const workerFor = form.action === 'telegram' ? telegram?.worker || '' : form.who === 'any' ? 'any' : form.who === 'mine' ? mine[0]?.worker || '' : form.workerAddr.trim();

  // ---- timing ----
  const offset = offsetOf(form);
  const fireAt = form.on === 'block' && clock && form.at ? blockAt(new Date(form.at), clock) : null;
  const deadline = form.on === 'expire' ? (target.state === 'ok' ? target.expiresAt - offset : null) : fireAt != null ? fireAt - offset : null;
  const deadlineDate = deadline != null ? blockTime(deadline, clock) : null;
  const inFuture = deadline != null && deadline > headNow(clock) + 5n;

  // ---- the rule as the SDK takes it ----
  const input = useMemo(() => {
    const trigger = form.on === 'expire' ? { on: 'expire', target: form.target.trim(), ...(offset ? { offset } : {}) } : { on: 'block', fireAt: fireAt ?? 0n, ...(offset ? { offset } : {}) };
    const r = { trigger, action: form.action, name: form.name.trim() || undefined, worker: workerFor || 'any', retries: Number(form.retries) };
    if (form.action === 'telegram') Object.assign(r, { message: form.message, chat: telegram?.sealed });
    if (form.action === 'webhook') Object.assign(r, { url: form.url.trim(), message: form.message || undefined });
    if (form.action === 'extend') r.extendDays = Number(form.extendDays);
    return r;
  }, [form, offset, fireAt, workerFor, telegram]);
  let schemaErr = '';
  try {
    validateRule(input);
  } catch (e) {
    schemaErr = e.message;
  }
  const warnings = ruleWarnings(input).filter(w => !/telegram rules can only be fired/.test(w));

  // ---- step completeness ----
  const whenOk = form.on === 'expire' ? target.state === 'ok' && inFuture : inFuture;
  const whenMissing =
    form.on === 'expire'
      ? target.state === 'empty'
        ? 'Pick an entity'
        : target.state === 'invalid'
          ? 'Not an entity key'
          : target.state === 'missing'
            ? 'Entity not found'
            : target.state === 'loading'
              ? 'Checking…'
              : 'Fire time has passed'
      : 'Pick a future time';
  const thenOk =
    form.action === 'telegram' ? !!telegram && !!form.message.trim() : form.action === 'webhook' ? /^https:\/\/.+\..+/.test(form.url.trim()) : form.action === 'extend' ? Number(form.extendDays) > 0 : true;
  const thenMissing = form.action === 'telegram' ? (!telegram ? 'Connect Telegram' : 'Add a message') : form.action === 'webhook' ? 'Add an https:// URL' : 'Set the days';
  const whoOk = form.action === 'telegram' || form.who === 'any' || HEX40.test(workerFor);
  const capable = workers.filter(w => w.online && w.actions.includes(form.action) && (workerFor === 'any' || sameAddr(w.worker, workerFor)));
  const ready = whenOk && thenOk && whoOk && !schemaErr && !!wallet;

  const checks = [
    form.on === 'expire'
      ? target.state === 'ok'
        ? ['ok', `Entity ${short(form.target)} exists, expires ${when(blockTime(target.expiresAt, clock))}`]
        : ['bad', target.state === 'missing' ? 'That entity was not found: expired, deleted, or never existed' : 'Pick the entity to watch']
      : null,
    deadlineDate ? (inFuture ? ['ok', `Fires ${when(deadlineDate)}, in ${span(deadlineDate - Date.now())}`] : ['bad', 'The fire time is in the past']) : null,
    form.action === 'telegram'
      ? telegram
        ? ['ok', `Telegram connected · chat •••• ${telegram.hint}`]
        : ['bad', 'Connect Telegram first']
      : thenOk
        ? ['ok', `${ACTIONS[form.action].label} is set up`]
        : ['bad', thenMissing],
    capable.length ? ['ok', `A worker that can fire it is online (${short(capable[0].worker)})`] : ['warn', 'No matching worker is online right now. The rule waits until one is.'],
    ...warnings.map(w => ['warn', w.replace(/^\w/, c => c.toUpperCase())]),
    schemaErr && (whenOk && thenOk) ? ['bad', schemaErr] : null,
    !wallet ? ['bad', 'Connect a wallet to publish'] : balance === 0n ? ['bad', 'Your wallet has no test GLM yet'] : null,
  ].filter(Boolean);

  // ---- what goes on Arkiv ----
  const stored = useMemo(() => {
    try {
      const p = ruleToCreate({ app: 'triggers-dashboard', ...input }, { targetExpiresAt: target.expiresAt });
      return { attrs: p.attributes, payload: JSON.parse(new TextDecoder().decode(p.payload)) };
    } catch {
      return null;
    }
  }, [input, target.expiresAt]);
  const code = `import { createTriggers } from "arkiv-triggers"

const triggers = createTriggers({ wallet })
await triggers.createRule(${toJson(
    {
      ...input,
      trigger: Object.fromEntries(Object.entries(input.trigger).map(([k, v]) => [k, typeof v === 'bigint' ? `${v}n` : v])),
      chat: input.chat ? 'sealForWorker(chatCode, worker.sealKey)' : undefined,
    },
    2,
  )
    .replace(/"(\d+)n"/g, '$1n')
    .replace(/"sealForWorker\(chatCode, worker.sealKey\)"/, 'sealForWorker(chatCode, worker.sealKey)')})`;

  const summary = ruleSentence({ ...input, trigger: { ...input.trigger, target: HEX64.test(form.target) ? form.target : '' } }, { clock });
  const preview = fillMessage(form.message || '', {
    entity: form.on === 'expire' ? short(form.target || '0xab12…') : 'Your timer',
    time: deadlineDate ? when(deadlineDate) : '5:00 PM',
    rule: form.name || 'Expiry alert',
  });

  const insert = tok => {
    const el = msgRef.current;
    const s = el?.selectionStart ?? form.message.length;
    const e = el?.selectionEnd ?? s;
    const next = form.message.slice(0, s) + tok + form.message.slice(e);
    set({ message: next });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(s + tok.length, s + tok.length);
    });
  };

  async function makeTestTarget(minutes) {
    if (!wallet) return setUi({ modal: { type: 'connect' } });
    setMakingTarget(true);
    try {
      const res = await wallet.client.createEntity({
        payload: new TextEncoder().encode('A test entity made by the Arkiv Triggers dashboard'),
        contentType: 'text/plain',
        attributes: { type: str('trg.demo'), app: str('triggers-dashboard') },
        expires: ExpirationTime.fromMinutes(minutes),
        flags: { permissionlessExtension: true },
      });
      set({ target: res.entityKey, name: form.name || `Test entity · ${minutes} min` });
      setNonce(n => n + 1);
      toast(`Test entity created. It expires in ${minutes} minutes.`);
    } catch (e) {
      toast(walletError(e), { kind: 'err' });
    } finally {
      setMakingTarget(false);
    }
  }

  async function publish() {
    if (!wallet) return setUi({ modal: { type: 'connect' } });
    setErr('');
    setPhase(wallet.kind === 'session' ? 'writing' : 'wallet');
    const t = setTimeout(() => setPhase('writing'), 1200);
    try {
      const res = await publishRules([{ ...input }]);
      clearTimeout(t);
      setResult(res);
      setPhase('done');
      dropDraft(form.id);
    } catch (e) {
      clearTimeout(t);
      setErr(walletError(e));
      setPhase('edit');
    }
  }

  if (phase === 'done' && result)
    return (
      <div className="page" style={{ maxWidth: 620 }}>
        <div className="panel" style={{ padding: '32px 28px', textAlign: 'center', marginTop: 24 }}>
          <div className="tl-dot ok" style={{ width: 44, height: 44, margin: '0 auto 14px' }}>
            <I n="circle-check" s={22} />
          </div>
          <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 600, margin: 0, letterSpacing: '-0.02em' }}>Your rule is live</h1>
          <p className="muted" style={{ margin: '8px 0 0' }}>{summary}</p>
          {deadlineDate && (
            <p style={{ margin: '14px 0 0', fontSize: 'var(--fs-md)' }}>
              Fires <b>{when(deadlineDate)}</b> <span className="faint">· in {span(deadlineDate - Date.now())}</span>
            </p>
          )}
          <div className="row" style={{ justifyContent: 'center', gap: 8, marginTop: 22, flexWrap: 'wrap' }}>
            <a className="btn btn-primary" href={href('rules/' + result.keys[0])}>
              View rule
            </a>
            <button className="btn btn-secondary" onClick={() => (setForm(blankForm()), setPhase('edit'), setResult(null))}>
              Create another
            </button>
            <a className="btn btn-ghost" href={txUrl(result.txHash)} target="_blank" rel="noreferrer">
              <I n="arrow-up-right" s={14} />
              Transaction
            </a>
          </div>
        </div>
      </div>
    );

  const publishLabel = !wallet ? 'Connect wallet to publish' : phase === 'wallet' ? 'Waiting for your wallet…' : phase === 'writing' ? 'Writing to Arkiv…' : 'Publish rule';
  const busy = phase === 'wallet' || phase === 'writing';

  return (
    <div className="page">
      <div className="ph">
        <div style={{ minWidth: 0 }}>
          <h1 className="row" style={{ gap: 10 }}>
            New rule <span className="badge">Draft</span>
          </h1>
          <p className="trunc">{summary}</p>
        </div>
        <div className="acts">
          <button className="btn btn-secondary hide-m" onClick={() => (saveDraft({ id: form.id, form, updatedAt: Date.now() }), toast('Draft saved in this browser'))}>
            Save draft
          </button>
          <button className={cx('btn btn-primary', busy && 'is-loading')} onClick={publish} disabled={busy || (wallet && !ready)}>
            {publishLabel}
          </button>
        </div>
      </div>
      <div className="row" style={{ gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <span className="faint" style={{ fontSize: 12.5 }}>
          Start from
        </span>
        <div className="chips">
          {[
            ['expiry-telegram', 'Expiry → Telegram', 'send'],
            ['time-webhook', 'Time → webhook', 'webhook'],
            ['keep-alive', 'Keep alive', 'hourglass'],
          ].map(([id, n, icon]) => (
            <button key={id} className="chipbtn" onClick={() => setForm(f => ({ ...fromTemplate(id), id: f.id, target: f.target }))}>
              <I n={icon} s={12} />
              {n}
            </button>
          ))}
          <button className="chipbtn" onClick={() => setForm(f => ({ ...blankForm(), id: f.id }))}>
            <I n="x" s={12} />
            Clear
          </button>
        </div>
      </div>
      {err && (
        <div className="alert danger" style={{ marginBottom: 14 }}>
          <I n="circle-alert" s={15} />
          <span>
            {err}{' '}
            {/GLM|faucet/.test(err) && (
              <a href={FAUCET} target="_blank" rel="noreferrer" className="link">
                Get test GLM →
              </a>
            )}
          </span>
        </div>
      )}
      <div className="ed">
        <div className="stack">
          <Step n={1} title="When" ok={whenOk} missing={whenMissing}>
            <div className="tiles">
              <Tile on={form.on === 'expire'} icon="clock" title="An entity expires" desc="Arkiv sends no event for this; workers watch the deadline." onClick={() => set({ on: 'expire' })} />
              <Tile on={form.on === 'block'} icon="calendar" title="At a date and time" desc="Fires at the block closest to the time you pick." onClick={() => set({ on: 'block' })} />
              <Tile disabled icon="sparkles" title="Entity created" desc="Coming soon" why="On the roadmap" />
            </div>
            {form.on === 'expire' ? (
              <>
                <Field
                  label="Entity"
                  htmlFor="f-target"
                  right={
                    <Menu2 busy={makingTarget} onPick={makeTestTarget} />
                  }
                >
                  <div className="inwrap">
                    <I n="search" s={13} />
                    <input id="f-target" className="input mono" style={{ fontSize: 12.5 }} placeholder="Paste an entity key, 0x… (66 characters)" value={form.target} onChange={e => set({ target: e.target.value.trim() })} spellCheck="false" />
                  </div>
                </Field>
                {target.state === 'ok' && (
                  <div className="resolved">
                    <I n="circle-check" s={15} style={{ color: 'var(--green)' }} />
                    <span className="grow">
                      {target.type ? <b style={{ fontWeight: 500 }}>{target.type}</b> : 'Entity'} · expires <b style={{ fontWeight: 500 }}>{when(blockTime(target.expiresAt, clock))}</b> <span className="faint">(in {span(blockTime(target.expiresAt, clock) - Date.now())})</span>
                    </span>
                    {wallet && sameAddr(target.owner, wallet.address) && <span className="badge">Yours</span>}
                  </div>
                )}
                {target.state === 'missing' && (
                  <div className="resolved bad">
                    <I n="circle-x" s={15} />
                    <span>No entity with that key: it has expired, been deleted, or never existed.</span>
                  </div>
                )}
                {target.state === 'loading' && (
                  <div className="resolved">
                    <I n="loader" s={15} className="spin" />
                    <span>Looking it up on Arkiv…</span>
                  </div>
                )}
              </>
            ) : (
              <Field label={`Date and time · ${tzName()}`} htmlFor="f-at" hint={fireAt != null ? `Block ${fmtNum(fireAt)}, at about 2 seconds per block` : ''}>
                <input id="f-at" type="datetime-local" className="input" value={form.at} onChange={e => set({ at: e.target.value })} style={{ maxWidth: 260 }} />
                <div className="chips" style={{ marginTop: 6 }}>
                  {[
                    ['In 3 min', 3],
                    ['In 10 min', 10],
                    ['In 1 hour', 60],
                  ].map(([n, m]) => (
                    <button key={n} className="chipbtn" onClick={() => set({ at: localInput(new Date(Date.now() + m * 60_000)) })}>
                      {n}
                    </button>
                  ))}
                  <button
                    className="chipbtn"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 1);
                      d.setHours(9, 0, 0, 0);
                      set({ at: localInput(d) });
                    }}
                  >
                    Tomorrow 9:00
                  </button>
                </div>
              </Field>
            )}
            <Field label="Fire early" hint={deadlineDate ? `→ fires ${when(deadlineDate)}` : form.on === 'expire' ? 'Counted back from the moment the entity expires' : ''}>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <Seg
                  value={form.early}
                  onChange={v => set({ early: v })}
                  label="Fire early"
                  options={[
                    ['none', 'On time'],
                    ['15m', '15 min'],
                    ['1h', '1 hour'],
                    ['1d', '1 day'],
                    ['custom', 'Custom'],
                  ]}
                />
                {form.early === 'custom' && (
                  <span className="row" style={{ gap: 6, fontSize: 12.5 }}>
                    <input type="number" min="0" className="input" style={{ width: 80 }} value={form.earlyMin} onChange={e => set({ earlyMin: e.target.value })} aria-label="Minutes early" />
                    minutes early
                  </span>
                )}
              </div>
            </Field>
          </Step>

          <Step n={2} title="Then" ok={thenOk} missing={thenMissing}>
            <div className="tiles">
              {['telegram', 'webhook', 'receipt', 'extend'].map(a => (
                <Tile
                  key={a}
                  on={form.action === a}
                  icon={ACTION_ICON[a]}
                  title={ACTIONS[a].label}
                  desc={
                    {
                      telegram: 'Our bot messages you',
                      webhook: 'A signed POST to your URL',
                      receipt: 'Just the signed proof on Arkiv',
                      extend: 'Keep the entity alive',
                    }[a]
                  }
                  onClick={() => set({ action: a })}
                />
              ))}
            </div>
            {form.action === 'telegram' &&
              (telegram ? (
                <div className="resolved">
                  <I n="send" s={15} style={{ color: 'var(--blue)' }} />
                  <span className="grow">
                    Sending to chat <b style={{ fontWeight: 500 }}>•••• {telegram.hint}</b> <span className="faint">via worker {short(telegram.worker)}</span>
                  </span>
                  <button className="btn btn-sm btn-ghost" onClick={() => setUi({ modal: { type: 'telegram' } })}>
                    Change
                  </button>
                </div>
              ) : (
                <div className="alert info">
                  <I n="send" s={15} />
                  <span className="grow">Connect Telegram once, and every rule can message you.</span>
                  <span data-tip={tgWorkers.length ? undefined : 'No Telegram worker is online right now'}>
                    <button className="btn btn-sm btn-primary" onClick={() => setUi({ modal: { type: 'telegram' } })} disabled={!tgWorkers.length}>
                      Connect Telegram
                    </button>
                  </span>
                </div>
              ))}
            {form.action === 'webhook' && (
              <Field label="Webhook URL" htmlFor="f-url" hint="Works with your server, n8n, Make or Zapier. Each call is signed by the worker (header x-trg-sig)." err={form.url && !/^https:\/\//.test(form.url) ? 'Use an https:// URL' : ''}>
                <input id="f-url" className="input" placeholder="https://myapp.com/hooks/arkiv" value={form.url} onChange={e => set({ url: e.target.value })} spellCheck="false" />
              </Field>
            )}
            {(form.action === 'telegram' || form.action === 'webhook') && (
              <Field label="Message" htmlFor="f-msg">
                <textarea id="f-msg" ref={msgRef} className="textarea" rows={3} value={form.message} onChange={e => set({ message: e.target.value })} />
                <div className="row" style={{ gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  <span className="faint" style={{ fontSize: 12 }}>
                    Insert
                  </span>
                  {['{entity}', '{time}', '{rule}'].map(t => (
                    <button key={t} type="button" className="chipbtn code" onClick={() => insert(t)}>
                      {t}
                    </button>
                  ))}
                </div>
              </Field>
            )}
            {form.action === 'telegram' && (
              <div className="tg-prev" aria-label="Message preview">
                <div className="tg-bubble">
                  <div className="who">Arkiv Triggers</div>
                  {preview || <span className="faint">Your message</span>}
                  <time>{deadlineDate ? deadlineDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '5:00 PM'}</time>
                </div>
              </div>
            )}
            {form.action === 'extend' && (
              <Field label="Extend by" htmlFor="f-days" hint="Works when the entity allows permissionless extension (test entities made here do).">
                <div className="row" style={{ gap: 8 }}>
                  <input id="f-days" type="number" min="1" className="input" style={{ width: 90 }} value={form.extendDays} onChange={e => set({ extendDays: e.target.value })} />
                  <span className="muted" style={{ fontSize: 13 }}>
                    days
                  </span>
                </div>
              </Field>
            )}
            {form.action === 'receipt' && <p className="faint" style={{ margin: 0, fontSize: 12.5 }}>The worker writes a signed receipt on Arkiv and nothing else. Your app can watch for it with the SDK's <span className="mono">watch()</span>.</p>}
          </Step>

          <Step n={3} title="Details" ok={whoOk} missing="Pick a worker">
            <Field label="Rule name" htmlFor="f-name" hint="Shown in lists and in {rule}.">
              <input id="f-name" className="input" placeholder="Lease reminder" value={form.name} onChange={e => set({ name: e.target.value })} maxLength={80} />
            </Field>
            <Field label="Who fires it">
              {form.action === 'telegram' ? (
                <div className="resolved">
                  <I n="lock" s={15} />
                  <span>Telegram messages are sent by the worker that holds the bot token{telegram ? ` (${short(telegram.worker)})` : ''}.</span>
                </div>
              ) : (
                <div className="col" style={{ gap: 6 }}>
                  {[
                    ['any', 'Any public worker', 'The default. Whichever worker claims it first fires it.'],
                    ['mine', 'My own worker', mine.length ? `${short(mine[0].worker)} · ${mine[0].online ? 'online' : 'offline, the rule waits'}` : 'Link a worker in Settings first'],
                    ['specific', 'A specific worker', 'Only that address may fire it.'],
                  ].map(([k, n, d]) => (
                    <label key={k} className="row" style={{ gap: 10, alignItems: 'flex-start', cursor: k === 'mine' && !mine.length ? 'not-allowed' : 'pointer', opacity: k === 'mine' && !mine.length ? 0.55 : 1 }}>
                      <input type="radio" className="radio" name="who" checked={form.who === k} disabled={k === 'mine' && !mine.length} onChange={() => set({ who: k })} style={{ marginTop: 2 }} />
                      <span>
                        <span style={{ fontWeight: 500, fontSize: 13 }}>{n}</span>
                        <span className="faint" style={{ display: 'block', fontSize: 12 }}>
                          {d}
                        </span>
                      </span>
                    </label>
                  ))}
                  {form.who === 'specific' && (
                    <input className="input mono" style={{ fontSize: 12.5 }} placeholder="0x… worker address" value={form.workerAddr} onChange={e => set({ workerAddr: e.target.value.trim() })} />
                  )}
                </div>
              )}
            </Field>
            <Field label="Retries" hint="Delivery attempts before the receipt records a failure.">
              <Select value={String(form.retries)} onChange={v => set({ retries: Number(v) })} style={{ width: 120 }} options={[0, 1, 2, 3, 5].map(n => ({ value: String(n), label: n === 0 ? 'No retries' : `${n} ${n === 1 ? 'retry' : 'retries'}` }))} />
            </Field>
          </Step>
        </div>

        <div className="ed-side">
          <Panel title="Review">
            <div className="summary">{summary}</div>
            <div className="row" style={{ gap: 8, margin: '8px 0 12px', flexWrap: 'wrap' }}>
              <ActTag action={form.action} />
              {offset > 0n && <span className="badge">{offsetText(offset)} early</span>}
            </div>
            <div className="checks">
              {checks.map(([k, t], i) => (
                <div key={i} className={cx('c', k)}>
                  <I n={k === 'ok' ? 'circle-check' : k === 'warn' ? 'triangle-alert' : 'circle-x'} s={14} />
                  <span>{t}</span>
                </div>
              ))}
            </div>
            <button className={cx('btn btn-primary btn-block', busy && 'is-loading')} style={{ marginTop: 14, width: '100%' }} onClick={publish} disabled={busy || (wallet && !ready)}>
              {publishLabel}
            </button>
            {wallet && (
              <p className="faint" style={{ fontSize: 11.5, margin: '8px 0 0', textAlign: 'center' }}>
                {wallet.kind === 'session' ? 'Signed by your session wallet' : 'You sign 1 transaction'} · about 0.0001 test GLM
              </p>
            )}
          </Panel>
          <Panel
            title={view === 'stored' ? 'Stored on Arkiv' : 'As code'}
            acts={
              <Seg
                value={view}
                onChange={setView}
                label="Preview"
                options={[
                  ['stored', 'Entity'],
                  ['code', 'Code'],
                ]}
              />
            }
          >
            {view === 'stored' ? (
              stored ? (
                <>
                  <p className="faint" style={{ fontSize: 12, margin: '0 0 8px', lineHeight: 1.5 }}>
                    Rules are public. Attributes are what workers query; the payload carries the rest. {form.action === 'telegram' && 'Your chat code appears only sealed.'}
                  </p>
                  <Code>
                    {Object.entries(stored.attrs)
                      .map(([k, v]) => `${k.padEnd(9)} ${String(v.type).padEnd(4)} ${typeof v.value === 'bigint' ? v.value : JSON.stringify(v.value)}`)
                      .join('\n') +
                      '\n\npayload\n' +
                      toJson(Object.fromEntries(Object.entries(stored.payload).map(([k, v]) => [k, k === 'chat' && typeof v === 'string' ? v.slice(0, 26) + '…' : v])), 2)}
                  </Code>
                </>
              ) : (
                <p className="faint" style={{ fontSize: 12.5, margin: 0 }}>
                  Fill in the cards to see the entity.
                </p>
              )
            ) : (
              <Code>{code}</Code>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

/** "Need one? Create a test entity" with a choice of lifetime. */
function Menu2({ busy, onPick }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="row" style={{ gap: 4, position: 'relative' }}>
      {busy ? (
        <span className="faint row" style={{ fontSize: 12, gap: 5 }}>
          <I n="loader" s={12} className="spin" />
          Creating…
        </span>
      ) : open ? (
        <>
          <span className="faint" style={{ fontSize: 12 }}>
            Expires in
          </span>
          {[3, 10, 60].map(m => (
            <button key={m} type="button" className="chipbtn" style={{ height: 22 }} onClick={() => (setOpen(false), onPick(m))}>
              {m < 60 ? `${m} min` : '1 hour'}
            </button>
          ))}
        </>
      ) : (
        <button type="button" className="btn btn-sm btn-ghost" style={{ height: 22, fontSize: 12 }} onClick={() => setOpen(true)}>
          <I n="plus" s={12} />
          Create a test entity
        </button>
      )}
    </span>
  );
}
