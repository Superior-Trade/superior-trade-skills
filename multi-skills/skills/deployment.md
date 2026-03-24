---
version: alpha-0.0.1
updated: 2026-03-24
---

# Deployment — Superior Trade

Sub-skill for deploying live trading bots.

**Load when:** User wants to go live or manage deployment credentials.

## Live Deployment Confirmation

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

### Wallet Architecture

Superior Trade uses Hyperliquid's native **agent wallet** pattern. Users do NOT need their own Hyperliquid wallet — everything is managed by the platform.

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

## Deployment Workflow

1. `POST /v2/deployment` with config, code, name
2. `POST /v2/deployment/{id}/credentials` with `{ "exchange": "hyperliquid" }` — server assigns wallet automatically (**required** before live start; there is no paper/dry-run deployment mode)
3. Run the pre-deployment checklist
4. Show the live deployment confirmation summary and wait for explicit user confirmation
5. `PUT /v2/deployment/{id}/status` -> `{"action": "start"}`
6. Monitor: `GET /v2/deployment/{id}/status`, `GET /v2/deployment/{id}/logs`
7. Stop: `PUT /v2/deployment/{id}/status` -> `{"action": "stop"}`

## Pre-Deployment Checklist (MANDATORY)

Before `PUT /v2/deployment/{id}/status` -> `{"action":"start"}`:

1. **Credentials stored** — `GET /v2/deployment/{id}` -> `credentials_status: "stored"`. If not, call `POST /v2/deployment/{id}/credentials`.
2. **Identify wallets** — `GET /v2/deployment/{id}/credentials` -> note `wallet_address` (agent wallet) and `agent_wallet_address`.
3. **Funds available in main wallet** — Check the **main wallet** (platform-managed trading wallet), NOT the agent wallet. Agent wallet having $0 is normal. Query `clearinghouseState` + `spotClearinghouseState` on the public Hyperliquid info endpoint (read-only, sends public wallet address only — no secrets).
4. **Pair is tradeable** — `POST https://api.hyperliquid.xyz/info` -> `{"type":"meta"}` and verify pair exists.

Do NOT skip any step or assume it passed without the API call.

## API Reference

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

### GET `/v2/deployment/{id}/status` — Live Status

Response: `{ "id": "string", "status": "string", "replicas": 1, "available_replicas": 1, "pods": null }`

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

**Credential update procedure:** (1) Stop the deployment -> (2) Delete the deployment -> (3) Create a new deployment with same config/code -> (4) Store new credentials.

**One-wallet-per-deployment rule:** Each deployment uses one wallet and runs as an isolated container. For multiple strategies on the same wallet, use multiple deployments pointing to the same wallet address.

### GET `/v2/deployment/{id}/credentials` — Credential Info

Does NOT return private keys. Response: `{ "id", "credentials_status": "stored | missing", "exchange", "wallet_address", "wallet_source": "main_trading_wallet | provided", "wallet_type": "main_wallet | agent_wallet", "agent_wallet_address" }`. If missing: `{ "credentials_status": "missing" }`.

### DELETE `/v2/deployment/{id}`

Closes all positions and orders on Hyperliquid before deleting. Response: `{ "message": "Deployment deleted" }`. Deleting stopped deployments may return 500 — safe to ignore.

### Logs — GET `/v2/deployment/{id}/logs`

Query: `pageSize` (default 100), `pageToken`. Response: `{ "items": [{ "timestamp": "ISO8601", "message": "string", "severity": "string" }], "nextCursor": "string | null" }`

### Paginated Lists

`GET /v2/deployment` returns `{ "items": [], "nextCursor": "string | null" }`. Pass `cursor` query param to paginate.
