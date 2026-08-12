---
name: hyperliquid
description: "Use when backtesting, deploying, funding, or debugging a live trading strategy on Hyperliquid through the Superior Trade API — writing Freqtrade configs and strategy code, running backtest sweeps, checking wallet balances, depositing USDC, trading HIP-3 stock/commodity perps, or diagnosing a deployment that will not start or trade."
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
    scope: "Read-write the user's own backtests and deployments. Can start live trading deployments that execute real trades with the user's platform-managed trading wallet, deposit native Arbitrum USDC from that wallet into Hyperliquid, and return Hyperliquid USDC to the user's server-resolved Superior wallet. Cannot export private keys, bypass the Superior wallet for withdrawals, move unsupported assets/chains, or access other users' data."
  env:
    - name: SUPERIOR_TRADE_API_KEY
      description: "Superior Trade API key (x-api-key header). Obtained at https://account.superior.trade. Can create/manage backtests and deployments including live trading, deposit native Arbitrum USDC from the user's platform-managed wallet into Hyperliquid, and return Hyperliquid USDC to the user's server-resolved Superior wallet. Cannot export private keys, bypass the Superior wallet for withdrawals, move unsupported assets/chains, or access other users' data. Users do not need their own Hyperliquid wallet."
      required: true
      type: api_key
  externalEndpoints:
    - url: https://api.superior.trade
      purpose: "All backtesting and deployment operations"
    - url: https://api.hyperliquid.xyz/info
      purpose: "Read-only public queries. Balance checks send the user's public wallet address (not a secret — visible on-chain). Pair validation sends no user data. No authentication or secrets are sent to this endpoint."
---

# Superior Trade — Hyperliquid

Backtest and deploy Freqtrade strategies on Hyperliquid through Superior Trade's managed cloud.

**Base URL:** `https://api.superior.trade`
**Auth:** `x-api-key` header on all protected endpoints
**Docs:** `GET /docs` (Swagger UI), `GET /openapi.json` (OpenAPI spec), `GET /llms.txt`

## Reference files

Load these on demand — each is the full detail behind a summary below.

| Read | When |
| --- | --- |
| `references/api.md` | You need the exact request/response shape for any endpoint: account, backtesting, deployment, portfolio deposit, **getting funds back out** (`POST /v3/portfolio/hyperliquid/withdraw`), or closing everything at once (portfolio exit). |
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
- **Accounts run in unified OR legacy mode — never assume.** If perps shows $0 but spot shows funds, ask about unified mode before telling the user to move anything themselves.
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

> **Key scope notice:** The API key can create and start live trading deployments that execute real trades using the user's platform-managed trading wallet. It can also initiate native Arbitrum USDC deposits into Hyperliquid and return Hyperliquid USDC to the user's Superior wallet. It cannot export private keys, bypass the Superior wallet for withdrawals, or move unsupported assets/chains. Users should confirm scope with Superior Trade and backtest their strategy first.

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
3. Create or select a trading account wallet from `GET /v3/account`
4. Fund the platform trading wallet with native USDC on Arbitrum One using the user's own capital
5. Create an API key (`st_live_...`) from your account settings
6. Add it as `SUPERIOR_TRADE_API_KEY` in your agent's environment/credential settings
7. Bootstrap Hyperliquid setup with `POST /v3/account/{address}/hyperliquid` for the selected trading wallet
8. If the wallet's USDC is still on Arbitrum, use `POST /v2/portfolio/hyperliquid/deposit` to deposit it into Hyperliquid before live trading

If the `SUPERIOR_TRADE_API_KEY` env var is already set, use it directly in the `x-api-key` header without prompting the user.

### Public Endpoints (no auth)

| Method | Path                          | Description                              |
| ------ | ----------------------------- | ---------------------------------------- |
| GET    | `/health`                     | `{ "status": "ok", "timestamp": "..." }` |
| GET    | `/docs`                       | Swagger UI                               |
| GET    | `/openapi.json`               | OpenAPI 3.0 spec                         |
| GET    | `/llms.txt`                   | LLM-optimized API docs                   |
| GET    | `/.well-known/ai-plugin.json` | AI plugin manifest                       |

## Agent Operating Rules

- **Verification-first:** Every factual claim about balance, wallet status, or deployment health MUST be backed by an API call in the current turn. NEVER assume → report → verify later.
- **Anti-hallucination:** If you can't call the API, say "I haven't checked yet." Every number must come from a real response.
- **Conversational:** Make API calls directly and present results conversationally. Show raw payloads only on request.
- **Backtesting:** Build config + code from user intent → create → start → poll → present results — all automatically.
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
2. `POST /v2/backtesting` — create with config, code, and timerange (`{ "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" }`). If the dates are invalid or omitted, the server picks a suitable duration based on the timeframe.
3. `PUT /v2/backtesting/{id}/status` with `{"action": "start"}`
4. Poll `GET /v2/backtesting/{id}/status` every 10s until `completed` or `failed` (1–10 min)
5. `GET /v2/backtesting/{id}` — fetch full results; download `resultUrl` for detailed JSON
6. Present summary: total trades, win rate, profit, drawdown, Sharpe ratio
7. If failed, check `GET /v2/backtesting/{id}/logs`
8. To cancel: `DELETE /v2/backtesting/{id}`

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

**Why:** building a config is the expensive cognitive step; a backtest pod is cheap. A single result tells you whether one point worked; three neighboring points tell you whether the *region* works and which direction to iterate.

**How to fan out:**

1. Issue all 3 `POST /v2/backtesting` calls in parallel (different config for each variant; same code unless the variant is a code-level change).
2. Issue all 3 `PUT /v2/backtesting/{id}/status` start calls in parallel.
3. Poll all 3 `GET /v2/backtesting/{id}/status` endpoints in parallel each cycle.
4. Fetch all 3 `GET /v2/backtesting/{id}` results in parallel once status is `completed`.

Each backtest runs in its own isolated pod, so parallel execution does not slow any single run.

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

After status = `completed`, download the `resultUrl` JSON. Present these key metrics:

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

1. `POST /v2/deployment` with config, code, name
2. **Ask the user: live or dry-run?**
   - **Live:** `POST /v2/deployment/{id}/credentials` with `{ "exchange": "hyperliquid", "wallet_address": "0x...", "subaccount_address": "0x..." }` — `wallet_address` and `subaccount_address` are optional; server assigns wallet automatically if omitted
   - **Dry-run:** Skip the credentials step — the deployment runs in simulation mode (no real funds)
3. Run the pre-deployment checklist
4. Show the deployment confirmation summary and wait for explicit user confirmation
5. `PUT /v2/deployment/{id}/status` → `{"action": "start"}`
6. Monitor: `GET /v2/deployment/{id}/status`, `GET /v2/deployment/{id}/logs`
7. Stop: `PUT /v2/deployment/{id}/status` → `{"action": "stop"}`

### Pre-Deployment Checklist (MANDATORY)

Before `PUT /v2/deployment/{id}/status` → `{"action":"start"}`:

**For live deployments (credentials stored):**

1. **Account ready** — list/select the trading wallet with `GET /v3/account`, then call `POST /v3/account/{address}/hyperliquid` for that wallet before live deployment. This is a write-capable bootstrap endpoint: it may set the Hyperliquid referrer, approve Superior's builder fee, create and approve the agent wallet, and persist agent wallet metadata. After it returns, verify readiness with `GET /v3/account/{address}/status/hyperliquid`; proceed only when `onboarding.ready` is `true` and `onboarding.blockers` is empty. If bootstrap returns `wallet_not_exportable`, `hyperliquid_bootstrap_failed`, or readiness still has blockers, stop and report the exact blocker instead of starting live trading.
2. **Credentials stored** — `GET /v2/deployment/{id}` → `credentials_status: "stored"`. If not, call `POST /v2/deployment/{id}/credentials`.
3. **Identify wallets** — `GET /v2/deployment/{id}/credentials` → note `wallet_address` (agent wallet) and `agent_wallet_address`.
4. **Funds available** — Check the **main wallet** (platform-managed trading wallet), NOT the agent wallet. Agent wallet having $0 is normal. Query `clearinghouseState` + `spotClearinghouseState` for single deployments. If the master account has sub-accounts, also query `subAccounts2` and sum total balance across master + all sub-accounts — funds allocated to sub-accounts are not available to the master. **Then verify `stake_amount × max_open_trades` fits within the available balance.** The exchange reserves a small fee buffer (~1%), so set `stake_amount` to no more than ~95% of `balance / max_open_trades` to avoid silent trade rejections. If Hyperliquid funds are insufficient but the user has native Arbitrum USDC in the platform wallet, ask for explicit confirmation and call `POST /v2/portfolio/hyperliquid/deposit`, then re-check balances before starting. If both Hyperliquid and platform-wallet funds are insufficient, tell the user they must add more of their own capital to the platform account before live trading can proceed.
5. **No existing positions/orders** — Check `clearinghouseState` for open positions on the main wallet. If positions or orders exist, show the user details (pair, side, size, PnL) and ask them to close before deploying — leftover positions can block new entries or cause unexpected margin usage.

**For dry-run deployments (no credentials):** Skip steps 1–5, the deployment runs in simulation mode without real funds.

6. **Pair is tradeable** — `POST https://api.hyperliquid.xyz/info` → `{"type":"meta"}` for standard perps, or `{"type":"meta", "dex":"xyz"}` (or the relevant dex name) for HIP3 pairs. Verify the coin name exists in the `universe` array.

Do NOT skip any step or assume it passed without the API call.

### Getting Funds Back Out

Two different operations — do not confuse them:

- **Unwind a sub-account** — `POST /v2/portfolio/hyperliquid/exit` closes ALL positions on the given `subaccount_address` and returns its funds to the master. Sub-account scoped; it does not take money off Hyperliquid.
- **Take USDC off Hyperliquid** — `POST /v3/portfolio/hyperliquid/withdraw` moves USDC to the server-resolved main Superior wallet on Arbitrum. The destination is resolved server-side, so you cannot send to an arbitrary or external address.

Both move real money. State the amount and destination and get an explicit yes first. Stop any strategy trading that account before withdrawing, or the withdrawal can underfund a live position. Hyperliquid also deducts a 1 USDC fee from the withdrawal amount — never withdraw 1 USDC or less. Full shapes and the confirmation template are in `references/api.md`.

## Related skills

Strategy templates and primitives are separate skills in this library. Load one when the user's idea matches it, rather than writing a strategy from scratch.

**Strategy templates:** `dca-weekly`, `grid-trading`, `funding-rate-arbitrage`, `funding-squeeze`, `basis-arb`, `breakout`, `mean-reversion`, `bollinger-reverter-4h`, `donchian-strong-regime`, `scalping`

**Primitives:** `regime-overlay` (trend gate), `dsl-exit-engine` (ROI ladder + ratcheting trail), `trade-thesis` (pre-trade bull/bear case), `backtesting` (windows, sweeps, walk-forward), `fees-optimizations` (maker vs taker, fee budgeting)

**Market scanning:** `intelligence` — live multi-bucket scoring across Hyperliquid alts and HIP-3, deployed as multi-pair buckets

**Other venues:** `aerodrome` (Base spot AMM), `lighter`, `polymarket`

**Funding an account:** `deposit-qr` (payment QR for a Superior-managed wallet), `external-deposit` (bridging in from an external wallet)
