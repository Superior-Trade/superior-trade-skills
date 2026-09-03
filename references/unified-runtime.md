# Unified API

Use the Unified API for every Superior Trade operation documented by this
package.

- Base URL: `${SUPERIOR_UNIFIED_API_URL:-https://unified-api-zag4gzx6gq-an.a.run.app}`
- Authentication: `x-api-key: $SUPERIOR_TRADE_API_KEY`
- Contract: `GET /openapi.json`
- MCP discovery: `GET /.well-known/mcp.json`

Request and response shapes come from the OpenAPI contract. Do not reuse a
payload from an older API solely because its resource name looks similar.

## Workflow

1. Read `GET /account`, `GET /wallet`, `GET /context/venues`, and
   `GET /runtime/frameworks` before selecting a venue/runtime combination.
2. Discover instruments and data with `GET /context/markets`,
   `GET /context/datasets`, `GET /context/candles`, `GET /context/funding`,
   `GET /context/scan`, and `GET /context/setup/{symbol}`.
3. Create a backtest with `POST /runtime/backtests`. Creation queues the run;
   there is no separate start request. Poll `GET /runtime/backtests/{id}` and
   inspect `GET /runtime/backtests/{id}/logs`. Cancel or remove it with
   `DELETE /runtime/backtests/{id}`.
4. Create a deployment with `POST /runtime/deployments`. Update metadata with
   `PATCH /runtime/deployments/{id}`, attach credentials with
   `PUT /runtime/deployments/{id}/credentials`, and start or stop it with
   `PUT /runtime/deployments/{id}/status`. Read the deployment, logs, and
   metrics before reporting its state.
5. Use `POST /runtime/executions` for a supported one-time venue action. Reuse
   the same `Idempotency-Key` for retries and poll
   `GET /runtime/executions/{id}` for the durable sanitized result. The current
   contract supports Hyperliquid `order`/`cancel` and Polymarket
   `placeMarketOrder`/`cancelOrder`. Send only the typed venue action—never
   caller code, credentials, signatures, private keys, or nonces.

Never start live trading, place or cancel an order, delete a deployment, or
withdraw funds without explicit confirmation for the exact action in the
current conversation.

## Accounts and funding

Register with `POST /account/register`, verify the OTP with
`POST /account/verify`, then keep the returned key in the normal credential
store. `GET /wallet` returns the managed wallet, deposit details, balances, and
readiness exposed by Unified API. `GET /wallet/deposits` and
`GET /wallet/withdrawals` are history reads. Withdraw through
`POST /wallet/withdraw` only after confirmation.

If a venue-specific bootstrap, deposit, transfer, or exit action is not present
in `GET /openapi.json`, report that it is unavailable through Unified API. Do
not fall back to a versioned API.
