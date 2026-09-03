---
description: Unified API routing for Polymarket discovery, Nautilus backtests, deployments, managed wallets, and typed orders.
---

# Polymarket through Unified API

Read [`../../../references/unified-runtime.md`](../../../references/unified-runtime.md)
for shared request, lifecycle, idempotency, and confirmation rules.

## Route selection

| Goal | Unified API |
| --- | --- |
| Discover markets | `GET /context/markets?venue=polymarket` |
| Check datasets and coverage | `GET /context/datasets` |
| Create and inspect a backtest | `POST /runtime/backtests`, `GET /runtime/backtests/{id}` |
| Read backtest logs | `GET /runtime/backtests/{id}/logs` |
| Create and manage a deployment | `POST /runtime/deployments`, then the `/runtime/deployments/{id}` routes |
| Place or cancel one order | `POST /runtime/executions` |
| Inspect the managed wallet | `GET /wallet` |

Use the canonical symbol and framework-specific identifier returned by
`GET /context/markets`. Confirm that the market is backtest-ready and that the
requested range fits a dataset before submitting strategy source.

Unified API typed executions support Polymarket `placeMarketOrder` and
`cancelOrder`. Send the venue action only; never send user code, credentials,
signatures, private keys, or nonces. Show the exact order or cancellation and
obtain explicit confirmation before submission. Reuse the same
`Idempotency-Key` for a retry.

Market discovery is a `GET`, not a search mutation. Venue-specific onboarding,
pUSD wrapping, and portfolio exit are available only if listed by
`GET /openapi.json`; otherwise report them as unavailable.
