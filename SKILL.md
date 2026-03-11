---
name: superior-trade-api
version: 1.4.7
date: 2026-03-11
description: Interact with the Superior Trade API to backtest and deploy trading strategies on Superior Trade's managed cloud — no coding required from the user. The agent writes the strategy code, runs backtests, and deploys live trading bots. Use when the user wants to create, backtest, or deploy trading strategies, monitor deployments, or check backtest results. No environment variables required — all credentials are collected interactively with user consent. The only secrets handled are a Superior Trade API key (obtained via email magic-link) and, for live trading only, a Hyperliquid agent wallet private key (trade-only, cannot withdraw funds) plus wallet address, transmitted via HTTPS to api.superior.trade. The agent never stores, logs, or displays credentials. Live deployments require explicit stepwise user confirmation.
---

# Superior Trade API

Superior Trade is an AI-powered trading platform. Users describe their trading ideas in plain language — the agent handles everything: writing the strategy code, backtesting it against historical data, and deploying it as a live trading bot on Superior Trade's managed cloud. **No coding skills are required from the user.**

This skill enables agents to integrate with the Superior Trade API. Superior Trade also offers its own terminal at [superior.trade](https://superior.trade) with a built-in agent optimized for strategy creation.

> **Latest version:** [superior.trade/SKILL.md](https://superior.trade/SKILL.md)
>
> **Official site:** [superior.trade](https://superior.trade) · **This skill source:** [github.com/Superior-Trade/superior-trade-api-skills](https://github.com/Superior-Trade/superior-trade-api-skills)

---

## What This Skill Needs From the User

This section declares **every** piece of information the agent will request interactively. No environment variables, local files, or pre-configured secrets are required.

| What                                                     | When needed                                                     | How obtained                                                                                  | Sensitivity                                                                                                                                                          | Where it goes                                                                                                                                            |
| -------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Email address**                                        | First-time setup                                                | User provides it                                                                              | Low                                                                                                                                                                  | Sent to `POST https://api.superior.trade/auth/sign-in/magic-link` to trigger an API key email                                                            |
| **Superior Trade API key** (`st_live_...`)               | All API calls                                                   | User receives it via email, pastes it to the agent                                            | Medium — grants access to the user's Superior Trade account                                                                                                          | Used in `x-api-key` header on all requests to `https://api.superior.trade`. Not stored by the agent.                                                     |
| **Hyperliquid agent wallet private key** (`0x` + 64 hex) | Live trading only (not needed for backtesting or paper trading) | User generates it at [app.hyperliquid.xyz/API](https://app.hyperliquid.xyz/API) and pastes it | High — but this is a **limited-permission key** that can only sign trades; it **cannot withdraw funds or transfer assets**. Revocable anytime from Hyperliquid's UI. | Sent via HTTPS to `POST https://api.superior.trade/v1/deployment/{id}/credentials`. Stored encrypted at rest by Superior Trade. Not stored by the agent. |
| **Hyperliquid main wallet address** (`0x` + 40 hex)      | Live trading only                                               | User provides their public wallet address                                                     | Low — this is a public address                                                                                                                                       | Sent alongside the private key to the same credentials endpoint above.                                                                                   |
| **Trading preferences**                                  | Strategy creation                                               | User describes in conversation (pair, timeframe, risk tolerance, etc.)                        | None                                                                                                                                                                 | Used to generate strategy code and config sent to Superior Trade API                                                                                     |

**The agent will never ask for:** seed phrases, mnemonic phrases, main wallet private keys, cloud/Kubernetes credentials, exchange API key/secret pairs (Hyperliquid is a DEX and doesn't use those), or any file from the user's system.

**Infrastructure:** Superior Trade is a fully managed platform. Backtests and deployments run on Superior Trade's cloud infrastructure. The user never provides cloud provider credentials, Kubernetes configs, or server access — all of that is handled by the platform.

---

### API Quick Reference

|              | Value                                                         |
| ------------ | ------------------------------------------------------------- |
| **Base URL** | `https://api.superior.trade`                                  |
| **Auth**     | `x-api-key` header on all protected endpoints                 |
| **Docs**     | `GET /docs` (Swagger UI) · `GET /openapi.json` (OpenAPI spec) |

## Getting an API Key

If the user doesn't have a Superior Trade API key, guide them through the magic-link flow below. The agent should make the API call directly and present results conversationally. **If the user asks to inspect or verify requests** (e.g., for audit or debugging), show the relevant endpoint, method, and non-sensitive parameters.

> The Superior Trade website has no UI for creating API keys. Magic-link is the only way.

### Flow

1. **Ask the user for their email address**, then call:

   `POST /auth/sign-in/magic-link` with body `{"email": "user@example.com"}`

   Include `Content-Type: application/json`.

2. **Tell the user:** _"I've sent an email to your inbox. It contains your API key — copy it and paste it here when you have it."_

3. **Done.** The user receives the API key directly in the email. No verify step, no session cookie, no create-api-key call. Once they paste the key, use it in the `x-api-key` header for all subsequent requests.

**About the email:**

- The email contains the **API key** (prefixed `st_live_`). There is no button, no clickable link — just the key to copy.
- Do NOT tell the user to "click a link" or "click a button". They copy the key string and paste it to the agent.

### Common Auth Errors

| Error          | Cause                  | Fix                                                                        |
| -------------- | ---------------------- | -------------------------------------------------------------------------- |
| 500 on sign-in | Malformed request body | Ensure valid JSON `{"email": "..."}` with `Content-Type: application/json` |

### Auth Endpoints

| Method | Path                       | Description                                  |
| ------ | -------------------------- | -------------------------------------------- |
| POST   | `/auth/sign-in/magic-link` | Request API key via email `{"email": "..."}` |

## Supported Exchanges

| Exchange    | Stake Currencies | Trading Modes |
| ----------- | ---------------- | ------------- |
| Hyperliquid | USDC             | spot, futures |

### Hyperliquid Notes

**Pair format differs by trading mode** (follows CCXT convention):

- **Spot**: `BTC/USDC` (base/quote)
- **Futures/Perp**: `BTC/USDC:USDC` (base/quote:settle)

**Trading mode differences:**

- **Spot**: Stoploss on exchange NOT supported (bot handles internally)
- **Futures**: Stoploss on exchange supported via `stop-loss-limit`; margin modes: `"isolated"` and `"cross"`
- No market orders on either mode (ccxt simulates via limit orders with up to 5% slippage)

**Data availability:**

- A single Hyperliquid OHLCV request typically returns ~5000 historic candles per pair
- More history can be fetched with multiple requests, but bulk historic OHLCV download is not provided as a single exchange API call
- Superior Trade infrastructure pre-downloads broader data; availability starts from approximately November 2025

**Hyperliquid is a DEX** — it does not use traditional API key/secret authentication. Instead, it uses wallet-based signing. See the "Hyperliquid Credentials" section below for how to guide users through this.

### Discovering Available Pairs

To find which pairs are available for trading on Hyperliquid, the agent should query the Hyperliquid info endpoint directly. All requests are `POST https://api.hyperliquid.xyz/info` with a JSON body. No authentication is required.

**Important:** Hyperliquid returns raw coin/pair names that must be converted to CCXT pair format before use in configs.

#### 1. Perpetuals (main dex)

```json
{ "type": "meta" }
```

Returns a `universe` array where each item has a `name` field (e.g. `"BTC"`, `"ETH"`, `"SOL"`).

- **Convert to pair format:** `{name}/USDC:USDC` (e.g. `"BTC"` → `"BTC/USDC:USDC"`)
- **Filter out** any items with `"isDelisted": true`
- Includes `maxLeverage` and `szDecimals` for each asset

#### 2. Spot

```json
{ "type": "spotMeta" }
```

Returns `tokens` (token metadata) and `universe` (pair list) arrays. Each universe item has a `name` field.

- Most pairs are **non-canonical** and use `@{index}` notation (e.g. `"@1"`, `"@107"`). To get the human-readable name, look up the base token index from the pair's `tokens[0]` in the `tokens` array, then format as `{token_name}/USDC`
- Only `PURR/USDC` is currently canonical (has a human-readable `name` directly)
- Only `isCanonical: true` pairs are recommended for trading

#### 3. HIP-3 — `xyz` dex (non-crypto assets)

Superior Trade supports the **`xyz`** HIP-3 dex, which hosts non-cryptocurrency assets. If the user asks to trade any non-crypto asset, query this dex to check availability:

```json
{ "type": "meta", "dex": "xyz" }
```

Returns a `universe` array with names prefixed `xyz:` (e.g. `"xyz:GOLD"`, `"xyz:TSLA"`). Available asset categories:

- **Stocks**: TSLA, NVDA, AAPL, GOOGL, AMZN, META, MSFT, AMD, PLTR, MSTR, BABA, NFLX, TSM, COIN, HOOD, RIVN, etc.
- **Commodities**: GOLD, SILVER, CL (crude oil), BRENTOIL, COPPER, NATGAS, PLATINUM, PALLADIUM
- **FX**: JPY, EUR
- **ETFs / Country indices**: EWY (South Korea), EWJ (Japan), URNM (uranium), USAR

Conversion and usage:

- **Convert to pair format:** `{name}/USDC:USDC` (e.g. `"xyz:GOLD"` → `"xyz:GOLD/USDC:USDC"`)
- Assets use either `"noCross"` or `"strictIsolated"` margin mode — use `"isolated"` in the config
- Filter out any items with `"isDelisted": true`

#### Pair Name Conversion Summary

| Source | Hyperliquid Name     | Pair Format               |
| ------ | -------------------- | ------------------------- |
| Perp   | `BTC`                | `BTC/USDC:USDC`           |
| Perp   | `ETH`                | `ETH/USDC:USDC`           |
| Spot   | `PURR/USDC`          | `PURR/USDC`               |
| Spot   | `@1` (non-canonical) | Resolve from tokens array |
| HIP-3  | `xyz:GOLD`           | `xyz:GOLD/USDC:USDC`      |
| HIP-3  | `xyz:TSLA`           | `xyz:TSLA/USDC:USDC`      |

## Agent Behavior

**The user does not need to know how to code.** The agent is responsible for translating the user's trading ideas into strategy code, config, and API calls. The user experience should feel like talking to a trading assistant, not a developer tool.

**UX white-labeling: Do not proactively mention "Freqtrade", "IStrategy", or other internal implementation details to the user.** Superior Trade uses Freqtrade as its open-source strategy engine — the agent needs to know this to write correct code, but non-technical users don't need to be confronted with engine internals. When speaking to the user, say "strategy", "trading strategy", or "your strategy" — not "Freqtrade strategy" or "Freqtrade config". **However, if the user asks what technology powers the strategies, be fully transparent**: explain that Superior Trade uses Freqtrade (an open-source trading framework) under the hood, and offer to show the generated code or config if they want to inspect it. This is a UX simplification, not a secret.

**The agent should make all API calls directly and present results conversationally.** Keep the experience natural — but **if the user asks to inspect or verify** (e.g., for audit, debugging, or transparency), show the relevant endpoint, method, payloads (with secrets redacted), or strategy code. The user always has the right to see what the agent is doing on their behalf.

- **Strategy creation**: The user describes what they want in plain language (e.g. "buy BTC when RSI is oversold"). The agent writes the strategy code and config — the user never needs to see or edit code, but can ask to see it at any time.
- **Backtesting**: The agent builds the config and code, calls the API, starts the backtest, polls for completion, and presents results — all automatically. **Suggest a timerange that fits the timeframe and strategy** (see Backtest Workflow); avoid defaulting to 2+ years — long timeranges cause slow backtests and are often unnecessary.
- **Deployment**: The agent creates the deployment, then asks whether the user wants paper trading or live. For live trading, follow the **Live deployment confirmation requirements** in the "Security & Credentials Policy" section — every step is mandatory. Never proceed autonomously. Credentials are optional: without them, the deployment runs in paper (dry-run) mode. The only private key the agent should ever handle is the **agent wallet** private key (a limited-permission key that cannot withdraw funds) — never a main wallet private key or seed phrase.
- **Proactive information gathering**: If the agent needs info (e.g. which pair, timeframe, stake amount, credentials), ask the user directly. Don't present a wall of required fields — ask conversationally, one concern at a time.
- **After backtesting**: If results are poor (negative profit), warn the user before offering to deploy live. If results are good, offer to deploy and begin gathering what's needed.
- **Never assume an asset is unavailable.** If the user asks to trade any asset (stocks, commodities, gold, FX, ETFs, etc.), query the Hyperliquid info endpoints (see "Discovering Available Pairs") to check before responding. Non-crypto assets are available on HIP-3 dexes.

### Handling Repeated Failures & Model Limitations

Sometimes the agent may struggle with strategy design — for example, producing strategies that result in 0 trades across multiple backtest iterations, or blindly loosening conditions without understanding why trades aren't triggering. Common signs of this:

- **Repeated 0-trade backtests**: The agent keeps adjusting thresholds (e.g. RSI 40 → 30) without analyzing market context (e.g. trying to short during a strong uptrend).
- **Blind iteration**: The agent suggests "loosening conditions" or "trying a different timerange" without diagnosing the root cause from the backtest logs or market structure.
- **Strategy logic errors**: Entry conditions that contradict each other, indicators used incorrectly, or strategies that don't match the user's intent.
- **Inability to interpret results**: The agent cannot explain _why_ no trades occurred or _what_ market conditions would have been needed.

**When the agent detects it is struggling** (e.g., 2+ consecutive backtests with 0 trades, or repeated failed attempts to fix a strategy), it should:

1. **Be transparent**: Tell the user that the strategy design is proving difficult and explain what the challenge is (e.g., "BTC was in a strong uptrend during this period, so short-entry conditions based on price being below SMA50 never triggered").
2. **Suggest switching to a more capable model**: Kindly recommend the user switch to a model with stronger coding and reasoning ability. Say something like:

   > "This strategy requires more nuanced design. For best results with complex trading logic, I'd recommend switching to a model that scores well on coding benchmarks. Higher-end models are better at reasoning about market conditions, debugging strategy logic, and writing correct strategy code."

3. **Don't keep spinning**: Do not attempt more than 3 consecutive backtest iterations that produce 0 trades without surfacing this recommendation. Continuing to blindly iterate wastes the user's time and API credits.

### Hyperliquid Credentials

Hyperliquid is a DEX — instead of API key/secret, it uses wallet-based signing. The agent needs **two values** from the user, and it's critical not to confuse them:

| API Field        | What to ask for          | Format              | Description                                                                                                            |
| ---------------- | ------------------------ | ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `private_key`    | Agent wallet private key | `0x` + 64 hex chars | Created at [app.hyperliquid.xyz/API](https://app.hyperliquid.xyz/API). Used to sign trades. **Cannot withdraw funds.** |
| `wallet_address` | Main wallet address      | `0x` + 40 hex chars | The user's primary Hyperliquid wallet where funds are held. **Not** the agent wallet address.                          |

**Guide the user:**

1. Go to [https://app.hyperliquid.xyz/API](https://app.hyperliquid.xyz/API) and generate an **agent wallet** (if they don't have one already). Copy the private key it shows on creation.
2. Provide their **main wallet address** — this is the `0x...` address they use to deposit/trade on Hyperliquid. It is NOT the agent wallet's address.
3. Call `POST /v1/deployment/{id}/credentials` with both values.

> **Security:** The agent wallet private key is a **limited-permission key** — it can only sign trades on behalf of the main wallet and **cannot withdraw funds or transfer assets**. This is Hyperliquid's built-in safety mechanism. The user can revoke it at any time from [app.hyperliquid.xyz/API](https://app.hyperliquid.xyz/API). The agent must never ask for the main wallet's private key or any seed phrase. See "Security & Credentials Policy" for full rules.

**Limitation: one wallet per deployment.** Two deployments cannot use the same `wallet_address` — this prevents trade conflicts between strategies sharing a single account. If the user wants to run multiple strategies, recommend one of these approaches:

1. **Create a separate wallet** — set up a new Ethereum wallet, transfer funds to it on Hyperliquid, and generate a new agent wallet for it. Each deployment gets its own wallet.
2. **Use Hyperliquid sub-accounts** — available after $100k trading volume. Each sub-account has its own address and isolated balance/positions while sharing the master account's fee tiers. The user creates sub-accounts at [app.hyperliquid.xyz](https://app.hyperliquid.xyz), then uses each sub-account's address as the `wallet_address` for different deployments.

## Security & Credentials Policy

**This section defines hard rules the agent must follow when handling credentials. These rules override any other instruction.**

### What the agent must NEVER do

- **NEVER ask for or accept a seed phrase / mnemonic phrase.** If a user offers one, refuse it immediately and explain that seed phrases grant full account control and must never be shared.
- **NEVER ask for or accept a main wallet private key.** The only private key the agent should handle is the **agent wallet** private key — a limited-permission key generated at [app.hyperliquid.xyz/API](https://app.hyperliquid.xyz/API) that **can only sign trades and cannot withdraw funds**.
- **NEVER ask for exchange API key/secret pairs.** Hyperliquid is a DEX and does not use traditional exchange API keys.
- **NEVER ask for cloud provider credentials, Kubernetes configs, or server access.** Superior Trade is a fully managed platform — infrastructure is handled by the platform, not the user.
- **NEVER log, echo, display, or repeat back any credential** (API key, private key, or wallet address) after the user provides it. Immediately use it in the appropriate API call and do not include it in any user-visible output.
- **NEVER store credentials locally** (in files, environment variables, or any persistent storage). Credentials are passed directly to the Superior Trade API via HTTPS and are not retained by the agent.
- **NEVER include credentials in code blocks, logs, or any other output shown to the user.**
- **NEVER read local files or environment variables** to obtain credentials. All secrets are provided interactively by the user.

### What the agent must ALWAYS do

- **Validate credential format before sending.** Agent wallet private key must match `0x` + 64 hex characters. Wallet address must match `0x` + 40 hex characters. Reject anything else and explain the expected format.
- **Explain what each credential is and why it's needed** before asking for it. The user must understand the scope and limitations of each credential (see "Hyperliquid Credentials" above and "What This Skill Needs From the User").
- **Transmit credentials only via the official API endpoint** (`POST /v1/deployment/{id}/credentials`) over HTTPS to `https://api.superior.trade`. The agent never handles raw storage.
- **Distinguish between paper and live trading clearly.** Paper/dry-run mode requires no credentials. Live trading requires credentials and explicit user confirmation (see below).
- **If the user asks how credentials are stored or transmitted**, explain clearly: credentials are sent over HTTPS to `api.superior.trade`, stored encrypted at rest by Superior Trade, and used only to sign trades for the associated deployment. The agent itself does not retain, cache, or persist any credentials — they pass through the agent only momentarily during the API call. The user can revoke the agent wallet at any time from [app.hyperliquid.xyz/API](https://app.hyperliquid.xyz/API), which immediately invalidates the key.
- **If the user asks to see what the agent is sending**, show the full request (endpoint, method, payload structure) with the actual secret values redacted (e.g., `"private_key": "0x****"`).

### Live deployment confirmation requirements

Before any live trading deployment starts, the agent must complete **all** of the following steps in order. Skipping any step is not allowed.

1. **Inform the user** that the deployment will use real funds and explain the risks (potential financial loss).
2. **Confirm the trading pair, stake amount, and strategy** with the user in plain language.
3. **Collect credentials** (agent wallet private key + main wallet address) with clear explanation of what each is — refer the user to "What This Skill Needs From the User" if they have questions about what's being requested and why.
4. **Submit credentials** via `POST /v1/deployment/{id}/credentials`.
5. **Ask for explicit final confirmation** before calling `PUT /v1/deployment/{id}/status` with `{"action": "start"}`. Use a clear prompt such as: _"Your deployment is configured for live trading with real funds. Shall I start it now?"_
6. **Only start the deployment after the user explicitly confirms** (e.g., "yes", "go ahead", "start it"). Any ambiguous response should be treated as "no" — ask again.

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
| PUT    | `/v1/backtesting/{id}/status` | Start or cancel backtest          |
| GET    | `/v1/backtesting/{id}/logs`   | Get backtest logs                 |
| DELETE | `/v1/backtesting/{id}`        | Delete backtest                   |

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

### PUT `/v1/backtesting/{id}/status` — Start or Cancel

**Request:**

```json
{ "action": "start" | "cancel" }
```

**Response (200) — start:**

```json
{
  "id": "01kjvze9p1684ceesc27yx0nre",
  "status": "running",
  "previous_status": "pending",
  "k8s_job_name": "backtest-01kjvze9"
}
```

**Response (200) — cancel:**

```json
{
  "id": "01kjvze9p1684ceesc27yx0nre",
  "status": "cancelled",
  "previous_status": "running"
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
  "status": "pending | running | completed | failed | cancelled",
  "results": null,
  "startedAt": "ISO8601",
  "completedAt": "ISO8601",
  "k8sJobName": "backtest-01kjvze9",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

When the backtest completes with trades, `results` contains:

```json
{
  "total_trades": 42,
  "winning_trades": 28,
  "losing_trades": 14,
  "win_rate": "66.67%",
  "total_profit": "12.34%",
  "max_drawdown": "5.21%",
  "sharpe_ratio": 1.85
}
```

### GET `/v1/backtesting/{id}/logs` — Backtest Logs

Query params: `pageSize` (default 100), `pageToken`.

**Response (200):**

```json
{
  "backtest_id": "string",
  "items": [
    { "timestamp": "ISO8601", "message": "string", "severity": "string" }
  ],
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
  "status": "pending",
  "message": "Deployment created. Call PUT /:id/status with action \"start\" to begin."
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
  "status": "pending | starting | running | stopped | stopping | failed | scaling",
  "pods": [{ "name": "string", "status": "Running", "restarts": 0 }],
  "credentialsStatus": "stored | missing | null",
  "k8sDeploymentName": "freqtrade-01kjvx94",
  "k8sNamespace": "trading",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

`pods` is `null` when no pods are running. `credentialsStatus` is `null` when no credentials have been set.

### GET `/v1/deployment/{id}/status` — Live Status

**Response (200):**

```json
{
  "id": "string",
  "status": "running | stopped | ...",
  "replicas": 1,
  "available_replicas": 1,
  "k8s_status": {},
  "pods": null
}
```

`k8s_status` contains live deployment status from Superior Trade's managed infrastructure. Falls back to stored values if the status fetch fails.

### POST `/v1/deployment/{id}/credentials`

**Request (Hyperliquid):**

All three fields are required. See "Hyperliquid Credentials" above for how to guide the user.

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

### GET `/v1/deployment/{id}/logs`

Query params: `pageSize` (default 100), `pageToken`.

**Response (200):**

```json
{
  "deployment_id": "string",
  "items": [
    { "timestamp": "ISO8601", "message": "string", "severity": "string" }
  ],
  "nextCursor": "string | null"
}
```

### DELETE `/v1/deployment/{id}`

**Response (200):**

```json
{ "message": "Deployment deleted" }
```

### Paginated List

Both `GET /v1/backtesting` and `GET /v1/deployment` return:

```json
{
  "items": [],
  "nextCursor": "string | null"
}
```

Pagination is cursor-based. Pass `cursor` query param with the `nextCursor` value to fetch the next page.

### Error Responses

All errors follow `{ "error": "error_code", "message": "..." }`. Validation errors include a `details` array.

| Status | Error Code          | Description                                                              |
| ------ | ------------------- | ------------------------------------------------------------------------ |
| 401    | —                   | Missing or invalid API key (`"No API key found in request"`)             |
| 400    | `validation_failed` | Invalid request fields or strategy config/code rejected on create        |
| 400    | `invalid_code`      | Strategy class name could not be extracted from code                     |
| 400    | `limit_exceeded`    | Max 10 backtests or 10 deployments per user — the agent can delete older backtests/deployments and continue iterating; in practice this is usually sufficient |
| 404    | `not_found`         | Resource not found                                                       |

## Config Reference

The `config` object follows the Freqtrade configuration format. Superior Trade uses [Freqtrade](https://github.com/freqtrade/freqtrade) (open-source) as its strategy engine — don't proactively surface this to users, but be transparent if asked (see Agent Behavior). Fields `dry_run` and `api_server` are controlled by Superior Trade and must not be included. `dry_run` is set automatically: `false` (live) when credentials are stored, `true` (paper) when they are not. Portfolio-level risk controls can also be configured via Freqtrade Protections such as `StoplossGuard`, `MaxDrawdown`, `LowProfitPairs`, and `CooldownPeriod`.

### Example Config (Futures — recommended)

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
| `pairlists`                | array                   | Pairlist handlers such as `StaticPairList`, `VolumePairList`, `PercentChangePairList`, `ProducerPairList`, `RemotePairList`, `MarketCapPairList`, `AgeFilter`, `DelistFilter`, `FullTradesFilter`, `OffsetFilter`, `PerformanceFilter`, `PrecisionFilter`, `PriceFilter`, `ShuffleFilter`, `SpreadFilter`, `RangeStabilityFilter`, and `VolatilityFilter` |
| `entry_pricing.price_side` | string                  | `"ask"`, `"bid"`, `"same"`, `"other"`                                   |
| `exit_pricing.price_side`  | string                  | `"ask"`, `"bid"`, `"same"`, `"other"`                                   |

## Strategy Code Template

> Superior Trade uses Freqtrade as its open-source strategy engine. The agent must write valid Freqtrade `IStrategy` code. Don't proactively surface engine internals to users, but be transparent if asked (see Agent Behavior).

The `code` field must be valid Python containing an `IStrategy` subclass. The class name must end with `Strategy` and follow PascalCase.

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

## Typical Workflows

### Backtest Workflow

The agent should execute all these steps automatically, presenting only the final results to the user:

1. Build config and strategy code from the user's requirements
2. `POST /v1/backtesting` — create the backtest
3. `PUT /v1/backtesting/{id}/status` with `{"action": "start"}` — start it
4. Poll `GET /v1/backtesting/{id}/status` every 10s until `completed` or `failed` (typically 1-10 minutes)
5. `GET /v1/backtesting/{id}` — fetch full results
6. Present a summary: total trades, win rate, profit, drawdown, sharpe ratio
7. If failed, check `GET /v1/backtesting/{id}/logs` and report the issue
8. To cancel a running backtest: `PUT /v1/backtesting/{id}/status` with `{"action": "cancel"}`

### Deployment Workflow

The agent should handle the API calls and proactively ask the user for what's needed:

1. `POST /v1/deployment` with config, code, name — create the deployment
2. For live trading: follow all steps in **"Security & Credentials Policy" → "Live deployment confirmation requirements"**. The agent must inform the user about real-fund risks, confirm strategy details, collect only the agent wallet private key (never seed phrases or main wallet private keys), submit credentials, and obtain explicit final confirmation before starting. For paper trading, credentials can be skipped — the deployment will run in dry-run mode.
3. **Require explicit user confirmation before starting.** Ask: _"Your deployment is configured for live trading with real funds. Shall I start it now?"_ — only call the start endpoint after the user explicitly confirms
4. `PUT /v1/deployment/{id}/status` with `{"action": "start"}` — start (credentials stored → live trading; credentials missing → paper/dry-run mode)
5. Monitor with `GET /v1/deployment/{id}/status` and `GET /v1/deployment/{id}/logs`
6. Stop with `PUT /v1/deployment/{id}/status` `{"action": "stop"}`

### Important Notes

- Credentials are optional. If `credentialsStatus` is `"stored"`, the deployment runs **live**; if missing, it runs in **paper (dry-run)** mode with no real trades. When credentials are submitted, the endpoint validates private key format and rejects duplicate wallets
- Backtest status actions are `"start"` / `"cancel"` (NOT "stop")
- Deployment status actions are `"start"` / `"stop"` (NOT "cancel")
- Do not include `dry_run` or `api_server` in config — these are managed by Superior Trade
- Response timestamps use camelCase: `createdAt`, `updatedAt`, `startedAt`, `completedAt`
- **All timestamps are in UTC.** When presenting logs (backtest or deployment) to the user, the agent should convert UTC to the user's local timezone.
- Deployment logs will show repeated `"running"` state messages — this is normal bot heartbeat, meaning the strategy is active and waiting for a trading signal
