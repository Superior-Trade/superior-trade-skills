---
name: probability-mean-reversion
description: Use when a Polymarket outcome appears to overreact and then stall away from recent filled-price range.
version: 0.1.0
updated: 2026-06-17
---

# Strategy: Polymarket · Probability Mean Reversion

## When to use

Use this when someone asks for fade, overreaction, mean reversion, range trading, panic buy, euphoria selloff, or probability jumps with weak follow-through.

## What the agent should look for

- Exact market slug from `POST /v3/markets/search`.
- A stable market with enough historical fills.
- Probability significantly far from a rolling median.
- Weak follow-through after the jump.
- No fresh catalyst changing the thesis.
- Enough time before resolution to allow drift back.

## Backtest fit with filled data

Moderate fit. Filled `TradeTick` history can test whether probability moves have a measurable reversion pattern, while using actual fills as the execution proxy.

Limit: backtests cannot validate resting liquidity, spread paid, or what is missed in the maker queue.

## Strategy logic

Enter when the outcome trades below a lower band and exit near the rolling median. If your implementation permits, do the inverse for above-band conditions when downside overextension appears.

## Nautilus strategy shape

- Keep a rolling window of trade prices.
- Compute median and deviation thresholds.
- Enter only after sufficient tick history is collected.
- Exit on median reversion or max holding ticks.

## Example strategyConfig

```json
{
  "window_ticks": 40,
  "entry_deviation": 0.08,
  "exit_deviation": 0.02,
  "order_size": 10,
  "max_holding_ticks": 80
}
```

## Iteration knobs

| Knob | Effect |
|---|---|
| `window_ticks` | Larger windows produce a smoother baseline. |
| `entry_deviation` | Higher values wait for stronger overreactions. |
| `exit_deviation` | Lower values demand tighter reversion before exit. |
| `max_holding_ticks` | Prevents stale positions through stale conditions. |

## Failure modes

1. Real information shocks rarely mean-revert.
2. Markets near resolution can trend cleanly to 0 or 1.
3. Low liquidity can create fake extremes.
4. Backtests may look strong when spread and order-book pressure are ignored.

## User-facing framing

"This is an overreaction fade. It works best in noisy markets without new decisive information. I’ll backtest it on filled prices first, then verify trade frequency and liquidity before suggesting live use."
