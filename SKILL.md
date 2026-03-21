---
name: superior-trade-api
version: 4.0.0
updated: 2026-03-22
description: "Interact with the Superior Trade API to backtest and deploy trading strategies on Superior Trade's managed cloud. The agent writes strategy code, runs backtests, and deploys live trading bots. Requires one credential — an API key (x-api-key header) from https://account.superior.trade. No private keys or wallet credentials are ever collected."
homepage: https://account.superior.trade
source: https://github.com/Superior-Trade
env:
  - name: SUPERIOR_TRADE_API_KEY
    description: "Superior Trade API key (x-api-key header). Obtained at https://account.superior.trade. Scoped to the user's own backtests and deployments — cannot withdraw funds, export private keys, or access other users' data."
    required: true
    type: api_key
---

# Superior Trade API

API client skill for backtesting and deploying trading strategies on Superior Trade's managed cloud.

**Base URL:** `https://api.superior.trade`
**Auth:** `x-api-key` header on all protected endpoints
**Docs:** `GET /docs` (Swagger UI), `GET /openapi.json` (OpenAPI spec)

## Getting an API Key

> **IMPORTANT:** The correct URL is **https://account.superior.trade** — NOT `app.superior.trade`. Never send users to `app.superior.trade`.

When instructing a user to get an API key, use exactly this format:
1. Go to https://account.superior.trade
2. Sign up with your email
3. Check inbox for the magic link — click to log in
4. Your API key (`st_live_...`) is created automatically on first login
5. Send me the key and I'll set up your first strategy

If the user already has a key (prefixed `st_live_`), use it directly in the `x-api-key` header.

## Security & Permissions

This skill requires exactly **one credential**: an `x-api-key` header value.

**The agent must NEVER ask users for private keys, seed phrases, or wallet credentials.** All wallet/key management is handled server-side. The only secret the user provides is their API key.

| Can do | Cannot do |
|--------|-----------|
| Create, list, delete backtests | Access other users' data |
| Create, start, stop, delete deployments | Withdraw funds from any wallet |
| Store credentials (server-managed wallets) | Export or view private keys |
| View deployment logs, status, wallet metadata | Transfer funds between wallets |

### Transparency Requirements

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

## Wallet Architecture (CRITICAL)

Superior Trade uses Hyperliquid's native **agent wallet** pattern:

1. **Main wallet** — the user's deposit/Arbitrum wallet (e.g. MetaMask). Holds the funds on Hyperliquid.
2. **Agent wallet** — a server-managed signing key authorized via Hyperliquid's `approveAgent`. Signs trades against the main wallet's balance.

**Key facts:**
- The agent wallet does NOT need its own funds — $0 balance is normal and expected
- Each user has one agent wallet; all deployments share it
- The credentials endpoint returns `wallet_type: "agent_wallet"` for auto-resolved wallets
- Always check the **main wallet's** balance, not the agent wallet's
- The API has no transfer/fund-routing endpoint — you cannot move funds via the API
- **NEVER tell users to deposit to the agent wallet address**

### Funding a Deployment

The user funds their **main wallet** (not the agent wallet):
1. Bridge USDC from Arbitrum to Hyperliquid using their main wallet address
2. The agent wallet signs trades against this balance — no internal transfers needed

### Checking Balances

Always check the **main wallet** (user's deposit address):
```
POST https://api.hyperliquid.xyz/info
{"type":"clearinghouseState","user":"<MAIN_WALLET_ADDRESS>"}
{"type":"spotClearinghouseState","user":"<MAIN_WALLET_ADDRESS>"}
```

### Handling `server_misconfigured` on Credentials

If `POST /v2/deployment/{id}/credentials` returns `500 server_misconfigured`:
1. This is **transient** — generate a new API key at https://account.superior.trade
2. Retry the credentials call with the new key
3. If still failing, report to Superior Trade support

## Supported Exchanges

| Exchange | Stake Currencies | Trading Modes |
|----------|-----------------|---------------|
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

HIP3 assets (stocks, commodities, indices) are tradeable as perpetual futures.

**Pair format** uses a hyphen separator: `{PROTOCOL}-{TICKER}/USDC:USDC`

> **Note:** The format uses a **hyphen** (e.g. `XYZ-GOLD/USDC:USDC`), NOT a colon.

| Protocol | Asset Types | Stake Currency | Examples |
|----------|-------------|----------------|----------|
| `XYZ-` | US/KR stocks, metals, currencies, indices | USDC | `XYZ-AAPL/USDC:USDC`, `XYZ-GOLD/USDC:USDC` |
| `CASH-` | Commodities, stocks | USDT0 | `CASH-GOLD/USDT0:USDT0` |
| `FLX-` | Commodities, stocks, crypto | USDC or USDH | `FLX-GOLD/USDH:USDH` |
| `KM-` | Stocks, indices, bonds | USDH | `KM-GOOGL/USDH:USDH` |
| `HYNA-` | Leveraged crypto | USDC or USDE | `HYNA-SOL/USDE:USDE` |

**XYZ tickers (USDC):** AAPL, AMZN, GOOGL, META, TSLA, NFLX, HOOD, PLTR, INTC, RIVN, COIN, SNDK, BABA, GOLD, SILVER, COPPER, PLATINUM, PALLADIUM, JPY, XYZ100, HYUNDAI, SKHX, SMSN

**Data:** XYZ from ~November 2025, KM/CASH/FLX from ~February 2026. Timeframes: 1m, 3m, 5m, 15m, 30m, 1h (also 2h, 4h, 8h, 12h, 1d, 3d, 1w for some). Funding rate data at 1h.

**Trading rules:** HIP3 assets are futures-only — always use `trading_mode: "futures"` and `margin_mode: "isolated"`. XYZ pairs use `stake_currency: "USDC"`. Stock-based assets may have reduced liquidity outside US market hours.

### Unified vs Legacy Account Mode

Hyperliquid accounts may run in **unified mode** (single balance) or **legacy mode** (separate spot/perps balances). Do NOT assume which mode the user has.

- If perps shows $0 but spot shows funds, ask about unified mode before advising a transfer.
- In unified mode, spot USDC is automatically available as perps collateral.

## Verification-First Principle

Every factual claim about balance, wallet status, or deployment health MUST be backed by an API call in the current turn.

**NEVER:** assume → report → verify later. **ALWAYS:** verify → report.

## Agent Behavior

Make API calls directly and present results conversationally. Show raw payloads only on request.

- **Backtesting**: Build config + code from user intent → create → start → poll → present results — all automatically.
- **Deployment**: Create → store credentials (automatic) → show summary → get confirmation → start. Always show the deployment summary and get explicit confirmation before starting live.
- **Proactive gathering**: Ask for missing info conversationally, one concern at a time.
- **After backtesting**: Warn if results are poor before offering live deployment.

### Anti-Hallucination

NEVER report a wallet balance or API result without making the actual call first. If you can't call the API, say "I haven't checked yet." Every number must come from a real response.

Check Hyperliquid balances with BOTH endpoints:
- **Perps:** `POST https://api.hyperliquid.xyz/info` → `{"type":"clearinghouseState","user":"0x..."}`
- **Spot:** `POST https://api.hyperliquid.xyz/info` → `{"type":"spotClearinghouseState","user":"0x..."}`

### Hyperliquid Credentials

Credentials are managed automatically. Call `POST /v2/deployment/{id}/credentials` with `{ "exchange": "hyperliquid" }` — the platform resolves the correct wallet.

**The agent must NEVER ask users for private keys.** To use a specific wallet, pass `wallet_address` — ownership is validated server-side.

## Endpoints

### Public (no auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | `{ "status": "ok", "timestamp": "..." }` |
| GET | `/docs` | Swagger UI |
| GET | `/openapi.json` | OpenAPI 3.0 spec |
| GET | `/llms.txt` | LLM-optimized API docs |
| GET | `/.well-known/ai-plugin.json` | AI plugin manifest |

### Backtesting

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v2/backtesting` | List backtests (cursor-paginated) |
| POST | `/v2/backtesting` | Create backtest |
| GET | `/v2/backtesting/{id}` | Get backtest details |
| GET | `/v2/backtesting/{id}/status` | Poll backtest status |
| PUT | `/v2/backtesting/{id}/status` | Start backtest (`{"action":"start"}`) |
| GET | `/v2/backtesting/{id}/logs` | Get backtest logs |
| DELETE | `/v2/backtesting/{id}` | Delete backtest (also cancels if running) |

### Deployment

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v2/deployment` | List deployments (cursor-paginated) |
| POST | `/v2/deployment` | Create deployment |
| GET | `/v2/deployment/{id}` | Get deployment details |
| GET | `/v2/deployment/{id}/status` | Get live status with pod info |
| PUT | `/v2/deployment/{id}/status` | Start or stop (`{"action":"start\|stop"}`) |
| POST | `/v2/deployment/{id}/credentials` | Store exchange credentials |
| GET | `/v2/deployment/{id}/credentials` | Get credential metadata |
| GET | `/v2/deployment/{id}/logs` | Get deployment logs |
| DELETE | `/v2/deployment/{id}` | Delete deployment |

## Request & Response Reference

### POST `/v2/backtesting` — Create Backtest

```json
// Request
{ "config": {}, "code": "string (Python strategy)", "timerange": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" } }

// Response (201)
{ "id": "string", "status": "pending", "message": "Backtest created. Call PUT /:id/status with action \"start\" to begin." }
```

### PUT `/v2/backtesting/{id}/status` — Start Backtest

```json
// Request — only "start" is supported; to cancel, use DELETE
{ "action": "start" }

// Response (200)
{ "id": "string", "status": "running", "previous_status": "pending", "job_name": "backtest-01kjvze9" }
```

### GET `/v2/backtesting/{id}/status` — Poll Status

```json
{ "id": "string", "status": "pending | running | completed | failed", "results": null }
```

`results` is `null` while running. **Use `result_url` from the full-details endpoint for complete results.**

### GET `/v2/backtesting/{id}` — Full Details

```json
{
  "id": "string", "config": {}, "code": "string",
  "timerange": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" },
  "status": "pending | running | completed | failed",
  "results": null,
  "result_url": "https://storage.googleapis.com/... (signed URL, valid 7 days)",
  "started_at": "ISO8601", "completed_at": "ISO8601",
  "job_name": "string", "created_at": "ISO8601", "updated_at": "ISO8601"
}
```

### GET `/v2/backtesting/{id}/logs`

Query: `pageSize` (default 100), `pageToken`.

```json
{ "backtest_id": "string", "items": [{ "timestamp": "ISO8601", "message": "string", "severity": "string" }], "nextCursor": "string | null" }
```

### DELETE `/v2/backtesting/{id}`

Cancels if running and deletes. Response: `{ "message": "Backtest deleted" }`

### POST `/v2/deployment` — Create Deployment

```json
// Request
{ "config": {}, "code": "string (Python strategy)", "name": "string" }

// Response (201)
{ "id": "string", "config": {}, "code": "string", "name": "My Strategy", "replicas": 1, "status": "pending", "deployment_name": "deploy-01kjvx94", "created_at": "ISO8601" }
```

### PUT `/v2/deployment/{id}/status` — Start or Stop

```json
// Request
{ "action": "start" | "stop" }

// Response (200)
{ "id": "string", "status": "running | stopped", "previous_status": "string" }
```

**On stop:** The platform automatically cancels all open orders and closes all positions on Hyperliquid before stopping the pod.

### GET `/v2/deployment/{id}` — Full Details

```json
{
  "id": "string", "config": {}, "code": "string", "name": "string",
  "replicas": 1, "status": "pending | running | stopped",
  "pods": [{ "name": "string", "status": "Running", "restarts": 0 }],
  "credentials_status": "stored | missing", "exchange": "hyperliquid",
  "deployment_name": "string", "namespace": "string",
  "created_at": "ISO8601", "updated_at": "ISO8601"
}
```

### GET `/v2/deployment/{id}/status` — Live Status

```json
{ "id": "string", "status": "string", "replicas": 1, "available_replicas": 1, "pods": null }
```

### POST `/v2/deployment/{id}/credentials` — Store Credentials

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

### GET `/v2/deployment/{id}/credentials` — Credential Info

Does NOT return private keys.

```json
// Stored
{
  "id": "string", "credentials_status": "stored", "exchange": "hyperliquid",
  "wallet_address": "0x...", "wallet_source": "main_trading_wallet | provided",
  "wallet_type": "main_wallet | agent_wallet",
  "agent_wallet_address": "0x... | undefined"
}

// Missing
{ "credentials_status": "missing" }
```

### GET `/v2/deployment/{id}/logs`

Query: `pageSize` (default 100), `pageToken`.

```json
{ "deployment_id": "string", "items": [{ "timestamp": "ISO8601", "message": "string", "severity": "string" }], "nextCursor": "string | null" }
```

### DELETE `/v2/deployment/{id}`

Closes all positions and orders on Hyperliquid before deleting. Response: `{ "message": "Deployment deleted" }`

**Known issue:** Deleting stopped deployments may return 500 in some cases. Safe to ignore — the deployment is already stopped.

### Paginated Lists

Both `GET /v2/backtesting` and `GET /v2/deployment` return `{ "items": [], "nextCursor": "string | null" }`. Pass `cursor` query param to paginate.

### Error Responses

```json
// 401 — Missing/invalid API key
{ "message": "No API key found in request", "request_id": "string" }

// 400 — Validation error
{ "error": "validation_failed", "message": "Invalid request", "details": [{ "path": "field", "message": "..." }] }

// 404 — Not found
{ "error": "not_found", "message": "Backtest not found" }
```

## Config Reference

The config object is a Freqtrade trading bot configuration. Fields `dry_run` and `api_server` are controlled by the platform and must NOT be included.

### Futures Config (recommended)

```json
{
  "exchange": { "name": "hyperliquid", "pair_whitelist": ["BTC/USDC:USDC"] },
  "stake_currency": "USDC", "stake_amount": 100, "timeframe": "5m",
  "max_open_trades": 3, "stoploss": -0.1,
  "trading_mode": "futures", "margin_mode": "cross",
  "pairlists": [{ "method": "StaticPairList" }]
}
```

### Spot Config

Spot pairs use `BTC/USDC` format. Stoploss on exchange not supported for spot.

```json
{
  "exchange": { "name": "hyperliquid", "pair_whitelist": ["BTC/USDC"] },
  "stake_currency": "USDC", "stake_amount": 100, "timeframe": "5m",
  "max_open_trades": 3, "stoploss": -0.1,
  "pairlists": [{ "method": "StaticPairList" }]
}
```

### HIP3 Config Example

```json
{
  "exchange": { "name": "hyperliquid", "pair_whitelist": ["XYZ-AAPL/USDC:USDC"] },
  "stake_currency": "USDC", "stake_amount": 100, "timeframe": "15m",
  "max_open_trades": 3, "stoploss": -0.05,
  "trading_mode": "futures", "margin_mode": "isolated",
  "pairlists": [{ "method": "StaticPairList" }]
}
```

### Common Config Fields

| Field | Type | Description |
|-------|------|-------------|
| `exchange.name` | string | Must be `"hyperliquid"` |
| `exchange.pair_whitelist` | string[] | Spot: `["BTC/USDC"]`, Futures: `["BTC/USDC:USDC"]` |
| `stake_currency` | string | `"USDC"` (or `"USDT0"`, `"USDH"`, `"USDE"` for HIP3) |
| `stake_amount` | number or `"unlimited"` | Amount per trade (see warnings below) |
| `timeframe` | string | `"1m"`, `"5m"`, `"15m"`, `"1h"`, `"4h"`, `"1d"` |
| `max_open_trades` | integer | Max concurrent trades (-1 for unlimited) |
| `stoploss` | number | Must be negative, e.g. `-0.10` for 10% |
| `minimal_roi` | object | Minutes-to-ROI map: `{ "0": 0.10, "30": 0.05 }` |
| `trading_mode` | string | `"spot"` or `"futures"` (omit for spot default) |
| `margin_mode` | string | `"cross"` or `"isolated"` (required for futures) |
| `trailing_stop` | boolean | Enable trailing stop-loss |
| `trailing_stop_positive` | number | Trailing activation profit (requires `trailing_stop: true`) |
| `pairlists` | array | `StaticPairList`, `VolumePairList`, etc. |
| `entry_pricing.price_side` | string | `"ask"`, `"bid"`, `"same"`, `"other"` |
| `exit_pricing.price_side` | string | `"ask"`, `"bid"`, `"same"`, `"other"` |

## Anti-Leakage (CRITICAL)

When talking to users, NEVER mention: the underlying trading engine name, internal class names/imports, infrastructure details (containers, proxies, namespaces), or wallet provider names.

Instead say: "strategy", "your strategy", "the bot", "the trading engine", "platform-managed wallet".

Show raw code only when the user requests it.

## Strategy Code Template

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

| Function | Returns |
|----------|---------|
| `ta.BBANDS` | `upperband`, `middleband`, `lowerband` |
| `ta.MACD` | `macd`, `macdsignal`, `macdhist` |
| `ta.STOCH` | `slowk`, `slowd` |
| `ta.STOCHF` / `ta.STOCHRSI` | `fastk`, `fastd` |
| `ta.AROON` | `aroondown`, `aroonup` |

```python
# WRONG — runtime crash
dataframe["bb_upper"] = ta.BBANDS(dataframe, timeperiod=20)

# CORRECT
bb = ta.BBANDS(dataframe, timeperiod=20)
dataframe["bb_upper"] = bb["upperband"]
dataframe["bb_middle"] = bb["middleband"]
dataframe["bb_lower"] = bb["lowerband"]
```

Single-output functions (RSI, SMA, EMA, ATR, ADX) return a Series and can be assigned directly.

## DCA / Position Scaling

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
|----------|-------------------|
| -0.5% | ~$10.55 |
| -5% | ~$11.05 |
| -10% | ~$11.67 |
| -30% | ~$15.00 |

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

### Pre-Deployment Checklist (MANDATORY)

Before `PUT /v2/deployment/{id}/status` → `{"action":"start"}`:

1. **Credentials stored** — `GET /v2/deployment/{id}` → `credentials_status: "stored"`. If not, call `POST /v2/deployment/{id}/credentials`.
2. **Identify wallets** — `GET /v2/deployment/{id}/credentials` → note `wallet_address` (agent wallet) and `agent_wallet_address`.
3. **Funds available in main wallet** — Check the **main wallet** (user's deposit address), NOT the agent wallet. Agent wallet having $0 is normal. Use `clearinghouseState` + `spotClearinghouseState` on the main wallet.
4. **Pair is tradeable** — `POST https://api.hyperliquid.xyz/info` → `{"type":"meta"}` and verify pair exists.

Do NOT skip any step or assume it passed without the API call.

### Deployment Workflow

1. `POST /v2/deployment` with config, code, name
2. **Live:** `POST /v2/deployment/{id}/credentials` with `{ "exchange": "hyperliquid" }` — server assigns wallet automatically
3. **Paper:** Skip credentials — runs in dry-run mode automatically
4. Run pre-deployment checklist
5. **MANDATORY:** Show deployment summary, wait for user confirmation
6. `PUT /v2/deployment/{id}/status` → `{"action": "start"}`
7. Monitor: `GET /v2/deployment/{id}/status`, `GET /v2/deployment/{id}/logs`
8. Stop: `PUT /v2/deployment/{id}/status` → `{"action": "stop"}`

### Reporting DCA Trades

When a strategy uses `adjust_trade_position()`:
1. Distinguish trades from orders: "X trades (Y buy orders, Z sell orders)"
2. Show per-order detail for at least the first trade (DCA count, avg entry/exit, total size)
3. Flag issues: minimum order rejections, rate limit failures, dust positions
4. Skip breakdown for non-DCA strategies (simple 1 buy + 1 sell)
5. Always download `result_url` for full order-level data

### Silent Failure Modes (CRITICAL)

Some failures produce **zero diagnostic output** — just heartbeats, no errors:

1. **`stake_amount: "unlimited"` with insufficient balance** — bot runs, zero trades, zero errors
2. **Main wallet has $0** — same symptom
3. **Balance below effective minimum** — same symptom

**Key signal:** Heartbeats but zero "Analyzing candle" or order lines after 5+ minutes = balance/stake issue.

### Diagnosing Zero-Trade Deployments

Check in order:
1. **Main wallet balance** — agent wallet $0 is normal; check main wallet
2. **`stake_amount`** — if `"unlimited"`, redeploy with explicit numeric amount slightly below balance
3. **Credentials** — verify `credentials_status: "stored"` and `WALLET_ADDRESS` in startup logs
4. **Strategy conditions** — check if entry conditions are met on recent candles
5. **Logs** — check for rate limits, exchange rejections, pair errors
6. **Pair validity** — verify pair is active on Hyperliquid

### Rate Limit Mitigation (CRITICAL)

All Superior Trade bots share a single proxy IP. One bot's retries can throttle all bots.

**Prevention:**
- Always set `process_only_new_candles = True`
- Use candle close price for exits when possible
- Do NOT make external Hyperliquid API calls while a bot is running

**If rate-limited:**
- Do NOT immediately restart — causes death spiral (retries → more 429s → more retries, ~50+ req/min)
- Wait for pod to stop, wait **5 minutes**, then create a fresh deployment

### Orphan Position Handling

When a bot crashes, it may leave open positions that lock up margin. Strategy code pattern:
- In `bot_loop_start()`, check for positions not in the bot's trade database
- Close orphans with a limit order before entering fresh
- Use a flag (`_orphan_closed`) to run cleanup exactly once per lifecycle

## Important Notes

- Credentials are **optional**: stored = live trading; missing = paper/dry-run
- Each deployment runs as an isolated container
- Each user has one platform-managed agent wallet — all deployments share it
- The agent wallet signs trades against the **main wallet's** balance via `approveAgent`
- Config fields `dry_run` and `api_server` are platform-managed; do not include
- Pair format: spot = `BTC/USDC`, futures = `BTC/USDC:USDC` — wrong format causes "not tradable"
- Futures requires `trading_mode: "futures"` + `margin_mode: "cross"` (or `"isolated"`)
- Spot does NOT support stoploss on exchange
- Historical data available from ~November 2025
- Backtests with no data for the timerange will fail
- To cancel a backtest: `DELETE /v2/backtesting/{id}`
- Deployment actions: `"start"` / `"stop"`
- Timestamps: snake_case (`created_at`, `updated_at`, `started_at`, `completed_at`)
- All endpoints use `/v2/` prefix with `x-api-key` auth
