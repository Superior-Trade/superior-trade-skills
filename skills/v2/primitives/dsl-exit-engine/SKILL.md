---
name: dsl-exit-engine
description: Use when designing or tuning exit logic for a Freqtrade strategy on Superior Trade — anything described as ratcheting trailing stop, two-phase exit, ALO-aware exit, dynamic stoploss DSL, ROI ladder, take-profit ladder, exit engine. Specifies a three-phase exit (Phase 0 ROI ladder, Phase 1 hard stop, Phase 2 ratcheting trail) that strategies compose. The Phase 2 ratchet was the most consistently profitable primitive across 21 validation backtests; the Phase 0 ladder is what makes mean-reversion strategies actually book wins.
version: 0.1.0
updated: 2026-05-18
---

# DSL Exit Engine — Three-Phase Exit Primitive

A reusable exit primitive that any strategy skill can compose. Replaces the ad-hoc trailing-stop logic currently duplicated inside `breakout` with a single, declarative spec.

Other names this is searchable under: **ratcheting trailing stop**, **two-phase exit**, **ALO-aware exit**, **dynamic stoploss DSL**, **ROI ladder**.

---

## Why a DSL

The Freqtrade `IStrategy` lifecycle gives you `stoploss`, `trailing_stop`, `trailing_stop_positive`, `minimal_roi`, and `custom_exit`. Each strategy ends up reimplementing the same three-phase shape:

1. **Phase 0 — Take-profit ladder (`minimal_roi`).** Cash out winners at known target tiers, decaying over time. For mean-reversion / scalper strategies, this is the primary profit mechanism.
2. **Phase 1 — Survival (`stoploss`).** A hard max-loss cutoff while the trade is underwater or barely above breakeven.
3. **Phase 2 — Ratchet (`trailing_stop`).** Once unrealized PnL clears an activation threshold, switch to a trailing stop that only tightens, never loosens. For trend-follow strategies, this is the primary profit mechanism.

This file specifies all three. Strategies declare the parameters and inherit the behavior.

## Validated evidence

Across 21 backtests on the Nov 2025 → May 2026 window, the `trailing_stop_loss` exit-reason bucket was **positive in every single backtest where Phase 2 activated**:

| Strategy | Trailing-stop bucket PnL | Strategy total PnL |
|---|---|---|
| Funding-fader minimal BTC | +$108 | -$8 |
| Funding-fader v3 BTC | +$75 | -$11 |
| Striker v1 multipair | +$373 | -$112 |
| Striker v2 multipair | +$170 | -$26 |
| Donchian 4h BTC baseline | +$78 | +$13 |
| Donchian 4h quick-exit BTC | +$36 | +$19 |
| Donchian strong-regime BTC | +$10 | +$10 |

The Phase 2 ratchet is the most consistently profitable primitive in the entire toolkit. The strategies that lost did so via Phase 1 stops or signal exits, **not** because the trailing stop misfired.

**Inverse finding for `minimal_roi`:** the standard template `minimal_roi = {"0": 100.0}` (used in most repo strategies) effectively disables Phase 0. For mean-reversion and scalp strategies this leaves money on the table — wins that should have been taken at +2.5% kept giving back. The `bollinger-reverter-4h` strategy's edge depends entirely on its `minimal_roi` ladder.

## Spec

```yaml
exit_engine:
  phase_0:
    roi_ladder:
      "0":    0.025   # take 2.5% immediately
      "60":   0.012   # 1.2% after 60 minutes
      "180":  0.005   # 0.5% after 3 hours
      "360":  0.0     # breakeven after 6 hours
  phase_1:
    max_loss_pct: 0.05        # hard stoploss while underwater (Freqtrade `stoploss`)
  phase_2:
    activate_at_pct: 0.025    # unrealized PnL that flips to trailing
    trail_offset_pct: 0.015   # distance from peak; ratchet only tightens
    min_step_pct: 0.002       # ignore noise below this when ratcheting
  exit_pricing:
    mode: "maker_then_taker"  # ALO post; if unfilled within timeout, fall through to taker
    maker_timeout_sec: 30
```

### Phase 0 vs Phase 2 — when to use which

**Use Phase 0 (`minimal_roi` ladder), skip Phase 2:** mean-reversion, scalp, range strategies. Target moves are small (sub-3%), the trailing stop's +2-3% activation threshold rarely fires, and trailing stops give back too much when they do.

**Use Phase 2 (trailing), skip Phase 0:** trend-follow, breakout, momentum strategies. Winners can run 5-20%, locking in fixed ROI cuts the right tail.

**Use both:** strategies that catch both small mean-reversions AND occasional runners. Configure Phase 0 with longer time tiers and Phase 2 with higher activation so they don't compete.

**Use neither (`minimal_roi = {"0": 100.0}` + `trailing_stop = False`):** signal-exit-only strategies that rely entirely on `populate_exit_trend`. This is the most common pattern in the repo today and is frequently sub-optimal — most strategies benefit from at least one of Phase 0 or Phase 2.

## Reference implementation (drop into `IStrategy`)

```python
stoploss = -0.05                # phase_1.max_loss_pct
trailing_stop = True
trailing_stop_positive = 0.015  # phase_2.trail_offset_pct
trailing_stop_positive_offset = 0.025  # phase_2.activate_at_pct
trailing_only_offset_is_reached = True  # do not trail until activate_at hit

def custom_exit(self, pair, trade, current_time, current_rate, current_profit, **kw):
    # Optional: enforce min_step_pct so micro-jitters do not churn orders.
    peak = trade.max_rate or trade.open_rate
    move_from_peak = (peak - current_rate) / peak
    if current_profit > 0.025 and move_from_peak >= 0.015 + 0.002:
        return "ratchet_trail"
    return None
```

## Maker-first exit (pairs cleanly with `fees-optimizations`)

For strategies that can tolerate a few seconds of fill latency on exit, post the trail as ALO first and only escalate to taker if `maker_timeout_sec` elapses:

```json
"exit_pricing": {"price_side": "same", "use_order_book": true, "order_book_top": 1},
"unfilledtimeout": {"entry": 3, "exit": 1, "unit": "minutes"}
```

Required pairing — without `unfilledtimeout`, a maker exit stalls indefinitely in trending markets and blocks the per-pair single-trade slot.

## Honest framing

This primitive does not improve a losing strategy. Backtests on `breakout` show the trailing stop *clips* winners more often than it saves losers when the regime is wrong — that is expected. Use Phase 2 to lock in asymmetric R after the trade has already proven the thesis, not as a substitute for a regime filter.

## Tunables

| Parameter | Typical range | Notes |
|---|---|---|
| `max_loss_pct` | 0.03 – 0.08 | Tighter than 0.03 over-stops on normal vol; wider than 0.08 turns small losers into account-killers |
| `activate_at_pct` | 0.015 – 0.04 | Below 1.5R of typical entry slippage = activates on noise |
| `trail_offset_pct` | 0.01 – 0.025 | Smaller = more clipped winners; larger = bigger give-back |
| `min_step_pct` | 0.001 – 0.005 | Anti-churn band; raise on illiquid pairs |

## Backtest harness

Run a 3-variant parameter sweep on `activate_at_pct × trail_offset_pct` (Superior backtester supports parallel sweeps natively):

```
variants:
  - {activate_at_pct: 0.020, trail_offset_pct: 0.010}
  - {activate_at_pct: 0.025, trail_offset_pct: 0.015}  # reference
  - {activate_at_pct: 0.040, trail_offset_pct: 0.025}
```

Compare on **profit factor** and **avg_winner / avg_loser ratio**, not raw return — the engine's job is shape, not direction.
