# Arkiv Triggers dashboard

The website for [Arkiv Triggers](https://github.com/soumyacodes007/arkiv-triggers): create rules on Arkiv
("when this entity expires, Telegram me"), watch workers fire them, and read the signed receipts.

It is a static, client-side app. Every page reads Arkiv straight from the browser and writes through
your own wallet. There is no backend: if this site goes down, your rules still fire.

## Run it

Use Node 22 or later. The dashboard installs the published `arkiv-triggers@0.1.0` SDK;
no sibling SDK checkout is required.

```bash
git clone https://github.com/soumyacodes007/dashboard-tiggers.git
cd dashboard-tiggers
npm ci
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
```

No settings are needed. Optional ones are in [.env.example](.env.example).

## What's in it

| Page | What it does |
|---|---|
| Overview | Before a wallet: what Triggers is, three templates, live workers. After: stats, the next rules to fire with countdowns, recent receipts, a live feed, a setup checklist |
| Rules | Every rule as a sentence ("When 0xab12… expires (1h early) → Telegram me"), filtered by status, plus drafts kept in this browser |
| New rule | When / Then / Details cards and a review panel: the rule as a sentence, what's missing, and exactly what will be stored on Arkiv (or the same rule as SDK code). Can create a test entity that expires in 3 minutes |
| Rule details | The audit trail (created, claimed, fired), each delivery, and the raw entity |
| Activity | A live stream of receipts over one WebSocket, with pause |
| Workers | Every worker from its heartbeat: online or not, what it can do, and how to run your own |
| Connections | Telegram (the chat code is sealed to the worker in the browser), webhooks, what's next |
| Settings | Wallet, theme and accent, linking your own worker with a signed operator message, network |

`⌘K` / `Ctrl K` opens the command menu; paste an entity key there to start a rule for it. `N` starts a new rule.

## How it talks to Arkiv

- **Reads:** the [`arkiv-triggers`](https://www.npmjs.com/package/arkiv-triggers) SDK, directly against the
  Tiramisu RPC (CORS is open). A snapshot on load, then `watch()` over one WebSocket for receipts and rules;
  heartbeats and the block clock refresh every 30 s.
- **Writes:** your wallet signs. Browser wallets are found with EIP-6963 and switched to Tiramisu
  (chain 7738577), adding it if needed. A **session wallet** (a key kept only in this browser) is there
  for trying things out; fund it from the [faucet](https://hub.arkiv.network/faucet).
- **The anonymous read budget:** a browser cannot hold an access key, so reads use Arkiv's anonymous quota.
  Reads fail fast instead of hanging when it runs out (see `arkiv/friction.md` #10 in the main repo), the
  page says so in a banner, and it retries every 30 s.

## Kept off Arkiv, on purpose

Rules are public, so nothing secret or personal goes in one. The Telegram chat code is encrypted to one
worker's key here in the browser (`sealForWorker`) before it can go into a rule. Drafts, the Telegram
connection and the session key live only in this browser's storage.

## Design

Built on the Gr8r Studio design system (its tokens, components and spacing, used as is), with the pages
designed for Triggers. React 18 + Vite, Lucide icons, Geist.

## Licence

MIT
