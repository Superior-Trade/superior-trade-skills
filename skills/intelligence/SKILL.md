---
name: intelligence
description: "Use when the user asks what's hot, what's moving, if there's any alpha, what's the setup on a symbol, or any market-scan or single-symbol drilldown question. Uses Superior Trade Unified context data and its evidence fields rather than stale training data."
metadata:
  version: 0.2.0
  updated: 2026-09-03
---

# Intelligence

Use Unified API market intelligence to rank current setups and inspect one
canonical symbol. Read the returned evidence; never treat a score as advice.

## Files in this skill

| File | What it covers |
|---|---|
| [`references/api.md`](references/api.md) | Unified scan/setup parameters and contract-shaped examples. |
| [`references/workflow.md`](references/workflow.md) | Scan → setup → backtest → deploy workflows. |
| [`references/buckets.md`](references/buckets.md) | Optional strategy lenses for interpreting evidence; these are not Unified response categories. |
| [`references/glossary.md`](references/glossary.md) | How to explain common evidence fields without assuming they are always present. |

## Route selection

- List/ranking question → `GET /context/scan`. Use `bucket=all` for an
  open-ended scan, or `alts`/`hip3` when the user narrows the universe. Use
  `category=all` unless they explicitly request `momentum`, `mean_reversion`,
  `breakout`, or `volume`. `top_n` defaults to 10 and must not exceed 50.
- Single-symbol question → first resolve a canonical symbol with
  `GET /context/markets`, then call `GET /context/setup/{symbol}` with the
  URL-encoded canonical value.

## Presenting results

1. State `computed_at` when the response includes it.
2. Present the returned `symbol`, `category`, and `score` without renaming them
   to an older bucket taxonomy.
3. Cite the exact `evidence` values returned for each conclusion.
4. Treat setup fields such as regime, levels, volatility, and funding as
   optional unless they appear in the response.
5. Before recommending capital, apply an appropriate strategy lens, run a
   backtest, and explain the principal risk.

Never manufacture an empty or unavailable scan from training data. Scores are
deterministic market computations, not guarantees or a signal service.
