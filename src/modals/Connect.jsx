// Connect a wallet: any browser wallet found via EIP-6963, or a session wallet kept in this browser.
import { useEffect, useState } from 'react';
import { I } from '../ui/icons.jsx';
import { Modal, toast } from '../ui/kit.jsx';
import { adoptWallet, setUi } from '../lib/store.js';
import { connectInjected, connectSession, discoverWallets, sessionKeyExists, walletError } from '../lib/wallet.js';
import { FAUCET, short } from '../lib/format.js';

export function ConnectModal() {
  const [wallets, setWallets] = useState([]);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => discoverWallets(setWallets), []);
  const close = () => setUi({ modal: null });
  const done = w => {
    adoptWallet(w);
    close();
    toast(`Connected as ${short(w.address)}`);
  };
  const injected = async w => {
    setErr('');
    setBusy(w.id);
    try {
      done(await connectInjected(w));
    } catch (e) {
      setErr(walletError(e));
    } finally {
      setBusy(null);
    }
  };
  const hasSession = sessionKeyExists();
  return (
    <Modal title="Connect a wallet" sub="Your wallet signs the rules you create. Arkiv records it as each rule's creator." onClose={close} size="sm">
      <div className="col" style={{ gap: 8 }}>
        {wallets.map(w => (
          <button key={w.id} className="wopt" onClick={() => injected(w)} disabled={!!busy}>
            {w.icon ? <img src={w.icon} alt="" /> : <span className="wicon"><I n="wallet" s={16} /></span>}
            <div className="grow">
              <div className="t">{w.name}</div>
              <div className="d">Switches to Tiramisu, adding the network if needed</div>
            </div>
            {busy === w.id ? <I n="loader" s={15} className="spin" /> : <I n="chevron-right" s={15} className="faint" />}
          </button>
        ))}
        {!wallets.length && (
          <div className="alert info">
            <I n="info" s={15} />
            <span>
              No browser wallet found. Install MetaMask or Rabby, or use a session wallet below.
            </span>
          </div>
        )}
        <button className="wopt" onClick={() => done(connectSession())} disabled={!!busy}>
          <span className="wicon">
            <I n="key" s={16} />
          </span>
          <div className="grow">
            <div className="t">{hasSession ? 'Session wallet' : 'Create a session wallet'}</div>
            <div className="d">A key kept only in this browser. Fund it from the faucet. Good for trying things out.</div>
          </div>
          <I n="chevron-right" s={15} className="faint" />
        </button>
      </div>
      {err && (
        <div className="alert danger">
          <I n="circle-alert" s={15} />
          <span>{err}</span>
        </div>
      )}
      <p className="faint" style={{ fontSize: 12, margin: 0, lineHeight: 1.5 }}>
        Tiramisu is Arkiv's testnet. Writes cost a little test GLM, free from the{' '}
        <a href={FAUCET} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
          faucet
        </a>
        .
      </p>
    </Modal>
  );
}
