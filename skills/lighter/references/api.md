---
description: Unified API routing for Lighter market context, wallet readiness, Nautilus backtests, deployments, and typed executions.
---

# Lighter through Unified API

Read [`../../../references/unified-runtime.md`](../../../references/unified-runtime.md)
for the shared lifecycle. Check `GET /context/venues`, `GET /runtime/frameworks`,
and `GET /wallet` before acting.

| Goal | Unified API |
| --- | --- |
| Discover Lighter instruments | `GET /context/markets?venue=lighter` |
| Backtest Nautilus strategy code | `POST /runtime/backtests` |
| Poll the backtest and logs | `GET /runtime/backtests/{id}`, `GET /runtime/backtests/{id}/logs` |
| Create and manage deployment | `POST /runtime/deployments`, then the `/runtime/deployments/{id}` routes |
| Run a supported one-time action | `POST /runtime/executions` |
| Inspect wallet and funding history | `GET /wallet`, `GET /wallet/deposits` |

Use instrument identifiers exactly as returned by `GET /context/markets`.
Backtest creation queues the run; there is no separate start request. Never
place an order or start live trading without current-turn confirmation.

The generic wallet history route does not create a Lighter CCTP deposit intent.
If the current OpenAPI contract does not expose the required Lighter onboarding,
deposit, or delayed-withdrawal operation, report that limitation instead of
calling a versioned endpoint.
