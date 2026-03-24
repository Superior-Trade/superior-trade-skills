---
version: alpha-0.0.1
updated: 2026-03-24
---

# Monitoring — Superior Trade

Sub-skill for monitoring running deployments, checking status, and handling stops.

**Load when:** User asks about a running deployment's status, logs, balance, or wants to stop/delete it.

## Status and Logs

### GET `/v2/deployment/{id}/status` — Live Status

Response: `{ "id": "string", "status": "string", "replicas": 1, "available_replicas": 1, "pods": null }`

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

### GET `/v2/deployment/{id}/logs`

Query: `pageSize` (default 100), `pageToken`. Response: `{ "items": [{ "timestamp": "ISO8601", "message": "string", "severity": "string" }], "nextCursor": "string | null" }`

## Log Interpretation

- **Heartbeat messages are normal** — the bot sends periodic heartbeats to confirm it's alive
- **"Analyzing candle"** — bot is checking strategy conditions on the latest candle
- **"Buying"/"Selling"** — trade execution
- **Rate limit warnings** — reduce API calls, consider stopping if persistent

## Diagnosing Zero-Trade Deployments

Check in order:

1. **Main wallet balance** — agent wallet $0 is normal; check the platform-managed main wallet
2. **`stake_amount`** — if `"unlimited"`, redeploy with explicit numeric amount slightly below balance
3. **Credentials** — verify `credentials_status: "stored"` and `WALLET_ADDRESS` in startup logs
4. **Strategy conditions** — check if entry conditions are met on recent candles
5. **Logs** — check for rate limits, exchange rejections, pair errors
6. **Pair validity** — verify pair is active on Hyperliquid

## Silent Failure Modes (CRITICAL)

Some failures produce **zero diagnostic output** — just heartbeats, no errors:

1. **`stake_amount: "unlimited"` with insufficient balance** — bot runs, zero trades, zero errors
2. **Main wallet has $0** — same symptom
3. **Balance below effective minimum** — same symptom

**Key signal:** Heartbeats but zero "Analyzing candle" or order lines after 5+ minutes = balance/stake issue.

## Rate Limit Mitigation

Hyperliquid enforces rate limits. Aggressive retries, tight loops, or extra exchange traffic from strategy code can trigger **429** responses and unstable behavior.

**Prevention:**

- Set `process_only_new_candles = True` so the bot does not reprocess every candle unnecessarily
- Prefer candle-close pricing for exits where it fits the strategy (fewer edge-case order updates)
- Do not add **custom polling** of Hyperliquid's API (or other heavy network work) inside hot strategy paths — it stacks on top of normal bot traffic

**If you see rate limits or 429s in logs:**

- Avoid rapid stop/start cycles; that often worsens retries against the limit
- After the deployment stops, wait several minutes before starting again; if the issue persists, simplify the strategy or reduce anything that drives extra exchange requests

## Stop and Delete

### Stop — `PUT /v2/deployment/{id}/status`

```json
{ "action": "stop" }
```

The platform cancels all open orders and closes all positions on Hyperliquid before stopping.

### Delete — `DELETE /v2/deployment/{id}`

Closes all positions and orders before deleting. Response: `{ "message": "Deployment deleted" }`

## Balance Checks

Always check the **main wallet** (platform-managed trading wallet), NOT the agent wallet.

These are read-only, unauthenticated queries to Hyperliquid's public API. The wallet address sent is public on-chain data — not a secret. No API keys, private keys, or auth tokens are included.

```
POST https://api.hyperliquid.xyz/info

// Perps balance
{"type":"clearinghouseState","user":"<MAIN_WALLET_ADDRESS>"}

// Spot balance
{"type":"spotClearinghouseState","user":"<MAIN_WALLET_ADDRESS>"}
```

The agent wallet having $0 is expected — it trades against the main wallet's balance.

### Unified vs Legacy Account Mode

Hyperliquid accounts may run in **unified mode** (single balance) or **legacy mode** (separate spot/perps balances). Do NOT assume which mode the user has.

- If perps shows $0 but spot shows funds, ask about unified mode before suggesting the user move funds themselves.
- In unified mode, spot USDC is automatically available as perps collateral.

## Timezone Reminder

All API timestamps are in **UTC (ISO8601)**. Convert to the user's local timezone when presenting times conversationally. If timezone is unknown, show both UTC and ask.
