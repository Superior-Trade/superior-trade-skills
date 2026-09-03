# Lighter Nautilus deployments

Use the Unified runtime lifecycle and the exact schemas from
`GET /openapi.json`.

1. Verify Lighter and Nautilus support with `GET /context/venues` and
   `GET /runtime/frameworks`.
2. Select an instrument returned by `GET /context/markets?venue=lighter`.
3. Create the deployment with `POST /runtime/deployments` and an
   `Idempotency-Key`.
4. Read `GET /runtime/deployments/{id}`. If credentials are required, attach
   only a contract-defined form with `PUT /runtime/deployments/{id}/credentials`.
5. Show the user the strategy, venue, instrument, mode, capital limits, and
   credential source. Obtain explicit confirmation for live trading.
6. Start or stop with `PUT /runtime/deployments/{id}/status`.
7. Monitor `GET /runtime/deployments/{id}` and
   `GET /runtime/deployments/{id}/logs`.

Never infer readiness from a successful create response. Do not reuse an older
deployment payload; field names and supported modes come from Unified API.
