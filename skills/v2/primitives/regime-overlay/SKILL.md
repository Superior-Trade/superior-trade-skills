---
name: regime-overlay
description: Use when adding a regime filter to any directional strategy on Superior Trade — anything described as regime gate, trend filter, directional confirmation, ADX gate, EMA-separation filter, trade-or-skip overlay. Provides three reusable building blocks (regime_strong_bear, regime_strong_bull, regime_range) that wrap entry signals with triple-confirmation (EMA separation + ADX + N-bar return). Validated as the difference between fragile and robust trend strategies — fewer trades, cleaner equity curve.
version: 0.1.0
updated: 2026-05-18
---

# Regime Overlay — Triple-Confirmation Gate

A reusable filter that wraps any directional strategy and only allows entries when three independent regime confirmations align. Validated as the difference between a fragile and a robust trend strategy.

Searchable under: **regime filter**, **trend gate**, **trade-or-skip filter**, **directional confirmation**, **ADX gate**.

## Why a separate primitive

After 21 backtests, the single biggest performance lever was not entry logic, stop sizing, or trailing config. It was **whether the strategy traded at all** during specific market structure.

The proof:
- Same Donchian-breakdown short on BTC 4h, no regime gate → **+12.85%** over 162d (looks great)
- Same strategy, on a different window (the rangy second half) → **-4.32%** (edge gone)
- Same strategy with triple-confirmed regime gate → **+6.69% with 0% drawdown**, fires zero trades in the chop window

The first version captured a real edge mixed with random noise. The third version captured **only** the real edge. Smaller absolute return; cleaner equity curve; no losing periods.

## The three confirmations

A signal is "in regime" when ALL three of these hold simultaneously:

| Indicator | Threshold | What it confirms |
|---|---|---|
| `(EMA50 - EMA200) / EMA200` | < -0.06 (for bear) | **Structural** trend direction — not a fresh cross, real separation |
| `ADX(14)` | > 25 | **Strength** of the current trend |
| `close.pct_change(30)` | < -0.10 (for bear) | **Recent** momentum is actually moving |

Three independent angles — structure, strength, recency. A market can satisfy any one or two by accident; satisfying all three is genuinely rare and genuinely informative.

For **long-side** strategies, invert the signs:
- `(EMA50 - EMA200) / EMA200 > +0.06`
- `ADX(14) > 25` (same — ADX is direction-agnostic)
- `close.pct_change(30) > +0.10`

## Implementation

```python
def regime_strong_bear(df: pd.DataFrame) -> pd.Series:
    ema50 = ta.EMA(df, timeperiod=50)
    ema200 = ta.EMA(df, timeperiod=200)
    adx = ta.ADX(df, timeperiod=14)
    ema_sep = (ema50 - ema200) / ema200
    ret_30 = df["close"].pct_change(30)
    return (ema_sep < -0.06) & (adx > 25) & (ret_30 < -0.10)


def regime_strong_bull(df: pd.DataFrame) -> pd.Series:
    ema50 = ta.EMA(df, timeperiod=50)
    ema200 = ta.EMA(df, timeperiod=200)
    adx = ta.ADX(df, timeperiod=14)
    ema_sep = (ema50 - ema200) / ema200
    ret_30 = df["close"].pct_change(30)
    return (ema_sep > 0.06) & (adx > 25) & (ret_30 > 0.10)


def regime_range(df: pd.DataFrame) -> pd.Series:
    adx = ta.ADX(df, timeperiod=14)
    return adx < 25
```

The range-regime check is the opposite end of the spectrum — useful for gating mean-reversion strategies (see `bollinger-reverter-4h`).

## Expected behavior

Apply this overlay to any signal-driven entry. The cost is **fewer trades**; the benefit is **the trades you do take fire in the right environment.**

| Strategy | Without overlay | With overlay |
|---|---|---|
| Donchian breakdown BTC | 23 trades, 56.5% win, +12.85%, 3.69% DD | **6 trades, 100% win, +6.69%, 0% DD** |
| (Same, second-half only) | 8 trades, 25% win, -4.32% | **0 trades, no PnL** |

The overlay traded the second column's win rate **and drawdown** for the first column's absolute return. Most production strategies should prefer the second column.

## Tunables

| Parameter | Conservative | Aggressive | Notes |
|---|---|---|---|
| EMA separation threshold | 0.08 | 0.04 | Tighter = wait for deeper structural moves |
| ADX threshold | 30 | 20 | Higher = stricter trend-strength requirement |
| Return lookback bars | 40 | 20 | Window for "actual momentum" check |
| Return threshold | 0.15 | 0.06 | How much momentum needed |

Start conservative (0.06 / 25 / -0.10). Loosen only if the gate eliminates so many trades that the strategy's edge can't compound.

## What this is NOT

- Not a signal in itself. The overlay only says "regime is right"; it doesn't tell you when to enter
- Not magic. In an environment where the historical regime gate would never fire (e.g., a yearlong sideways grind), the strategy simply stays out. That's the feature
- Not a replacement for stops or take-profit. Even regime-confirmed signals fail individually

## When NOT to use a regime gate

- Mean-reversion strategies (`bollinger-reverter-4h`) work IN range regimes — use `regime_range` (ADX < 25) instead of bear/bull strong gates
- Funding-carry strategies that earn rebates rather than directional moves
- Pair-arbitrage or basis-arb strategies where the edge is structural, not regime-conditional

## Pairing patterns

Most directional strategies in this repo benefit from this overlay:
- `donchian-strong-regime` — uses bear overlay (validated)
- Any custom trend-follow strategy

The overlay file itself is regime-agnostic — it provides functions for both bear and bull, and a range complement.
