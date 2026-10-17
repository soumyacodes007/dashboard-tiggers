// A read-only relay to Arkiv for when a visitor's browser has used up Arkiv's anonymous read budget.
// The dashboard calls Arkiv directly first and only falls back here on a 429. The access key comes from
// this function's environment (ARKIV_ACCESS_KEY, set in Vercel, never a VITE_ variable), so it never
// reaches the browser. Only read methods pass, so the key cannot be used to write or for anything else.
const UPSTREAM = 'https://rpc.tiramisu.db-chain.testnet.arkiv.network';
const READS = new Set([
  'arkiv_query',
  'arkiv_getBlockTiming',
  'eth_blockNumber',
  'eth_chainId',
  'eth_getBalance',
  'eth_getLogs',
  'eth_getBlockByNumber',
  'eth_getTransactionReceipt',
  'eth_call',
]);
const MAX_BATCH = 20;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.ARKIV_ACCESS_KEY;
  if (!key) return res.status(503).json({ error: 'relay not configured' });
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'invalid JSON' });
    }
  }
  const calls = Array.isArray(body) ? body : [body];
  if (!calls.length || calls.length > MAX_BATCH || !calls.every(c => c && READS.has(c.method))) {
    return res.status(403).json({ error: 'only read methods are relayed' });
  }
  try {
    const r = await fetch(UPSTREAM, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-API-KEY': key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    res.status(r.status);
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'no-store');
    return res.send(await r.text());
  } catch {
    return res.status(502).json({ error: 'Arkiv did not answer' });
  }
}
