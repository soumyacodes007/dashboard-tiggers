// ⌘K: jump to a page, open a rule, start a rule from a pasted entity key, or switch theme.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { I } from '../ui/icons.jsx';
import { cx } from '../ui/kit.jsx';
import { setPrefs, setUi, useStore } from '../lib/store.js';
import { go } from '../lib/router.js';
import { DOCS, ruleSentence, short } from '../lib/format.js';
import { ROUTES } from './Shell.jsx';

const HEX64 = /^0x[0-9a-fA-F]{64}$/;

export function Palette() {
  const { rules, wallet } = useStore();
  const [q, setQ] = useState('');
  const [hl, setHl] = useState(0);
  const input = useRef(null);
  const close = () => setUi({ palette: false });
  useEffect(() => input.current?.focus(), []);

  const groups = useMemo(() => {
    const t = q.trim();
    const m = s => !t || s.toLowerCase().includes(t.toLowerCase());
    const out = [];
    if (HEX64.test(t))
      out.push({
        name: 'Entity',
        items: [{ icon: 'zap', name: `New rule when ${short(t)} expires`, run: () => (sessionStorage.setItem('trg.prefill', t), go('rules/new')) }],
      });
    out.push({
      name: 'Actions',
      items: [
        { icon: 'plus', name: 'New rule', kbd: 'N', run: () => go('rules/new') },
        !wallet && { icon: 'wallet', name: 'Connect wallet', run: () => setUi({ modal: { type: 'connect' } }) },
        { icon: 'send', name: 'Connect Telegram', run: () => go('connections') },
        { icon: 'book-open', name: 'Open the docs', run: () => window.open(DOCS, '_blank') },
      ].filter(Boolean).filter(x => m(x.name)),
    });
    out.push({
      name: 'Go to',
      items: Object.entries(ROUTES)
        .map(([k, [n, icon]]) => ({ icon, name: n, run: () => go(k === 'overview' ? '' : k) }))
        .filter(x => m(x.name)),
    });
    const rs = rules.filter(r => m(r.name || '') || m(r.key) || m(ruleSentence(r))).slice(0, 8);
    if (rs.length) out.push({ name: 'Rules', items: rs.map(r => ({ icon: 'zap', name: r.name || 'Untitled rule', sub: ruleSentence(r), run: () => go('rules/' + r.key) })) });
    out.push({
      name: 'Theme',
      items: [
        ['light', 'Light theme', 'sun'],
        ['dark', 'Dark theme', 'moon'],
        ['system', 'System theme', 'monitor'],
      ]
        .map(([v, n, icon]) => ({ icon, name: n, run: () => setPrefs({ theme: v }) }))
        .filter(x => m(x.name)),
    });
    return out.filter(g => g.items.length);
  }, [q, rules, wallet]);
  const flat = groups.flatMap(g => g.items);
  const run = it => {
    close();
    it?.run();
  };
  const onKey = e => {
    if (e.key === 'ArrowDown') (e.preventDefault(), setHl(h => Math.min(flat.length - 1, h + 1)));
    else if (e.key === 'ArrowUp') (e.preventDefault(), setHl(h => Math.max(0, h - 1)));
    else if (e.key === 'Enter') (e.preventDefault(), run(flat[hl]));
    else if (e.key === 'Escape') close();
  };
  let idx = 0;
  return createPortal(
    <>
      <div className="scrim" onClick={close} style={{ zIndex: 89 }} />
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command menu">
        <div className="pal-in">
          <I n="command" s={17} />
          <input
            ref={input}
            value={q}
            onChange={e => (setQ(e.target.value), setHl(0))}
            onKeyDown={onKey}
            placeholder="Type a command, a rule name, or paste an entity key…"
            autoComplete="off"
            role="combobox"
            aria-expanded="true"
            aria-controls="pal-list"
          />
          <kbd>Esc</kbd>
        </div>
        <div className="pal-list" id="pal-list" role="listbox">
          {flat.length ? (
            groups.map(g => (
              <div className="pal-group" key={g.name}>
                <div className="pal-sec">{g.name}</div>
                {g.items.map(it => {
                  const i = idx++;
                  return (
                    <div key={i} className={cx('pi', i === hl && 'hl')} role="option" aria-selected={i === hl} onMouseEnter={() => setHl(i)} onClick={() => run(it)}>
                      <I n={it.icon} s={15} />
                      <span className="trunc">{it.name}</span>
                      {it.sub && <span className="sub trunc">{it.sub}</span>}
                      <span className="r">{it.kbd && <kbd>{it.kbd}</kbd>}</span>
                    </div>
                  );
                })}
              </div>
            ))
          ) : (
            <div className="empty-state sm">
              <div className="glyph">
                <I n="search" s={18} />
              </div>
              <h2 className="es-h">No results</h2>
              <p>Try a page name, a rule name, or paste a 66-character entity key.</p>
            </div>
          )}
        </div>
        <div className="pal-f">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd>navigate
          </span>
          <span>
            <kbd>↵</kbd>select
          </span>
          <span className="sp" style={{ flex: 1 }} />
          <span className="faint">Arkiv Triggers</span>
        </div>
      </div>
    </>,
    document.body,
  );
}
