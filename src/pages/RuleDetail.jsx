// One rule and everything that happened to it: the audit trail, each delivery, and the raw entity.
import { useEffect, useState } from 'react';
import { I } from '../ui/icons.jsx';
import { Addr, Code, Empty, Panel, StateBadge, copy, cx, useNow } from '../ui/kit.jsx';
import { ActTag, duplicate, resultText, receiptTone } from '../ui/rules.jsx';
import { setUi, triggers, useStore } from '../lib/store.js';
import { href } from '../lib/router.js';
import { addrUrl, blockTime, fmtNum, offsetText, ruleSentence, ruleState, sameAddr, short, span, toJson, when } from '../lib/format.js';

export function RuleDetail({ k }) {
  const { clock, wallet, receipts: liveReceipts } = useStore();
  const [trail, setTrail] = useState(null);
  const [state, setState] = useState('loading');
  const [raw, setRaw] = useState(false);
  useNow(1000);

  useEffect(() => {
    let live = true;
    const load = () =>
      triggers()
        .getRule(k)
        .then(t => {
          if (!live) return;
          setTrail(t || null);
          setState(t ? 'ok' : 'missing');
        })
        .catch(() => live && setState(s => (s === 'ok' ? s : 'error')));
    load();
    const t = setInterval(load, 6000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [k]);

  if (state === 'loading')
    return (
      <div className="page">
        <div className="sk" style={{ width: 260, height: 22, marginBottom: 10 }} />
        <div className="sk" style={{ width: 420, height: 12 }} />
      </div>
    );
  if (state !== 'ok' || !trail)
    return (
      <div className="page">
        <div className="panel" style={{ maxWidth: 520, margin: '40px auto' }}>
          <Empty icon="search" title={state === 'error' ? "Couldn't load this rule" : 'Rule not found'} text={state === 'error' ? 'Arkiv did not answer. Try again in a moment.' : 'It was deleted, or it expired a week after its deadline and cleaned itself up. Its history stays in the chain.'}>
            <a className="btn btn-secondary btn-sm" href={href('rules')}>
              Back to rules
            </a>
          </Empty>
        </div>
      </div>
    );

  const rule = trail.rule;
  const receipts = [...trail.receipts, ...liveReceipts.filter(r => sameAddr(r.rule, k) && !trail.receipts.some(x => x.key === r.key))].sort((a, b) => (a.firedAt > b.firedAt ? -1 : 1));
  // Once the target is gone its expiry can't be read, but every receipt records the deadline it fired for.
  const deadline = trail.deadline ?? receipts[0]?.deadline;
  const st = ruleState({ ...rule, status: trail.status, deadline, receipts }, clock);
  const dl = blockTime(deadline, clock);
  const created = blockTime(rule.createdAt, clock);
  const mineRule = wallet && sameAddr(rule.creator, wallet.address);
  const t = rule.trigger;

  return (
    <div className="page">
      <div className="ph">
        <div style={{ minWidth: 0 }}>
          <h1 className="row" style={{ gap: 10 }}>
            <span className="trunc">{rule.name || 'Untitled rule'}</span>
            <StateBadge state={st} />
          </h1>
          <p>
            {ruleSentence(rule, { clock })} · fired by {rule.worker === 'any' ? 'any public worker' : `worker ${short(rule.worker)}`}
          </p>
        </div>
        <div className="acts">
          <button className="btn btn-secondary" onClick={() => duplicate(rule)}>
            <I n="copy-plus" s={14} />
            Duplicate
          </button>
          {mineRule && (
            <button className="btn btn-secondary" onClick={() => setUi({ modal: { type: 'delete', rule } })}>
              <I n="trash-2" s={14} />
              Delete
            </button>
          )}
        </div>
      </div>

      {st === 'active' && dl && (
        <div className="alert info" style={{ marginBottom: 16 }}>
          <I n="timer" s={15} />
          <span>
            Fires <b>{when(dl)}</b> · in <span className="cd">{span(dl - Date.now())}</span>. Nothing else to do: a worker picks it up at the deadline block.
          </span>
        </div>
      )}
      {st === 'firing' && (
        <div className="alert warn" style={{ marginBottom: 16 }}>
          <I n="loader" s={15} className="spin" />
          <span>The deadline has passed. A worker is claiming and firing it; the receipt appears here within a few blocks.</span>
        </div>
      )}

      <div className="grid2">
        <div className="stack">
          <Panel title="Audit trail">
            <p className="faint" style={{ fontSize: 12, margin: '-4px 0 10px' }}>
              Every step is an entity on Arkiv, signed by whoever wrote it.
            </p>
            <div className="tl">
              <div className="tl-item">
                <span className="tl-dot on">
                  <I n="pencil" s={12} />
                </span>
                <div className="grow">
                  <div className="t">Created</div>
                  <div className="m">
                    <span>by</span>
                    <Addr a={rule.creator} you={mineRule} />
                    <span>block {fmtNum(rule.createdAt)}</span>
                    <span>{when(created)}</span>
                  </div>
                </div>
              </div>
              {trail.claims.map(c => (
                <div className="tl-item" key={c.key}>
                  <span className="tl-dot on">
                    <I n="lock" s={12} />
                  </span>
                  <div className="grow">
                    <div className="t">Claimed</div>
                    <div className="m">
                      <span>by worker</span>
                      <Addr a={c.worker} />
                      <span>60-second lease, until block {fmtNum(c.expiresAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
              {receipts.map(r => (
                <div className="tl-item" key={r.key}>
                  <span className={cx('tl-dot', r.status === 'ok' ? 'ok' : r.status === 'failed' ? 'bad' : '')}>
                    <I n={r.status === 'ok' ? 'check' : r.status === 'failed' ? 'x' : 'circle-slash'} s={12} />
                  </span>
                  <div className="grow">
                    <div className="t">
                      {r.status === 'ok' ? 'Fired' : r.status === 'failed' ? 'Failed' : 'Skipped'} · <span style={{ fontWeight: 400 }}>{resultText(r)}</span>
                    </div>
                    <div className="m">
                      <span>receipt by worker</span>
                      <Addr a={r.worker} />
                      <span>block {fmtNum(r.firedAt)}</span>
                      <span>{when(blockTime(r.firedAt, clock))}</span>
                      <span>{r.firedAt >= r.deadline ? `${r.firedAt - r.deadline} blocks after the deadline` : `${r.deadline - r.firedAt} blocks early`}</span>
                    </div>
                  </div>
                </div>
              ))}
              {!receipts.length && (
                <div className="tl-item">
                  <span className="tl-dot wait">
                    <I n="timer" s={12} />
                  </span>
                  <div className="grow">
                    <div className="t">{st === 'firing' ? 'Firing…' : st === 'waiting' ? 'Waiting for its target' : 'Scheduled'}</div>
                    <div className="m">{dl ? `due ${when(dl)} · block ${fmtNum(deadline)}` : 'the target entity is gone; a worker records a skipped receipt'}</div>
                  </div>
                </div>
              )}
            </div>
          </Panel>

          <Panel title="Deliveries" body={false}>
            {receipts.length ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="perm-t" style={{ minWidth: 520 }}>
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: 14, textAlign: 'left' }}>Time</th>
                      <th style={{ textAlign: 'left' }}>Result</th>
                      <th style={{ textAlign: 'left' }}>Attempts</th>
                      <th style={{ textAlign: 'left' }}>Took</th>
                      <th style={{ textAlign: 'right', paddingRight: 14 }}>Worker</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipts.map(r => (
                      <tr key={r.key}>
                        <td style={{ paddingLeft: 14, textAlign: 'left' }} className="num muted">
                          {when(blockTime(r.firedAt, clock))}
                        </td>
                        <td style={{ textAlign: 'left' }}>
                          <span className={`badge ${receiptTone(r.status)}`}>
                            <span className="dot" />
                            {r.status === 'ok' ? (r.action === 'webhook' ? `${r.result.code || 200} OK` : 'Delivered') : r.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'left' }} className="num muted">
                          {r.result.attempts ?? 1}
                        </td>
                        <td style={{ textAlign: 'left' }} className="num muted">
                          {r.result.latencyMs != null ? `${r.result.latencyMs} ms` : '—'}
                        </td>
                        <td style={{ textAlign: 'right', paddingRight: 14 }}>
                          <a className="mono faint" href={addrUrl(r.worker)} target="_blank" rel="noreferrer">
                            {short(r.worker)}
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="panel-b">
                <Empty sm icon="receipt" title="No deliveries yet" text="When a worker fires this rule, each attempt shows up here." />
              </div>
            )}
          </Panel>
        </div>

        <div className="stack">
          <Panel title="Details">
            <dl className="props">
              <dt>Trigger</dt>
              <dd>{t.on === 'expire' ? 'An entity expires' : 'A date and time'}</dd>
              {t.on === 'expire' && (
                <>
                  <dt>Entity</dt>
                  <dd>
                    <Addr a={t.target} link={false} />
                    <div className="faint" style={{ fontSize: 12 }}>
                      {trail.targetExpiresAt ? `expires ${when(blockTime(trail.targetExpiresAt, clock))}` : 'expired or deleted'}
                    </div>
                  </dd>
                </>
              )}
              <dt>Deadline</dt>
              <dd>
                {dl ? when(dl) : '—'}
                {deadline != null && <div className="faint mono" style={{ fontSize: 11.5 }}>block {fmtNum(deadline)}</div>}
              </dd>
              {t.offset > 0n && (
                <>
                  <dt>Fires early</dt>
                  <dd>by {offsetText(t.offset)}</dd>
                </>
              )}
              <dt>Action</dt>
              <dd>
                <ActTag action={rule.action} />
              </dd>
              {rule.message && (
                <>
                  <dt>Message</dt>
                  <dd>{rule.message}</dd>
                </>
              )}
              {rule.url && (
                <>
                  <dt>Webhook</dt>
                  <dd className="mono" style={{ fontSize: 12 }}>
                    {rule.url}
                  </dd>
                </>
              )}
              {rule.chat && (
                <>
                  <dt>Telegram chat</dt>
                  <dd className="row" style={{ gap: 6 }}>
                    <I n="lock" s={13} className="faint" />
                    Sealed to the worker
                  </dd>
                </>
              )}
              {rule.extendDays && (
                <>
                  <dt>Extend by</dt>
                  <dd>{rule.extendDays} days</dd>
                </>
              )}
              <dt>Who fires</dt>
              <dd>{rule.worker === 'any' ? 'Any public worker' : <Addr a={rule.worker} />}</dd>
              <dt>Retries</dt>
              <dd>{rule.retries}</dd>
              <dt>Rule key</dt>
              <dd>
                <Addr a={rule.key} link={false} />
              </dd>
              <dt>Cleans up</dt>
              <dd>{when(blockTime(rule.expiresAt, clock))}</dd>
            </dl>
          </Panel>
          <Panel
            title="Raw entity"
            acts={
              <>
                <button className="btn btn-sm btn-ghost" onClick={() => copy(rule.key, 'Rule key copied')}>
                  <I n="copy" s={13} />
                  Key
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => setRaw(r => !r)}>
                  <I n={raw ? 'eye-off' : 'eye'} s={13} />
                  {raw ? 'Hide' : 'Show'}
                </button>
              </>
            }
          >
            {raw ? (
              <Code>{toJson({ ...rule, chat: rule.chat ? rule.chat.slice(0, 26) + '…' : undefined })}</Code>
            ) : (
              <p className="faint" style={{ fontSize: 12.5, margin: 0 }}>
                The attributes and payload exactly as stored on Arkiv. Anyone can read them; the chat code is sealed.
              </p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
