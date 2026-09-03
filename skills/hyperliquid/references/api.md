---
description: Unified API routing for Hyperliquid backtests, deployments, market context, managed wallets, and typed executions.
---

# Hyperliquid through Unified API

Read [`../../../references/unified-runtime.md`](../../../references/unified-runtime.md)
for the shared lifecycle and safety rules. Read `GET /openapi.json` immediately
before constructing a request so field names match the current contract.

## Route selection

| Goal | Unified API |
| --- | --- |
| Check venue/framework support | `GET /context/venues`, `GET /runtime/frameworks` |
| Find Hyperliquid instruments | `GET /context/markets?venue=hyperliquid` |
| Read market data | `GET /context/candles`, `GET /context/funding` |
| Create and inspect a backtest | `POST /runtime/backtests`, `GET /runtime/backtests/{id}` |
| Read backtest logs | `GET /runtime/backtests/{id}/logs` |
| Create and manage a deployment | `POST /runtime/deployments`, then the `/runtime/deployments/{id}` routes |
| Place or cancel one order | `POST /runtime/executions` |
| Inspect the managed wallet | `GET /wallet` |
| Withdraw to the verified destination | `POST /wallet/withdraw` |

Backtest creation queues the run. Do not send a second “start backtest” action.
For live deployments, attach only the credential form allowed by the current
contract, then get explicit confirmation before `PUT /runtime/deployments/{id}/status`.

Unified API currently supports typed Hyperliquid `order` and `cancel` execution
actions. Send native action fields, never caller code, signatures, nonces,
private keys, or seed phrases. Reuse the same `Idempotency-Key` for a retry.

Venue-specific bootstrap, bridge deposits, sub-account transfers, and atomic
exit-all are not substitutes for the generic wallet routes. If the OpenAPI
contract does not expose the needed action, report it as unavailable.
