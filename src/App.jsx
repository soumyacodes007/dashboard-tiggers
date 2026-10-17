import { useEffect } from 'react';
import { Shell } from './shell/Shell.jsx';
import { Palette } from './shell/Palette.jsx';
import { ToastHost, Empty, toast } from './ui/kit.jsx';
import { boot, onLiveReceipt, getState, setUi, useStore } from './lib/store.js';
import { go, href, useRoute } from './lib/router.js';
import { resultText } from './ui/rules.jsx';
import { Overview } from './pages/Overview.jsx';
import { Rules } from './pages/Rules.jsx';
import { RuleEditor } from './pages/RuleEditor.jsx';
import { RuleDetail } from './pages/RuleDetail.jsx';
import { Activity } from './pages/Activity.jsx';
import { Workers } from './pages/Workers.jsx';
import { Connections } from './pages/Connections.jsx';
import { Settings } from './pages/Settings.jsx';
import { ConnectModal } from './modals/Connect.jsx';
import { TelegramModal } from './modals/Telegram.jsx';
import { DeleteModal } from './modals/Delete.jsx';

/** gr8r's theme attributes on <html>, from preferences. */
function useTheme() {
  const prefs = useStore(s => s.prefs);
  useEffect(() => {
    const r = document.documentElement;
    if (prefs.theme === 'system') r.removeAttribute('data-theme');
    else r.setAttribute('data-theme', prefs.theme);
    if (prefs.accent === 'indigo') r.removeAttribute('data-accent');
    else r.setAttribute('data-accent', prefs.accent);
  }, [prefs.theme, prefs.accent]);
}

function Page() {
  const route = useRoute();
  switch (route.name) {
    case 'overview':
      return <Overview />;
    case 'rules':
      return <Rules />;
    case 'new':
      return <RuleEditor key={route.seq} />;
    case 'rule':
      return <RuleDetail key={route.params.key} k={route.params.key} />;
    case 'activity':
      return <Activity />;
    case 'workers':
      return <Workers />;
    case 'connections':
      return <Connections />;
    case 'settings':
      return <Settings sec={route.params.sec} />;
    default:
      return (
        <div className="page">
          <div className="panel" style={{ maxWidth: 520, margin: '40px auto' }}>
            <Empty icon="search" title="Page not found" text="The page was moved, or never existed.">
              <a className="btn btn-secondary btn-sm" href={href('')}>
                Go to Overview
              </a>
            </Empty>
          </div>
        </div>
      );
  }
}

export function App() {
  const { ui } = useStore();
  useTheme();
  useEffect(() => {
    boot();
    const off = onLiveReceipt(r => {
      const rule = getState().rules.find(x => x.key.toLowerCase() === r.rule.toLowerCase());
      toast(`${rule?.name || 'A rule'} fired · ${resultText(r)}`, { kind: r.status === 'failed' ? 'err' : 'ok', action: 'View', onAction: () => go('rules/' + r.rule) });
    });
    const key = e => {
      const typing = e.target.closest?.('input,textarea,[contenteditable]');
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setUi({ palette: !getState().ui.palette });
      } else if (!typing && !e.metaKey && !e.ctrlKey && e.key.toLowerCase() === 'n' && !getState().ui.modal) {
        go('rules/new');
      }
    };
    addEventListener('keydown', key);
    return () => {
      off();
      removeEventListener('keydown', key);
    };
  }, []);
  return (
    <>
      <Shell>
        <Page />
      </Shell>
      {ui.palette && <Palette />}
      {ui.modal?.type === 'connect' && <ConnectModal />}
      {ui.modal?.type === 'telegram' && <TelegramModal />}
      {ui.modal?.type === 'delete' && <DeleteModal rule={ui.modal.rule} />}
      <ToastHost />
    </>
  );
}
