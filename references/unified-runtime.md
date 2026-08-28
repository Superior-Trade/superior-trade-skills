# Unified API runtime compatibility

Use the Unified API first for Phase 1 workflows. Its production base URL is
`https://unified-api-zag4gzx6gq-an.a.run.app`; use `SUPERIOR_UNIFIED_API_URL`
when the agent environment supplies a different base URL. Authenticate with
`x-api-key: $SUPERIOR_TRADE_API_KEY`.

Read `GET /openapi.json` when an exact request or response shape is needed.
Use `GET /.well-known/mcp.json` to discover the authenticated MCP endpoint.

## Primary runtime workflow

1. Discover supported venue/framework combinations with `GET /context/venues`
   and `GET /runtime/frameworks`.
2. Create and inspect backtests with `POST /runtime/backtests`,
   `GET /runtime/backtests/{id}`, and `GET /runtime/backtests/{id}/logs`.
3. Create and manage deployments with `POST /runtime/deployments`,
   `GET /runtime/deployments/{id}`, `PUT /runtime/deployments/{id}/credentials`,
   `PUT /runtime/deployments/{id}/status`, and `GET /runtime/deployments/{id}/logs`.
4. Create and monitor individual executions with `POST /runtime/executions`,
   `GET /runtime/executions/{id}`, and `GET /runtime/executions/{id}/logs`.

Never start a live deployment or execution without explicit confirmation in the
current turn. Fetch the resulting resource or logs before reporting its status.

## Temporary legacy compatibility

Use a legacy `/v2` or `/v3` endpoint only when the Unified OpenAPI contract
does not expose the required operation or its required venue/framework input.
State that fallback explicitly, keep the operation within the relevant venue
skill, and do not substitute a legacy route merely because it is familiar.

| Unified capability | Legacy fallback during migration |
| --- | --- |
| Backtest lifecycle | `/v2/backtesting` or `/v3/backtest` |
| Deployment lifecycle | `/v2/deployment` or `/v3/deployments` |
| Venue-specific account setup/readiness | `/v3/account/{address}/{venue}` and its status route |

Do not use a fallback for account, wallet, context, runtime discovery, or MCP
operations that the Unified API already exposes.
