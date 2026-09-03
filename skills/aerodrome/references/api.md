---
description: Unified API routing and capability checks for Aerodrome backtests and deployments.
---

# Aerodrome through Unified API

Read [`../../../references/unified-runtime.md`](../../../references/unified-runtime.md)
and check `GET /context/venues` plus `GET /runtime/frameworks` before creating a
request. Proceed only when the returned capability metadata supports the
Aerodrome venue and selected framework.

Use `GET /runtime/backtests/dataset` to discover a supported dataset,
`POST /runtime/backtests` to queue the run, and
`GET /runtime/backtests/{id}` plus `GET /runtime/backtests/{id}/logs` to inspect
it. Use `POST /runtime/deployments` and the standard deployment lifecycle for
paper or live operation.

Aerodrome uses the managed wallet returned by `GET /wallet`. The wallet must
already hold the required Base assets and gas. If Unified API reports the venue
or framework as unavailable, stop; do not redirect the agent to a versioned
endpoint.
