# Hyperliquid API Reference

Every Superior Trade endpoint used by this skill, with request and response shapes.

Reference for the `hyperliquid` skill. See SKILL.md for the workflow and safety rules.

---

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

#### GET `/v2/account/status` — REMOVED

This endpoint no longer exists; it answers `404 {"error":"not_found","message":"Route not found"}`. Do not call it, and do not treat its failure as an account problem.

The per-wallet equivalent is `GET /v2/account/{address}/status/{exchange}`. For trading-account workflows use the v3 flow above: `GET /v3/account`, `POST /v3/account/{address}/hyperliquid`, then `GET /v3/account/{address}/status/hyperliquid`.

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
  "name": "string",
  "replicas": 1,
  "status": "pending | running | stopped",
  "pods": [{ "name": "string", "status": "Running", "restarts": 0 }],
  "credentialsStatus": "stored | missing",
  "exchange": "hyperliquid",
  "executionMode": "string",
  "executionEngine": "string",
  "apiVersion": "string",
  "walletAddress": "0x... | null",
  "isDeleted": false,
  "createdAt": "ISO8601",
  "createdBy": "string",
  "updatedAt": "ISO8601",
  "updatedBy": "string"
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

> **Casing:** this endpoint returns the stored record verbatim, so its fields are **camelCase** (`credentialsStatus`, `createdAt`, `walletAddress`). The credentials endpoints below hand-map their responses and return **snake_case** (`credentials_status`, `wallet_address`). Reading the wrong one yields `undefined`, which looks exactly like "not configured". Verified against production 2026-08-12.

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

