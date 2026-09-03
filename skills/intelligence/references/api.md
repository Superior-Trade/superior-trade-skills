---
description: Unified API reference for market scans and single-symbol setup context.
---

# Intelligence through Unified API

Use the base URL and authentication rules from
[`../../../references/unified-runtime.md`](../../../references/unified-runtime.md).
Read `GET /openapi.json` before relying on fields not documented here.

## `GET /context/scan`

Query parameters:

| Parameter | Values | Default/limit |
|---|---|---|
| `bucket` | `alts`, `hip3`, `all` | Use `all` for open-ended scans |
| `category` | `momentum`, `mean_reversion`, `breakout`, `volume`, `all` | Use `all` unless the user narrows it |
| `top_n` | integer | Default 10, maximum 50 |

The documented response contains `computed_at` plus ranked `results`. Each row
uses a canonical `symbol`, a `category`, a numeric `score`, and an `evidence`
object containing the measurements behind the ranking. Do not map those fields
to an older bucket response shape.

## `GET /context/setup/{symbol}`

Resolve the canonical symbol through `GET /context/markets`, URL-encode it, and
place it in the path. The setup response may include current regime, levels,
volatility, funding posture, and evidence. Present only fields returned by the
current response.

Scores and setup descriptions are computed context, not advice. Cite evidence,
then backtest a strategy before recommending deployment.
