---
name: hyperliquid
version: 4.5.1
updated: 2026-06-30
description: "Backtest and deploy trading strategies on Superior Trade's managed cloud."
source: https://github.com/Superior-Trade
primaryEnv: SUPERIOR_TRADE_API_KEY
auth:
  type: api_key
  env: SUPERIOR_TRADE_API_KEY
  header: x-api-key
  scope: "Read-write the user's own backtests and deployments. Can start live trading deployments that execute real trades with the user's platform-managed trading wallet, deposit native Arbitrum USDC from that wallet into Hyperliquid, and return Hyperliquid USDC to the user's server-resolved Superior wallet. Cannot export private keys, bypass the Superior wallet for withdrawals, move unsupported assets/chains, or access other users' data."
env:
  - name: SUPERIOR_TRADE_API_KEY
    description: "Superior Trade API key (x-api-key header). Obtained from the user's Superior Trade account settings. Can create/manage backtests and deployments including live trading, deposit native Arbitrum USDC from the user's platform-managed wallet into Hyperliquid, and return Hyperliquid USDC to the user's server-resolved Superior wallet. Cannot export private keys, bypass the Superior wallet for withdrawals, move unsupported assets/chains, or access other users' data. Users do not need their own Hyperliquid wallet."
    required: true
    type: api_key
externalEndpoints:
  - url: https://api.superior.trade
    purpose: "All backtesting and deployment operations"
  - url: https://api.hyperliquid.xyz/info
    purpose: "Read-only public queries. Balance checks send the user's public wallet address (not a secret — visible on-chain). Pair validation sends no user data. No authentication or secrets are sent to this endpoint."
---

# Superior Trade API

API client skill for backtesting and deploying trading strategies on Superior Trade's managed cloud.

**Base URL:** `https://api.superior.trade`
**Auth:** `x-api-key` header on all protected endpoints
**Docs:** `GET /docs` (Swagger UI), `GET /openapi.json` (OpenAPI spec)

## Setup

### Getting an API Key

Use `SUPERIOR_TRADE_API_KEY` from the environment or credential manager.

When a user needs to get their API key:

1. Sign up for or open a Superior Trade account
2. Create or select a trading account wallet from `GET /v3/account`
3. Fund the platform trading wallet with native USDC on Arbitrum One using the user's own capital
4. Create an API key (`st_live_...`) from account settings
5. Add it as `SUPERIOR_TRADE_API_KEY` in your agent's environment/credential settings
6. Bootstrap Hyperliquid setup with `POST /v3/account/{address}/hyperliquid` for the selected trading wallet
7. If the wallet's USDC is still on Arbitrum, use `POST /v2/portfolio/hyperliquid/deposit` to deposit it into Hyperliquid before live trading

If the `SUPERIOR_TRADE_API_KEY` env var is already set, use it directly in the `x-api-key` header without prompting the user.

### Public Endpoints (no auth)

| Method | Path                          | Description                              |
| ------ | ----------------------------- | ---------------------------------------- |
| GET    | `/health`                     | `{ "status": "ok", "timestamp": "..." }` |
| GET    | `/docs`                       | Swagger UI                               |
| GET    | `/openapi.json`               | OpenAPI 3.0 spec                         |
| GET    | `/llms.txt`                   | LLM-optimized API docs                   |
| GET    | `/.well-known/ai-plugin.json` | AI plugin manifest                       |

## Reference Library

These pages live alongside this skill in the same repo. Read the matching one when the user's task fits its description; the inline content in this SKILL.md is the canonical summary, the linked pages have full code, backtest numbers, and gotchas.

### Strategy templates (Hyperliquid Freqtrade)

- [DCA · Weekly buy](https://github.com/Superior-Trade/superior-skills/blob/main/skills/v2/strategies/dca-weekly/SKILL.md) — scheduled buys via `adjust_trade_position` (works on calendar trigger, not price)
- [Grid trading](https://github.com/Superior-Trade/superior-skills/blob/main/skills/v2/strategies/grid-trading/SKILL.md) — profit-laddered position adjustment + partial take-profits
- [Funding rate arbitrage](https://github.com/Superior-Trade/superior-skills/blob/main/skills/v2/strategies/funding-rate-arbitrage/SKILL.md) — capture funding when shorts are paying longs (the most profitable template in our audit)
- [Funding squeeze](https://github.com/Superior-Trade/superior-skills/blob/main/skills/v2/strategies/funding-squeeze/SKILL.md) — long when funding is deeply negative AND price is rising; ride the squeeze instead of waiting for carry mean-reversion
- [Basis arbitrage (directional)](https://github.com/Superior-Trade/superior-skills/blob/main/skills/v2/strategies/basis-arb/SKILL.md) — long perp when spot–perp basis flips negative with funding negative (directional read; not a hedged arb)
- [Breakout](https://github.com/Superior-Trade/superior-skills/blob/main/skills/v2/strategies/breakout/SKILL.md) — Donchian-style breakout with trailing stop (regime-sensitive)
- [Mean reversion](https://github.com/Superior-Trade/superior-skills/blob/main/skills/v2/strategies/mean-reversion/SKILL.md) — 2.5σ Bollinger fade with ADX regime filter
- [Scalping](https://github.com/Superior-Trade/superior-skills/blob/main/skills/v2/strategies/scalping/SKILL.md) — fast in/out on RSI thrust + volume spike (structural template; tune before deploying)

### Exchange-specific guides

- [Aerodrome / Base](https://github.com/Superior-Trade/superior-skills/blob/main/skills/v2/exchanges/aerodrome/SKILL.md) — spot AMM swap execution on Base; no order book, no leverage, wallet-balance-driven

### Optimizations

- [Pre-trade thesis builder](https://github.com/Superior-Trade/superior-skills/blob/main/skills/v2/primitives/trade-thesis/SKILL.md) — structured bull/bear analysis, invalidation criteria, and sizing rationale before any live deployment of a new strategy idea
- [Backtesting best practices](https://github.com/Superior-Trade/superior-skills/blob/main/skills/v2/primitives/backtesting/SKILL.md) — window selection, trade-count thresholds, exit-reason mix, parameter sweeps, walk-forward, zero-trade escalation, compute-cost estimation
- [Fees optimization](https://github.com/Superior-Trade/superior-skills/blob/main/skills/v2/primitives/fees-optimizations/SKILL.md) — Freqtrade × Hyperliquid order types, entry/exit pricing, maker vs taker, builder code fee, edge-to-fee budgeting

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
8. **NEVER** send users to `app.superior.trade`

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

## Platform Model

### Wallet Architecture (CRITICAL)

Superior Trade uses Hyperliquid's native **agent wallet** pattern. Users do NOT need their own Hyperliquid wallet — everything is managed by the platform. If a user asks "how do I link my Hyperliquid account," the answer is: **they don't need one** — create or select a Superior trading account wallet with `GET /v3/account` / `POST /v3/account`, then bootstrap Hyperliquid setup with `POST /v3/account/{address}/hyperliquid`.

1. **Main wallet** — a platform-managed trading account wallet. Users fund this address with native USDC on Arbitrum One, then deposit that USDC into Hyperliquid using the API when needed. The address is shown in the user's Superior Trade account and returned by `GET /v3/account`.
2. **Agent wallet** — a platform-managed signing key authorized via Hyperliquid's `approveAgent`. Signs trades against the main wallet's balance.

**Key facts:**

- The agent wallet does NOT need its own funds — $0 balance is normal and expected
- Each trading account has its own agent wallet. Deployments can auto-resolve an idle trading account, or target one explicitly.
- The credentials endpoint returns `wallet_type: "agent_wallet"` for auto-resolved wallets
- Always check the **main wallet's** balance, not the agent wallet's
- `POST /v3/account/{address}/hyperliquid` can configure the Hyperliquid referral, approve Superior's builder fee, create/approve the agent wallet, and persist the agent wallet metadata
- The API can deposit native Arbitrum USDC from the user's platform-managed wallet into Hyperliquid via `POST /v2/portfolio/hyperliquid/deposit`
- The API can return Hyperliquid USDC to the server-resolved Superior wallet via `POST /v3/portfolio/hyperliquid/withdraw`
- The API cannot bridge unsupported assets/chains or withdraw without explicit user confirmation
- **NEVER tell users to deposit to the agent wallet address**

### Funding, Deposits, and Balance Checks

Funding is a two-stage flow:

1. The user funds their platform-managed trading wallet with native USDC on Arbitrum One using their own capital. The wallet address is shown in the user's Superior Trade account.
2. The agent can call `POST /v2/portfolio/hyperliquid/deposit` to transfer native Arbitrum USDC from that platform wallet to Hyperliquid Bridge2.
3. After the deposit confirms, the agent wallet signs trades against the main wallet's Hyperliquid balance.

Before calling the deposit endpoint, tell the user that this sends real USDC from their platform wallet into Hyperliquid and ask for explicit confirmation. If the platform wallet does not have enough Arbitrum USDC, tell the user they need to add more of their own capital to the platform account before the agent can deposit or trade.

**Supported deposit only:** native USDC on Arbitrum One to Hyperliquid. Do not suggest the deposit endpoint for Ethereum mainnet USDC, bridged USDC variants, Base, Optimism, other assets, external user wallets, or withdrawals. Use the dedicated withdrawal endpoint for Hyperliquid USDC withdrawals.

Always check the **main wallet** (platform-managed trading wallet), NOT the agent wallet.

**Balance query for master account (single deployment):**

```
POST https://api.hyperliquid.xyz/info
{"type":"clearinghouseState","user":"<MAIN_WALLET_ADDRESS>"}
{"type":"spotClearinghouseState","user":"<MAIN_WALLET_ADDRESS>"}
```

**Balance query for master account (multi-strategy with sub-accounts):**

When the master account has sub-accounts, its total balance is the sum of its own perp + spot balances PLUS all sub-account balances. Query both:

```
POST https://api.hyperliquid.xyz/info
{"type":"subAccounts2","user":"<MAIN_WALLET_ADDRESS>"}
```

Sub-account balances are included in the master account's total — funds allocated to sub-accounts are not available for master deployments. Always query `subAccounts2` first when the user has sub-accounts, then sum across all sub-account `spotState.balances` and `dexToClearinghouseState` entries to get the true total balance.

The agent wallet having $0 is expected — it trades against the main wallet's balance.

### Multi-Strategy Trading

Each strategy runs on its own wallet (one active deployment per wallet). To run multiple strategies concurrently there are two mechanisms — prefer the first:

**1. Multiple trading accounts (primary).** A user can hold several trading accounts (Free: up to 3, Pro: up to 6), each its own Hyperliquid master with its own agent wallet. To start an additional concurrent strategy, create the deployment and call `POST /v2/deployment/{id}/credentials` **omitting `wallet_address`** — the server auto-assigns the next **idle** trading account. Pass an explicit `wallet_address` to target a specific account. Errors: `all_accounts_in_use` (400) when every trading account is already running a strategy.

**2. Hyperliquid sub-accounts (overflow, HL-only).** When all trading accounts are busy, a master with **≥ $100,000 USD in lifetime trading volume** on Hyperliquid can create sub-accounts to run further strategies, each with its own isolated balance and positions.

**Key facts:**

- Sub-accounts inherit the master account's collateral (USDC, USDE, USDT0, USDH)
- Each sub-account can have its own deployment with isolated margin/positions
- Maximum 10 sub-accounts per master account
- Sub-accounts use **unified account mode** — spot and perps share a single balance

**Sub-account query** (read-only):

```
POST https://api.hyperliquid.xyz/info
{"type":"subAccounts2","user":"<MAIN_WALLET_ADDRESS>"}
```

Returns each sub-account's name, address, `abstraction` mode ("unifiedAccount" or legacy), spot balances, and perps state (`dexToClearinghouseState`). Always verify the sub-account has `abstraction: "unifiedAccount"` — legacy sub-accounts cannot be used with unified margin strategies.

**Balance composition for a sub-account:**

- **Perps account value:** from `dexToClearinghouseState[0][1].marginSummary.accountValue`
- **Perps withdrawable:** from `dexToClearinghouseState[0][1].withdrawable`
- **Spot USDC:** from `spotState.balances` where `coin === "USDC"`

The sub-account's total balance = perps account value + spot USDC (in unified mode these merge).

### Hyperliquid Authorize-and-Send API

`POST https://api.superior.trade/v2/authorize-and-send/hyperliquid`

A unified endpoint for Hyperliquid operations. All requests use `{"type": "...", ...}` body. Requires `x-api-key` header.

**Supported operation types:**

| Operation | Description |
| --------- | ----------- |
| `createSubAccount` | Create a new sub-account |
| `subAccountTransfer` | Transfer between main and sub-account |
| `sendAsset` | Move assets (main→sub, sub→main, or sub→sub) |
| `userSetAbstraction` | Set account mode (unified/legacy) |
| `subAccountModify` | Modify sub-account settings |

**Create sub-account:**
```json
{"type":"createSubAccount","user":"<MAIN_WALLET_ADDRESS>","name":"My Strategy"}
```

**Sub-account transfer (main → sub):**
```json
{"type":"subAccountTransfer","from":"<MAIN_WALLET_ADDRESS>","to":"<SUB_ACCOUNT_ADDRESS>","token":"USDC","amount":1000}
```

**Sub-account transfer (sub → main):**
```json
{"type":"subAccountTransfer","from":"<SUB_ACCOUNT_ADDRESS>","to":"<MAIN_WALLET_ADDRESS>","token":"USDC","amount":500}
```

**Transfer via sendAsset (main → sub):**
```json
{"type":"sendAsset","destination":"<SUB_ACCOUNT_ADDRESS>","sourceDex":"spot","destinationDex":"spot","token":"USDC","amount":1000}
```

**Transfer via sendAsset (sub → main):**
```json
{"type":"sendAsset","fromSubAccount":"<SUB_ACCOUNT_ADDRESS>","destination":"<MASTER_WALLET_ADDRESS>","sourceDex":"spot","destinationDex":"spot","token":"USDC","amount":500}
```

**Set unified account mode on a sub-account:**
```json
{"type":"userSetAbstraction","user":"<SUB_ACCOUNT_ADDRESS>","abstraction":"unifiedAccount"}
```

When creating a sub-account via the API, unified mode is set automatically after creation by calling `userSetAbstraction` with `abstraction: "unifiedAccount"`.

**Modify sub-account:**
```json
{"type":"subAccountModify","user":"<SUB_ACCOUNT_ADDRESS>","action":"disable"}
```

**Safety check before moving funds out of a trading account.** Any `sendAsset` / `subAccountTransfer` that pulls USDC OUT of a wallet (one trading account to another, or master to sub) lowers the source wallet's collateral. If that source wallet is running a live strategy, the withdrawal can raise liquidation risk on open positions or drop the balance below the strategy's reserved stake (`stake_amount × max_open_trades × buffer`). Before sending:

1. List the source wallet's live deployments — `GET /v2/deployment?status=running` — and check whether any has a `walletAddress` matching the source.
2. If one does, confirm with the user, and verify the **post-transfer** balance (current balance minus amount) still covers that strategy's reservation before transferring. If it would underfund the strategy, reduce the amount or move funds from an idle account instead.

### Hyperliquid Credentials

Credentials are managed automatically. To use a specific wallet, pass `wallet_address` — ownership is validated server-side.

## Exchange and Pair Rules

### Supported Exchanges

| Exchange    | Stake Currencies                       | Trading Modes |
| ----------- | -------------------------------------- | ------------- |
| Hyperliquid | USDC (also USDT0, USDH, USDE via HIP3) | spot, futures |

### Hyperliquid Notes

**Pair format by trading mode** (CCXT convention):

- **Spot**: `BTC/USDC`
- **Futures/Perp**: `BTC/USDC:USDC`

**Spot limitations:** No stoploss on exchange (bot handles internally), no market orders (simulated via limit with up to 5% slippage).

**Futures:** Margin modes `"cross"` and `"isolated"`. Stoploss on exchange via `stop-loss-limit` orders. No market orders (same simulation).

**Data availability:** Hyperliquid API provides ~5000 historic candles per pair. Superior Trade pre-downloads data; availability starts from ~November 2025.

**Hyperliquid is a DEX** — uses wallet-based signing, not API key/secret. Wallet credentials are managed automatically by the platform.

### HIP3 — Tokenized Real-World Assets

HIP3 assets (stocks, commodities, indices) are perpetual futures.

> **CRITICAL: HIP3 uses a HYPHEN, not a colon. This is the #1 format mistake.** Wrong: `XYZ:AAPL/USDC:USDC`. Correct: `XYZ-AAPL/USDC:USDC`.

**Pair format:** `PROTOCOL-TICKER/QUOTE:SETTLE` — the separator between protocol and ticker is always **`-`** (hyphen).

| Protocol | Dex name | Asset Types                               | Stake Currency | Examples                                   |
| -------- | -------- | ----------------------------------------- | -------------- | ------------------------------------------ |
| `XYZ-`   | `xyz`    | US/KR stocks, metals, currencies, indices | USDC           | `XYZ-AAPL/USDC:USDC`, `XYZ-GOLD/USDC:USDC` |
| `CASH-`  | `cash`   | Stocks, commodities                       | USDT0          | `CASH-GOLD/USDT0:USDT0`                    |
| `FLX-`   | `flx`    | Commodities, metals, crypto               | USDH           | `FLX-GOLD/USDH:USDH`                       |
| `KM-`    | `km`     | Stocks, indices, bonds                    | USDH           | `KM-GOOGL/USDH:USDH`                       |
| `HYNA-`  | `hyna`   | Leveraged crypto, metals                  | USDE           | `HYNA-SOL/USDE:USDE`                       |
| `VNTL-`  | `vntl`   | Sector indices, pre-IPO                   | USDH           | `VNTL-SPACEX/USDH:USDH`                    |

**XYZ tickers (USDC):** AAPL, ALUMINIUM, AMD, AMZN, BABA, BRENTOIL, CL, COIN, COPPER, COST, CRCL, CRWV, DKNG, DXY, EUR, EWJ, EWY, GME, GOLD, GOOGL, HIMS, HOOD, HYUNDAI, INTC, JP225, JPY, KIOXIA, KR200, LLY, META, MSFT, MSTR, MU, NATGAS, NFLX, NVDA, ORCL, PALLADIUM, PLATINUM, PLTR, RIVN, SILVER, SKHX, SMSN, SNDK, SOFTBANK, SP500, TSLA, TSM, URANIUM, URNM, USAR, VIX, XYZ100

**Data:** XYZ from ~November 2025, KM/CASH/FLX from ~February 2026. Timeframes: 1m, 3m, 5m, 15m, 30m, 1h (also 2h, 4h, 8h, 12h, 1d, 3d, 1w for some). Funding rate data at 1h.

**Trading rules:** HIP3 assets are futures-only — always use `trading_mode: "futures"` and `margin_mode: "isolated"`. XYZ pairs use `stake_currency: "USDC"`. Stock-based assets may have reduced liquidity outside US market hours.

### Pair Discovery

- **Standard perps:** `{"type":"meta"}` — check `universe[].name`
- **HIP3 pairs:** `{"type":"meta", "dex":"xyz"}` (or `"cash"`, `"km"`, etc.) — HIP3 pairs are NOT in the default meta call
- **List all dexes:** `{"type":"perpDexs"}`
- **Name conversion:** API returns `xyz:AAPL` → CCXT format `XYZ-AAPL/USDC:USDC` (uppercase prefix, colon→hyphen)

### Unified vs Legacy Account Mode

Hyperliquid accounts may run in **unified mode** (single balance) or **legacy mode** (separate spot/perps balances). Do NOT assume which mode the user has.

- If perps shows $0 but spot shows funds, ask about unified mode before suggesting the user move funds themselves.
- In unified mode, spot USDC is automatically available as perps collateral.

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

## API Reference

### Account

#### GET `/v3/account` — List Trading Accounts

Lists the user's platform-managed trading account wallets. Use one of these wallet addresses for Hyperliquid bootstrap, readiness checks, deposits, and live deployment credentials.

```bash
curl -sS "https://api.superior.trade/v3/account" \
  -H "accept: application/json" \
  -H "x-api-key: ${SUPERIOR_TRADE_API_KEY}"
```

If the user has no suitable trading account, create one with `POST /v3/account` before continuing.

#### POST `/v3/account/{address}/hyperliquid` — Bootstrap Hyperliquid Account

Bootstraps Hyperliquid setup for an owned trading account wallet. This endpoint is a mutation, not just a status read. It can call Hyperliquid to set the Superior referrer, approve the Superior builder fee, create and approve the agent wallet, and persist the agent wallet metadata.

Call this before starting a live Hyperliquid deployment for a trading account.

```bash
curl -sS -X POST "https://api.superior.trade/v3/account/${ADDRESS}/hyperliquid" \
  -H "accept: application/json" \
  -H "x-api-key: ${SUPERIOR_TRADE_API_KEY}"
```

```json
// Response (200)
{
  "chain": "arbitrum",
  "chain_id": 42161,
  "account": {
    "type": "trading_account",
    "name": "Momentum Vault",
    "account_index": 1,
    "wallet_address": "0x..."
  },
  "onboarding": {
    "target": "hyperliquid",
    "account_type": "trading_account",
    "ready": true,
    "next_step": "check_hyperliquid_status",
    "blockers": [],
    "steps": [
      { "id": "verify_trading_account_wallet", "status": "complete" },
      { "id": "create_agent_wallet", "status": "complete" },
      { "id": "configure_builder_fee", "status": "complete" },
      { "id": "check_hyperliquid_status", "status": "ready" }
    ]
  },
  "builder": {
    "configured": true,
    "address": "0xf4397BF0B047a2e70E860d475C46496F6A9efaF1",
    "requiredFeePercent": 0.04,
    "feePercent": 0.04
  },
  "agentWallet": {
    "created": true,
    "address": "0x..."
  },
  "referral": {
    "configured": true,
    "code": "AIWINMORETRADES4U"
  }
}
```

**Errors:** `400 wallet_not_exportable`, `400 validation_failed`, `404 trading_account_not_found`, `502 hyperliquid_bootstrap_failed`, `500 database_not_configured`.

If this endpoint returns `502 hyperliquid_bootstrap_failed`, do not proceed. The Hyperliquid exchange action failed or returned a non-ok response, so the account may be partially configured. Report the message and retry only after the cause is understood.

#### GET `/v3/account/{address}/status/hyperliquid` — Hyperliquid Readiness

Returns Hyperliquid readiness for an owned trading account wallet. Use this after bootstrap and before live deployment start.

```bash
curl -sS "https://api.superior.trade/v3/account/${ADDRESS}/status/hyperliquid" \
  -H "accept: application/json" \
  -H "x-api-key: ${SUPERIOR_TRADE_API_KEY}"
```

Proceed only when `onboarding.ready` is `true` and `onboarding.blockers` is empty.

#### GET `/v2/account/status` — Legacy Account Setup Status

Legacy status endpoint for the authenticated user before live trading. Prefer the v3 trading-account flow above when selecting or bootstrapping a specific trading wallet.

```bash
curl -sS "https://api.superior.trade/v2/account/status" \
  -H "accept: application/json" \
  -H "x-api-key: ${SUPERIOR_TRADE_API_KEY}"
```

If this endpoint returns a `400`, do not proceed with live credentials or deployment start. For trading-account workflows, use `GET /v3/account`, `POST /v3/account/{address}/hyperliquid`, and `GET /v3/account/{address}/status/hyperliquid` to resolve and verify setup for the selected wallet.

### Backtesting

#### POST `/v2/backtesting` — Create Backtest

```json
// Request
{ "config": {}, "code": "string (Python strategy)", "timerange": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" } }

// Response (201)
{ "id": "string", "status": "pending", "message": "Backtest created. Call PUT /:id/status with action \"start\" to begin." }
```

`timerange` specifies the historical period to backtest against. Dates are validated against available data — the server returns `invalid_timerange` if the requested period is outside what's available. If invalid dates are provided, the server falls back to a dynamic range based on the timeframe.

#### PUT `/v2/backtesting/{id}/status` — Start Backtest

```json
// Request — only "start" is supported; to cancel, use DELETE
{ "action": "start" }

// Response (200)
{ "id": "string", "status": "running", "previous_status": "pending", "job_name": "backtest-01kjvze9" }
```

#### GET `/v2/backtesting/{id}/status` — Poll Status

Response: `{ "id": "string", "status": "pending | running | completed | failed", "results": null }`. `results` is `null` while running — use `resultUrl` from full details for complete results.

#### GET `/v2/backtesting/{id}` — Full Details

```json
{
  "id": "string",
  "config": {},
  "code": "string",
  "status": "pending | running | completed | failed",
  "results": null,
  "resultUrl": "https://storage.googleapis.com/... (signed URL, valid 7 days)",
  "started_at": "ISO8601",
  "completed_at": "ISO8601",
  "job_name": "string",
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```

#### DELETE `/v2/backtesting/{id}`

Cancels if running and deletes. Response: `{ "message": "Backtest deleted" }`

### Deployment

#### POST `/v2/deployment` — Create Deployment

```json
// Request
{ "config": {}, "code": "string (Python strategy)", "name": "string" }

// Response (201)
{ "id": "string", "config": {}, "code": "string", "name": "My Strategy", "replicas": 1, "status": "pending", "deployment_name": "deploy-01kjvx94", "created_at": "ISO8601" }
```

#### PUT `/v2/deployment/{id}/status` — Start or Stop

```json
// Request
{ "action": "start" | "stop" }

// Response (200)
{ "id": "string", "status": "running | stopped", "previous_status": "string" }
```

**On stop:** The platform automatically cancels all open orders and closes all positions on Hyperliquid before stopping the pod.

#### GET `/v2/deployment/{id}` — Full Details

```json
{
  "id": "string",
  "config": {},
  "code": "string",
  "name": "string",
  "replicas": 1,
  "status": "pending | running | stopped",
  "pods": [{ "name": "string", "status": "Running", "restarts": 0 }],
  "credentials_status": "stored | missing",
  "exchange": "hyperliquid",
  "subaccount_address": "0x... | undefined",
  "deployment_name": "string",
  "namespace": "string",
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```

#### GET `/v2/deployment/{id}/status` — Live Status

Response: `{ "id": "string", "status": "string", "replicas": 1, "available_replicas": 1, "pods": null }`

#### POST `/v2/deployment/{id}/credentials` — Store Credentials

`exchange` required. `wallet_address` optional. `private_key` is **NOT accepted**.

```json
// Request
{ "exchange": "hyperliquid", "wallet_address": "0x... (optional)", "subaccount_address": "0x... (optional)" }

// Response (200)
{
  "id": "string", "credentials_status": "stored", "exchange": "hyperliquid",
  "wallet_address": "0x...", "wallet_source": "main_trading_wallet | provided",
  "agent_wallet_address": "0x... | undefined",
  "subaccount_address": "0x... | undefined", "updated_at": "ISO8601"
}
```

**IMPORTANT:** `wallet_address` in the response is the wallet that signs trades. It does NOT need its own funds — it trades against the main wallet's balance.

**Errors:** `400 invalid_request` (private_key sent), `400 invalid_wallet_address`, `400 duplicate_wallet_address`, `400 unsupported_exchange`, `400 no_wallet_available`, `403 wallet_not_owned`, `500 server_misconfigured`

**Idempotent:** Once credentials are stored, calling again returns existing credentials unchanged — it will NOT update or overwrite. To change wallets, delete and recreate the deployment.

**Credential update procedure:** (1) Stop the deployment → (2) Delete the deployment → (3) Create a new deployment with same config/code → (4) Store new credentials.

**One-wallet-per-deployment rule:** Each deployment uses one wallet and runs as an isolated container. For multiple strategies on the same wallet, use multiple deployments pointing to the same wallet address.

### Portfolio Deposit

#### POST `/v2/portfolio/hyperliquid/deposit` — Deposit Arbitrum USDC into Hyperliquid

Deposits native Arbitrum One USDC from the authenticated user's platform-managed trading wallet into Hyperliquid. This signs an ERC-20 `transfer` from the user's platform wallet to Hyperliquid Bridge2 and waits for transaction acceptance.

**Use this when:** the user has funded their Superior Trade platform wallet with native USDC on Arbitrum One, but Hyperliquid balance checks show insufficient USDC for live trading. If the platform wallet is underfunded, the user must add more of their own capital to the platform account first.

**Do not use this for:** withdrawals, external wallets not owned by the authenticated user, non-Arbitrum chains, non-native USDC, or any asset other than native Arbitrum USDC.

Before calling this endpoint, show the amount and source wallet and wait for explicit confirmation:

```
Deposit Summary:
• Chain: Arbitrum One
• Asset: native USDC
• Amount: [amount] USDC
• Source wallet: [wallet_address or account default]
• Destination: Hyperliquid

This will move REAL USDC from the user's platform wallet into Hyperliquid. Proceed? (yes/no)

If the platform wallet does not have enough USDC, the user must add more of their own capital to the platform account before this deposit can run.
```

**Constants:**

| Field | Value |
| ----- | ----- |
| Chain aliases | `arbitrum`, `arbitrum_one`, `arbitrum-one`, `42161` |
| Native Arbitrum USDC | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` |
| Hyperliquid Bridge2 | `0x2df1c51e09aecf9cacb7bc98cb1742757f163df7` |
| Minimum amount | `5` USDC |
| Decimals | Up to 6 decimal places |

```json
// Request
{
  "chain": "arbitrum",
  "asset_address": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  "amount": "5",
  "from": "0x... (optional)"
}

// Response (200)
{
  "tx_hash": "0x...",
  "chain": "arbitrum",
  "asset_address": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  "amount": "5",
  "bridge_address": "0x2df1c51e09aecf9cacb7bc98cb1742757f163df7",
  "wallet_address": "0x..."
}
```

If `from` is omitted, the server uses the authenticated user's default main trading wallet. If `from` is provided, it must be one of the user's platform-managed wallets; ownership is validated server-side.

**Errors:** `400 invalid_json`, `400 validation_failed`, `400 unsupported_chain`, `400 unsupported_asset`, `400 insufficient_balance`, `400 no_credentials`, `500 server_error`, `502 deposit_failed`.

After a successful deposit, re-check Hyperliquid balances with `clearinghouseState` and `spotClearinghouseState` before starting a live deployment. Do not assume the deposited funds are available until the balance check confirms them.

#### POST `/v3/portfolio/hyperliquid/withdraw` — Return Hyperliquid USDC to Superior

Withdraws USDC from the authenticated user's Hyperliquid account to the server-resolved main Superior wallet on Arbitrum.

**Use this when:** the user asks to return Hyperliquid USDC to their Superior treasury before rebalancing or cashing out.

**Important withdrawal behavior:**

- Hyperliquid deducts a **1 USDC withdrawal fee from the withdrawal amount**. If the user withdraws `5` USDC, their Hyperliquid balance decreases by `5` USDC and the destination should receive about `4` USDC.
- Do not withdraw amounts less than or equal to `1` USDC because the Hyperliquid fee can consume the withdrawal.
- Withdrawals can take time to arrive on Arbitrum. A successful API response means Hyperliquid accepted the withdrawal request; do not promise immediate wallet arrival.
- Re-check Hyperliquid balance after the withdrawal and, when the user asks about arrival, verify the destination wallet or Arbiscan transaction status.

Before calling this endpoint, show the amount, fee, source wallet/account, and destination address, then wait for explicit confirmation:

```
Withdrawal Summary:
• Chain: Arbitrum One
• Asset: native USDC
• Amount: [amount] USDC
• Hyperliquid withdrawal fee: 1 USDC deducted from the withdrawal amount
• Expected destination amount: [amount - 1] USDC
• Hyperliquid balance decrease: [amount] USDC
• Source: [wallet_address or account default] Hyperliquid balance
• Destination: [main Superior wallet]

This will move REAL USDC out of Hyperliquid. Arrival on Arbitrum can take some time after Hyperliquid accepts the request. Proceed? (yes/no)
```

**Constants:**

| Field | Value |
| ----- | ----- |
| Chain aliases | `arbitrum`, `arbitrum_one`, `arbitrum-one`, `42161` |
| Native Arbitrum USDC | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` |
| Hyperliquid withdrawal fee | `1` USDC |
| Decimals | Up to 6 decimal places |

```json
// Request
{
  "chain": "arbitrum",
  "asset_address": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  "amount": "5",
  "from": "0x... (optional)"
}

// Response (200)
{
  "chain": "arbitrum",
  "asset_address": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  "amount": "5",
  "destination": "0x... (main Superior wallet)",
  "withdrawal_flow": "hyperliquid_to_superior_wallet",
  "wallet_address": "0x...",
  "hyperliquid_response": {
    "status": "ok",
    "response": {
      "type": "default"
    }
  }
}
```

If `from` is omitted, the server uses the authenticated user's default main trading wallet. If `from` is provided, it must be one of the user's platform-managed wallets; ownership is validated server-side.

**Errors:** `400 invalid_json`, `400 validation_failed`, `400 unsupported_chain`, `400 unsupported_asset`, `400 insufficient_balance`, `400 no_credentials`, `500 server_error`, `502 withdraw_failed`.

### Portfolio Exit

#### POST `/v2/portfolio/hyperliquid/exit` — Close Positions and Repatriate Funds

Closes ALL open positions and repatriates all funds from a sub-account back to the main wallet in a single call. Use this to cleanly exit a sub-account deployment and return funds to the master account.

**Requires:** `subaccount_address` in request body.

```json
// Request
{ "subaccount_address": "0x..." }

// Response (200)
{ "message": "Exit successful", "positions_closed": 2, "orders_cancelled": 0 }

// Response (400) — invalid subaccount
{ "error": "invalid_request", "message": "..." }
```

This endpoint:
1. Cancels all open orders on the sub-account
2. Closes all open positions at market price
3. Transfers all remaining funds (USDC, USDE, USDT0, USDH) back to the main wallet

Use this instead of manually closing positions and transferring funds — it's a single atomic operation.

#### GET `/v2/deployment/{id}/credentials` — Credential Info

Does NOT return private keys. Response: `{ "id", "credentials_status": "stored | missing", "exchange", "wallet_address", "wallet_source": "main_trading_wallet | provided", "wallet_type": "main_wallet | agent_wallet", "agent_wallet_address", "subaccount_address" }`. If missing: `{ "credentials_status": "missing" }`.

#### POST `/v2/deployment/{id}/exit` — Exit All Positions

Closes all open orders and liquidates all open positions. Deployment must be **stopped** first.

**Before calling this endpoint**, check `clearinghouseState` for the wallet's open positions. Show the user each position's pair, side, size, and unrealized PnL, then ask for explicit confirmation — this action is irreversible and closes at market price.

```json
// Response (200)
{ "id": "string", "status": "string", "orders_cancelled": 3, "positions_closed": 2 }

// Response (400) — deployment still running or credentials missing
{ "error": "invalid_request", "message": "..." }
```

#### DELETE `/v2/deployment/{id}`

Closes all positions and orders on Hyperliquid before deleting. Response: `{ "message": "Deployment deleted" }`. Deleting stopped deployments may return 500 — safe to ignore.

### Shared API Notes

#### Logs — GET `/v2/backtesting/{id}/logs` and `/v2/deployment/{id}/logs`

Query: `pageSize` (default 100), `pageToken`. Response: `{ "items": [{ "timestamp": "ISO8601", "message": "string", "severity": "string" }], "nextCursor": "string | null" }`

#### Paginated Lists

Both `GET /v2/backtesting` and `GET /v2/deployment` return `{ "items": [], "nextCursor": "string | null" }`. Pass `cursor` query param to paginate.

#### Error Responses

```json
// 401 — Missing/invalid API key
{ "message": "No API key found in request", "request_id": "string" }

// 400 — Validation error
{ "error": "validation_failed", "message": "Invalid request", "details": [{ "path": "field", "message": "..." }] }

// 404 — Not found
{ "error": "not_found", "message": "Backtest not found" }
```

## Config and Strategy Authoring

### Config Reference

The config object is a Freqtrade trading bot configuration. Do not include `api_server` (platform-managed). To run in **dry-run/paper mode**, skip the credentials step — a deployment without credentials trades in simulation. Do not set `dry_run` manually in config.

#### Futures Config (recommended)

```json
{
  "exchange": { "name": "hyperliquid", "pair_whitelist": ["BTC/USDC:USDC"] },
  "stake_currency": "USDC",
  "stake_amount": 100,
  "dry_run_wallet": { "USDC": 1000 },
  "timeframe": "5m",
  "max_open_trades": 3,
  "minimal_roi": { "0": 100.0 },
  "stoploss": -0.1,
  "trading_mode": "futures",
  "margin_mode": "cross",
  "entry_pricing": { "price_side": "same", "price_last_balance": 0.0 },
  "exit_pricing": { "price_side": "same", "price_last_balance": 0.0 },
  "pairlists": [{ "method": "StaticPairList" }]
}
```

#### Spot Config

Same as futures but omit `trading_mode` and `margin_mode`. Pairs use `BTC/USDC` format (no `:USDC` suffix). Stoploss on exchange not supported for spot.

#### HIP3 Config Example

```json
{
  "exchange": {
    "name": "hyperliquid",
    "pair_whitelist": ["XYZ-AAPL/USDC:USDC"]
  },
  "stake_currency": "USDC",
  "stake_amount": 100,
  "dry_run_wallet": { "USDC": 1000 },
  "timeframe": "15m",
  "max_open_trades": 3,
  "minimal_roi": { "0": 100.0 },
  "stoploss": -0.05,
  "trading_mode": "futures",
  "margin_mode": "isolated",
  "entry_pricing": { "price_side": "same", "price_last_balance": 0.0 },
  "exit_pricing": { "price_side": "same", "price_last_balance": 0.0 },
  "pairlists": [{ "method": "StaticPairList" }]
}
```

#### Additional Config Fields

Other common config fields include `trailing_stop` (boolean), `trailing_stop_positive` (number), `entry_pricing.price_side` / `exit_pricing.price_side` (`"ask"`, `"bid"`, `"same"`, `"other"`), and `pairlists` (`StaticPairList`, `VolumePairList`, etc.). Use `"same"` as the default pricing side. `"other"` crosses the spread for faster fills and is mainly appropriate when intentionally modeling market-order-style execution.

### Strategy Code Template

The `code` field must be valid Python with a strategy class. Class name must end with `Strategy` in PascalCase. Use `import talib.abstract as ta` for indicators.

```python
from freqtrade.strategy import IStrategy
import pandas as pd
import talib.abstract as ta


class MyCustomStrategy(IStrategy):
    minimal_roi = {"0": 0.10, "30": 0.05, "120": 0.02}
    stoploss = -0.10
    trailing_stop = False
    timeframe = '5m'
    process_only_new_candles = True
    startup_candle_count = 20

    def populate_indicators(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        dataframe['rsi'] = ta.RSI(dataframe, timeperiod=14)
        dataframe['sma_20'] = ta.SMA(dataframe, timeperiod=20)
        return dataframe

    def populate_entry_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        dataframe.loc[
            (dataframe['rsi'] < 30) & (dataframe['close'] > dataframe['sma_20']),
            'enter_long'
        ] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        dataframe.loc[(dataframe['rsi'] > 70), 'exit_long'] = 1
        return dataframe
```

**Requirements:** Must use standard imports/inheritance (see template), `import talib.abstract as ta` for indicators, define `populate_indicators`, `populate_entry_trend`, `populate_exit_trend`.

### Multi-Output TA-Lib Functions (CRITICAL)

Some TA-Lib functions return **multiple columns**. Assigning directly to one column causes a runtime crash.

| Function                    | Returns                                |
| --------------------------- | -------------------------------------- |
| `ta.BBANDS`                 | `upperband`, `middleband`, `lowerband` |
| `ta.MACD`                   | `macd`, `macdsignal`, `macdhist`       |
| `ta.STOCH`                  | `slowk`, `slowd`                       |
| `ta.STOCHF` / `ta.STOCHRSI` | `fastk`, `fastd`                       |
| `ta.AROON`                  | `aroondown`, `aroonup`                 |
| `ta.HT_PHASOR`              | `inphase`, `quadrature`                |
| `ta.MAMA`                   | `mama`, `fama`                         |
| `ta.MINMAXINDEX`            | `minidx`, `maxidx`                     |

```python
# WRONG — runtime crash
dataframe["bb_upper"] = ta.BBANDS(dataframe, timeperiod=20)

# CORRECT
bb = ta.BBANDS(dataframe, timeperiod=20)
dataframe["bb_upper"] = bb["upperband"]
dataframe["bb_middle"] = bb["middleband"]
dataframe["bb_lower"] = bb["lowerband"]

macd = ta.MACD(dataframe)
dataframe["macd"] = macd["macd"]
dataframe["macd_signal"] = macd["macdsignal"]
dataframe["macd_hist"] = macd["macdhist"]

stoch = ta.STOCH(dataframe)
dataframe["slowk"] = stoch["slowk"]
dataframe["slowd"] = stoch["slowd"]
```

Single-output functions (RSI, SMA, EMA, ATR, ADX) return a Series and can be assigned directly.

### Multi-Entry Strategies — DCA, Grid, Scaling-In

The engine enforces **one open trade per pair**. A second `enter_long = 1` while a position is open is silently rejected. Anything that wants to "buy more of the same thing" — DCA, scaling-in, grid laddering, weekly buys — must use `adjust_trade_position`, not repeated entry signals.

Config and strategy code must be set together. If using dynamic stake, keep `max_open_trades` finite and divide the initial entry in `custom_stake_amount` so later adjustment orders have wallet room.

```python
class MyStrategy(IStrategy):
    position_adjustment_enable = True    # required for adjust_trade_position to fire
    max_entry_position_adjustment = 5    # cap on additional entries (-1 = unlimited)
    max_dca_multiplier = 6.0             # initial size × (1 + planned adds)

    def custom_stake_amount(self, pair, current_time, current_rate, proposed_stake,
                            min_stake, max_stake, leverage, entry_tag, side, **kwargs):
        # MANDATORY: divide initial entry so room remains for future adds.
        return proposed_stake / self.max_dca_multiplier
```

Fixed `stake_amount` is also valid with position adjustment, but the wallet must still have enough free balance for the planned additional entries. With `"unlimited"` stake, `custom_stake_amount` is mandatory to avoid allocating the whole wallet to the initial order.

`adjust_trade_position` is called very frequently while a trade is open: in dry-run/live it runs every bot loop (about every 5 seconds by default), while backtesting runs it once per candle (`timeframe` or `timeframe_detail`). Return positive = add stake, negative = partial close, `None` = do nothing. Keep the logic strict and always check the last filled order / open orders so the bot cannot re-enter repeatedly while one condition remains true.

**Pattern A — Profit-driven DCA (averaging down):**

```python
def adjust_trade_position(self, trade, current_time, current_rate, current_profit,
                          min_stake, max_stake, *args, **kwargs):
    if trade.has_open_orders:
        return None
    n_entries = trade.nr_of_successful_entries
    if n_entries <= self.max_entry_position_adjustment and current_profit <= -0.025 * n_entries:
        first_stake = trade.select_filled_orders(trade.entry_side)[0].stake_amount_filled
        return (first_stake, f"dca_buy_{n_entries}")
    return None
```

**Pattern B — Schedule-driven DCA (weekly / daily fixed-time buys).** Gate on `current_time.weekday()` / `.hour`. **Critical**: include a same-day guard, otherwise the initial entry's Monday and `adjust_trade_position`'s Monday collide and double-buy:

```python
def adjust_trade_position(self, trade, current_time, current_rate, current_profit,
                          min_stake, max_stake, *args, **kwargs):
    if trade.has_open_orders:
        return None
    if current_time.weekday() != 0:  # Monday only
        return None
    filled = trade.select_filled_orders(trade.entry_side)
    if filled and filled[-1].order_filled_utc.date() == current_time.date():
        return None  # same-day guard
    first_stake = filled[0].stake_amount_filled
    return (first_stake, "weekly_dca")
```

**Pattern C — Grid / range fade with laddered buys + partial profits:**

```python
def adjust_trade_position(self, trade, current_time, current_rate, current_profit,
                          min_stake, max_stake, *args, **kwargs):
    if trade.has_open_orders:
        return None
    n_entries = trade.nr_of_successful_entries
    n_exits = trade.nr_of_successful_exits
    # Ladder buys at every -1% drawdown, up to 5 rungs
    if n_entries <= 5 and current_profit <= -0.01 * n_entries:
        first = trade.select_filled_orders(trade.entry_side)[0].stake_amount_filled
        return (first, f"grid_buy_{n_entries}")
    # Partial profit-takes at every +1.5% above avg, up to 3
    if n_exits < 3 and current_profit >= 0.015 * (n_exits + 1):
        return (-(trade.stake_amount / 4.0), f"grid_tp_{n_exits}")
    return None
```

A true 20-rung grid (multiple simultaneous orders at distinct price levels) is NOT supported by Freqtrade. Pattern C is the closest faithful approximation — describe it as "laddered range fade" not "20-level grid."

**Hyperliquid minimum: $10 per order.** Engine inflates by stoploss reserve (up to 1.5x) — always use `min_stake` as a floor.

`max_open_trades` limits total concurrent trades across all pairs, not entries per pair.

### Funding Rate (Futures Only)

For "harvest negative funding" / "long when shorts pay longs" / any funding-aware strategy, the historical funding rate is **automatically downloaded** for backtest. Do not poll Hyperliquid's REST API from inside the strategy. Hyperliquid pays funding hourly. The example below assumes the strategy timeframe is `1h` or faster; do not merge a faster funding timeframe into a slower strategy timeframe without first resampling/alignment:

```python
from freqtrade.strategy import merge_informative_pair


def populate_indicators(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
    funding_tf = "1h"
    funding = self.dp.get_pair_dataframe(
        pair=metadata["pair"],
        timeframe=funding_tf,
        candle_type="funding_rate",
    )
    if not funding.empty and "open" in funding.columns:
        funding = funding[["date", "open"]].rename(columns={"open": "funding_rate"})
        dataframe = merge_informative_pair(
            dataframe,
            funding,
            self.timeframe,
            funding_tf,
            ffill=True,
        )
        dataframe["funding_rate"] = dataframe[f"funding_rate_{funding_tf}"].fillna(0.0)
        dataframe["funding_apr"] = dataframe["funding_rate"] * 24 * 365
    else:
        dataframe["funding_rate"] = 0.0
        dataframe["funding_apr"] = 0.0
    return dataframe
```

Available only for futures pairs (`BTC/USDC:USDC`), not spot.

### Required Config Fields

The schema validator rejects payloads that omit any of these — **even when the strategy class declares its own equivalent**:

- `entry_pricing` and `exit_pricing` — both required. Safe default: `{"price_side": "same", "price_last_balance": 0.0}`.
- `minimal_roi` — required at the config level. Use `{"0": 100.0}` to effectively disable config-level ROI and let the strategy's own exit logic run.
- `dry_run_wallet` — must contain enough `stake_currency` balance for the configured `stake_amount` and `max_open_trades`, **plus ~50% buffer** to cover fees, funding payments, and slippage. For `stake_amount: 1000` and `max_open_trades: 1`, use at least `{ "USDC": 1500 }`. For futures multi-pair setups, scale up by `max_open_trades`. Tighter buffers (≤10%) cause silent signal rejection mid-run. For DCA / grid strategies that ladder up to `max_dca_multiplier × initial`, set `dry_run_wallet ≈ stake_amount × 10`. See the "Backtest Wallet and Stake Sizing" section above for the full sizing rationale.

### Choosing a `minimal_roi` shape

The class-level `minimal_roi = {"0": 100.0}` pattern fully disables ROI take-profit.
Use it ONLY when your strategy has a signal-driven exit (`populate_exit_trend`) that
fires on most bars where the trade should close — typically trend-follow strategies
with structural exits like "break of N-bar high" or trailing stops.

For mean-reversion, scalp, range, and any strategy where wins are small (under ~3%),
use an explicit ROI ladder:

```python
minimal_roi = {
    "0":    0.025,   # take 2.5% immediately if available
    "240":  0.015,   # 1.5% after 4 hours (relevant for 1h+ timeframes)
    "720":  0.005,   # 0.5% after 12 hours
    "1440": 0,       # breakeven after 24 hours — close any open position
}
```

The keys are **minutes since trade open**. Tiers decay so stale trades close at breakeven
rather than sitting forever. Without an ROI ladder, mean-reversion strategies give back
wins waiting for a signal exit that may never come.

See `dsl-exit-engine` for full Phase 0 / Phase 1 / Phase 2 guidance.

### `stake_amount: "unlimited"` Warning

`"unlimited"` bypasses minimum-order validation. The bot starts but **silently executes zero trades** if balance is insufficient — no error, just heartbeats. For simple single-entry strategies, prefer explicit numeric `stake_amount` with small balances (<$50). For strategies using `position_adjustment_enable` and `adjust_trade_position`, fixed stake is valid if enough wallet balance remains for planned adds; if `stake_amount` is `"unlimited"`, use `custom_stake_amount` to divide the first entry so there is room for later adds.

Do **not** set both `stake_amount: "unlimited"` and `max_open_trades: -1`. Use a finite positive `max_open_trades` instead. For single-pair DCA/grid/scaling strategies, use `max_open_trades: 1`; repeated same-pair entries come from `adjust_trade_position`, not extra open-trade slots.

| Stoploss | Effective minimum |
| -------- | ----------------- |
| -0.5%    | ~$10.55           |
| -5%      | ~$11.05           |
| -10%     | ~$11.67           |
| -30%     | ~$15.00           |

## Operations and Troubleshooting

### Reporting DCA Trades

For DCA strategies: distinguish trades from orders ("X trades, Y buy orders, Z sell orders"), show per-order detail for at least the first trade, flag minimum order rejections or dust positions. Always download `resultUrl` for full order-level data. Skip breakdown for non-DCA strategies.

### Log Interpretation

- **Heartbeat messages are normal** — the bot sends periodic heartbeats to confirm it's alive
- **"Analyzing candle"** — bot is checking strategy conditions on the latest candle
- **"Buying"/"Selling"** — trade execution
- **Rate limit warnings** — reduce API calls, consider stopping if persistent
- **Websocket disconnection ("Couldn't reuse watch…falling back to REST api")** — normal and expected. The bot automatically reconnects via REST API. Trading is **not** affected. Do not treat this as an error or suggest redeployment.

### Diagnosing Zero-Trade Deployments

Check in order:

1. **Main wallet balance** — agent wallet $0 is normal; check the platform-managed main wallet
2. **`stake_amount`** — for simple single-entry strategies, if `"unlimited"` with a small balance, redeploy with an explicit numeric amount slightly below balance. For `position_adjustment_enable` / `adjust_trade_position` strategies, either use fixed stake with enough wallet room for planned adds, or keep `stake_amount: "unlimited"` and reduce `custom_stake_amount`, ladder count, or total planned exposure.
3. **Credentials** — verify `credentials_status: "stored"` and `WALLET_ADDRESS` in startup logs
4. **Strategy conditions** — check if entry conditions are met on recent candles
5. **Logs** — check for rate limits, exchange rejections, pair errors
6. **Pair validity** — verify pair is active on Hyperliquid

### Rate Limit Mitigation

Hyperliquid enforces rate limits. Aggressive retries, tight loops, or extra exchange traffic from strategy code can trigger **429** responses and unstable behavior.

**Prevention:**

- Set `process_only_new_candles = True` so the bot does not reprocess every candle unnecessarily
- Prefer candle-close pricing for exits where it fits the strategy (fewer edge-case order updates)
- Do not add **custom polling** of Hyperliquid’s API (or other heavy network work) inside hot strategy paths — it stacks on top of normal bot traffic

**If you see rate limits or 429s in logs:**

- Avoid rapid stop/start cycles; that often worsens retries against the limit
- After the deployment stops, wait several minutes before starting again; if the issue persists, simplify the strategy or reduce anything that drives extra exchange requests

### Orphan Position Handling

When a bot crashes, it may leave open positions that lock up margin. Strategy code pattern:

- In `bot_loop_start()`, check for positions not in the bot's trade database
- Close orphans with a limit order before entering fresh
- Use a flag (`_orphan_closed`) to run cleanup exactly once per lifecycle

### Backtest `limit_exceeded` Error

If you get a `limit_exceeded` error when creating a backtest, the user has hit the concurrent backtest limit. Delete completed/failed backtests first: `DELETE /v2/backtesting/{id}`

### Timezone Reminder

All API timestamps are in **UTC (ISO8601)**. Convert to the user's local timezone when presenting times conversationally. If timezone is unknown, show both UTC and ask.
