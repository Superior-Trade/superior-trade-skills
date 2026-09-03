---
name: polymarket
description: "Use when the user wants to trade, research, or backtest Polymarket prediction markets through Superior Trade — finding markets by slug or event URL, placing a single immediate market order, writing NautilusTrader strategies, running filled-data backtests, funding pUSD, or deploying and monitoring a live Polymarket strategy."
metadata:
  version: 2.0.0
  updated: 2026-08-12
  homepage: https://superior.trade
  source: https://github.com/Superior-Trade
  primaryEnv: SUPERIOR_TRADE_API_KEY
  auth:
    type: api_key
    env: SUPERIOR_TRADE_API_KEY
    header: "x-api-key"
    scope: "Use the authenticated user's Unified API account, managed wallet, market context, backtests, deployments, and supported typed Polymarket executions. Cannot export private keys or access other users' data."
  env:
    - name: SUPERIOR_TRADE_API_KEY
      description: "Superior Trade API key for Unified API account, wallet, context, backtest, deployment, and typed execution requests."
      required: true
      type: api_key
  externalEndpoints:
    - url: https://unified-api-zag4gzx6gq-an.a.run.app
      purpose: "Unified account, wallet, market context, typed executions, filled-data backtests, deployments, and logs"
---

# Polymarket Prediction Market Trading

Trade prediction markets on Polymarket through Superior Trade. Discover markets, place single immediate market orders, write NautilusTrader strategies, backtest against historical trade data, and deploy live — all through one API.

Read [`../../references/unified-runtime.md`](../../references/unified-runtime.md)
before any Superior Trade request. Use only methods, fields, and capabilities
published by Unified OpenAPI.

**Base URL:** `https://unified-api-zag4gzx6gq-an.a.run.app`. If the environment configures a different base URL, use that instead.
**Auth:** Prefer `x-api-key: <api_key>` for Superior Trade product API keys. Browser/session callers may use `Authorization: Bearer <token>`.
**Docs:** `GET /openapi.json` (Unified OpenAPI contract)

## Reference files

Load these on demand — each is the full detail behind a summary below.

| Read | When |
| --- | --- |
| `references/api.md` | You need Unified route selection for account, wallet, market discovery, typed execution, backtest, or deployment. |
| `references/strategy-authoring.md` | You are writing NautilusTrader strategy code — structure, order submission, dollars-to-shares conversion, multi-instrument setups, available data. |
| `references/example-strategies.md` | You want a worked starting point: carry/yield harvesting, momentum/news fade, or spread capture. |
| `references/strategies.md` | You are choosing an archetype for the user's thesis and need the fit/anti-fit table. |
| `references/troubleshooting.md` | A strategy source, backtest, or deployment is failing, or a deployment trades zero times. |

## Gotchas

Environment-specific facts that defy reasonable assumptions. Read these before acting.

- **Wallet reads are not bootstrap or funding mutations.** Use `GET /wallet` only for the managed wallet data it returns. If a required Polymarket funding action is absent from the Unified contract, report it as unavailable.
- **Backtests are built from filled `TradeTick` data, not a full order book.** They cannot model queue position or liquidity, so a strategy that depends on resting-order fills will look better in backtest than it trades. Say this when presenting results.
- **An exact market slug is required before writing a strategy.** Get it from `GET /context/markets`; if the user pastes a Polymarket event URL, pass the whole URL as the query so child markets expand.
- **Prices are probabilities between 0 and 1.** Sizing is in shares, not dollars — convert with `shares = dollars / price` (see `references/strategy-authoring.md`).
- **Credential storage is contract-defined.** Use only the form published for `PUT /runtime/deployments/{id}/credentials`; never infer or send undisclosed key material.

## Setup

### API Key

This skill uses the same Superior Trade API key as every other venue — there is no separate prediction-market key:

```
x-api-key: $SUPERIOR_TRADE_API_KEY
```

If `SUPERIOR_TRADE_API_KEY` is not set, use the registration and verification flow in the `superior-trade-auth` skill.

### Wallet and Funding

The managed wallet is read through `/wallet`. Polymarket support is discovered
through `/context/venues`; exact capabilities come from `/openapi.json`.

Before live trading:

1. Read the managed wallet with `GET /wallet`.
2. Check Polymarket and Nautilus support with `GET /context/venues` and `GET /runtime/frameworks`.
3. Confirm the wallet has the required balance and readiness exposed by Unified API.
4. If a required onboarding or pUSD funding action is absent from `GET /openapi.json`, stop and report it.
5. Create a Unified deployment with strategy code and config.
6. Store credentials with `PUT /runtime/deployments/{id}/credentials` only when the current contract requires it.
7. Start the deployment only after the user explicitly confirms.

Use only the credential schema published by Unified API. Never infer a secret or
wallet field from an older payload.

### Account Endpoints

Current account/funding endpoints:

- `GET /account`
- `GET /wallet`
- `GET /wallet/deposits`
- `GET /wallet/withdrawals`
- `POST /wallet/withdraw`
- `GET /context/venues`
- `POST /runtime/executions`

### Single Immediate Market Orders

Use `POST /runtime/executions` when the user asks to place one immediate Polymarket bet/order. This is a fast path for a whitelisted `placeMarketOrder` action, not a strategy deployment. Do not create a deployment plan or run a backtest for a one-off order unless the user asks for a strategy or bot.

Required sequence:

1. Confirm auth with `SUPERIOR_TRADE_API_KEY`.
2. Fetch `GET /wallet`.
3. If selecting a non-default managed account, set top-level `account_address` only to an address verified by `GET /wallet`.
4. Check `GET /context/venues` and the wallet balance. If the required capability or collateral is unavailable, stop and report the blocker.
5. If the user already provided the complete order payload and explicit affirmative confirmation for that exact payload in the current conversation, submit it without asking unrelated follow-up questions. If not, show the exact payload and ask for confirmation before submitting.
6. Send exactly one request to `POST /runtime/executions` and report the real API result. Never fabricate fills, order IDs, balances, or status.

Supported action:

```json
{
  "venue": "polymarket",
  "account_address": "0x1234567890123456789012345678901234567890",
  "action": {
    "type": "placeMarketOrder",
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
• Wallet address: [wallet address from GET /wallet] — capability: [Polymarket support from GET /context/venues]
• Token ID: [tokenID]
• Side: [BUY/SELL]
• Amount: [amount] pUSD
• Limit price: [price]
• Order type: [orderType]

This will submit one REAL Polymarket market order immediately. Proceed? (yes/no)
```

Inspect the durable execution with `GET /runtime/executions/{id}`. If the
Unified contract does not expose the current position or open-order read the
user needs, say that it is unavailable instead of querying with undisclosed
venue credentials.

## Safety

### Security & Permissions

This skill requires exactly **one credential**: a Superior Trade API key. The only secret the agent uses is `SUPERIOR_TRADE_API_KEY`.

**Security rules (non-negotiable):**

1. **NEVER** ask users for private keys, seed phrases, or wallet credentials
2. **NEVER** log, store, or display private keys or seed phrases
3. **NEVER** fabricate wallet balances, API responses, market prices, or trade results
4. **NEVER** start a live deployment without explicit user confirmation
5. **NEVER** promise a venue withdrawal or portfolio exit unless the exact operation is present in Unified OpenAPI
6. **Prefer user-friendly language** over internal technical names when speaking conversationally. Say "strategy" or "the bot" instead of internal class names or infrastructure details. If the user asks about the underlying technology, answer honestly (the platform uses NautilusTrader for strategy execution against Polymarket's CLOB).

| Can do                                                                               | Cannot do                            |
| ------------------------------------------------------------------------------------ | ------------------------------------ |
| Read Unified account, wallet, venue, and market context                               | Access other users' data             |
| Run supported filled-data backtests                                                   | Export, accept, or view private keys |
| Create and manage Unified deployments                                                 | Guess holdings from deployment state |
| Place or cancel a typed Polymarket order after confirmation                           | Invent balances or trade results     |
| Inspect durable execution records                                                     | Transfer or bridge arbitrary funds   |

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
- **Position/order state:** When the user asks what they hold, whether orders are open, whether a bot traded, or whether it is safe to stop/exit, first check Unified OpenAPI for a supported live position/order read. If none exists, say exposure verification is unavailable; do not infer it from deployment status or proceed with an exit, replacement, restart, or exposure-based sizing decision whose safety depends on that state.
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
1. Confirm auth      →  Use existing `SUPERIOR_TRADE_API_KEY`
2. Managed wallet    →  GET /wallet
3. Check readiness   →  GET /context/venues and GET /runtime/frameworks
4. Read live state   →  Use contract-supported Unified reads; if exposure state is unavailable, report the limitation and block actions whose safety depends on it
5. Funding check     →  Use the deposit details and balances from GET /wallet
6. Discover markets  →  GET /context/markets?venue=polymarket
7. Write strategy    →  Author NautilusTrader Python strategy code from the closest archetype
8. Backtest          →  POST /runtime/backtests with `strategyId`, `strategySource`, and `strategyConfig`
9. Review results    →  Poll/read backtest status/result/logs; analyze performance; iterate or proceed
10. Plan deployment  →  POST /runtime/deployments with top-level framework, venue, mode, name, code, and config
11. Store credentials → PUT /runtime/deployments/{id}/credentials with the contract-defined form
12. Start            →  Confirm with user → PUT /runtime/deployments/{id}/status `{ "action": "start" }`
13. Monitor/stop     →  Use status/logs and any contract-supported exposure reads; never claim the wallet is flat when exposure reads are unavailable; stop with PUT `/runtime/deployments/{id}/status` `{ "action": "stop" }`
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
3. Generate a custom NautilusTrader strategy from the selected archetype and pass it directly to `POST /runtime/backtests` via `strategySource` with matching `strategyConfig`.
4. Before any backtest request, confirm exact market identifiers from search candidates.
5. Use filled-data assumptions (`TradeTick`) in backtests; do not promise queue/maker behavior without matching evidence.

Filled-data rule: Polymarket strategy logic should be driven by historical `TradeTick` replay in backtesting. If logic is quote-only, flag it as likely non-tradable in current backtest mode.

### Pre-Deployment Checklist (MANDATORY)

Before `PUT /runtime/deployments/{id}/status` → `{"action":"start"}`:

1. **Backtest reviewed** — at least one completed backtest for this strategy code/config or materially similar logic, results shown to the user.
2. **Wallet readiness checked** — `GET /wallet` and `GET /context/venues` show the required support and balance. If not ready, report the returned blocker.
3. **Credentials stored when required** — use `PUT /runtime/deployments/{id}/credentials` with the Unified contract's form; do not improvise secret fields.
4. **Market selected** — `GET /context/markets?venue=polymarket` → confirm the canonical symbol and framework identifier. If several candidates match, show them and ask the user to choose. Require `backtest_ready: true` and verify the requested range against `GET /context/datasets`.
5. **Deployment config valid** — Polymarket live deployment config must include `instrument_id` formatted as `<clobTokenId>.POLYMARKET`.
6. **Current exposure checked when relevant** — if replacing, restarting, stopping, exiting, or sizing around existing exposure, use a position/open-order read published by Unified OpenAPI. If the contract exposes none, report that verification is unavailable and do not proceed with an action whose safety depends on knowing that exposure.
7. **User confirmation** — show the deployment summary and get an explicit "yes".

Do NOT skip any step or assume it passed without the API call.
