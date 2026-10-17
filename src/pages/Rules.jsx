// Rules: every rule as a sentence, filterable by status, plus drafts kept in this browser.
import { useState } from 'react';
import { I } from '../ui/icons.jsx';
import { Empty, Panel, Seg, StateIcon, useNow } from '../ui/kit.jsx';
import { RuleRow } from '../ui/rules.jsx';
import { dropDraft, loadMine, setUi, useStore } from '../lib/store.js';
import { go, href } from '../lib/router.js';
import { ago, ruleSentence, ruleState } from '../lib/format.js';
import { pickTemplate } from './Overview.jsx';

export function Rules() {
  const { wallet, rules, rulesLoaded, rulesError, clock, drafts } = useStore();
  const [f, setF] = useState('all');
  const [q, setQ] = useState('');
  useNow(5000);
  if (!wallet) return <ConnectFirst what="your rules" />;
  const st = r => ruleState(r, clock);
  const groups = {
    all: rules,
    active: rules.filter(r => ['active', 'firing', 'waiting'].includes(st(r))),
    fired: rules.filter(r => ['fired', 'skipped'].includes(st(r))),
    failed: rules.filter(r => st(r) === 'failed'),
  };
  const match = r => !q || `${r.name} ${r.key} ${ruleSentence(r)}`.toLowerCase().includes(q.toLowerCase());
  const list = f === 'drafts' ? [] : groups[f].filter(match);
  const order = { firing: 0, active: 1, waiting: 2, failed: 3, fired: 4, skipped: 5 };
  list.sort((a, b) => order[st(a)] - order[st(b)] || (a.deadline < b.deadline ? -1 : 1));
  return (
    <div className="page">
      <div className="ph">
        <div>
          <h1>Rules</h1>
          <p>Each rule is an entity on Arkiv, created by your wallet. Workers read them; nothing else is needed.</p>
        </div>
        <div className="acts">
          <a className="btn btn-primary" href={href('rules/new')}>
            <I n="plus" s={14} />
            New rule
          </a>
        </div>
      </div>
      <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <Seg
          value={f}
          onChange={setF}
          label="Filter rules"
          options={[
            ['all', 'All', groups.all.length],
            ['active', 'Active', groups.active.length],
            ['fired', 'Fired', groups.fired.length],
            ['failed', 'Failed', groups.failed.length || ''],
            ['drafts', 'Drafts', drafts.length || ''],
          ]}
        />
        <span className="sp" />
        <div className="inwrap" style={{ width: 240 }}>
          <I n="search" s={13} />
          <input className="input" placeholder="Search rules" value={q} onChange={e => setQ(e.target.value)} aria-label="Search rules" />
        </div>
      </div>
      {f === 'drafts' ? (
        <Panel body={false}>
          {drafts.length ? (
            <div className="rlist">
              {drafts.map(d => (
                <div key={d.id} className="rrow" onClick={() => (sessionStorage.setItem('trg.draft', d.id), go('rules/new'))}>
                  <StateIcon state="draft" s={16} />
                  <div style={{ minWidth: 0 }}>
                    <div className="t trunc">{d.form.name || 'Untitled draft'}</div>
                    <div className="s trunc">Saved in this browser {ago(d.updatedAt)} · not on Arkiv yet</div>
                  </div>
                  <div className="hide-sm" />
                  <div className="hide-sm" />
                  <div className="hide-sm" />
                  <button className="ibtn ibtn-sm" aria-label="Discard draft" data-tip="Discard" onClick={e => (e.stopPropagation(), dropDraft(d.id))}>
                    <I n="trash-2" s={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="panel-b">
              <Empty icon="pencil" title="No drafts" text="Rules you start but don't publish are saved here, in this browser only." />
            </div>
          )}
        </Panel>
      ) : !rulesLoaded && rulesError ? (
        <Panel>
          <Empty err icon="circle-alert" title="Couldn't load your rules" text={`${rulesError} Your rules are safe on Arkiv; this page retries on its own.`}>
            <button className="btn btn-secondary btn-sm" onClick={loadMine}>
              <I n="refresh-cw" s={13} />
              Try again
            </button>
          </Empty>
        </Panel>
      ) : !rulesLoaded ? (
        <Panel body={false}>
          {[0, 1, 2].map(i => (
            <div key={i} className="lrow static" style={{ minHeight: 54 }}>
              <span className="sk" style={{ width: 16, height: 16, borderRadius: '50%' }} />
              <span className="col grow" style={{ gap: 6 }}>
                <span className="sk" style={{ width: '30%', height: 11 }} />
                <span className="sk" style={{ width: '55%', height: 9 }} />
              </span>
            </div>
          ))}
        </Panel>
      ) : list.length ? (
        <Panel body={false} className="rlist">
          {list.map(r => (
            <RuleRow key={r.key} rule={r} />
          ))}
        </Panel>
      ) : rules.length ? (
        <Panel>
          <Empty icon="search" title="No rules match" text="Try another filter or search." />
        </Panel>
      ) : (
        <Panel>
          <Empty icon="zap" title="No rules yet" text="Start from a template, or build one from scratch. It takes under a minute.">
            <div className="row" style={{ gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => pickTemplate('expiry-telegram')}>
                <I n="send" s={13} />
                Expiry → Telegram
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => pickTemplate('time-webhook')}>
                <I n="webhook" s={13} />
                Time → webhook
              </button>
              <a className="btn btn-primary btn-sm" href={href('rules/new')}>
                <I n="plus" s={13} />
                New rule
              </a>
            </div>
          </Empty>
        </Panel>
      )}
    </div>
  );
}

export function ConnectFirst({ what }) {
  return (
    <div className="page">
      <div className="panel" style={{ maxWidth: 520, margin: '40px auto' }}>
        <Empty icon="wallet" title="Connect a wallet" text={`Arkiv knows ${what} by the wallet that created them. Connect one to see them.`}>
          <button className="btn btn-primary btn-sm" onClick={() => setUi({ modal: { type: 'connect' } })}>
            <I n="wallet" s={14} />
            Connect wallet
          </button>
        </Empty>
      </div>
    </div>
  );
}
