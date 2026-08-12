---
name: polymarket
description: "Use when the user wants to trade, research, or backtest Polymarket prediction markets through Superior Trade — finding markets by slug or event URL, placing a single immediate market order, writing NautilusTrader strategies, running filled-data backtests, funding pUSD, or deploying and monitoring a live Polymarket strategy."
metadata:
  version: 2.0.0
  updated: 2026-08-12
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

## Reference files

Load these on demand — each is the full detail behind a summary below.

| Read | When |
| --- | --- |
| `references/api.md` | You need the exact request/response shape for any endpoint: account, portfolio funding, positions and orders, market search, backtest, deployment. |
| `references/strategy-authoring.md` | You are writing NautilusTrader strategy code — structure, order submission, dollars-to-shares conversion, multi-instrument setups, available data. |
| `references/example-strategies.md` | You want a worked starting point: carry/yield harvesting, momentum/news fade, or spread capture. |
| `references/strategies.md` | You are choosing an archetype for the user's thesis and need the fit/anti-fit table. |
| `references/troubleshooting.md` | A strategy source, backtest, or deployment is failing, or a deployment trades zero times. |

## Gotchas

Environment-specific facts that defy reasonable assumptions. Read these before acting.

- **Do not call `POST /v3/account/onboard`.** It is not part of the current main API. Bootstrap with `POST /v3/account/{address}/polymarket` instead.
- **Deposits are not send-to-address instructions.** The v3 API wraps Polygon USDC/USDC.e from an owned Superior wallet into Polymarket pUSD via `/v3/portfolio/polymarket/deposit`. Never give the user a raw address to send to.
- **Backtests are built from filled `TradeTick` data, not a full order book.** They cannot model queue position or liquidity, so a strategy that depends on resting-order fills will look better in backtest than it trades. Say this when presenting results.
- **An exact market slug is required before writing a strategy.** Get it from `POST /v3/markets/search`; if the user pastes a Polymarket event URL, pass the whole URL as the query so child markets expand.
- **Prices are probabilities between 0 and 1.** Sizing is in shares, not dollars — convert with `shares = dollars / price` (see `references/strategy-authoring.md`).
- **Credential storage takes only an owned `wallet_address`.** Never send key material to `POST /v3/deployment/{id}/credentials`.

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

