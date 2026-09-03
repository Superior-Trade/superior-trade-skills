---
description: Plain-language guidance for explaining evidence returned by Unified context intelligence.
---

# Intelligence evidence glossary

Unified scan rows contain `symbol`, `category`, `score`, and `evidence`.
Single-symbol setup responses may also contain regime, levels, volatility, or
funding fields. Treat every field as optional unless it appears in the current
response.

- `computed_at` — when the context was calculated; use it to explain freshness.
- `score` — the server's ranking within the returned category, not a probability
  of profit and not investment advice.
- `evidence` — the measurements supporting the computed category or setup.
- `range_days` — how long the measured trading range has persisted.
- `distance_to_range_high_pct` — distance from the current price to the measured
  range high; smaller values can support a breakout interpretation.
- `rvol_20` — current volume relative to its 20-period baseline.
- `funding_annualized` — an annualized snapshot of perpetual funding; it can
  change rapidly and should not be treated as guaranteed carry.
- `regime` — a returned trend/range classification and any supporting indicator.
- `levels` — computed support and resistance candidates, not guaranteed floors
  or ceilings.
- `volatility` — returned measures such as ATR percentage or a historical
  percentile.
- `funding` — current funding posture and trend when the setup response includes
  it.

For any unfamiliar evidence key, describe the raw name and value conservatively
or consult current API documentation. Never infer an absent field from an older
Intelligence response format.
