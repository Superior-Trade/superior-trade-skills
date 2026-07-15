---
name: catalyst-confirmation
description: Use when an external event thesis needs market confirmation before commitment.
version: 0.1.0
updated: 2026-06-17
---

# Strategy: Polymarket · Catalyst Confirmation

## When to use

Use this when the user ties a strategy idea to an external event (CPI, Fed, court rulings, ETF, earnings, protocol upgrade, sports injuries) and wants Polymarket behavior to confirm it.

## What the agent should look for

- Exact market slug from `POST /v3/markets/search`.
- Clear catalyst timestamp or date.
- Evidence of filled-trade reaction after the catalyst window.
- Enough filled history around the event window.
- Confirmation that market question maps directly to the catalyst.

## Backtest fit with filled data

Moderate fit. Filled `TradeTick` backtests can validate whether price reacted and how quickly after timestamps. They do not validate the news source itself or guarantee it remains relevant in future sessions.

This is an archetype template: it should be converted into custom NautilusTrader code and tuned by the user and engine constraints.

## Strategy logic

Enter only when the expected directional catalyst outcome appears and a filled-trade confirmation move occurs after the catalyst window.

## Nautilus strategy shape

- Ignore ticks before the configured catalyst timestamp.
- Require a `confirmation_move` in the right direction within `confirmation_window_ticks`.
- Enter with the configured size only after confirmation.
- Exit after `exit_after_ticks`, on reversal, or near market end.

## Example strategyConfig

```json
{
  "catalyst_time": "2026-06-12T18:00:00Z",
  "confirmation_move": 0.025,
  "confirmation_window_ticks": 20,
  "order_size": 10,
  "exit_after_ticks": 60
}
```

## Iteration knobs

| Knob | Effect |
|---|---|
| `confirmation_move` | Higher = wait for stronger post-catalyst movement. |
| `confirmation_window_ticks` | Lower = tighter catalyst-response window. |
| `exit_after_ticks` | Higher = hold longer for delayed event drift. |

## Failure modes

1. Catalyst information may already be priced in before timestamp.
2. Market may not map cleanly to the event framing.
3. False-positive events can create temporary spikes without follow-through.
4. Single-event backtests can overfit and fail in fresh conditions.

## User-facing framing

"This is a catalyst-led archetype, not a guaranteed edge. It runs on filled `TradeTick` history and exact market slugs, then becomes a starting point for custom Nautilus strategy generation."
