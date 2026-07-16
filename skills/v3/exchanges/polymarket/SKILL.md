---
name: polymarket
version: 1.1.2
updated: 2026-06-23
description: "Discover Polymarket markets, place single immediate market orders, run v3 filled-data backtests, and plan/start live Nautilus deployments through Superior Trade's managed cloud."
homepage: https://superior.trade
source: https://github.com/Superior-Trade
primaryEnv: SUPERIOR_TRADE_PM_API_KEY
auth:
  type: api_key
  env: SUPERIOR_TRADE_PM_API_KEY
  header: "x-api-key"
  scope: "Read-write the user's own v3 trading accounts, Polymarket funding actions, immediate market orders, backtests, and deployments. Can bootstrap Polymarket setup, deposit Polygon USDC/USDC.e into pUSD, place a single confirmed Polymarket market order, plan/start live deployments after explicit confirmation, and close Polymarket positions. Cannot export private keys or access other users' data."
env:
  - name: SUPERIOR_TRADE_PM_API_KEY
    description: "Superior Trade prediction market API key. The main API accepts x-api-key for product API keys and Bearer auth for user sessions. Can create/manage trading accounts, Polymarket onboarding/funding, immediate Polymarket market orders, v3 backtests, and deployments. Cannot export private keys or access other users' data."
    required: true
    type: api_key
externalEndpoints:
  - url: https://api.superior.trade/v3
    purpose: "Trading accounts, Polymarket onboarding/funding, immediate market orders, market discovery, filled-data backtesting, deployment planning/status, credential metadata, and logs"
  - url: https://data-api.polymarket.com
    purpose: "Read-only Polymarket public position lookup by wallet address"
  - url: https://clob.polymarket.com
    purpose: "Authenticated Polymarket CLOB reads for open orders and trade history"
---

# Polymarket Prediction Market Trading

Trade prediction markets on Polymarket through Superior Trade. Discover markets, place single immediate market orders, write NautilusTrader strategies, backtest against historical trade data, and deploy live — all through one API.

**Base URL:** Use the environment-configured Superior Trade API base URL. Production is `https://api.superior.trade/v3`; UAT may use `https://api-uat.superior.trade/v3`.
**Auth:** Prefer `x-api-key: <api_key>` for Superior Trade product API keys. Browser/session callers may use `Authorization: Bearer <token>`.
**Docs:** `GET /v3/docs` (interactive reference), `GET /v3/openapi.json` (OpenAPI spec)

## Setup

### API Key

This skill uses an existing Superior Trade API key:

```
x-api-key: $SUPERIOR_TRADE_PM_API_KEY
```

If `SUPERIOR_TRADE_PM_API_KEY` is not set, ask the user to provide or configure their Superior Trade API key through their normal credential flow. Do **not** call `POST /v3/account/onboard`; that path is not part of the current main API.

### Wallet and Funding

Trading-account wallets are managed through `/v3/account`. Polymarket readiness and balances are checked through `/v3/account/{address}/status/polymarket`. Deposits are not "send-to-address instructions"; the v3 API wraps Polygon USDC/USDC.e from an owned Superior wallet into Polymarket pUSD through `/v3/portfolio/polymarket/deposit`.

Before live trading:

1. List or create a trading account with `/v3/account`.
2. Bootstrap Polymarket setup for the wallet with `POST /v3/account/{address}/polymarket`.
3. Check readiness with `GET /v3/account/{address}/status/polymarket`; it reports onboarding, approvals, credentials, and balances.
4. If needed, deposit Polygon USDC/USDC.e with `POST /v3/portfolio/polymarket/deposit`.
5. Create a v3 deployment plan with strategy code and config.
6. Store credential metadata with `POST /v3/deployment/{id}/credentials` using only the owned `wallet_address`.
7. Start the deployment only after the user explicitly confirms.

The v3 credentials endpoint accepts wallet-address metadata only:

```json
{ "wallet_address": "0x1234567890123456789012345678901234567890" }
```

It rejects `private_key` and rejects wallet addresses outside the authenticated account list.

### Account Endpoints

Current account/funding endpoints:

- `GET /v3/account`
- `POST /v3/account`
- `PATCH /v3/account/{address}`
- `POST /v3/account/{address}/polymarket`
- `GET /v3/account/{address}/status/polymarket`
- `GET /v3/account/{address}/deposit-link`
- `POST /v3/portfolio/polymarket/deposit`
- `POST /v3/portfolio/polymarket/exit`
- `POST /v3/authorize-and-send/polymarket`

### Single Immediate Market Orders

Use `POST /v3/authorize-and-send/polymarket` when the user asks to place one immediate Polymarket bet/order. This is a fast path for a whitelisted `placeMarketOrder` action, not a strategy deployment. Do not create a deployment plan or run a backtest for a one-off order unless the user asks for a strategy or bot.

Required sequence:

1. Confirm auth with `SUPERIOR_TRADE_PM_API_KEY`.
2. Fetch `GET /v3/account`.
3. Set `action.from` only to a `wallet_address` returned in `items[]`. Never trust or invent an arbitrary `from` address; if the user supplied one, verify it appears in the account list before using it.
4. Check `GET /v3/account/{address}/status/polymarket` for that wallet. If onboarding, approvals, credentials, or available pUSD balance are not ready for the requested order, stop and report the blocker.
5. If the user already provided the complete order payload and explicit affirmative confirmation for that exact payload in the current conversation, submit it without asking unrelated follow-up questions. If not, show the exact payload and ask for confirmation before submitting.
6. Send exactly one request to `POST /v3/authorize-and-send/polymarket` and report the real API result. Never fabricate fills, order IDs, balances, or status.

Supported action:

```json
{
  "action": {
    "type": "placeMarketOrder",
    "from": "0x1234567890123456789012345678901234567890",
    "tokenID": "1234567890",
    "side": "BUY",
    "amount": "10",
    "price": 0.55,
    "orderType": "FOK"
  }
}
```

Fast confirmation format:

```
Order Summary:
• Venue: Polymarket
• Wallet address: [wallet_address from GET /v3/account] — readiness: [ready/blockers from status endpoint]
• Token ID: [tokenID]
• Side: [BUY/SELL]
• Amount: [amount] pUSD
• Limit price: [price]
• Order type: [orderType]

This will submit one REAL Polymarket market order immediately. Proceed? (yes/no)
```

Current Polymarket state checks:

- `GET https://data-api.polymarket.com/positions` — public current positions by wallet address
- `GET https://clob.polymarket.com/data/orders` — authenticated open orders through Polymarket CLOB credentials/client
- `GET https://clob.polymarket.com/data/order/{orderId}` — authenticated single-order lookup
- `GET https://clob.polymarket.com/data/trades` — authenticated fills/trade history

Do not advertise old/stale paths: `/v3/account/onboard`, `/v3/account/wallets`, `/v3/account/deposit/polymarket`, `/v3/account/withdraw/polymarket`, or `/v3/deployment/{id}/exit`.

## Safety

### Security & Permissions

This skill requires exactly **one credential**: a Superior Trade API key. The only secret the agent uses is `SUPERIOR_TRADE_PM_API_KEY`.

**Security rules (non-negotiable):**

1. **NEVER** ask users for private keys, seed phrases, or wallet credentials
2. **NEVER** log, store, or display private keys or seed phrases
3. **NEVER** fabricate wallet balances, API responses, market prices, or trade results
4. **NEVER** start a live deployment without explicit user confirmation
5. **NEVER** promise withdrawals — v3 supports Polymarket deposit and portfolio exit, not withdrawal to an external address
6. **Prefer user-friendly language** over internal technical names when speaking conversationally. Say "strategy" or "the bot" instead of internal class names or infrastructure details. If the user asks about the underlying technology, answer honestly (the platform uses NautilusTrader for strategy execution against Polymarket's CLOB).

| Can do                                                                               | Cannot do                            |
| ------------------------------------------------------------------------------------ | ------------------------------------ |
| List/create/rename trading accounts                                                   | Access other users' data             |
| Bootstrap Polymarket setup, check readiness, and deposit Polygon USDC/USDC.e to pUSD   | Export, accept, or view private keys |
| Search markets and run filled-data backtests                                          | Withdraw to an external address      |
| Read current Polymarket positions and open orders                                      | Guess holdings from deployment state |
| Plan deployments, store wallet-address credential metadata, start/stop/delete v3 runs  | Invent balances or trade results     |
| Close all Polymarket positions/orders with `/v3/portfolio/polymarket/exit` after confirmation | Transfer or bridge arbitrary funds   |

### Polymarket-Specific Risks (tell the user when relevant)

- **Prices are probabilities** — every outcome trades between 0.001 and 0.999 pUSD. A "cheap" 0.03 outcome is not a bargain; it is a ~3% market-implied probability.
- **Resolution risk** — positions held to resolution settle at exactly 0 or 1. A strategy can be up and still settle at zero if the outcome resolves against it.
- **Liquidity risk** — many markets have thin order books. Market orders can fill far from the displayed price. Prefer markets with meaningful `volume_24h` and `liquidity`.
- **Market end dates** — markets stop trading at `end_date`. Never deploy a strategy on a market that resolves before the strategy has time to work.
- **Rate limits** — Polymarket enforces ~30 order submissions/minute and ~100 data requests/minute per user. Strategies that cancel/replace on every tick can hit these fast.

### Live Deployment Confirmation

Before any **live deployment start**, the agent MUST present this summary and wait for an explicit affirmative response:

```
Deployment Summary:
• Deployment: [deployment_id]
• Venue: Polymarket
• Market(s): [market question(s)]
• Wallet address: [0x...] — readiness: [ready/blockers from status endpoint]
• Trade size/risk settings: [from deployment.config]
• Backtest reviewed: [backtest_id / result summary]

⚠️ This will trade with REAL funds. Proceed? (yes/no)
```

Do NOT start a live deployment without an explicit affirmative response.

## Agent Operating Rules

- **Verification-first:** Every factual claim about balance, market price, position, or deployment status MUST be backed by an API call in the current turn. NEVER assume → report → verify later.
- **Anti-hallucination:** If you can't call the API, say "I haven't checked yet." Every number must come from a real response.
- **Position/order state:** When the user asks what they hold, whether orders are open, whether a bot traded, or whether it is safe to stop/exit, fetch live Polymarket positions/orders first. Deployment status does not prove a position exists.
- **Backtest before deploy:** Always run a backtest and review results with the user before the first live deployment of any strategy.
- **Conversational:** Make API calls directly and present results conversationally. Show raw payloads only on request.
- **Proactive:** Ask for missing info conversationally, one concern at a time.

### Repeated Failures

If the same task fails 3+ times (e.g. strategy source/config keeps failing, backtest keeps erroring), stop and:

1. Summarize what was tried and what failed
2. Suggest a simpler approach or different parameters
3. If the issue appears to be model capability (complex multi-instrument logic), suggest switching to a more capable model for strategy generation

## Workflow

```
1. Confirm auth      →  Use existing `SUPERIOR_TRADE_PM_API_KEY`
2. Account setup     →  GET/POST /v3/account, then POST /v3/account/{address}/polymarket
3. Check readiness   →  GET /v3/account/{address}/status/polymarket; deposit if needed
4. Read live state   →  For holdings/order questions, fetch positions and open orders for the owned wallet
5. Deposit if needed →  POST /v3/portfolio/polymarket/deposit using Polygon USDC/USDC.e
6. Discover markets  →  POST /v3/markets/search — find candidate market slugs matching the user's interest; pass exact Polymarket event URLs directly when the user provides one
7. Write strategy    →  Author NautilusTrader Python strategy code from the closest archetype
8. Backtest          →  POST /v3/backtest with `strategyId`, `strategySource`, and `strategyConfig`
9. Review results    →  Poll/read backtest status/result/logs; analyze performance; iterate or proceed
10. Plan deployment  →  POST /v3/deployment with `{ deployment: { code, config } }`
11. Store credentials → POST /v3/deployment/{id}/credentials with an owned `wallet_address`
12. Start            →  Confirm with user → PATCH/PUT /v3/deployment/{id}/status `{ "action": "start" }`
13. Monitor/stop     →  Status/logs plus live positions/orders; stop with PATCH/PUT `/v3/deployment/{id}/status` `{ "action": "stop" }`
```

Deployment start requires both credential metadata and explicit user confirmation.

### Strategy Archetypes

When a user asks for a Polymarket strategy, pick an archetype first and then generate strategy code from it. This keeps backtest assumptions explicit and reduces silent drift.

- Probability Momentum (`probability-momentum` skill) — momentum, breakout, fast reaction in active markets
- Probability Mean Reversion (`probability-mean-reversion` skill) — overreaction fade and range-like behavior
- Deadline Drift (`deadline-drift` skill) — time-to-resolution behavior, especially before-date markets
- Related-Market Spread (`related-market-spread` skill) — relative-value checks across linked markets
- Large-Fill Pressure (`large-fill-pressure` skill) — repeated oversized fills with directional follow-through
- Catalyst Confirmation (`catalyst-confirmation` skill) — event thesis with market confirmation first

Operational rules:

1. Pick the closest archetype before coding.
2. Treat these as starting points, not validated strategies.
3. Generate a custom NautilusTrader strategy from the selected archetype and pass it directly to `POST /v3/backtest` via `strategySource` with matching `strategyConfig`.
4. Before any backtest request, confirm exact market slugs from search candidates.
5. Use filled-data assumptions (`TradeTick`) in backtests; do not promise queue/maker behavior without matching evidence.

Filled-data rule: Polymarket strategy logic should be driven by historical `TradeTick` replay in backtesting. If logic is quote-only, flag it as likely non-tradable in current backtest mode.

### Pre-Deployment Checklist (MANDATORY)

Before `PATCH /v3/deployment/{id}/status` or `PUT /v3/deployment/{id}/status` → `{"action":"start"}`:

1. **Backtest reviewed** — at least one completed backtest for this strategy code/config or materially similar logic, results shown to the user.
2. **Wallet readiness checked** — `GET /v3/account/{address}/status/polymarket` returns `onboarding.ready: true`. If not ready, resolve the blockers first; common blockers are no wallet, not onboarded, approvals missing, or balance below 5 USDC.
3. **Credentials metadata stored** — `POST /v3/deployment/{id}/credentials` with an owned `wallet_address`; do not send private keys.
4. **Market selected** — `POST /v3/markets/search` → confirm the exact `slug` to use. If the user gives a Polymarket event URL, pass that URL as the search query so child markets can be expanded. If search returns multiple plausible candidates, show the candidate questions/slugs and ask the user to choose. For backtests, require `backtestSupported: true`, `coverageStatus: "available"`, and a requested timerange inside the candidate `coverage`.
5. **Deployment config valid** — Polymarket live deployment config must include `instrument_id` formatted as `<clobTokenId>.POLYMARKET`.
6. **Current exposure checked when relevant** — if replacing, restarting, stopping, exiting, or sizing around existing exposure, fetch positions and open orders for the wallet first.
7. **User confirmation** — show the deployment summary and get an explicit "yes".

Do NOT skip any step or assume it passed without the API call.

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

#### GET `/v3/account/{address}/deposit-link` — Generate Deposit Links

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

#### PATCH/PUT `/v3/deployment/{id}/status` — Start or Stop

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

## Strategy Authoring (NautilusTrader)

Write a NautilusTrader `Strategy` subclass in Python. The strategy receives real-time market data and submits orders. Keep the code self-contained and avoid filesystem, network, private-key, or environment access.

### Strategy Structure

```python
from nautilus_trader.config import StrategyConfig
from nautilus_trader.model.data import QuoteTick, TradeTick, Bar, BarType
from nautilus_trader.model.enums import OrderSide, TimeInForce
from nautilus_trader.model.events import OrderFilled, PositionOpened, PositionClosed
from nautilus_trader.model.identifiers import InstrumentId
from nautilus_trader.trading import Strategy


class MyStrategyConfig(StrategyConfig, frozen=True):
    instrument_id: str          # Polymarket instrument ID
    # Add strategy-specific parameters here
    trade_size: float = 10.0    # pUSD per trade


class MyStrategy(Strategy):

    def __init__(self, config: MyStrategyConfig):
        super().__init__(config)
        self.instrument_id = InstrumentId.from_str(config.instrument_id)

    def on_start(self):
        """Called when strategy starts. Subscribe to data here."""
        self.subscribe_trade_ticks(self.instrument_id)
        # also available: self.subscribe_quote_ticks(...) — live only, see note below
        # or: self.subscribe_bars(BarType.from_str("..."))

    def on_quote_tick(self, tick: QuoteTick):
        """Called on every bid/ask update (live trading)."""
        bid = float(tick.bid_price)
        ask = float(tick.ask_price)

    def on_trade_tick(self, tick: TradeTick):
        """Called on every trade execution in the market."""
        price = float(tick.price)
        size = float(tick.size)

    def on_bar(self, bar: Bar):
        """Called on every bar close (if subscribed to bars)."""
        close = float(bar.close)

    def on_order_filled(self, event: OrderFilled):
        """Called when your order is filled."""
        pass

    def on_position_opened(self, event: PositionOpened):
        pass

    def on_position_closed(self, event: PositionClosed):
        pass

    def on_order_rejected(self, event):
        """Called when an order is rejected by venue or risk engine."""
        self.log.warning(f"Order rejected: {event.reason}")

    def on_stop(self):
        """Called when strategy stops. Clean up here."""
        self.cancel_all_orders(self.instrument_id)
```

> **Backtest compatibility:** backtests replay historical **trade ticks**. A strategy whose logic lives entirely in `on_quote_tick` will do nothing in a backtest. Drive backtestable logic from `on_trade_tick`, or subscribe to both.

### Submitting Orders

**Market order (BUY — quote quantity in pUSD):**

```python
instrument = self.cache.instrument(self.instrument_id)
order = self.order_factory.market(
    instrument_id=self.instrument_id,
    order_side=OrderSide.BUY,
    quantity=instrument.make_qty(10.0),   # 10 pUSD
    time_in_force=TimeInForce.IOC,
    quote_quantity=True,                  # BUY uses pUSD amount
)
self.submit_order(order)
```

**Market order (SELL — base quantity in shares):**

```python
order = self.order_factory.market(
    instrument_id=self.instrument_id,
    order_side=OrderSide.SELL,
    quantity=instrument.make_qty(25.0),   # 25 shares
    time_in_force=TimeInForce.IOC,
)
self.submit_order(order)
```

**Limit order (GTC):**

```python
order = self.order_factory.limit(
    instrument_id=self.instrument_id,
    order_side=OrderSide.BUY,
    quantity=instrument.make_qty(10.0),
    price=instrument.make_price(0.45),
    time_in_force=TimeInForce.GTC,
    post_only=True,                       # maker only
)
self.submit_order(order)
```

### Key Rules

- **Market BUY**: use `quote_quantity=True` — quantity is the pUSD amount to spend
- **Market SELL**: use base quantity — quantity is the number of shares to sell
- **Limit orders (both sides)**: always base quantity (shares), never `quote_quantity`
- Market orders require `TimeInForce.IOC` (maps to Polymarket FAK)
- Limit orders support `GTC`, `GTD`, `FOK`, `IOC`
- Prices are 0.001 to 0.999 (probability, in pUSD)
- Use `self.cache.instrument(id)` to get the instrument for `make_qty()` and `make_price()`
- `Position.quantity` is always positive (unsigned size)
- Handle `on_order_rejected(self, event)` — orders can be rejected by the venue or risk engine
- Minimum order size: 5 pUSD (market BUY) or 5 shares (limit/sell)
- Polymarket rate limits: 30 order submissions/minute, 100 data requests/minute per user

### Converting Dollars to Shares for Limit Orders

Limit orders use share quantities, not pUSD:

```python
shares = dollar_amount / price
# e.g., $50 at price 0.25 = 200 shares
```

### Multi-Instrument Strategies

A single strategy can subscribe to and trade multiple instruments:

```python
class MultiOutcomeConfig(StrategyConfig, frozen=True):
    instrument_ids: list[str]
    trade_size: float = 10.0

class MultiOutcome(Strategy):
    def __init__(self, config: MultiOutcomeConfig):
        super().__init__(config)
        self.ids = [InstrumentId.from_str(i) for i in config.instrument_ids]

    def on_start(self):
        for iid in self.ids:
            self.subscribe_trade_ticks(iid)

    def on_trade_tick(self, tick: TradeTick):
        # tick.instrument_id tells you which instrument this tick is for
        if tick.instrument_id == self.ids[0]:
            pass  # handle first outcome
        elif tick.instrument_id == self.ids[1]:
            pass  # handle second outcome
```

For multi-outcome markets (e.g. Fed rate: hold / 25bp cut / 50bp cut), pass all outcome instrument_ids and trade across them in one strategy. Each deployment runs one strategy instance — no need for separate deployments per outcome.

### Available Data

- `self.cache.quote_tick(instrument_id)` — latest bid/ask
- `self.cache.instrument(instrument_id)` — instrument details
- `self.cache.positions(instrument_id=id)` — open positions for an instrument
- `self.clock.utc_now()` — current UTC timestamp
- `self.portfolio` — account balances and positions

## Example Strategies

### Carry / Yield Harvesting

Buy high-probability outcomes near resolution. The "T-Bill" of prediction markets. Resolution risk applies: a 0.95 outcome that resolves NO loses everything staked.

```python
from nautilus_trader.config import StrategyConfig
from nautilus_trader.model.data import TradeTick
from nautilus_trader.model.enums import OrderSide, TimeInForce
from nautilus_trader.model.identifiers import InstrumentId
from nautilus_trader.trading import Strategy


class CarryConfig(StrategyConfig, frozen=True):
    instrument_id: str
    min_probability: float = 0.90
    max_probability: float = 0.99
    trade_size_pusd: float = 50.0


class Carry(Strategy):
    def __init__(self, config: CarryConfig):
        super().__init__(config)
        self.instrument_id = InstrumentId.from_str(config.instrument_id)
        self._has_position = False

    def on_start(self):
        self.subscribe_trade_ticks(self.instrument_id)

    def on_trade_tick(self, tick: TradeTick):
        if self._has_position:
            return
        price = float(tick.price)
        if self.config.min_probability <= price <= self.config.max_probability:
            instrument = self.cache.instrument(self.instrument_id)
            order = self.order_factory.market(
                instrument_id=self.instrument_id,
                order_side=OrderSide.BUY,
                quantity=instrument.make_qty(self.config.trade_size_pusd),
                time_in_force=TimeInForce.IOC,
                quote_quantity=True,
            )
            self.submit_order(order)

    def on_position_opened(self, event):
        self._has_position = True

    def on_position_closed(self, event):
        self._has_position = False

    def on_stop(self):
        self.cancel_all_orders(self.instrument_id)
```

### Momentum / News Fade

Buy when probability drops sharply (overreaction), sell when it recovers.

```python
from nautilus_trader.config import StrategyConfig
from nautilus_trader.model.data import TradeTick
from nautilus_trader.model.enums import OrderSide, TimeInForce
from nautilus_trader.model.identifiers import InstrumentId
from nautilus_trader.trading import Strategy


class MomentumFadeConfig(StrategyConfig, frozen=True):
    instrument_id: str
    lookback_ticks: int = 20
    drop_threshold: float = -0.05
    recovery_threshold: float = 0.02
    trade_size_pusd: float = 25.0


class MomentumFade(Strategy):
    def __init__(self, config: MomentumFadeConfig):
        super().__init__(config)
        self.instrument_id = InstrumentId.from_str(config.instrument_id)
        self._prices = []
        self._has_position = False

    def on_start(self):
        self.subscribe_trade_ticks(self.instrument_id)

    def on_trade_tick(self, tick: TradeTick):
        price = float(tick.price)
        self._prices.append(price)
        if len(self._prices) > self.config.lookback_ticks:
            self._prices.pop(0)
        if len(self._prices) < self.config.lookback_ticks:
            return

        recent_return = (price - self._prices[0]) / self._prices[0]
        instrument = self.cache.instrument(self.instrument_id)

        if not self._has_position and recent_return < self.config.drop_threshold:
            order = self.order_factory.market(
                instrument_id=self.instrument_id,
                order_side=OrderSide.BUY,
                quantity=instrument.make_qty(self.config.trade_size_pusd),
                time_in_force=TimeInForce.IOC,
                quote_quantity=True,
            )
            self.submit_order(order)

        elif self._has_position and recent_return > self.config.recovery_threshold:
            positions = self.cache.positions(instrument_id=self.instrument_id)
            for pos in positions:
                if pos.is_open:
                    order = self.order_factory.market(
                        instrument_id=self.instrument_id,
                        order_side=OrderSide.SELL,
                        quantity=instrument.make_qty(float(pos.quantity)),
                        time_in_force=TimeInForce.IOC,
                    )
                    self.submit_order(order)

    def on_position_opened(self, event):
        self._has_position = True

    def on_position_closed(self, event):
        self._has_position = False

    def on_stop(self):
        self.cancel_all_orders(self.instrument_id)
```

### Spread Capture / Market Making

Live-only reference. Do **not** use this as a filled-data backtest template: it needs quote/order-book state, queue assumptions, and spread realism that current Polymarket backtests do not replay. Watch the rate limit: cancelling and re-quoting on every tick can exceed 30 orders/minute on active markets.

```python
from nautilus_trader.config import StrategyConfig
from nautilus_trader.model.data import QuoteTick
from nautilus_trader.model.enums import OrderSide, TimeInForce
from nautilus_trader.model.events import OrderFilled
from nautilus_trader.model.identifiers import InstrumentId
from nautilus_trader.trading import Strategy


class SpreadCaptureConfig(StrategyConfig, frozen=True):
    instrument_id: str
    spread_width: float = 0.02
    order_size: float = 10.0
    max_inventory: float = 100.0


class SpreadCapture(Strategy):
    def __init__(self, config: SpreadCaptureConfig):
        super().__init__(config)
        self.instrument_id = InstrumentId.from_str(config.instrument_id)
        self._net_qty = 0.0

    def on_start(self):
        self.subscribe_quote_ticks(self.instrument_id)

    def on_quote_tick(self, tick: QuoteTick):
        self.cancel_all_orders(self.instrument_id)
        if abs(self._net_qty) >= self.config.max_inventory:
            return

        bid = float(tick.bid_price)
        ask = float(tick.ask_price)
        mid = (bid + ask) / 2
        half = self.config.spread_width / 2
        our_bid = mid - half
        our_ask = mid + half

        if our_bid <= 0 or our_ask >= 1:
            return

        instrument = self.cache.instrument(self.instrument_id)

        bid_order = self.order_factory.limit(
            instrument_id=self.instrument_id,
            order_side=OrderSide.BUY,
            quantity=instrument.make_qty(self.config.order_size),
            price=instrument.make_price(our_bid),
            time_in_force=TimeInForce.GTC,
            post_only=True,
        )
        self.submit_order(bid_order)

        ask_order = self.order_factory.limit(
            instrument_id=self.instrument_id,
            order_side=OrderSide.SELL,
            quantity=instrument.make_qty(self.config.order_size),
            price=instrument.make_price(our_ask),
            time_in_force=TimeInForce.GTC,
            post_only=True,
        )
        self.submit_order(ask_order)

    def on_order_filled(self, event: OrderFilled):
        qty = float(event.last_qty)
        if event.order_side == OrderSide.BUY:
            self._net_qty += qty
        else:
            self._net_qty -= qty

    def on_stop(self):
        self.cancel_all_orders(self.instrument_id)
```

## Troubleshooting

### Strategy Source Issues

- **Python syntax/import errors** — fix the inline `strategySource` or `deployment.code`; there is no separate `/v3/strategy` validation endpoint.
- **Config mismatch** — make sure `strategyConfig` or `deployment.config` keys match the `StrategyConfig` class fields.
- **Missing instrument** — live deployment config requires `instrument_id` formatted as `<clobTokenId>.POLYMARKET`; do not use condition IDs or market slugs as instrument IDs.
- **Backtest-only mismatch** — backtests replay trade ticks. Quote-only strategies may run live but produce zero backtest callbacks.

### Backtest Failures

- `status: "failed"` with `message: "No data loaded for slugs: ..."` — the market slug is wrong or has no hydrated fill history. Re-check the exact `slug` from `POST /v3/markets/search` and require `coverageStatus: "available"`.
- `message: "Process exited with code N"` — the strategy crashed at runtime. Common causes: config kwargs that don't match the config class fields, or referencing an instrument the engine didn't load.
- **Zero fills** — the strategy's conditions never triggered, or it only subscribes to quote ticks (backtests replay trade ticks only).

### Deployment Issues

- **`credentials_required`** — call `POST /v3/deployment/{id}/credentials` with an owned wallet address before starting.
- **`deployment_not_ready`** — call `GET /v3/account/{address}/status/polymarket` and resolve blockers: not onboarded, approvals missing, or balance below 5 USDC.
- **Start returns 500** — resource submission failed. Check `GET /v3/deployment/{id}/logs` if a runtime exists, otherwise retry after the platform issue is resolved.
- **Orders rejected at the venue** — usually readiness/balance, an order below the 5 pUSD / 5 share minimum, invalid instrument ID, or a market that has resolved or closed.
- **Rate limits** — if order submissions exceed ~30/minute, the venue throttles. Reduce re-quote frequency (e.g. only re-quote when the mid moves more than a threshold) rather than rapid stop/start cycles.

### Diagnosing Zero-Trade Deployments

Check in order:

1. **Wallet readiness** — `GET /v3/account/{address}/status/polymarket` shows `onboarding.ready: true` and sufficient balance
2. **Runtime logs** — `GET /v3/deployment/{id}/logs` for startup errors, order rejections, or strategy exceptions
3. **Market still active** — not resolved, `end_date` in the future
4. **Strategy conditions** — are entry thresholds reachable at current prices? (e.g. a carry strategy with `min_probability: 0.90` does nothing while the market trades at 0.60)
5. **Order minimums** — trade size at least 5 pUSD (market BUY) / 5 shares (limit/sell)
