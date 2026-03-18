---
name: superior-trade-api
version: 1.6.0
updated: 2026-03-18
description: Interact with the Superior Trade API to backtest and deploy trading strategies on Superior Trade's managed cloud — no coding required from the user. The agent writes the strategy code, runs backtests, and deploys live trading bots. Use when the user wants to create, backtest, or deploy trading strategies, monitor deployments, or check backtest results. No environment variables required — all credentials are collected interactively.
---

# Superior Trade API

API client skill for backtesting and deploying Freqtrade strategies on Superior Trade's cloud infrastructure.

**Base URL:** `https://api.superior.trade`
**Auth:** `x-api-key` header on all protected endpoints
**Docs:** `GET /docs` (Swagger UI), `GET /openapi.json` (OpenAPI spec)

## Getting an API Key

If the user doesn't have a Superior Trade API key, guide them through the magic-link flow below. The agent should make the API call directly.

> The Superior Trade website has no UI for creating API keys. Magic-link is the only way.

### Flow

1. **Ask the user for their email address**, then call:

   `POST /auth/sign-in/magic-link` with body `{"email": "user@example.com"}` and `Content-Type: application/json`

2. **Tell the user:** *"I've sent an email to your inbox. It contains your API key — copy it and paste it here when you have it."*

3. **Done.** The user receives the API key directly in the email. No verify step, no create-api-key call. Once they paste the key, use it in the `x-api-key` header for all subsequent requests.

**About the email:** The email contains the **API key** (prefixed `st_live_`). There is no button, no clickable link — just the key to copy. Do NOT tell the user to "click a link" or "click a button".

### Common Auth Errors

| Error | Cause | Fix |
|---|---|---|
| 500 on sign-in | Malformed request body | Ensure valid JSON `{"email": "..."}` with `Content-Type: application/json` |

### Auth Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/sign-in/magic-link` | Request API key via email `{"email": "..."}` |

## Supported Exchanges

| Exchange    | Stake Currencies | Trading Modes |
| ----------- | ---------------- | ------------- |
| Hyperliquid | USDC             | spot, futures |

### Hyperliquid Notes

**Pair format differs by trading mode** (follows CCXT convention):

- **Spot**: `BTC/USDC` (base/quote)
- **Futures/Perp**: `BTC/USDC:USDC` (base/quote:settle)

**Spot limitations:**

- Stoploss on exchange is NOT supported — the bot handles stoploss internally
- No market orders (ccxt simulates via limit orders with up to 5% slippage)

**Futures capabilities:**

- Margin modes: `"isolated"` and `"cross"`
- Stoploss on exchange supported via `stop-loss-limit` orders
- No market orders (same simulation as spot)

**Data availability:**

- Hyperliquid API only provides ~5000 historic candles per pair
- Historic OHLCV bulk download is not supported via the exchange API
- Superior Trade infrastructure pre-downloads data; availability starts from approximately November 2025

**Hyperliquid is a DEX** — it does not use traditional API key/secret authentication. Instead, it uses wallet-based signing. See the "Hyperliquid Credentials" section below for how to guide users through this.

### HIP3 — Tokenized Real-World Assets

Hyperliquid supports **HIP3** tokenized assets — stocks, commodities, currencies, and indices — tradeable as perpetual futures. These are fetched directly from the Hyperliquid API and available in Superior Trade's pre-downloaded data.

**Pair format** follows CCXT convention with a protocol prefix: `{PROTOCOL}-{TICKER}/USDC:USDC`

**Available protocols and example pairs:**

| Protocol | Asset Types | Stake Currency | Example Pairs (config format) |
|----------|------------|----------------|-------------------------------|
| `XYZ-` | US/KR stocks, metals, currencies, indices | USDC | `XYZ-AAPL/USDC:USDC`, `XYZ-TSLA/USDC:USDC`, `XYZ-GOLD/USDC:USDC` |
| `CASH-` | Commodities, stocks | USDT0 | `CASH-GOLD/USDT0:USDT0`, `CASH-GOOGL/USDT0:USDT0` |
| `FLX-` | Commodities, stocks, crypto | USDC or USDH | `FLX-GOLD/USDH:USDH`, `FLX-TSLA/USDH:USDH` |
| `KM-` | Stocks, indices, bonds | USDH | `KM-GOOGL/USDH:USDH`, `KM-US500/USDH:USDH` |
| `HYNA-` | Leveraged crypto | USDC or USDE | `HYNA-SOL/USDE:USDE`, `HYNA-XRP/USDC:USDC` |

**XYZ protocol tickers** (USDC — most commonly used):
- **US stocks**: AAPL, AMZN, GOOGL, META, TSLA, NFLX, HOOD, PLTR, INTC, RIVN, COIN, SNDK, BABA
- **Metals**: GOLD, SILVER, COPPER, PLATINUM, PALLADIUM
- **Currencies**: JPY
- **Indices**: XYZ100
- **Korean stocks**: HYUNDAI, SKHX, SMSN

**Data availability:**
- XYZ assets: data from ~November 2025 onwards
- KM/CASH/FLX assets: data from ~February 2026 onwards
- Timeframes: 1m, 3m, 5m, 15m, 30m, 1h (also 2h, 4h, 8h, 12h, 1d, 3d, 1w for some)
- Funding rate data available at 1h timeframe

**Trading considerations:**
- HIP3 assets are **futures-only** — always use `trading_mode: "futures"` and `margin_mode: "cross"`
- XYZ pairs use `stake_currency: "USDC"` — works with existing USDC balances
- USDH/USDT0/USDE pairs require the corresponding stake currency
- Stock-based HIP3 assets may have reduced liquidity outside US market hours
- Use the same strategy code patterns as regular crypto futures — no special handling needed

**Config example (XYZ-AAPL futures):**
```json
{
  "exchange": { "name": "hyperliquid", "pair_whitelist": ["XYZ-AAPL/USDC:USDC"] },
  "stake_currency": "USDC",
  "stake_amount": 100,
  "timeframe": "15m",
  "max_open_trades": 3,
  "stoploss": -0.05,
  "trading_mode": "futures",
  "margin_mode": "cross",
  "entry_pricing": { "price_side": "other" },
  "exit_pricing": { "price_side": "other" },
  "pairlists": [{ "method": "StaticPairList" }]
}
```

### Unified vs Legacy Account Mode

Hyperliquid accounts may run in **unified mode** (single balance for spot + perps) or **legacy mode** (separate balances). Do NOT assume which mode the user has.

- If perps `clearinghouseState` shows $0 but `spotClearinghouseState` shows funds, ask the user if they have unified mode enabled before advising a transfer.
- If the user confirms unified mode, spot USDC is automatically available as perps collateral — no transfer needed.

## Verification-First Principle

Every factual claim about the user's account, balance, wallet status, or deployment health MUST be backed by an API call made in the current conversation turn. The pattern is:

1. Make the API call
2. Read the response
3. Report the data

**NEVER:** assume → report → verify later. **ALWAYS:** verify → report.

## Agent Behavior

**CRITICAL: The agent must make all API calls directly and never show curl commands or raw API payloads to the user.** The user experience should be conversational:

- **Backtesting**: The agent builds the config and strategy code from the user's intent, calls the API, starts the backtest, polls for completion, and presents results — all automatically.
- **Deployment**: The agent creates the deployment, then proactively asks the user for their credentials before proceeding. Never dump a curl command or JSON payload.
- **Proactive information gathering**: If the agent needs info (e.g. which pair, timeframe, stake amount, credentials), ask the user directly. Don't present a wall of required fields — ask conversationally, one concern at a time.
- **After backtesting**: If results are poor (negative profit), warn the user before offering to deploy live. If results are good, offer to deploy and begin gathering what's needed.

### Anti-Hallucination — Balance & State Checks

NEVER report a wallet balance, account state, or API result without making the actual API call first. If you cannot call the API, say "I haven't checked yet" — do not guess or assume. Every number you present must come from a real API response in the current session.

To check Hyperliquid balances, use these calls:

- **Perps:** `POST https://api.hyperliquid.xyz/info` → `{"type":"clearinghouseState","user":"0x..."}`
- **Spot:** `POST https://api.hyperliquid.xyz/info` → `{"type":"spotClearinghouseState","user":"0x..."}`

Always call BOTH endpoints and report combined results.

### Hyperliquid Credentials

When a deployment needs exchange credentials, guide the user through obtaining a **Hyperliquid Agent Wallet**:

1. **Explain what it is**: An agent wallet is a special sub-wallet on Hyperliquid designed for automated trading. It can place trades on your behalf but **cannot initiate withdrawals**, making it safe to use with third-party trading bots. Your funds stay secure in your main wallet.

2. **Direct the user to create one**: Go to [https://app.hyperliquid.xyz/API](https://app.hyperliquid.xyz/API) and generate an agent wallet. This will give you:
   - An **agent wallet private key** (`0x` + 64 hex chars)
   - Your **main wallet address** (the `0x...` address you already use on Hyperliquid — NOT the agent wallet's address)

3. **Collect credentials from the user** — ask for:
   - Their **agent wallet private key** (from the API page) — `private_key` field
   - Their **main wallet address** (their Hyperliquid account address) — `wallet_address` field

**Security:** The agent wallet key is trade-only — it **cannot withdraw funds**. The agent must never ask for the main wallet private key or any seed phrase.

## Endpoints

### Public (no auth required)

| Method | Path                          | Description                                                    |
| ------ | ----------------------------- | -------------------------------------------------------------- |
| GET    | `/health`                     | Health check. Returns `{ "status": "ok", "timestamp": "..." }` |
| GET    | `/docs`                       | Swagger UI                                                     |
| GET    | `/openapi.json`               | OpenAPI 3.0 spec                                               |
| GET    | `/llms.txt`                   | LLM-optimized API documentation in Markdown                    |
| GET    | `/.well-known/ai-plugin.json` | AI plugin manifest (OpenAI-style)                              |

### Backtesting

| Method | Path                          | Description                       |
| ------ | ----------------------------- | --------------------------------- |
| GET    | `/v1/backtesting`             | List backtests (cursor-paginated) |
| POST   | `/v1/backtesting`             | Create backtest                   |
| GET    | `/v1/backtesting/{id}`        | Get backtest details              |
| GET    | `/v1/backtesting/{id}/status` | Poll backtest status              |
| PUT    | `/v1/backtesting/{id}/status` | Start backtest                    |
| GET    | `/v1/backtesting/{id}/logs`   | Get backtest logs                 |
| DELETE | `/v1/backtesting/{id}`        | Delete backtest (also stops it)   |
| GET    | `/v2/backtesting`             | List backtests (cursor-paginated) |
| POST   | `/v2/backtesting`             | Create backtest                   |
| GET    | `/v2/backtesting/{id}`        | Get backtest details              |
| GET    | `/v2/backtesting/{id}/status` | Poll backtest status              |
| PUT    | `/v2/backtesting/{id}/status` | Start backtest                    |
| GET    | `/v2/backtesting/{id}/logs`   | Get backtest logs                 |
| DELETE | `/v2/backtesting/{id}`        | Delete backtest (also stops it)   |

### Deployment

| Method | Path                              | Description                         |
| ------ | --------------------------------- | ----------------------------------- |
| GET    | `/v1/deployment`                  | List deployments (cursor-paginated) |
| POST   | `/v1/deployment`                  | Create deployment                   |
| GET    | `/v1/deployment/{id}`             | Get deployment details              |
| GET    | `/v1/deployment/{id}/status`      | Get live status with pod info       |
| PUT    | `/v1/deployment/{id}/status`      | Start or stop deployment            |
| POST   | `/v1/deployment/{id}/credentials` | Add exchange credentials            |
| GET    | `/v1/deployment/{id}/logs`        | Get deployment pod logs             |
| DELETE | `/v1/deployment/{id}`             | Delete deployment                   |
| GET    | `/v2/deployment`                  | List deployments (cursor-paginated) |
| POST   | `/v2/deployment`                  | Create deployment                   |
| GET    | `/v2/deployment/{id}`             | Get deployment details              |
| GET    | `/v2/deployment/{id}/status`      | Get live status with pod info       |
| PUT    | `/v2/deployment/{id}/status`      | Start or stop deployment            |
| POST   | `/v2/deployment/{id}/credentials` | Add exchange credentials            |
| GET    | `/v2/deployment/{id}/logs`        | Get deployment pod logs             |
| DELETE | `/v2/deployment/{id}`             | Delete deployment                   |

## Request & Response Reference

### POST `/v1/backtesting` — Create Backtest

**Request:**

```json
{
  "config": {},
  "code": "string (Python strategy code, required)",
  "timerange": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" },
  "stake_amount": 100
}
```

**Response (201):**

```json
{
  "id": "01kjvze9p1684ceesc27yx0nre",
  "status": "pending",
  "message": "Backtest created. Call PUT /:id/status with action \"start\" to begin."
}
```

### PUT `/v1/backtesting/{id}/status` — Start Backtest

**Request:**

```json
{ "action": "start" | "stop" }
```

`"start"` begins a pending backtest. `"stop"` cancels a running or pending backtest (terminates the K8s pod and marks as cancelled).

**Response (200):**

```json
{
  "id": "01kjvze9p1684ceesc27yx0nre",
  "status": "running",
  "previous_status": "pending",
  "k8s_job_name": "backtest-01kjvze9"
}
```

### GET `/v1/backtesting/{id}/status` — Poll Status

**Response (200):**

```json
{
  "id": "string",
  "status": "pending | running | completed | failed | cancelled",
  "results": null
}
```

The `results` field is `null` while running and populates with backtest metrics on completion (when trades were made).

### GET `/v1/backtesting/{id}` — Full Details

**Response (200):**

```json
{
  "id": "string",
  "config": {},
  "code": "string",
  "timerange": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" },
  "stake_amount": 100,
  "status": "pending | running | completed | failed",
  "results": null,
  "result_url": "https://storage.googleapis.com/... (signed URL, valid 7 days)",
  "started_at": "ISO8601",
  "completed_at": "ISO8601",
  "k8s_job_name": "backtest-01kjvze9",
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```

- `result_url` — signed URL to download full backtest results as JSON. Only available when status is `"completed"`. Valid for 7 days.
- `results` — **deprecated**. Use `result_url` to download the full results instead.

### GET `/v1/backtesting/{id}/logs` — Backtest Logs

Query params: `pageSize` (default 100), `pageToken`.

**Response (200):**

```json
{
  "backtest_id": "string",
  "items": [{ "timestamp": "ISO8601", "message": "string", "severity": "string" }],
  "nextCursor": "string | null"
}
```

### DELETE `/v1/backtesting/{id}`

**Response (200):**

```json
{ "message": "Backtest deleted" }
```

### POST `/v1/deployment` — Create Deployment

**Request:**

```json
{
  "config": {},
  "code": "string (Python strategy code, required)",
  "name": "string (human-readable name, required)"
}
```

**Response (201):**

```json
{
  "id": "string",
  "config": {},
  "code": "string",
  "name": "My Strategy",
  "replicas": 1,
  "status": "running",
  "k8s_deployment_name": "freqtrade-01kjvx94",
  "created_at": "ISO8601"
}
```

### PUT `/v1/deployment/{id}/status` — Start or Stop

**Request:**

```json
{ "action": "start" | "stop" }
```

**Response (200):**

```json
{
  "id": "string",
  "status": "running | stopped",
  "previous_status": "string"
}
```

### GET `/v1/deployment/{id}` — Full Details

**Response (200):**

```json
{
  "id": "string",
  "config": {},
  "code": "string",
  "name": "My Strategy",
  "replicas": 1,
  "status": "pending | running | stopped",
  "pods": [{ "name": "string", "status": "Running", "restarts": 0 }],
  "credentials_status": "stored | missing",
  "exchange": "hyperliquid",
  "k8s_deployment_name": "freqtrade-01kjvx94",
  "k8s_namespace": "trading",
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```

`pods` is `null` when no pods are running.

### GET `/v1/deployment/{id}/status` — Live Status

**Response (200):**

```json
{
  "id": "string",
  "status": "running | stopped | ...",
  "replicas": 1,
  "available_replicas": 1,
  "pods": null
}
```

### POST `/v1/deployment/{id}/credentials`

**Request (Hyperliquid):**

`exchange` and `private_key` are required. `wallet_address` is required for Hyperliquid. Supports two modes:

1. **API Wallet mode** (recommended): `private_key` from the agent/API wallet, `wallet_address` from the main account.
2. **Main Account mode**: `private_key` and `wallet_address` both from the main account.

See "Hyperliquid Credentials" above for how to guide the user.

```json
{
  "exchange": "hyperliquid",
  "private_key": "0x... (agent wallet private key — 64 hex chars)",
  "wallet_address": "0x... (main trading wallet address — 40 hex chars, NOT the agent wallet)"
}
```

**Response (200):**

```json
{
  "id": "string",
  "credentials_status": "stored",
  "exchange": "hyperliquid",
  "updated_at": "ISO8601"
}
```

**Error responses:**
- `400 invalid_private_key` — private key is not a valid Ethereum private key
- `400 duplicate_wallet_address` — wallet is already used by another deployment
- `400 unsupported_exchange` — only `"hyperliquid"` is supported
- `400 missing_credentials` — `private_key` is required
- If credentials are already `"stored"`, the endpoint returns the existing status (idempotent)

#### Credential Updates (CRITICAL)

The `POST /v1/deployment/{id}/credentials` endpoint is **idempotent once credentials are stored** — it will NOT overwrite existing credentials. To change wallets on a running deployment:

1. Stop: `PUT /v1/deployment/{id}/status` → `{"action":"stop"}`
2. Delete: `DELETE /v1/deployment/{id}`
3. Create new: `POST /v1/deployment`
4. Store new credentials: `POST /v1/deployment/{id}/credentials`
5. Start: `PUT /v1/deployment/{id}/status` → `{"action":"start"}`

NEVER tell the user "credentials updated" after calling the endpoint — always read the response and confirm the new wallet address was actually stored.

### GET `/v1/deployment/{id}/logs`

Query params: `pageSize` (default 100), `pageToken`.

**Response (200):**

```json
{
  "deployment_id": "string",
  "items": [{ "timestamp": "ISO8601", "message": "string", "severity": "string" }],
  "nextCursor": "string | null"
}
```

### DELETE `/v1/deployment/{id}`

**Response (200):**

```json
{ "message": "Deployment deleted" }
```

### Paginated List

Both `GET /v1/backtesting` (or `/v2/backtesting`) and `GET /v1/deployment` (or `/v2/deployment`) return:

```json
{
  "items": [],
  "nextCursor": "string | null"
}
```

Pagination is cursor-based. Pass `cursor` query param with the `nextCursor` value to fetch the next page.

### Error Responses

**401 — Unauthorized (missing or invalid API key):**

```json
{
  "message": "No API key found in request",
  "request_id": "string"
}
```

**400 — Validation error:**

```json
{
  "error": "validation_failed",
  "message": "Invalid request",
  "details": [{ "path": "field", "message": "validation error" }]
}
```

**404 — Not found:**

```json
{
  "error": "not_found",
  "message": "Backtest not found"
}
```

## Config Reference

The `config` object is a Freqtrade configuration. Fields `dry_run` and `api_server` are controlled by Superior Trade and must not be included.

### Spot Config

Spot pairs use `BTC/USDC` format. Note: stoploss on exchange is not supported for spot.

```json
{
  "exchange": { "name": "hyperliquid", "pair_whitelist": ["BTC/USDC"] },
  "stake_currency": "USDC",
  "stake_amount": 100,
  "timeframe": "5m",
  "max_open_trades": 3,
  "stoploss": -0.1,
  "pairlists": [{ "method": "StaticPairList" }]
}
```

### Futures Config (recommended)

Futures/perp pairs use `BTC/USDC:USDC` format (base/quote:settle). Requires `trading_mode` and `margin_mode`.

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

### Multi-Pair Futures Config

```json
{
  "exchange": {
    "name": "hyperliquid",
    "pair_whitelist": ["BTC/USDC:USDC", "ETH/USDC:USDC", "SOL/USDC:USDC"]
  },
  "stake_currency": "USDC",
  "stake_amount": 1000,
  "timeframe": "1h",
  "max_open_trades": 3,
  "stoploss": -0.05,
  "trading_mode": "futures",
  "margin_mode": "cross",
  "pairlists": [{ "method": "StaticPairList" }]
}
```

### Common Config Fields

| Field                      | Type                    | Description                                                             |
| -------------------------- | ----------------------- | ----------------------------------------------------------------------- |
| `exchange.name`            | string                  | Must be `"hyperliquid"`                                                 |
| `exchange.pair_whitelist`  | string[]                | Spot: `["BTC/USDC"]`, Futures: `["BTC/USDC:USDC"]`                      |
| `stake_currency`           | string                  | `"USDC"`                                                                |
| `stake_amount`             | number or `"unlimited"` | Amount per trade                                                        |
| `timeframe`                | string                  | Candle timeframe: `"1m"`, `"5m"`, `"15m"`, `"1h"`, `"4h"`, `"1d"`       |
| `max_open_trades`          | integer                 | Max concurrent trades (-1 for unlimited)                                |
| `stoploss`                 | number                  | Must be negative, e.g. `-0.10` for 10%                                  |
| `minimal_roi`              | object                  | Minutes-to-ROI map, e.g. `{ "0": 0.10, "30": 0.05 }`                    |
| `trading_mode`             | string                  | `"spot"` or `"futures"` (omit for spot, which is the default)           |
| `margin_mode`              | string                  | `"cross"` or `"isolated"` (required when `trading_mode` is `"futures"`) |
| `trailing_stop`            | boolean                 | Enable trailing stop-loss                                               |
| `trailing_stop_positive`   | number                  | Trailing stop activation profit (requires `trailing_stop: true`)        |
| `pairlists`                | array                   | Pairlist methods: `StaticPairList`, `VolumePairList`, etc.              |
| `entry_pricing.price_side` | string                  | `"ask"`, `"bid"`, `"same"`, `"other"`                                   |
| `exit_pricing.price_side`  | string                  | `"ask"`, `"bid"`, `"same"`, `"other"`                                   |

## Strategy Code Template

The `code` field must be valid Python containing a Freqtrade `IStrategy` subclass. The class name must end with `Strategy` and follow PascalCase.

Use `import talib.abstract as ta` for technical indicators (talib is pre-installed in the runtime).

```python
from freqtrade.strategy import IStrategy
import pandas as pd
import talib.abstract as ta


class MyCustomStrategy(IStrategy):
    minimal_roi = {
        "0": 0.10,
        "30": 0.05,
        "120": 0.02
    }

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
            (dataframe['rsi'] < 30) &
            (dataframe['close'] > dataframe['sma_20']),
            'enter_long'
        ] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        dataframe.loc[
            (dataframe['rsi'] > 70),
            'exit_long'
        ] = 1
        return dataframe
```

**Requirements for `code`:**

- Must `import` from `freqtrade`
- Must `import talib.abstract as ta` for technical indicators (do NOT use `self.indicators`)
- Must define a class inheriting from `IStrategy` with a PascalCase name ending in `Strategy`
- Must implement `populate_indicators`, `populate_entry_trend`, and `populate_exit_trend`

### Multi-Output TA-Lib Functions (CRITICAL)

Some TA-Lib abstract functions return a **DataFrame with multiple columns**, not a single Series. Assigning them directly to one column causes a runtime error that only appears during the backtest — not at validation time.

**These functions return multiple columns — do NOT assign directly to a single column:**

| Function       | Returns                                  |
| -------------- | ---------------------------------------- |
| `ta.BBANDS`    | `upperband`, `middleband`, `lowerband`   |
| `ta.MACD`      | `macd`, `macdsignal`, `macdhist`         |
| `ta.STOCH`     | `slowk`, `slowd`                         |
| `ta.STOCHF`    | `fastk`, `fastd`                         |
| `ta.STOCHRSI`  | `fastk`, `fastd`                         |
| `ta.AROON`     | `aroondown`, `aroonup`                   |
| `ta.HT_PHASOR` | `inphase`, `quadrature`                  |
| `ta.MAMA`      | `mama`, `fama`                           |
| `ta.MINMAXINDEX`| `minidx`, `maxidx`                      |

```python
# WRONG — causes runtime crash (shape mismatch)
dataframe["bb_upper"] = ta.BBANDS(dataframe, timeperiod=20)
dataframe["macd"] = ta.MACD(dataframe)

# CORRECT — assign each column separately
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

**Single-output functions** (RSI, SMA, EMA, ATR, ADX, etc.) return a Series and can be assigned directly:
```python
dataframe["rsi"] = ta.RSI(dataframe, timeperiod=14)  # OK — returns Series
```

### One Open Trade Per Pair & DCA

Freqtrade enforces a **one open trade per pair** rule. Once a trade is open on a pair (e.g. `BTC/USDC:USDC`), all subsequent entry signals for that pair are ignored until the trade is closed — even if the strategy generates a signal every candle.

This means strategies that rely on buying repeatedly into the same pair (e.g. "buy $500 BTC every minute for an hour") will only execute the **first** entry. The rest are silently dropped.

**To implement DCA (Dollar-Cost Averaging) or position scaling**, use the `adjust_trade_position()` callback instead of generating new entry signals:

```python
def adjust_trade_position(self, trade, current_time, current_rate,
                         current_profit, min_stake, max_stake,
                         current_entry_rate, current_exit_rate,
                         current_entry_profit, current_exit_profit,
                         **kwargs):
    # Return a positive stake amount to add to the position (DCA buy)
    # Return a negative stake amount to partially close the position
    # Return None to do nothing
    #
    # IMPORTANT: Hyperliquid exchange minimum is $10 per order.
    # Freqtrade inflates this by a stoploss reserve (up to 1.5×), making
    # the effective minimum $10–$15 depending on stoploss depth.
    # Always check min_stake and ensure amounts >= min_stake.
    if should_dca(trade, current_time):
        dca_amount = 500  # add $500 to the position
        return max(dca_amount, min_stake)  # respect exchange minimum
    return None
```

Key points:
- `adjust_trade_position()` is called on every candle while a trade is open
- Returning a positive number opens an additional order (DCA buy)
- Returning a negative number partially closes the position
- The agent should use this pattern whenever the user wants repeated buys on the same pair
- `max_open_trades` in config limits total concurrent trades across all pairs, not entries per pair
- **Hyperliquid minimum order: $10 (exchange base).** Freqtrade applies a stoploss reserve on top: `$10 × min(1.05 / (1 - |stoploss|), 1.5)`, making the effective minimum $10–$15 depending on stoploss depth (e.g. $15 at -30% stoploss). Always use the `min_stake` parameter — it already accounts for this reserve. Superior Trade auto-sets `trading_min_order_amount: 10` in config. The API validates at deployment time that `stake_amount` ≥ effective minimum for the configured stoploss, so bad configs are rejected early with a clear error message.

## Typical Workflows

### Backtest Workflow

The agent should execute all these steps automatically, presenting only the final results to the user:

1. Build config and strategy code from the user's requirements
2. `POST /v1/backtesting` — create the backtest
3. `PUT /v1/backtesting/{id}/status` with `{"action": "start"}` — start it
4. Poll `GET /v1/backtesting/{id}/status` every 10s until `completed` or `failed` (typically 1-10 minutes)
5. `GET /v1/backtesting/{id}` — fetch full results; download `result_url` for detailed JSON
6. Present a summary: total trades, win rate, profit, drawdown, sharpe ratio
7. If failed, check `GET /v1/backtesting/{id}/logs` and report the issue
8. To stop a running backtest: `DELETE /v1/backtesting/{id}`

### Pre-Deployment Checklist (MANDATORY before starting any live bot)

Before calling `PUT /v1/deployment/{id}/status` → `{"action":"start"}`, verify ALL of these:

1. **Agent wallet is approved** — `POST https://api.hyperliquid.xyz/info` → `{"type":"clearinghouseState","user":"<AGENT_WALLET_ADDRESS>"}`. If it returns an error or empty state, the wallet is NOT registered. Tell the user to approve it at [app.hyperliquid.xyz/API](https://app.hyperliquid.xyz/API).

2. **Funds are available** — Check BOTH perps and spot balances on the MAIN wallet. Report what you find. If funds are only in spot and user doesn't have unified mode, advise transfer.

3. **Credentials are stored** — `GET /v1/deployment/{id}` and confirm `credentials_status` is `"stored"`.

4. **Pair is tradeable** — `POST https://api.hyperliquid.xyz/info` → `{"type":"meta"}` and verify the pair exists in the `universe` array.

Do NOT skip any step. Do NOT assume any step passed without making the actual API call.

### Deployment Workflow

The agent should handle the API calls and proactively ask the user for what's needed:

1. `POST /v1/deployment` with config, code, name — create the deployment
2. **For live trading:** ask the user for their Hyperliquid credentials (see "Hyperliquid Credentials" section above):
   - Guide them to create an agent wallet at https://app.hyperliquid.xyz/API if they don't have one
   - Collect their agent wallet private key (`private_key`) and main wallet address (`wallet_address`)
   - `POST /v1/deployment/{id}/credentials` — store the credentials
   - Inform the user that the deployment will use real funds and confirm before proceeding
3. **For paper trading:** credentials are optional — skip them. The deployment will run in dry-run mode automatically.
4. `PUT /v1/deployment/{id}/status` with `{"action": "start"}` — start (live if credentials stored, paper/dry-run if not)
5. Monitor with `GET /v1/deployment/{id}/status`
6. Check logs with `GET /v1/deployment/{id}/logs`
7. Stop with `PUT /v1/deployment/{id}/status` `{"action": "stop"}`

### Reporting DCA / Multi-Order Trades

When a strategy uses `adjust_trade_position()` (DCA, scaling, or any multi-order pattern), the agent MUST follow these reporting rules:

**Rule 1 — Distinguish trades from orders.** A single "trade" in backtest results may contain many buy/sell orders. Never report raw trade count alone when DCA is used. Always clarify: "X trades (Y total buy orders, Z total sell orders)".

**Rule 2 — Show per-order detail.** For at least the first completed trade, provide:
- Number of buy orders and sell orders
- First buy price and last buy price
- Weighted average entry price and weighted average exit price
- Total position size accumulated across all DCA orders

**Rule 3 — Flag order-level issues.** Report any of the following if they occur:
- Minimum order size rejections (order too small for the exchange)
- Rate limit or API failures on individual orders
- Dust positions remaining after final sell
- Expected vs actual order count mismatches (e.g., strategy intended 10 DCA buys but only 7 executed)

**Rule 4 — Skip the breakdown for non-DCA strategies.** If the strategy uses a simple 1 buy + 1 sell pattern (no `adjust_trade_position()`), standard trade-level reporting is sufficient — no per-order breakdown needed.

**Rule 5 — Always download `result_url` for full order-level data.** The summary endpoint does not include individual order details. The agent must download the `result_url` JSON and parse `orders` within each trade to provide accurate DCA reporting.

### Important Notes

- Credentials are **optional**. If `credentialsStatus` is `"stored"`, the deployment runs **live**; if missing, it runs in **paper (dry-run)** mode with no real trades
- Each deployment runs as an isolated Kubernetes pod
- Backtests run as Kubernetes Jobs and are cleaned up after completion
- Config fields `dry_run` and `api_server` are managed by Superior Trade; do not include them
- Hyperliquid pair format depends on trading mode: spot uses `BTC/USDC`, futures uses `BTC/USDC:USDC` — using the wrong format for the mode will cause "not tradable" errors
- Futures mode requires `trading_mode: "futures"` and `margin_mode: "cross"` (or `"isolated"`) in config
- Spot mode does NOT support stoploss on exchange; futures mode supports `stop-loss-limit` orders
- Historical data for Hyperliquid is available from approximately November 2025 onwards; choose timeranges within the available data window
- Backtests with no available data for the requested timerange will fail — check logs for details
- Backtest status supports `"start"` and `"stop"` — stop cancels a running/pending backtest
- Deployment status actions are `"start"` / `"stop"`
- Response timestamps use snake_case: `created_at`, `updated_at`, `started_at`, `completed_at`
- v1 and v2 endpoints have **identical** request/response formats — use either interchangeably
