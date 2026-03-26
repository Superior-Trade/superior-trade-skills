---
name: Superior Trade
version: 3.0.4
updated: 2026-03-24
description: "Backtest and deploy trading strategies on Superior Trade's managed cloud."
homepage: https://account.superior.trade
source: https://github.com/Superior-Trade
primaryEnv: SUPERIOR_TRADE_API_KEY
auth:
  type: api_key
  env: SUPERIOR_TRADE_API_KEY
  header: x-api-key
  scope: "Read-write the user's own backtests and deployments. Can start live trading deployments that execute real trades with the user's platform-managed trading wallet. Cannot withdraw funds, export private keys, or access other users' data."
env:
  - name: SUPERIOR_TRADE_API_KEY
    description: "Superior Trade API key (x-api-key header). Obtained at https://account.superior.trade. Can create/manage backtests and deployments including live trading. Cannot withdraw funds, export private keys, or access other users' data. Users do not need their own Hyperliquid wallet."
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

> **IMPORTANT:** The correct URL is **https://account.superior.trade** — NOT `app.superior.trade`. Never send users to `app.superior.trade`.

Use `SUPERIOR_TRADE_API_KEY` from the environment or credential manager.

When a user needs to get their API key:

1. Go to https://account.superior.trade
2. Sign up (email or wallet)
3. Complete onboarding — a trading wallet is created for you and shown on the dashboard
4. Deposit USDC to your wallet address (on Arbitrum)
5. Create an API key (`st_live_...`) from the dashboard
6. Add it as `SUPERIOR_TRADE_API_KEY` in your agent's environment/credential settings

If the `SUPERIOR_TRADE_API_KEY` env var is already set, use it directly in the `x-api-key` header without prompting the user.

### Public Endpoints (no auth)

| Method | Path                          | Description                              |
| ------ | ----------------------------- | ---------------------------------------- |
| GET    | `/health`                     | `{ "status": "ok", "timestamp": "..." }` |
| GET    | `/docs`                       | Swagger UI                               |
| GET    | `/openapi.json`               | OpenAPI 3.0 spec                         |
| GET    | `/llms.txt`                   | LLM-optimized API docs                   |
| GET    | `/.well-known/ai-plugin.json` | AI plugin manifest                       |

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

> **Key scope notice:** The API key can create and start live trading deployments that execute real trades using the user's platform-managed trading wallet. It cannot withdraw funds, export private keys, or move money. Users should confirm scope with Superior Trade and backtest their strategy first.

| Can do                                                                           | Cannot do                                               |
| -------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Create, list, delete backtests                                                   | Access other users' data                                |
| Create, start, stop, delete deployments (including live trading with real funds) | Withdraw funds from any wallet                          |
| Trigger server-side credential resolution (no user secrets collected)            | Export or view private keys                             |
| View deployment logs, status, wallet metadata                                    | Transfer or bridge funds (user does this independently) |

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

Superior Trade uses Hyperliquid's native **agent wallet** pattern. Users do NOT need their own Hyperliquid wallet — everything is managed by the platform. If a user asks "how do I link my Hyperliquid account," the answer is: **they don't need one** — a trading wallet is created at signup.

1. **Main wallet** — a platform-managed trading wallet created for each user at signup. Holds the funds on Hyperliquid. Users deposit USDC to this address via the dashboard at https://account.superior.trade.
2. **Agent wallet** — a platform-managed signing key authorized via Hyperliquid's `approveAgent`. Signs trades against the main wallet's balance.

**Key facts:**

- The agent wallet does NOT need its own funds — $0 balance is normal and expected
- Each user has one agent wallet; all deployments share it
- The credentials endpoint returns `wallet_type: "agent_wallet"` for auto-resolved wallets
- Always check the **main wallet's** balance, not the agent wallet's
- The API has no transfer/fund-routing endpoint — you cannot move funds via the API
- **NEVER tell users to deposit to the agent wallet address**

### Funding and Balance Checks

The agent cannot move or bridge funds — the user handles this independently outside the skill:

1. The user deposits USDC to their platform wallet address (shown on their dashboard at https://account.superior.trade)
2. The agent wallet signs trades against this balance — no internal transfers needed

Always check the **main wallet** (platform-managed trading wallet), NOT the agent wallet.

These are read-only, unauthenticated queries to Hyperliquid's public API. The wallet address sent is public on-chain data — not a secret. No API keys, private keys, or auth tokens are included.

```
POST https://api.hyperliquid.xyz/info
{"type":"clearinghouseState","user":"<MAIN_WALLET_ADDRESS>"}
{"type":"spotClearinghouseState","user":"<MAIN_WALLET_ADDRESS>"}
```

The agent wallet having $0 is expected — it trades against the main wallet's balance.

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
| `HYNA-`  | `hyna`   | Leveraged crypto, metals                  | USDE           | `HYNA-SOL/USDE:USDE`                        |
| `VNTL-`  | `vntl`   | Sector indices, pre-IPO                   | USDH           | `VNTL-SPACEX/USDH:USDH`                     |

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
- **Proactive:** Ask for missing info conversationally, one concern at a time. Warn if backtest results are poor before offering live deployment.

Check Hyperliquid balances with BOTH endpoints:

- **Perps:** `POST https://api.hyperliquid.xyz/info` → `{"type":"clearinghouseState","user":"0x..."}`
- **Spot:** `POST https://api.hyperliquid.xyz/info` → `{"type":"spotClearinghouseState","user":"0x..."}`

### Repeated Failures

If the agent fails the same task 3+ times (e.g. strategy code keeps crashing, backtest keeps failing), stop and:

1. Summarize what was tried and what failed
2. Suggest the user try a simpler approach or different parameters
3. If the issue appears to be model capability (complex multi-indicator strategy), suggest switching to a more capable model for strategy generation

## Workflows

### Backtest Workflow

1. Build config + strategy code from user requirements
2. `POST /v2/backtesting` — create
3. `PUT /v2/backtesting/{id}/status` with `{"action": "start"}`
4. Poll `GET /v2/backtesting/{id}/status` every 10s until `completed` or `failed` (1–10 min)
5. `GET /v2/backtesting/{id}` — fetch full results; download `result_url` for detailed JSON
6. Present summary: total trades, win rate, profit, drawdown, Sharpe ratio
7. If failed, check `GET /v2/backtesting/{id}/logs`
8. To cancel: `DELETE /v2/backtesting/{id}`

#### Result Interpretation

After status = `completed`, download the `result_url` JSON. Present these key metrics:

- **Total trades** — completed round-trips
- **Win rate** — percentage of profitable trades
- **Total profit %** — net profit as percentage of starting balance
- **Max drawdown** — worst peak-to-trough decline
- **Sharpe ratio** — risk-adjusted return (>1.0 good, >2.0 excellent)
- **Average trade duration** — how long positions are held

### Deployment Workflow

1. `POST /v2/deployment` with config, code, name
2. **Ask the user: live or dry-run?**
   - **Live:** `POST /v2/deployment/{id}/credentials` with `{ "exchange": "hyperliquid" }` — server assigns wallet automatically
   - **Dry-run:** Skip the credentials step — the deployment runs in simulation mode (no real funds)
3. Run the pre-deployment checklist
4. Show the deployment confirmation summary and wait for explicit user confirmation
5. `PUT /v2/deployment/{id}/status` → `{"action": "start"}`
6. Monitor: `GET /v2/deployment/{id}/status`, `GET /v2/deployment/{id}/logs`
7. Stop: `PUT /v2/deployment/{id}/status` → `{"action": "stop"}`

### Pre-Deployment Checklist (MANDATORY)

Before `PUT /v2/deployment/{id}/status` → `{"action":"start"}`:

**For live deployments (credentials stored):**

1. **Credentials stored** — `GET /v2/deployment/{id}` → `credentials_status: "stored"`. If not, call `POST /v2/deployment/{id}/credentials`.
2. **Identify wallets** — `GET /v2/deployment/{id}/credentials` → note `wallet_address` (agent wallet) and `agent_wallet_address`.
3. **Funds available in main wallet** — Check the **main wallet** (platform-managed trading wallet), NOT the agent wallet. Agent wallet having $0 is normal. Query `clearinghouseState` + `spotClearinghouseState` on the public Hyperliquid info endpoint (read-only, sends public wallet address only — no secrets).

**For dry-run deployments (no credentials):** Skip steps 1–3 — the deployment runs in simulation mode without real funds.

4. **Pair is tradeable** — `POST https://api.hyperliquid.xyz/info` → `{"type":"meta"}` for standard perps, or `{"type":"meta", "dex":"xyz"}` (or the relevant dex name) for HIP3 pairs. Verify the coin name exists in the `universe` array.

Do NOT skip any step or assume it passed without the API call.

## API Reference

### Backtesting

#### POST `/v2/backtesting` — Create Backtest

```json
// Request
{ "config": {}, "code": "string (Python strategy)", "timerange": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" } }

// Response (201)
{ "id": "string", "status": "pending", "message": "Backtest created. Call PUT /:id/status with action \"start\" to begin." }
```

#### PUT `/v2/backtesting/{id}/status` — Start Backtest

```json
// Request — only "start" is supported; to cancel, use DELETE
{ "action": "start" }

// Response (200)
{ "id": "string", "status": "running", "previous_status": "pending", "job_name": "backtest-01kjvze9" }
```

#### GET `/v2/backtesting/{id}/status` — Poll Status

Response: `{ "id": "string", "status": "pending | running | completed | failed", "results": null }`. `results` is `null` while running — use `result_url` from full details for complete results.

#### GET `/v2/backtesting/{id}` — Full Details

```json
{
  "id": "string",
  "config": {},
  "code": "string",
  "timerange": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" },
  "status": "pending | running | completed | failed",
  "results": null,
  "result_url": "https://storage.googleapis.com/... (signed URL, valid 7 days)",
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
{ "exchange": "hyperliquid", "wallet_address": "0x... (optional)" }

// Response (200)
{
  "id": "string", "credentials_status": "stored", "exchange": "hyperliquid",
  "wallet_address": "0x...", "wallet_source": "main_trading_wallet | provided",
  "agent_wallet_address": "0x... | undefined", "updated_at": "ISO8601"
}
```

**IMPORTANT:** `wallet_address` in the response is the wallet that signs trades. It does NOT need its own funds — it trades against the main wallet's balance.

**Errors:** `400 invalid_request` (private_key sent), `400 invalid_wallet_address`, `400 duplicate_wallet_address`, `400 unsupported_exchange`, `400 no_wallet_available`, `403 wallet_not_owned`, `500 server_misconfigured`

**Idempotent:** Once credentials are stored, calling again returns existing credentials unchanged — it will NOT update or overwrite. To change wallets, delete and recreate the deployment.

**Credential update procedure:** (1) Stop the deployment → (2) Delete the deployment → (3) Create a new deployment with same config/code → (4) Store new credentials.

**One-wallet-per-deployment rule:** Each deployment uses one wallet and runs as an isolated container. For multiple strategies on the same wallet, use multiple deployments pointing to the same wallet address.

#### GET `/v2/deployment/{id}/credentials` — Credential Info

Does NOT return private keys. Response: `{ "id", "credentials_status": "stored | missing", "exchange", "wallet_address", "wallet_source": "main_trading_wallet | provided", "wallet_type": "main_wallet | agent_wallet", "agent_wallet_address" }`. If missing: `{ "credentials_status": "missing" }`.

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
  "timeframe": "5m",
  "max_open_trades": 3,
  "stoploss": -0.1,
  "trading_mode": "futures",
  "margin_mode": "cross",
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
  "timeframe": "15m",
  "max_open_trades": 3,
  "stoploss": -0.05,
  "trading_mode": "futures",
  "margin_mode": "isolated",
  "entry_pricing": { "price_side": "other" },
  "exit_pricing": { "price_side": "other" },
  "pairlists": [{ "method": "StaticPairList" }]
}
```

#### Additional Config Fields

Beyond the examples above: `minimal_roi` (minutes-to-ROI map, e.g. `{"0": 0.10, "30": 0.05}`), `trailing_stop` (boolean), `trailing_stop_positive` (number), `entry_pricing.price_side` / `exit_pricing.price_side` (`"ask"`, `"bid"`, `"same"`, `"other"`), `pairlists` (`StaticPairList`, `VolumePairList`, etc.).

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

### DCA / Position Scaling

The engine enforces one open trade per pair. Use `adjust_trade_position()` for DCA:

```python
def adjust_trade_position(self, trade, current_time, current_rate,
                          current_profit, min_stake, max_stake,
                          current_entry_rate, current_exit_rate,
                          current_entry_profit, current_exit_profit, **kwargs):
    if should_dca(trade, current_time):
        return max(500, min_stake)  # add $500, respect exchange minimum
    return None
```

- Called every candle while a trade is open. Positive = DCA buy, negative = partial close, None = no action.
- **Hyperliquid minimum: $10 per order.** Engine inflates by stoploss reserve (up to 1.5x) — always use `min_stake`.
- `max_open_trades` limits total concurrent trades across all pairs, not entries per pair.

### `stake_amount: "unlimited"` Warning

`"unlimited"` bypasses minimum-order validation. The bot starts but **silently executes zero trades** if balance is insufficient — no error, just heartbeats. Always use explicit numeric `stake_amount` with small balances (<$50).

| Stoploss | Effective minimum |
| -------- | ----------------- |
| -0.5%    | ~$10.55           |
| -5%      | ~$11.05           |
| -10%     | ~$11.67           |
| -30%     | ~$15.00           |

## Operations and Troubleshooting

### Reporting DCA Trades

For DCA strategies: distinguish trades from orders ("X trades, Y buy orders, Z sell orders"), show per-order detail for at least the first trade, flag minimum order rejections or dust positions. Always download `result_url` for full order-level data. Skip breakdown for non-DCA strategies.

### Silent Failure Modes (CRITICAL)

Some failures produce **zero diagnostic output** — just heartbeats, no errors:

1. **`stake_amount: "unlimited"` with insufficient balance** — bot runs, zero trades, zero errors
2. **Main wallet has $0** — same symptom
3. **Balance below effective minimum** — same symptom

**Key signal:** Heartbeats but zero "Analyzing candle" or order lines after 5+ minutes = balance/stake issue.

### Log Interpretation

- **Heartbeat messages are normal** — the bot sends periodic heartbeats to confirm it's alive
- **"Analyzing candle"** — bot is checking strategy conditions on the latest candle
- **"Buying"/"Selling"** — trade execution
- **Rate limit warnings** — reduce API calls, consider stopping if persistent

### Diagnosing Zero-Trade Deployments

Check in order:

1. **Main wallet balance** — agent wallet $0 is normal; check the platform-managed main wallet
2. **`stake_amount`** — if `"unlimited"`, redeploy with explicit numeric amount slightly below balance
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
