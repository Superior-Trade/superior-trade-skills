---
description: Workflows that turn Unified context intelligence into a reviewed backtest and deployment.
---

# Intelligence workflows

## Open-ended discovery

1. Call `GET /context/scan?bucket=all&category=all&top_n=10`.
2. Present two or three returned symbols with their category, score, evidence,
   and computation time when available.
3. Ask which symbol the user wants to inspect. Do not auto-deploy.

When the user requests a narrower universe or signal family, map their request
to the documented `bucket` and `category` values rather than inventing filters.

## Single-symbol drilldown

1. Resolve the canonical symbol with `GET /context/markets`.
2. Call `GET /context/setup/{symbol}` using its URL-encoded canonical value.
3. Present only returned fields and cite the evidence behind the setup.
4. Select an appropriate strategy skill based on the evidence and user thesis.
5. Ask whether to backtest. If yes, create the run with
   `POST /runtime/backtests` using fields from Unified OpenAPI.
6. Review sample size, profit, drawdown, and failure logs. Do not promote a
   strategy solely because its live context score is high.
7. If the user later chooses deployment, create it with
   `POST /runtime/deployments`, show the exact live configuration and risk, and
   require explicit confirmation before starting it through
   `PUT /runtime/deployments/{id}/status`.

## Comparison

For cross-category or cross-symbol questions, compare only values returned in
the same scan response. Scores from different categories may use different
evidence and should not be treated as directly interchangeable unless the
current API documentation says they are.

## Monitoring

`GET /context/scan` is authenticated and rate-limited. Poll no faster than the
engine cadence shown by `computed_at`; repeated calls within that cadence add no
new evidence.

Never substitute cached model knowledge for a failed context call, rewrite the
server's score, or place capital from a scan without a setup review and
backtest.
