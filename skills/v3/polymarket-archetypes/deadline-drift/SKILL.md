---
name: deadline-drift
description: Use when a Polymarket market probability changes as the resolution deadline approaches.
version: 0.1.0
updated: 2026-06-17
---

# Strategy: Polymarket · Deadline Drift

## When to use

Use this for before-date contracts, monthly/weekly threshold markets, election timing markets, or requests where time remaining is the core thesis.

## What the agent should look for

- Exact market slug from `POST /v3/markets/search`.
- Reliable `market_end` from market metadata.
- Time remaining during the candidate backtest window.
- Probability drift near deadline in the filled history.
- Whether the market reprices gradually or with sharp catalyst jumps.
- User preference for holding to settlement or exiting earlier.

## Backtest fit with filled data

Moderate fit. Filled `TradeTick` data can show whether price drifted in line with deadline pressure and whether exits would usually occur before binary resolution.

Limit: this does not produce true fair-probability forecasts; it only tests historical price behavior around deadlines.

## Strategy logic

Enter when drift aligns with time decay or deadline acceleration. Exit before settlement unless the user explicitly asks for binary exposure into resolution.

## Nautilus strategy shape

- Use `on_trade_tick`.
- Compare trade timestamp to `market_end`.
- Trade only between `min_days_to_end` and `max_days_to_end`.
- Exit using an `exit_buffer_hours` cutoff.

## Example strategyConfig

```json
{
  "market_end": "2026-07-01T00:00:00Z",
  "min_days_to_end": 2,
  "max_days_to_end": 21,
  "drift_threshold": 0.015,
  "order_size": 10,
  "exit_buffer_hours": 12
}
```

## Iteration knobs

| Knob | Effect |
|---|---|
| `min_days_to_end` | Avoids entering too close to settlement. |
| `max_days_to_end` | Avoids entering when the deadline is still distant. |
| `drift_threshold` | Higher values require stronger deadline repricing. |
| `exit_buffer_hours` | Larger buffers reduce resolution timing risk. |

## Failure modes

1. Market rules can resolve differently than expected.
2. Event risk can overwhelm smooth drift behavior.
3. Short windows overfit to one cycle.
4. Holding through settlement can produce binary outcomes unrelated to interim PnL.

## User-facing framing

"This strategy trades deadline pressure, not certainty. I will backtest on filled TradeTicks to check whether the historical price drift is consistent and tradable, then suggest only cautious position sizing."
