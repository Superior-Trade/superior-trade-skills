---
name: lighter
description: "Use when researching, backtesting, deploying, or running a supported one-time Lighter action through the Superior Trade Unified API."
metadata:
  version: 1.0.2
  updated: 2026-07-22
  homepage: https://account.superior.trade
  source: https://github.com/Superior-Trade
  primaryEnv: SUPERIOR_TRADE_API_KEY
  auth:
    type: api_key
    env: SUPERIOR_TRADE_API_KEY
    header: x-api-key
    scope: "Read the user's Unified wallet and Lighter market context, and manage contract-supported Nautilus backtests and deployments. One-time actions, venue-specific onboarding, deposits, and withdrawals are available only when the Unified OpenAPI contract explicitly exposes them. Cannot export private keys or access other users' data."
  env:
    - name: SUPERIOR_TRADE_API_KEY
      description: "Superior Trade API key (x-api-key header). Obtained at https://account.superior.trade. Used for Unified wallet reads, market context, backtests, and contract-supported Lighter deployments."
      required: true
      type: api_key
  externalEndpoints:
    - url: https://unified-api-zag4gzx6gq-an.a.run.app
      purpose: "Unified Lighter market context, wallet reads, backtests, and deployments"
---

# Superior Trade Lighter

Use this skill for Lighter market discovery, Nautilus backtests and deployments,
managed-wallet checks, and supported typed executions through Unified API.

Read [`../../references/unified-runtime.md`](../../references/unified-runtime.md)
before making any request. The OpenAPI contract, not older venue workflows,
defines which Lighter operations are available.

**Base URL:** `https://unified-api-zag4gzx6gq-an.a.run.app`
**Auth:** `x-api-key: $SUPERIOR_TRADE_API_KEY`
**Venue config:** `{ "venue": "lighter", "instrument_id": "<SYMBOL>.LIGHTER" }`

## Unified API only

Read [`../../references/unified-runtime.md`](../../references/unified-runtime.md)
before onboarding, backtesting, deployment, or execution. Use `GET /context/venues`
and `GET /runtime/frameworks` first, then the Unified runtime endpoints. If the
contract does not expose the required Lighter operation, report it as
unavailable.

## Robinhood Chain Variant

Use the separate `lighter-robinhood` skill and venue name for Robinhood Chain Lighter. Do not treat `lighter-robinhood` as an alias for this default `lighter` profile; it uses a different venue profile, chain id, deposit asset, and instrument suffix.

## Safety Rules

- Never ask for private keys, seed phrases, API private keys, passwords, or wallet credentials.
- Never log, echo, store, or display secrets. The only credential an agent should use is `SUPERIOR_TRADE_API_KEY`.
- Never move funds or start live trading without explicit user confirmation.
- Never submit a Lighter order without explicit user confirmation of market, side, size, order type, and risk.
- Treat any contract-supported Lighter deposit or withdrawal as a real fund-moving action.
- Do not retry an ambiguous execution or withdrawal automatically. Read its durable status and report the persisted state.
- Do not claim managed-wallet funds are available on Lighter unless Unified API returns the required readiness and balance evidence.
- Do not claim Lighter readiness or balance without querying the API.
- If onboarding, CCTP funding, delayed withdrawal, or signed proxy submission is
  absent from `GET /openapi.json`, report it as unavailable.

## Account readiness

Read the managed wallet with `GET /wallet` and venue support with
`GET /context/venues`. Do not infer a Lighter-specific account state machine
from generic wallet history. If Unified API does not return the readiness data
needed for a live deployment, report the deployment as unavailable rather than
reusing an older onboarding flow.
## Reference files

Load on demand.

| Read | When |
| --- | --- |
| `references/api.md` | You need Unified routing for market context, wallet readiness, backtests, deployments, or supported typed executions. |
| `references/deployment.md` | You are creating, starting, stopping or monitoring a Lighter Nautilus deployment. |


## Related Skills

- Use `superior-trade-auth` first when the user needs an API key.
- Use `trade-thesis` before deploying a new live strategy idea.
- Use `hyperliquid` for Hyperliquid workflows. Lighter deployments use the same Unified runtime lifecycle with the Nautilus framework.
