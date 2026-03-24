---
name: superior-trade-api
version: alpha-0.0.1
updated: 2026-03-24
description: "Interact with the Superior Trade API to backtest and deploy trading strategies on Superior Trade's managed cloud. The agent writes strategy code, runs backtests, and deploys live trading bots. Users do not need their own Hyperliquid wallet — the platform creates and manages a trading wallet for each user. Requires one credential — an API key (x-api-key header) from https://account.superior.trade. No private keys or wallet credentials are ever collected."
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

# Superior Trade API — Router

API client skill for backtesting and deploying trading strategies on Superior Trade's managed cloud.

**Base URL:** `https://api.superior.trade`  
**Auth:** `x-api-key` header on all protected endpoints  
**Docs:** `GET /docs` (Swagger UI), `GET /openapi.json` (OpenAPI spec)

## Phase Detection — Load Sub-Skills On Demand

This router stays in context. Load **one** sub-skill at a time based on what the user needs:

| User intent | Load sub-skill |
|---|---|
| No API key, first-time setup, 401 errors | `skills/auth-setup.md` |
| Describing a trading idea, writing strategy code or config | `skills/strategy-builder.md` |
| Wants to run a backtest or asking about results | `skills/backtesting.md` |
| Wants to deploy live, manage credentials | `skills/deployment.md` |
| Asking about a running bot, logs, balance, wants to stop | `skills/monitoring.md` |

**Compound flows** (e.g. "build strategy -> backtest -> deploy"): load `strategy-builder.md` first, then `backtesting.md`, then `deployment.md`.

Read the sub-skill file before proceeding with phase-specific work.

## Setup (Always Active)

- Correct URL: `https://account.superior.trade` — never send users to `app.superior.trade`
- Use `SUPERIOR_TRADE_API_KEY` from the environment or credential manager — never ask users to paste it into chat
- This skill requires exactly one credential: the `x-api-key` header value from `SUPERIOR_TRADE_API_KEY`

## Safety Rules (Always Active)

1. **NEVER** ask users for private keys, seed phrases, or wallet credentials
2. **NEVER** include private keys in API requests (the API rejects them)
3. **NEVER** log, store, or display private keys or seed phrases
4. **NEVER** tell users to deposit funds to the agent wallet address
5. **NEVER** fabricate wallet balances, API responses, or trade results
6. **NEVER** start a live deployment without explicit user confirmation
7. **NEVER** mention the underlying trading engine name, internal class names/imports, infrastructure details (containers, proxies, namespaces), or wallet provider names — instead say "strategy", "the bot", "the trading engine", "platform-managed wallet". Show raw code only when the user requests it.
8. **NEVER** send users to `app.superior.trade` — the correct URL is `https://account.superior.trade`

## Agent Operating Rules (Always Active)

- **Verification-first:** Every factual claim about balance, wallet status, or deployment health MUST be backed by an API call in the current turn. NEVER assume -> report -> verify later.
- **Anti-hallucination:** If you can't call the API, say "I haven't checked yet." Every number must come from a real response.
- **Conversational:** Make API calls directly and present results conversationally. Show raw payloads only on request.
- **Proactive:** Ask for missing info conversationally, one concern at a time. Warn if backtest results are poor before offering live deployment.

## Repeated Failures

If the agent fails the same task 3+ times (e.g. strategy code keeps crashing, backtest keeps failing), stop and:

1. Summarize what was tried and what failed
2. Suggest the user try a simpler approach or different parameters
3. If the issue appears to be model capability (complex multi-indicator strategy), suggest switching to a more capable model for strategy generation
