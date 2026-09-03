---
name: hyperliquid
description: "Use when backtesting, deploying, checking funding readiness, or debugging a Hyperliquid strategy through Superior Trade Unified API — writing Freqtrade configs and strategy code, running sweeps, checking managed-wallet balances, trading HIP-3 perps, or diagnosing a deployment that will not start or trade."
metadata:
  version: 5.0.0
  updated: 2026-08-12
  homepage: https://account.superior.trade
  source: https://github.com/Superior-Trade
  primaryEnv: SUPERIOR_TRADE_API_KEY
  auth:
    type: api_key
    env: SUPERIOR_TRADE_API_KEY
    header: x-api-key
    scope: "Read the user's Unified wallet and Hyperliquid context, manage backtests and deployments, submit supported typed executions, and request a contract-supported withdrawal after confirmation. Venue-specific deposits and transfers are unavailable unless Unified OpenAPI explicitly exposes them. Cannot export private keys or access other users' data."
  env:
    - name: SUPERIOR_TRADE_API_KEY
      description: "Superior Trade API key (x-api-key header). Obtained at https://account.superior.trade. Used for Unified wallet/context reads, backtests, deployments, supported typed executions, and contract-supported withdrawals. It cannot export private keys or access other users' data."
      required: true
      type: api_key
  externalEndpoints:
    - url: https://unified-api-zag4gzx6gq-an.a.run.app
      purpose: "All backtesting and deployment operations"
    - url: https://api.hyperliquid.xyz/info
      purpose: "Read-only public queries. Balance checks send the user's public wallet address (not a secret — visible on-chain). Pair validation sends no user data. No authentication or secrets are sent to this endpoint."
---

# Superior Trade — Hyperliquid

Backtest and deploy Freqtrade strategies on Hyperliquid through Superior Trade's managed cloud.

Read [`../../references/unified-runtime.md`](../../references/unified-runtime.md)
before any Superior Trade request. Use only current Unified API methods and
payload fields.

**Base URL:** `https://unified-api-zag4gzx6gq-an.a.run.app`
**Auth:** `x-api-key` header on all protected endpoints
**Discovery:** `GET /openapi.json` (OpenAPI), `GET /install.txt`, and `GET /.well-known/mcp.json`

## Unified API only

Before venue setup, backtesting, deployment, or execution, read
[`../../references/unified-runtime.md`](../../references/unified-runtime.md).
Use `GET /context/venues` and `GET /runtime/frameworks` to discover support,
then use the Unified runtime endpoints. If a required Hyperliquid operation is
absent from the contract, report it as unavailable.

## Reference files

Load these on demand — each is the full detail behind a summary below.

| Read | When |
| --- | --- |
| `references/api.md` | You need Unified route selection for account, context, backtesting, deployment, typed execution, or withdrawal (`POST /wallet/withdraw`). |
| `references/strategy-config.md` | You are writing or fixing config JSON or strategy Python — config fields, code template, TA-Lib usage, multi-entry (DCA/grid), funding-rate access, `minimal_roi` shapes. |
| `references/wallets-and-accounts.md` | Anything about wallets, balances, deposits, sub-accounts, multi-strategy capacity, pair formats, or HIP-3 tickers. |
| `references/troubleshooting.md` | A deployment or backtest is failing, trading zero times, hitting rate limits, or showing orphan positions. |

## Gotchas

Environment-specific facts that defy reasonable assumptions. Read these before acting.

- **HIP-3 pairs use a HYPHEN, not a colon.** `XYZ-AAPL/USDC:USDC` is correct; `XYZ:AAPL/USDC:USDC` is the single most common format mistake. HIP-3 pairs are also absent from the default `{"type":"meta"}` call — you must pass the dex, e.g. `{"type":"meta","dex":"xyz"}`.
- **The agent wallet holding $0 is normal.** It signs against the main wallet's balance and never needs funds. Always check the **main** trading wallet's balance; checking the agent wallet's will always look like an empty account.
- **A balance that covers `stake_amount × max_open_trades` exactly will still fail.** The exchange reserves roughly 1% for fees, so cap `stake_amount` at ~95% of `balance / max_open_trades` or entries get rejected silently.
- **The account URL is `https://account.superior.trade`.** Never send users to `app.superior.trade`, including when an API error message itself contains that older URL.
- **Multi-output TA-Lib functions return tuples.** `talib.BBANDS(...)` and friends crash at runtime if unpacked as a single value — see `references/strategy-config.md`.
- **Sub-account funds are not available to the master.** A master's true capacity is its own balance plus sub-account balances queried separately via `subAccounts2`; funds sitting in a sub-account cannot back a master deployment.
- **Hyperliquid margin modes differ — never assume.** If perps shows $0 but spot shows funds, inspect whether the exchange account uses unified margin or standard margin before telling the user to move anything themselves.
- **One live strategy per trading account.** To run several at once, omit `wallet_address` when storing credentials and the server assigns the next idle trading account.

## Safety

### Security & Permissions

This skill requires exactly **one credential**: an `x-api-key` header value. The only secret the agent uses is `SUPERIOR_TRADE_API_KEY` from the environment.

**Security rules (non-negotiable):**

1. **NEVER** ask users for private keys, seed phrases, or wallet credentials
2. **NEVER** include private keys in API requests (the API rejects them)
3. **NEVER** log, store, or display private keys or seed phrases
4. **NEVER** tell users to deposit funds to the agent wallet address
5. **NEVER** fabricate wallet balances, API responses, or trade results
6. **NEVER** start a live deployment without explicit user confirmation
7. **Prefer user-friendly language** over internal technical names when speaking conversationally. Say "strategy", "the bot", or "the trading engine" instead of referencing internal class names or infrastructure details. This is a UX preference — if the user asks about the underlying technology, answer honestly (the platform uses Freqtrade for strategy execution on Hyperliquid).
8. **NEVER** send users to `app.superior.trade` — the correct URL is `https://account.superior.trade`

> **Key scope notice:** The API key can create and start live deployments that execute real trades using the user's managed wallet, submit contract-supported typed executions, and request a Unified wallet withdrawal after confirmation. It cannot export private keys or provide an undocumented venue-specific deposit/transfer action. Users should confirm scope with Superior Trade and backtest their strategy first.

| Can do                                                                                     | Cannot do                                          |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| Create, list, delete backtests                                                             | Access other users' data                           |
| Create, start, stop, delete deployments (including live trading with real funds)           | Export or view private keys                        |
| Trigger server-side credential resolution (no user secrets collected)                      | Ask users for wallet secrets                       |
| View deployment logs, status, wallet metadata                                              | Move unsupported assets or use unsupported chains  |
| Deposit native Arbitrum USDC from the user's platform wallet into Hyperliquid via the API | Bridge from external wallets                       |
| Return Hyperliquid USDC to the server-resolved Superior wallet via the API                | Withdraw to an arbitrary external address           |

### Live Deployment Confirmation

Before any **live deployment**, the agent MUST present this summary and wait for explicit confirmation:

```
Deployment Summary:
• Strategy: [name]
• Exchange: hyperliquid
• Trading mode: [spot/futures]
• Pairs: [list]
• Stake amount: [amount] USDC per trade
• Max open trades: [n]
• Stoploss: [percentage]
• Margin mode: [cross/isolated] (futures only)

⚠️ This will trade with REAL funds. Proceed? (yes/no)
```

Do NOT start a live deployment without an explicit affirmative response.

## Setup

### Getting an API Key

> **IMPORTANT:** The correct URL is **https://account.superior.trade** — NOT `app.superior.trade`. Never send users to `app.superior.trade`.

Use `SUPERIOR_TRADE_API_KEY` from the environment or credential manager.

When a user needs to get their API key:

1. Go to https://account.superior.trade
2. Sign up (email or wallet)
3. Read the managed wallet and deposit details from `GET /wallet`
4. Fund the platform trading wallet with native USDC on Arbitrum One using the user's own capital
5. Create an API key (`st_live_...`) from your account settings
6. Add it as `SUPERIOR_TRADE_API_KEY` in your agent's environment/credential settings
7. Check Hyperliquid and framework support with `GET /context/venues` and `GET /runtime/frameworks`
8. If a required venue bootstrap or bridge action is absent from `GET /openapi.json`, report it as unavailable

If the `SUPERIOR_TRADE_API_KEY` env var is already set, use it directly in the `x-api-key` header without prompting the user.

### Public Endpoints (no auth)

| Method | Path                          | Description                              |
| ------ | ----------------------------- | ---------------------------------------- |
| GET    | `/health`                     | `{ "status": "ok", "timestamp": "..." }` |
| GET    | `/openapi.json`               | Unified OpenAPI contract                 |
| GET    | `/install.txt`                | Installation instructions                |
| GET    | `/.well-known/mcp.json`       | MCP discovery manifest                   |

## Agent Operating Rules

- **Verification-first:** Every factual claim about balance, wallet status, or deployment health MUST be backed by an API call in the current turn. NEVER assume → report → verify later.
- **Anti-hallucination:** If you can't call the API, say "I haven't checked yet." Every number must come from a real response.
- **Conversational:** Make API calls directly and present results conversationally. Show raw payloads only on request.
- **Backtesting:** Build config + code from user intent → create → poll → present results — all automatically.
- **Deployment:** Create → store credentials → run checklist → show summary → get confirmation → start.
- **Proactive:** Ask for missing info conversationally, one concern at a time. Always ask user to run a backtest before first live deployment.

Check Hyperliquid balances with BOTH endpoints:

- **Perps:** `POST https://api.hyperliquid.xyz/info` → `{"type":"clearinghouseState","user":"0x..."}`
- **Spot:** `POST https://api.hyperliquid.xyz/info` → `{"type":"spotClearinghouseState","user":"0x..."}`

### Repeated Failures

If the agent fails the same task 3+ times (e.g. strategy code keeps crashing, backtest keeps failing), stop and:

1. Summarize what was tried and what failed
2. Pivot in two stages before giving up:
   - **First — param space.** If you have not yet run a parameter sweep on this strategy/pair, run one (see Backtest Workflow → Parameter Sweeps). Most "this idea doesn't work" verdicts are really "this single config didn't work" — sweeping the key parameter often surfaces a viable variant in one batch.
   - **Second — pair space.** Only after a full sweep also fails, suggest a different pair, timeframe, or strategy family (e.g. mean-reversion instead of momentum).
3. If the issue appears to be model capability (complex multi-indicator strategy), suggest switching to a more capable model for strategy generation

## Workflows

### Backtest Workflow

1. Build config + strategy code from user requirements
2. `POST /runtime/backtests` — create with `framework: "freqtrade"`, `venue: "hyperliquid"`, strategy source/config, instruments, and timerange fields from `GET /openapi.json`.
3. Poll `GET /runtime/backtests/{id}` every 10s until `completed` or `failed` (1–10 min)
4. Read `GET /runtime/backtests/{id}/logs` for framework output and diagnostics
5. Present the result fields published by the current contract: total trades, win rate, profit, drawdown, Sharpe ratio, and duration when available
6. If failed, check `GET /runtime/backtests/{id}/logs`
7. To cancel or remove: `DELETE /runtime/backtests/{id}`

#### Backtest Wallet and Stake Sizing

Backtests are simulations. Do **not** size a backtest from the user's live wallet by default; use simulated capital to evaluate the strategy. Only mirror the user's current wallet if they explicitly ask for a live-wallet simulation.

- `dry_run_wallet` is the total simulated wallet inventory by asset. It is an object/map, not a scalar. Examples: `{ "USDC": 1000 }`, `{ "USDC": 100, "BTC": 0.1 }`.
- `stake_amount` is the amount the backtest/bot may allocate per trade slot. A numeric value is fixed stake per entry slot; `"unlimited"` divides the simulated wallet across `max_open_trades` slots.
- If using fixed stake, set `dry_run_wallet` to the total simulated balances so PnL is measured against the correct capital base. Example: a $50 USDC simulation with $45 usable per trade uses `stake_amount: 45` and `dry_run_wallet: { "USDC": 50 }`.
- For standard perps, keep fixed `stake_amount` at or below ~90% of `USDC / max_open_trades`; for HIP-3 assets, use ~70% because fees and isolated-margin buffers are higher.
- Never combine `stake_amount: "unlimited"` with `max_open_trades: -1`. When stake is unlimited, `max_open_trades` must be a finite positive integer so the wallet can be divided across slots.
- For DCA/grid/scaling strategies that use `position_adjustment_enable` and `adjust_trade_position`, `stake_amount` may be fixed or `"unlimited"`. If using `"unlimited"`, you must control the initial entry size in `custom_stake_amount`; otherwise the first entry can consume all available capital. In either mode, `dry_run_wallet` must cover the maximum laddered exposure, not just the first entry.

#### Parameter Sweeps (recommended for first-pass backtests)

For the **first** backtest of any new idea on a given pair, do not submit a single config. Submit a **3-variant sweep** that varies ONE parameter, run all 3 in parallel, then compare horizontally.

**Why:** building a config is the expensive cognitive step; running a backtest is cheap. A single result tells you whether one point worked; three neighboring points tell you whether the *region* works and which direction to iterate.

**How to fan out:**

1. Issue all 3 `POST /runtime/backtests` calls in parallel (different config for each variant; same code unless the variant is a code-level change).
2. Poll all 3 `GET /runtime/backtests/{id}` endpoints in parallel each cycle.
3. Fetch all 3 `GET /runtime/backtests/{id}` results in parallel once status is `completed`.

Each backtest runs in isolation, so parallel execution does not slow any single run.

**What to vary (pick ONE axis per sweep):**

| Strategy family | Parameter to vary | Three variants |
|---|---|---|
| Momentum / EMA cross | EMA periods | 5/10/20, 8/13/21, 12/26/50 |
| Trend-following | ATR stop multiplier | 2.0, 3.0, 4.0 |
| Mean-reversion (RSI) | Oversold threshold | <25, <30, <35 |
| Bollinger Bands | Std-dev width | 1.5, 2.0, 2.5 |
| Breakout | Lookback window | 20, 50, 100 candles |

**When NOT to sweep:**

- The user pinned specific parameter values ("backtest with EMA 8/21 only").
- Walk-forward validation on a second pair after a confirmed setup — that should be a single config (sweeping there is parameter overfitting).
- The user is iterating on a known winner ("now try the same config on ETH").

#### Result Interpretation

After status = `completed`, read both `GET /runtime/backtests/{id}` and
`GET /runtime/backtests/{id}/logs`. Present only metrics actually returned by
the Unified API or its framework logs:

- **Total trades** — completed round-trips
- **Win rate** — percentage of profitable trades
- **Total profit %** — net profit as percentage of starting balance
- **Max drawdown** — worst peak-to-trough decline
- **Sharpe ratio** — risk-adjusted return (>1.0 good, >2.0 excellent)
- **Average trade duration** — how long positions are held

**Before suggesting deployment**, always run a backtest first. If the backtest produced **zero trades** over a timerange that should have generated signals (e.g. weeks on a 5m timeframe), do not offer deployment — the strategy or pair likely has an issue. If PnL is **negative**, note the timerange may be unsuitable but don't dismiss the strategy outright. If PnL is **positive**, present results without overpromising — strong backtest fit can indicate overfitting. Stay neutral and let the user decide.

#### Sweep Result Comparison

For 3-variant sweeps, present results as a single table (Variant | Config | PnL% | Trades | Sharpe | Max DD), then read the shape:

- **All 3 profitable** → pick the **best Sharpe** (not best PnL — small-sample PnL rewards luck). The parameter region is robust; proceed to walk-forward or deployment.
- **1–2 profitable** → pick the winner, but flag that the parameter is sensitive. Suggest either (a) walk-forward on a second pair as an independent check, or (b) one tighter sweep around the winner.
- **All 3 unprofitable / < 10 trades** → the idea doesn't work on this pair. Move to pair-space (different pair, timeframe, or strategy family). Do not sweep again on the same pair.
- **Monotonic edge** (e.g. PnL strictly improves 2.0 → 3.0 → 4.0) → the best variant sits at the edge of the grid. Run ONE more variant past it (e.g. 5.0) — don't run another full 3-grid; just extend by one.

**Zero-trade rule for sweeps:** zeros in 1–2 variants of a sweep are *informative* (the parameter was too tight), not a failure. Only treat the sweep as failed when ALL 3 variants return zero trades.

### Deployment Workflow

1. `POST /runtime/deployments` with top-level `framework`, `venue`, `mode`, `name`, `code`, and `config`
2. **Ask the user: live or dry-run?**
   - **Live:** use `PUT /runtime/deployments/{id}/credentials` with a credential form published by `GET /openapi.json`
   - **Dry-run:** Skip the credentials step — the deployment runs in simulation mode (no real funds)
3. Run the pre-deployment checklist
4. Show the deployment confirmation summary and wait for explicit user confirmation
5. `PUT /runtime/deployments/{id}/status` → `{"action": "start"}`
6. Monitor: `GET /runtime/deployments/{id}`, `GET /runtime/deployments/{id}/logs`
7. Stop: `PUT /runtime/deployments/{id}/status` → `{"action": "stop"}`

### Pre-Deployment Checklist (MANDATORY)

Before `PUT /runtime/deployments/{id}/status` → `{"action":"start"}`:

**For live deployments (credentials stored):**

1. **Account ready** — fetch `GET /wallet` and `GET /context/venues`. Proceed only when the returned wallet and Hyperliquid capability data show the required support; otherwise report the blocker.
2. **Credentials stored** — inspect the credential state returned by `GET /runtime/deployments/{id}`. If credentials are required, attach the exact contract-defined payload with `PUT /runtime/deployments/{id}/credentials`.
3. **Identify wallets** — `GET /runtime/deployments/{id}` → note `wallet_address` (agent wallet) and `agent_wallet_address`.
4. **Funds available** — Check the managed wallet and live Hyperliquid state. Verify `stake_amount × max_open_trades` fits within available collateral with a fee buffer. If funding is insufficient and Unified API does not publish a venue deposit action, stop and tell the user what funding step remains unavailable.
5. **No existing positions/orders** — Check `clearinghouseState` for open positions on the main wallet. If positions or orders exist, show the user details (pair, side, size, PnL) and ask them to close before deploying — leftover positions can block new entries or cause unexpected margin usage.

**For dry-run deployments (no credentials):** Skip steps 1–5, the deployment runs in simulation mode without real funds.

6. **Pair is tradeable** — `POST https://api.hyperliquid.xyz/info` → `{"type":"meta"}` for standard perps, or `{"type":"meta", "dex":"xyz"}` (or the relevant dex name) for HIP3 pairs. Verify the coin name exists in the `universe` array.

Do NOT skip any step or assume it passed without the API call.

### Getting Funds Back Out

Use `POST /wallet/withdraw` only with the request shape and verified destination
published by the Unified contract. A typed `POST /runtime/executions` request may
place or cancel supported orders; it is not an undocumented exit-all or
sub-account transfer primitive. If the required unwind action is absent from
`GET /openapi.json`, report it as unavailable. Every money-moving action
requires an exact summary and explicit confirmation first.

## Related skills

Strategy templates and primitives are separate skills in this library. Load one when the user's idea matches it, rather than writing a strategy from scratch.

**Strategy templates:** `dca-weekly`, `grid-trading`, `funding-rate-arbitrage`, `funding-squeeze`, `basis-arb`, `breakout`, `mean-reversion`, `bollinger-reverter-4h`, `donchian-strong-regime`, `scalping`

**Primitives:** `regime-overlay` (trend gate), `dsl-exit-engine` (ROI ladder + ratcheting trail), `trade-thesis` (pre-trade bull/bear case), `backtesting` (windows, sweeps, walk-forward), `fees-optimizations` (maker vs taker, fee budgeting)

**Market scanning:** `intelligence` — live multi-bucket scoring across Hyperliquid alts and HIP-3, deployed as multi-pair buckets

**Other venues:** `aerodrome` (Base spot AMM), `lighter`, `polymarket`

**Funding an account:** `deposit-qr` (payment QR for a Superior-managed wallet), `external-deposit` (bridging in from an external wallet)
