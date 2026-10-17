// Wallets. Browser wallets are found with EIP-6963 (every installed extension announces itself), then
// switched to Tiramisu, adding the network if it is missing. A session wallet is a key kept in this
// browser: handy for a demo, funded from the faucet, and never sent anywhere.
import { createWalletClient } from '@arkiv-network/sdk';
import { tiramisu } from '@arkiv-network/sdk/chains';
import { custom, http, toHex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { DEFAULT_RPC_URL } from 'arkiv-triggers';
import { EXPLORER } from './format.js';

const SESSION_KEY = 'trg.session-key';
const LAST_KEY = 'trg.wallet';

/** Wallet extensions that announced themselves (EIP-6963), plus window.ethereum as a fallback. */
const found = new Map();
let listeners = [];
export function discoverWallets(onChange) {
  listeners.push(onChange);
  const onAnnounce = e => {
    const { info, provider } = e.detail || {};
    if (!info?.uuid || found.has(info.rdns || info.uuid)) return;
    found.set(info.rdns || info.uuid, { id: info.rdns || info.uuid, name: info.name, icon: info.icon, provider });
    listeners.forEach(l => l(injectedWallets()));
  };
  window.addEventListener('eip6963:announceProvider', onAnnounce);
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  onChange(injectedWallets());
  return () => {
    window.removeEventListener('eip6963:announceProvider', onAnnounce);
    listeners = listeners.filter(l => l !== onChange);
  };
}
export function injectedWallets() {
  const list = [...found.values()];
  if (!list.length && window.ethereum) list.push({ id: 'injected', name: window.ethereum.isMetaMask ? 'MetaMask' : 'Browser wallet', provider: window.ethereum });
  return list;
}

const CHAIN_HEX = toHex(tiramisu.id);
async function useTiramisu(provider) {
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_HEX }] });
  } catch (e) {
    if (e?.code !== 4902 && !/unrecognized|not added|unknown chain/i.test(e?.message || '')) throw e;
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: CHAIN_HEX,
          chainName: 'Arkiv Tiramisu',
          nativeCurrency: { name: 'GLM', symbol: 'GLM', decimals: 18 },
          rpcUrls: [DEFAULT_RPC_URL],
          blockExplorerUrls: [EXPLORER],
        },
      ],
    });
  }
}

/** Connects a browser wallet: accounts, then Tiramisu. Returns an Arkiv wallet client. */
export async function connectInjected(w) {
  const [address] = await w.provider.request({ method: 'eth_requestAccounts' });
  if (!address) throw new Error('The wallet returned no account.');
  await useTiramisu(w.provider);
  const client = createWalletClient({ chain: tiramisu, transport: custom(w.provider), account: address });
  remember({ kind: 'injected', id: w.id });
  return { kind: 'injected', name: w.name, address, client, provider: w.provider };
}

export function sessionKeyExists() {
  try {
    return !!localStorage.getItem(SESSION_KEY);
  } catch {
    return false;
  }
}
/** A key kept in this browser's storage. Created on first use. */
export function connectSession() {
  let key;
  try {
    key = localStorage.getItem(SESSION_KEY);
    if (!key) {
      key = generatePrivateKey();
      localStorage.setItem(SESSION_KEY, key);
    }
  } catch {
    key = generatePrivateKey();
  }
  const account = privateKeyToAccount(key);
  const client = createWalletClient({ chain: tiramisu, transport: http(DEFAULT_RPC_URL), account });
  remember({ kind: 'session' });
  return { kind: 'session', name: 'Session wallet', address: account.address, client };
}
export function forgetSessionKey() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage blocked */
  }
}

function remember(v) {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify(v));
  } catch {
    /* storage blocked */
  }
}
export function forgetWallet() {
  try {
    localStorage.removeItem(LAST_KEY);
  } catch {
    /* storage blocked */
  }
}
/** Reconnects the last wallet without a prompt where possible (session always; injected if already authorised). */
export async function restoreWallet() {
  let last;
  try {
    last = JSON.parse(localStorage.getItem(LAST_KEY) || 'null');
  } catch {
    return null;
  }
  if (!last) return null;
  if (last.kind === 'session') return sessionKeyExists() ? connectSession() : null;
  await new Promise(r => setTimeout(r, 150)); // give extensions time to announce
  const w = injectedWallets().find(x => x.id === last.id) || injectedWallets()[0];
  if (!w) return null;
  const accounts = await w.provider.request({ method: 'eth_accounts' }).catch(() => []);
  if (!accounts?.length) return null;
  return connectInjected(w);
}

/** Human words for the errors wallets throw. */
export function walletError(e) {
  const m = e?.shortMessage || e?.message || String(e);
  if (e?.code === 4001 || /reject|denied|cancel/i.test(m)) return 'You cancelled in your wallet. Nothing was written.';
  if (/insufficient funds|exceeds balance|gas required exceeds/i.test(m)) return 'Not enough test GLM to pay for this. Get some from the faucet.';
  if (/429|quota|rate/i.test(m)) return 'Arkiv is rate-limiting this browser right now. Try again in a minute.';
  return m.split('\n')[0].slice(0, 180);
}
