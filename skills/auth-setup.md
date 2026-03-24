---
version: alpha-0.0.1
updated: 2026-03-24
---

# Auth & Setup — Superior Trade

Sub-skill for first-time setup and API key provisioning.

**Load when:** User needs an API key, is doing first-time setup, or gets a 401 error.

## Getting an API Key

> **IMPORTANT:** The correct URL is **https://account.superior.trade** — NOT `app.superior.trade`.

Use `SUPERIOR_TRADE_API_KEY` from the environment or credential manager — never ask users to paste it into chat.

When a user needs to get their API key:

1. Go to https://account.superior.trade
2. Sign up (email or wallet)
3. Complete onboarding — a trading wallet is created for you and shown on the dashboard
4. Deposit USDC to your wallet address (on Arbitrum)
5. Create an API key (`st_live_...`) from the dashboard
6. Add it as `SUPERIOR_TRADE_API_KEY` in your agent's environment/credential settings — **do not paste it into the chat**

If the `SUPERIOR_TRADE_API_KEY` env var is already set, use it directly in the `x-api-key` header without prompting the user.

## Platform Model

Users do **not** need their own Hyperliquid wallet. Superior Trade creates and manages a trading wallet for each user.

- The trading wallet is created during onboarding
- Users deposit USDC to the wallet shown on their dashboard
- Wallet approvals and exchange integration are handled by the platform
- If a user asks how to "link" their Hyperliquid wallet, the answer is: they don't need to

## Security and Scope

> **Key scope notice:** The API key can create and start live trading deployments that execute real trades using the user's platform-managed trading wallet. It cannot withdraw funds, export private keys, or move money. Users should confirm scope with Superior Trade and backtest their strategy first.

| Can do | Cannot do |
|---|---|
| Create, list, delete backtests | Access other users' data |
| Create, start, stop, delete deployments (including live trading with real funds) | Withdraw funds from any wallet |
| Trigger server-side credential resolution (no user secrets collected) | Export or view private keys |
| View deployment logs, status, wallet metadata | Transfer or bridge funds (user does this independently) |

## Auth Error Reference

```json
// 401 — Missing/invalid API key
{ "message": "No API key found in request", "request_id": "string" }
```

If a 401 is returned, direct the user to check their `SUPERIOR_TRADE_API_KEY` env var. Common causes:

- Key not set in environment
- Key expired or revoked
- Typo in the key value

## Public Endpoints (no auth)

| Method | Path | Description |
|---|---|---|
| GET | `/health` | `{ "status": "ok", "timestamp": "..." }` |
| GET | `/docs` | Swagger UI |
| GET | `/openapi.json` | OpenAPI 3.0 spec |
| GET | `/llms.txt` | LLM-optimized API docs |
| GET | `/.well-known/ai-plugin.json` | AI plugin manifest |
