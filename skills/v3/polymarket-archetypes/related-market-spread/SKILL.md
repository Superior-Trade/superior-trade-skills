---
name: related-market-spread
description: Use when two Polymarket markets imply different probabilities for a linked outcome.
version: 0.1.0
updated: 2026-06-17
---

# Strategy: Polymarket · Related-Market Spread

## When to use

Use this when the user asks for relative-value trades, discrepancy checks, linked outcomes, or questions like "this market is mispriced versus that one."

## What the agent should look for

- At least two exact market slugs from `POST /v3/markets/search`.
- Resolution logic that is genuinely comparable across the two markets.
- Spread between filled-trade prices that is wide versus historical behavior.
- Enough historical filled data on both markets for the requested backtest window.
- Ability to enter and exit both legs (or acknowledge unavailable liquidities before entering).

## Backtest fit with filled data

Partial fit. Backtests built from filled `TradeTick` data are useful for checking whether the spread relationship has widened and then compressed in history. They cannot guarantee simultaneous fills or full cross-book liquidity.

Use this as a generated archetype: the strategy should be adapted in code before use, not treated as a finished edge.

## Strategy logic

Track the latest filled price for both legs. Enter when spread is above a threshold and exits when spread narrows or max holding duration expires.

## Nautilus strategy shape

- Subscribe to `TradeTick` for both instruments.
- Keep the latest filled price per instrument.
- Compute spread each tick using the latest values.
- Enter and flatten only when spread thresholds are hit.
- Manage stale-state safety (e.g., skip entries until both legs have recent fills).

## Example strategyConfig

```json
{
  "primary_instrument_id": "AUTO_FROM_MARKET_A",
  "secondary_instrument_id": "AUTO_FROM_MARKET_B",
  "spread_entry": 0.08,
  "spread_exit": 0.03,
  "order_size": 10,
  "max_holding_ticks": 120
}
```

## Iteration knobs

| Knob | Effect |
|---|---|
| `spread_entry` | Higher = only trade stronger relative-value discrepancies. |
| `spread_exit` | Lower = wait for fuller normalization before exiting. |
| `max_holding_ticks` | Lower = tighter time risk control if convergence does not happen. |

## Failure modes

1. Markets with different outcome mappings can produce a real structural spread, not an inefficiency.
2. Resolution rules can shift, changing what "discrepancy" means.
3. One leg may look tradable in backtest and be unavailable or illiquid live.
4. `TradeTick` replay cannot prove simultaneous execution across legs.

## User-facing framing

"This is a relative-value archetype, not a guaranteed edge. It is built from filled `TradeTick` backtests and exact market slug discovery first, then adapted into custom NautilusTrader code before any deployment."
