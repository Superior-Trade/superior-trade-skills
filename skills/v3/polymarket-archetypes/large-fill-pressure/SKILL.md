---
name: large-fill-pressure
description: Use when repeated large fills suggest directional participation or informed flow.
version: 0.1.0
updated: 2026-06-17
---

# Strategy: Polymarket · Large-Fill Pressure

## When to use

Use this when the user asks about whales, big fills, unusual size, or "who is moving this market."

## What the agent should look for

- Exact market slug from `POST /v3/markets/search`.
- High-quality filled volume history with enough ticks.
- Fill sizes meaningfully above that market's recent median.
- Multiple large fills in a short interval with same-direction follow-through.
- No single fill dominating the backtest window.

## Backtest fit with filled data

Good fit for directional-signal detection, weak fit for proving source-side confidence. Filled `TradeTick` replay can show whether big prints were associated with sustained movement, but it cannot reveal maker intent, hidden liquidity, or queue position.

Treat this as an archetype template that helps generate custom Nautilus strategy code; do not imply it is a proven edge.

## Strategy logic

Count large fill clusters over a rolling window. Enter when both size and direction align with the configured cluster threshold. Exit after a fixed window, reversal signal, or price giveback.

## Nautilus strategy shape

- Keep a rolling median of recent fill sizes.
- Tag a fill as large when size exceeds a multiplier of the median.
- Track clusters of large fills by direction and time window.
- Enter after a minimum cluster size and directional confirmation.
- Exit on fixed holding duration, reverse cluster, or price retrace.

## Example strategyConfig

```json
{
  "size_window_ticks": 80,
  "large_fill_multiple": 3.0,
  "cluster_ticks": 12,
  "min_cluster_count": 3,
  "order_size": 10,
  "exit_after_ticks": 40
}
```

## Iteration knobs

| Knob | Effect |
|---|---|
| `large_fill_multiple` | Higher = only react to more unusual fills. |
| `cluster_ticks` | Lower = require tighter timing between fills. |
| `min_cluster_count` | Higher = fewer, higher-confidence entries. |
| `exit_after_ticks` | Lower = shorter reaction window. |

## Failure modes

1. A one-off large fill may be risk transfer or hedge activity, not directional pressure.
2. Fill size does not equal resting-likelihood in live execution.
3. One market can show repeated prints during low liquidity and still revert immediately.
4. Backtest quality can degrade if fill data coverage is noisy or sparse.

## User-facing framing

"This is a filled-trade pressure archetype. It uses exact slugs and `TradeTick` backtests to shape a custom Nautilus strategy, not to promise profit."
