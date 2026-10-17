import { useState } from 'react';
import { I } from '../ui/icons.jsx';
import { Modal, cx, toast } from '../ui/kit.jsx';
import { deleteRule, setUi } from '../lib/store.js';
import { go, useRoute } from '../lib/router.js';
import { walletError } from '../lib/wallet.js';

export function DeleteModal({ rule }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const route = useRoute();
  const close = () => setUi({ modal: null });
  const ok = async () => {
    setBusy(true);
    setErr('');
    try {
      await deleteRule(rule.key);
      close();
      toast('Rule deleted from Arkiv');
      if (route.name === 'rule') go('rules');
    } catch (e) {
      setErr(walletError(e));
      setBusy(false);
    }
  };
  return (
    <Modal
      title="Delete this rule?"
      size="sm"
      onClose={close}
      footer={
        <>
          <span className="sp" />
          <button className="btn btn-secondary" onClick={close} autoFocus>
            Cancel
          </button>
          <button className={cx('btn btn-danger', busy && 'is-loading')} onClick={ok} disabled={busy}>
            Delete rule
          </button>
        </>
      }
    >
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5 }}>
        <b>{rule.name || 'This rule'}</b> is removed from Arkiv and will not fire. Receipts already written stay, and the rule's history remains in the chain.
      </p>
      {err && (
        <div className="alert danger">
          <I n="circle-alert" s={15} />
          <span>{err}</span>
        </div>
      )}
    </Modal>
  );
}
