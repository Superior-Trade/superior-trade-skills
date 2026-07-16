---
name: probability-momentum
description: Use when a Polymarket outcome price and filled volume are accelerating in the same direction.
version: 0.1.0
updated: 2026-06-17
---

# Strategy: Polymarket · Probability Momentum

## When to use

Use this when someone asks for momentum, trend following, breakout, follow-the-crowd behavior, fast-moving crypto milestones, or rapid probability acceleration.

## What the agent should look for

- Exact market slug from `POST /v3/markets/search`.
- `backtestSupported: true`.
- Sufficient filled-trade history for the requested lookback window.
- Rising probability on last-trade filled ticks.
- Elevated fill counts or larger notional during the move.
- Market not too close to resolution unless user explicitly accepts expiry risk.

## Backtest fit with filled data

Good fit for this archetype. Filled `TradeTick` history can validate whether momentum would have produced fill-driven entries, exits, and directional exposure.

Limit: filled-trade backtests do not prove maker queue position, maker rebates, or order-book depth. Treat this as taker-style behavior evidence, not certainty.

## Strategy logic

Enter YES when recent probability rises more than a threshold over `lookback_ticks`. Exit when `exit_after_ticks` is reached, or when momentum stalls if an exit condition is included.

## Nautilus strategy shape

- `subscribe_trade_ticks(instrument_id)` to stream TradeTicks.
- Use `on_trade_tick` as the main event handler.
- Submit market or conservative IOC orders.
- Track open position and fill state in `on_order_filled`.

## Example strategyConfig

```json
{
  "lookback_ticks": 5,
  "momentum_threshold": 0.02,
  "order_size": 10,
  "exit_after_ticks": 25,
  "max_entries": 3
}
```

## Iteration knobs

| Knob | Effect |
|---|---|
| `lookback_ticks` | Larger values reduce noise; smaller values react faster. |
| `momentum_threshold` | Higher values reduce frequency and require stronger momentum. |
| `order_size` | Larger values increase PnL sensitivity and liquidity exposure. |
| `exit_after_ticks` | Shorter values trim quickly; longer values hold trend. |
| `max_entries` | Caps repeated entries in choppy markets. |

## Failure modes

1. One large fill can produce a false momentum signal.
2. Thin trades can overstate available liquidity.
3. Late-resolution markets can reverse from mark-to-market gains to a 0/1 close.
4. Stale fills can make momentum look cleaner than it was live.

## User-facing framing

"This is a probability momentum strategy: it buys when fills and last-trade probability move together in one direction. It is backtestable with filled TradeTicks, but it does not confirm maker queue priority or spread capture."
