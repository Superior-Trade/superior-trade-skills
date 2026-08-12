# Polymarket API Reference

Every Superior Trade v3 endpoint used by this skill, with request and response shapes.

Reference for the `polymarket` skill. See SKILL.md for the workflow and safety rules.

---

## API Reference

### Account

#### GET `/v3/account` — List Trading Accounts

```json
{
  "items": [
    {
      "name": "Trading Account 1",
      "account_index": 1,
      "wallet_address": "0x1234567890123456789012345678901234567890"
    }
  ]
}
```

#### POST `/v3/account` — Create Trading Account

Creates a Privy server wallet-backed trading account. Limit: 3 active trading accounts per user.

```json
// Request
{ "name": "btc-carry" }

// Response
{
  "account": {
    "id": "acct_...",
    "label": "btc-carry",
    "account_index": 2,
    "wallet_address": "0x5678901234567890123456789012345678901234",
    "wallet_id": "privy-wallet-id",
    "status": "active"
  }
}
```

Error `409 trading_account_limit_reached` means the user already has 3 active trading accounts.

#### PATCH `/v3/account/{address}` — Rename Trading Account

```json
// Request
{ "name": "fed-spread" }

// Response
{
  "account": {
    "name": "fed-spread",
    "account_index": 2,
    "wallet_address": "0x5678901234567890123456789012345678901234"
  }
}
```

#### POST `/v3/account/{address}/polymarket` — Bootstrap Polymarket

Bootstraps Polymarket setup for an owned trading-account wallet. This returns onboarding steps and accepted assets; it does **not** return a deposit address.

```json
{
  "wallet_id": "privy-wallet-id",
  "chain": "polygon",
  "chain_id": 137,
  "account": {
    "type": "trading_account",
    "name": "fed-spread",
    "account_index": 2,
    "wallet_address": "0x5678901234567890123456789012345678901234"
  },
  "onboarding": {
    "target": "polymarket",
    "account_type": "trading_account",
    "next_step": "deposit_polygon_assets",
    "steps": [
      { "id": "verify_trading_account_wallet", "status": "complete" },
      { "id": "deposit_polygon_assets", "status": "ready" },
      { "id": "convert_to_pusd", "status": "available_after_deposit" }
    ]
  },
  "accepted_assets": [
    {
      "symbol": "USDC",
      "address": "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
      "decimals": 6
    }
  ],
  "gasless": true
}
```

#### GET `/v3/account/{address}/status/polymarket` — Readiness and Balances

Use this before deployment start. The v3 route reconciles approvals and CLOB credentials when possible and checks Polygon balances.

```json
{
  "chain": "polygon",
  "chain_id": 137,
  "wallet": {
    "address": "0x5678901234567890123456789012345678901234",
    "name": "fed-spread",
    "index": 2
  },
  "balance": {
    "minimum": "5",
    "usdc": "10.25",
    "usdcNative": "10.25",
    "usdcE": "0",
    "pusd": "8.00",
    "pol": "0.01",
    "meetsMinimum": true
  },
  "onboarding": {
    "ready": true,
    "onboarded": true,
    "approvalsSet": true
  },
  "polymarketApi": {
    "credentialsStored": true
  }
}
```

#### GET `/v3/account/{address}/deposit-link` — REMOVED (404; use the deposit-qr skill instead)

Generates wallet deep links for depositing native USDC to an owned trading-account wallet. Query params: `chain` (`polygon` or `arbitrum`, default `arbitrum`), `amount` (default `10`), and `wallet` (`all`, `metamask`, `trust`, `coinbase`, etc.).

```json
{
  "chain": "polygon",
  "chain_id": 137,
  "token": {
    "symbol": "USDC",
    "address": "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
    "decimals": 6
  },
  "amount": "10",
  "amount_atoms": "10000000",
  "wallet_address": "0x5678901234567890123456789012345678901234",
  "selected_wallet": "all",
  "links": {
    "metamask": "https://...",
    "eip681": "ethereum:pay-..."
  }
}
```

### Portfolio Funding

#### POST `/v3/portfolio/polymarket/deposit` — Deposit Polygon USDC to Polymarket

Wraps Polygon USDC or USDC.e held by an owned Superior wallet into Polymarket pUSD. This is an on-chain action using the platform-managed wallet; present the details and get confirmation when user intent is not already explicit.

```json
// Request
{
  "chain": "polygon",
  "asset_address": "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
  "amount": "10",
  "from": "0x5678901234567890123456789012345678901234"
}

// Response
{
  "txHash": "0x...",
  "deposit": {
    "id": "dep_...",
    "venue": "polymarket",
    "amount": "10",
    "depositedAmount": "10",
    "status": "completed",
    "superiorWalletAddress": "0x5678901234567890123456789012345678901234",
    "polygonBalance": "0",
    "pusdBalance": "10",
    "bridgeTxHash": "0x..."
  }
}
```

Requirements: `chain`, `asset_address`, `amount`, and `from` are required strings. `chain` must be `polygon`; `asset_address` must be Polygon USDC or USDC.e; minimum amount is 5 USDC.

#### POST `/v3/portfolio/polymarket/exit` — Close Polymarket Portfolio

Closes all Polymarket positions and cancels orders for the selected wallet. This is portfolio-level, not deployment-level; `/v3/deployment/{id}/exit` does not exist.

```json
// Request
{ "tradingAccountId": "acct_..." }

// Response
{
  "orders_cancelled": 3,
  "positions_closed": 2,
  "wallet_address": "0x5678901234567890123456789012345678901234"
}
```

Before calling this, tell the user it closes all Polymarket positions/orders for that wallet and get explicit confirmation.

#### POST `/v3/authorize-and-send/polymarket` — Place One Immediate Market Order

Signs and sends one whitelisted Polymarket action through an owned wallet. Use this for a single user-confirmed bet/order, not for strategy deployments.

Before calling this endpoint:

1. Fetch `GET /v3/account`.
2. Use only a listed `wallet_address` as `action.from`.
3. Fetch `GET /v3/account/{address}/status/polymarket`.
4. Confirm onboarding, approvals, credentials, and pUSD balance are ready for the requested order.
5. Confirm the exact order payload with the user unless they already explicitly confirmed that exact payload in the current conversation.

```json
// Request
{
  "action": {
    "type": "placeMarketOrder",
    "from": "0x5678901234567890123456789012345678901234",
    "tokenID": "1234567890",
    "side": "BUY",
    "amount": "10",
    "price": 0.55,
    "orderType": "FOK"
  }
}
```

`action.type` must be `placeMarketOrder`. `action.from` must be an owned wallet from `GET /v3/account`; do not pass user-provided addresses that are not in the account list.

### Polymarket Positions and Orders

Use these checks whenever the user asks about current holdings, open bets, pending orders, whether a deployment traded, or whether it is safe to stop/exit. Do not infer live exposure from deployment status alone.

Read-only checks do not require user confirmation. Order placement, cancellation, portfolio exit, and deployment start still require explicit confirmation.

#### GET `https://data-api.polymarket.com/positions` — Current Positions

Positions are public by wallet address. First get the owned wallet from `GET /v3/account` or the selected deployment credentials, then call:

```http
GET https://data-api.polymarket.com/positions?user=0x5678901234567890123456789012345678901234&sizeThreshold=0&limit=500&sortBy=TOKENS&sortDirection=DESC
```

Summarize:

- Number of open positions
- Largest exposures by market/outcome
- Current price/probability when present
- Unrealized PnL when present
- Any tiny dust positions separately

If the response is empty, say the wallet has no current Polymarket positions verified by the position API.

#### CLOB Open Orders — Authenticated Order State

Open orders require authenticated Polymarket CLOB credentials/client context. Use the authenticated client when available; never ask the user to paste a CLOB secret/passphrase into chat.

```ts
const orders = await clobClient.getOpenOrders({ market, asset_id }, true)
const order = await clobClient.getOrder(orderId)
```

Underlying endpoints:

- `GET https://clob.polymarket.com/data/orders`
- `GET https://clob.polymarket.com/data/order/{orderId}`

Filter params are optional:

```json
{
  "market": "0x...",
  "asset_id": "1234567890",
  "id": "order-id"
}
```

Summarize each meaningful order with:

- Market/outcome when known
- Side, price, original size, matched size, and unmatched size
- Status, order type, created time, expiration

Unmatched size is `original_size - size_matched`. If authenticated order reads are unavailable in the current context, say that positions were checked but authenticated open orders could not be fetched from this environment.

#### CLOB Trades — Fill History

Use this when the user asks "did it trade?", "what filled?", or wants debugging for a deployment that appears idle.

```ts
const trades = await clobClient.getTrades({ maker_address: walletAddress, market, asset_id }, true)
```

Underlying endpoint:

- `GET https://clob.polymarket.com/data/trades`

Present fills as market/outcome, side, price, size, timestamp, and related order ID when available. Do not use trade history as proof of current exposure; check current positions too.

#### State Check Pattern

For "what do I have open?" use this order:

1. `GET /v3/account` to identify the selected owned wallet if needed.
2. `GET /v3/account/{address}/status/polymarket` for readiness and balances.
3. `GET https://data-api.polymarket.com/positions?...` for current positions.
4. Authenticated CLOB `getOpenOrders()` for pending orders, if client credentials are available.
5. Authenticated CLOB `getTrades()` only when the user asks about fills/history or debugging.

For "exit everything", first show the verified positions/orders summary, then ask for explicit confirmation before calling `POST /v3/portfolio/polymarket/exit`.

### Markets

#### POST `/v3/markets/search` — Search Polymarket Markets

Use this before any Polymarket backtest when the user describes a market in natural language ("BTC 120k before July", "Trump Greenland before 2027", "Fed 50 bps cut") or provides a Polymarket event URL such as `https://polymarket.com/event/world-cup-winner`. The endpoint returns candidates, not a single guaranteed resolution.

```json
// Request
{
  "query": "https://polymarket.com/event/world-cup-winner",
  "limit": 10
}
```

**Fields:** `query` is required. It can be natural language, an exact market slug, or a Polymarket event URL. `limit` is optional, defaults to 10, and must be between 1 and 50.

**Response:**

```json
{
  "status": "candidates_found",
  "candidates": [
    {
      "slug": "will-bitcoin-hit-120000-before-july-1",
      "question": "Will Bitcoin hit $120,000 before July 1?",
      "tradeCount": 12345,
      "liquidity": 240000.5,
      "volume": 1800000.25,
      "volume24h": 95000.1,
      "coverage": {
        "start": "2026-05-01",
        "end": "2026-06-17"
      },
      "dataMode": "fills_only",
      "coverageStatus": "available",
      "backtestSupported": true,
      "deploymentSupported": false,
      "matchedKeywords": ["bitcoin", "120000", "july"]
    }
  ]
}
```

`status: "not_found"` with an empty `candidates` array means no matching market was found. Do not invent a slug.

Search rules:

- If the user provides a Polymarket event URL, pass the full URL as `query`; do not manually strip it or guess the child market.
- Event URLs can expand into child markets. Example: `https://polymarket.com/event/world-cup-winner` can return country-specific markets such as `will-portugal-win-the-2026-fifa-world-cup-912`.
- If the user says "Ronaldo World Cup winner", search first; do not claim no market exists just because there is no exact Ronaldo-title market. The relevant candidate may be a Portugal World Cup market.
- Pass the candidate `slug` exactly as returned into `marketSlugs[]` for `POST /v3/backtest`.
- If more than one candidate is plausible, ask the user to choose by question/slug before backtesting or deploying.
- For filled-data backtests, prefer candidates with `coverageStatus: "available"` and `backtestSupported: true`.
- If `coverageStatus` is `"metadata_only"`, the market is known but historical filled data is not hydrated yet; explain that it cannot be backtested until data coverage is available.
- `deploymentSupported` is intentionally separate from `backtestSupported`; do not assume a market is deployable just because filled-data backtesting is available.
- Current market search does **not** return order book depth, outcome token IDs, current prices, or prebuilt `instrument_id`s.

#### Instrument ID Format

Each outcome (Yes/No) is a separate tradeable instrument:

```
{clobTokenId}.POLYMARKET
```

Do not derive or guess token IDs from search candidates. Market search is for finding the exact `slug` and data coverage; it intentionally does not return outcome token IDs. Backtests can resolve market dataset instruments from `marketSlugs[]`; live deployment config must include a validated `instrument_id` such as `"1234567890.POLYMARKET"`.

### Strategy Source

There is no `/v3/strategy` create/list/detail endpoint in the current `apps/api` main surface. Strategies are supplied inline:

- Backtests: `POST /v3/backtest` with `strategyId`, optional `strategySource`, and optional `strategyConfig`.
- Live deployments: `POST /v3/deployment` with `deployment.code` and `deployment.config`.

Keep generated strategy code self-contained and NautilusTrader-compatible. Avoid filesystem/network operations, private-key handling, and hidden side effects.

### Backtest

#### POST `/v3/backtest` — Create and Run

```json
// Request
{
  "tenantId": "tenant_a",
  "backtestId": "bt_xyz789",
  "strategyId": "strat_abc123",
  "strategySource": "from nautilus_trader.config import StrategyConfig\nfrom nautilus_trader.model.data import TradeTick\n...",
  "strategyConfig": {
    "order_size": 10,
    "lookback_ticks": 20
  },
  "marketSlugs": ["will-donald-trump-win-the-2024-us-presidential-election"],
  "startingBalance": 1000,
  "timerange": { "start": "2024-10-01", "end": "2024-11-06" },
  "venueProfile": "polymarket-london"
}

// Response — planned/queued
{
  "tenantId": "tenant_a",
  "backtestId": "bt_xyz789",
  "strategyId": "strat_abc123",
  "status": "queued",
  "executionCluster": "london-poc",
  "namespace": "superior-trade",
  "resultUri": "gs://.../backtest-results/polymarket/tenant=tenant_a/date=2026-06-17/bt_xyz789.json",
  "plannedResources": ["ConfigMap", "Job", "NautilusBacktestRun"],
  "resources": []
}
```

- `tenantId`, `backtestId`, `strategyId`, `marketSlugs`, `timerange`, and `venueProfile` are required.
- For generated custom strategies, use `strategyId` as the strategy/run identifier and include `strategySource` + `strategyConfig`. If `strategySource` is omitted, the API tries the known template matching `strategyId`.
- If the custom strategy config declares `instrument_id`, the runner injects the primary market outcome instrument when `strategyConfig.instrument_id` is omitted. Only provide explicit instrument IDs when the user or a market-detail source gives exact values.
- Use exact `slug` values returned by `POST /v3/markets/search` as `marketSlugs[]`.
- `startingBalance` defaults to 1000 pUSD.
- `timerange` must fit inside the candidate coverage returned by market search. If data coverage is missing, the API returns `409` with a blocked reason instead of pretending the backtest ran.
- The engine loads historical **trade ticks** for each market slug. Filled-data backtests cannot prove order-book queue priority, spread capture, or exact partial-fill realism.

> **Backtests replay historical trade ticks.** Strategies that only subscribe to quote ticks (`subscribe_quote_ticks`) may receive no callbacks in a backtest. For backtestable strategies, drive logic from `on_trade_tick` (or subscribe to both and let live trading benefit from quotes).

#### GET `/v3/backtest/{id}/status` — Poll Status

Poll until `status` is `completed` or `failed`. Typical run takes 1–30 seconds depending on data size.

**Statuses:** `pending` → `running` → `completed` | `failed`

```json
{
  "id": "bt_xyz789",
  "status": "completed",
  "resultUrl": "gs://.../backtest-results/polymarket/tenant=tenant_a/date=2026-06-17/bt_xyz789.json",
  "k8sJobName": "polymarket-backtest-bt-xyz789"
}
```

#### GET `/v3/backtest/{id}` — Persisted Record

Returns the persisted backtest record and current status.

#### GET `/v3/backtest/{id}/result` — Uploaded Result

Returns `202` while the result is not ready, then `200` when the runner has uploaded JSON to GCS.

```json
// Response (completed)
{
  "backtest_id": "bt_xyz789",
  "status": "completed",
  "resultUri": "gs://.../backtest-results/polymarket/tenant=tenant_a/date=2026-06-17/bt_xyz789.json",
  "result": {
    "starting_balance": 1000,
    "ending_balance": 1087.5,
    "total_pnl": 87.5,
    "total_return_pct": 8.75,
    "total_orders": 24,
    "total_fills": 24,
    "dataset_provenance": {
      "dataset_version": "20260617T033000Z-backtest-ready-trade-ticks-compatible",
      "source": "persisted_dataset",
      "total_ticks": 63626
    },
    "trades": [
      {
        "instrument": "0xdd22472e...-21742633....POLYMARKET",
        "side": "BUY",
        "quantity": 19.23,
        "price": 0.52,
        "timestamp": "2024-10-15T14:22:00Z"
      }
    ],
    "positions": [
      {
        "instrument": "0xdd22472e...-21742633....POLYMARKET",
        "side": "LONG",
        "entry_price": 0.52,
        "exit_price": 1.00,
        "pnl": 48.0
      }
    ]
  },
  "message": null
}

// Response (failed)
{ "backtest_id": "bt_xyz789", "status": "failed", "message": "No data loaded for slugs: invalid-market-slug" }
```

Balances are in pUSD. The `trades` array is capped at the first 50 fills. Win rate, Sharpe, and drawdown are not computed server-side — derive them from `trades`/`positions` if the user asks.

#### GET `/v3/backtest/{id}/logs` — Runtime Logs

Use this when status is `failed`, stuck, or the user asks what happened. Logs come from GCP Logging for the Kubernetes Job.

#### Result Interpretation

Before suggesting deployment, always run a backtest first. If the backtest produced **zero fills** over a period that should have generated signals, do not offer deployment — the strategy, market slug, or instrument_id likely has an issue. If PnL is **negative**, note the timerange may be unsuitable but don't dismiss the strategy outright. If PnL is **positive**, present results without overpromising — strong backtest fit on a single resolved market is weak evidence. Stay neutral and let the user decide.

### Deployment

#### POST `/v3/deployment` — Create

Plans and persists a single v3 Polymarket deployment. Alias: `POST /v3/deployments`.

```json
// Request
{
  "region": "london",
  "deployment": {
    "code": "from nautilus_trader.trading import Strategy\n...",
    "config": {
      "venue": "polymarket",
      "market": "btc-120k",
      "instrument_id": "1234567890.POLYMARKET",
      "trade_size_pusd": 10
    }
  }
}

// Response — 202
{
  "deployment": {
    "id": "01k...",
    "status": "starting"
  },
  "executionCluster": "london-poc",
  "namespace": "superior-trade",
  "region": "london",
  "activeDeploymentIds": ["01k..."],
  "plannedResources": ["NautilusTenantRuntime"],
  "resources": []
}
```

`deployment.code` and `deployment.config` are required. For Polymarket deployments, `deployment.config.instrument_id` must be formatted as `<clobTokenId>.POLYMARKET`. If runtime images or artifacts are not ready, the response is `409` with `deployment.status: "blocked"` and a `reason`.

#### POST `/v3/deployment/{id}/credentials` — Store Wallet Metadata

```json
// Request
{ "wallet_address": "0x1234567890123456789012345678901234567890" }

// Response
{
  "id": "01k...",
  "credentials_status": "stored",
  "exchange": "polymarket",
  "wallet_address": "0x1234567890123456789012345678901234567890"
}
```

The endpoint rejects `private_key` and rejects wallet addresses not owned by the authenticated user.

#### PATCH `/v3/deployment/{id}/status` — Start or Stop

```json
// Request
{ "action": "start" }   // or "stop"

// Response (start)
{
  "id": "01k...",
  "status": "running",
  "previous_status": "pending",
  "k8s_deployment_name": "tenant-auth-user-runtime",
  "namespace": "superior-trade",
  "executionCluster": "london-poc",
  "activeDeploymentIds": ["01k..."],
  "plannedResources": ["NautilusTenantRuntime"],
  "resources": []
}

// Response (stop)
{
  "id": "01k...",
  "status": "stopped",
  "previous_status": "running",
  "activeDeploymentIds": []
}
```

Start requires:

- Deployment status is `pending` or `stopped`
- Credential metadata is stored for every active deployment
- Polymarket readiness checker passes: onboarded, approvals set, and minimum balance met
- Deployment config contains valid `<clobTokenId>.POLYMARKET` instrument IDs

#### GET `/v3/deployment/{id}/logs` — Runtime Logs

Returns Cloud Logging entries for the tenant runtime. Alias: `GET /v3/deployments/{id}/logs`.

```json
{
  "deployment_id": "01k...",
  "items": [
    { "timestamp": "2026-06-18T10:00:00.000Z", "message": "started", "severity": "INFO" }
  ],
  "nextCursor": "..."
}
```

#### DELETE `/v3/deployment/{id}` — Delete Stopped Deployment

Soft-deletes an owned v3 deployment. Running deployments must be stopped first.

```json
{ "id": "01k...", "message": "Deployment deleted" }
```

### Shared API Notes

- **Auth errors (401):** `{ "error": "unauthorized", "message": "Missing or invalid authentication" }`
- **Not found (404):** `{ "error": "not_found", "message": "Route not found" }` or resource-specific `not_found`
- All timestamps are **UTC (ISO8601)**. Convert to the user's local timezone when presenting times conversationally.

