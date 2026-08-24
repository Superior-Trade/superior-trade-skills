---
name: mtf-entry
description: Use when aligning a strategy's entry to a lower timeframe than the level it trades — multi-timeframe alignment, timeframe pairing, top-down analysis, "drop down for the entry", HTF level + LTF trigger, Elder triple-screen. Turns any level/zone signal (support/resistance, breakout, band touch, regime bias, fair-value gap, order block, prior swing) into a precise lower-timeframe entry with a tighter stop and better risk:reward. A reusable overlay, not a standalone strategy.
version: 0.1.0
updated: 2026-06-24
---

# Multi-Timeframe Entry (timeframe pairing)

**The higher timeframe tells you WHERE and WHICH WAY; the lower timeframe tells you exactly WHEN.**

Find the level/bias on the **higher timeframe (HTF)**; drop to a paired **lower timeframe (LTF)** to time the entry. The stop sits on LTF structure (tight); the target is the HTF level/liquidity. This is Elder's Triple Screen generalized — HTF for trend/direction, LTF for the precise entry — and it applies to almost any level-based strategy, not just one setup.

## When to use

Any signal that is really a **level or zone**, not an exact tick: support/resistance, breakout level, Bollinger/band touch, regime bias, fair-value gap, order block, prior swing (resting liquidity). Aliases: **top-down analysis, multi-timeframe, MTF, timeframe pairing, triple screen, HTF/LTF, "drop down to enter".**

**Not** for pure single-timeframe scalping/momentum that already trades tick-by-tick — pairing adds little there.

## The pairing rule

Match the level's timeframe to an entry timeframe roughly **4–16× smaller**:

| Level on… | Enter on… |
|---|---|
| 1d | 1h |
| 4h | 15m |
| 1h | 5m |

Too close (`1d → 4h`) isn't precise; too far (`1d → 1m`) is noise. (Elder's "factor of five": screens scale ~3–5× apart; our pairings are a slightly wider modern variant.)

## State the alignment before writing code (required)

```
level TF → entry TF → stop source (LTF structure) → target (HTF level / liquidity)
e.g.  4h swing high → 15m entry → stop below 15m swing low → target 4h liquidity above
```

If you can't fill this line, the strategy isn't a multi-timeframe setup — write it single-TF.

## How it runs on our engine (Freqtrade informative timeframes)

The strategy runs on the **LTF**; the HTF is pulled in with `@informative(HTF)`. Merged HTF columns arrive suffixed (`close_4h`, `ema50_4h`, …), force-filled and **lookahead-safe**. Same mechanism the `basis-arb` skill uses.

```python
from freqtrade.strategy import IStrategy, informative
import talib.abstract as ta
import pandas as pd


class MtfEntryStrategy(IStrategy):
    timeframe = "15m"             # LTF — entries fire here
    startup_candle_count = 200    # max period across all timeframes
    can_short = False
    process_only_new_candles = True
    minimal_roi = {"0": 100.0}    # disable ROI; exit on the HTF target below
    stoploss = -0.05              # fallback floor; real stop is LTF-structure based

    # --- HTF context (4h): bias + target ---
    @informative("4h")
    def populate_indicators_4h(self, df: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        df["ema50"] = ta.EMA(df, timeperiod=50)
        # prior swing high = resting liquidity above = the target.
        # .shift() makes the pivot only "known" after it completes — no lookahead.
        df["swing_high"] = df["high"].rolling(5, center=True).max().shift(3)
        return df
    # merged into the 15m frame as ema50_4h, swing_high_4h (ffill'd, lookahead-safe)

    # --- LTF (15m): the precise trigger ---
    def populate_indicators(self, df: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        df["ema20"] = ta.EMA(df, timeperiod=20)
        df["swing_low"] = df["low"].rolling(5, center=True).min().shift(3)
        return df

    def populate_entry_trend(self, df: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        df.loc[
            (df["close"] > df["ema50_4h"])   # HTF bias: up
            & (df["close"] > df["ema20"])    # LTF trigger — SWAP for sweep/FVG/retest/etc.
            & (df["volume"] > 0),
            "enter_long",
        ] = 1
        return df

    def populate_exit_trend(self, df: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        # target the HTF liquidity above
        df.loc[df["close"] >= df["swing_high_4h"], "exit_long"] = 1
        return df

    def custom_stoploss(self, pair, trade, current_time, current_rate,
                        current_profit, **kwargs):
        # Tight, structure-based: stop just under the LTF swing low near entry.
        # For a full ratcheting exit, compose the `dsl-exit-engine` skill instead.
        return -0.03
```

## The LTF trigger is pluggable

The HTF gate and the stop/target plumbing stay the same; swap the **LTF entry trigger** to taste:

- **liquidity sweep → structure break → FVG pullback** (ICT / SMC)
- **retest of the level + bullish engulfing / rejection wick**
- **LTF EMA reclaim** (the template above)

This skill *is* the pairing + tight-stop + HTF-target logic. The trigger is a parameter.

## Pitfalls

1. **Lookahead bias — the #1 way MTF backtests lie.** Always use `merge_informative_pair` (ffill) for manual merges and `.shift()` your pivots. Reading an unclosed HTF candle inflates results and never reproduces live.
2. **Entering on the level's own timeframe.** Defeats the purpose: wide stop, sloppy fill. Drop down.
3. **Stop taken from the HTF.** Put the stop on **LTF** structure or you forfeit the tighter-stop R:R gain that justifies the whole approach.
4. **Too few trades.** Pairing is selective by design — expect fewer entries. Report the trade count; never loosen filters to manufacture trades. A 4-trade, 100%-win result is not validation.
5. **Thin LTF data.** 15m needs deep history and our backtest window is finite — let the engine auto-narrow and state the window before trusting the result.

## Composes with

- **`regime-overlay`** — use the HTF trend gate as the bias filter.
- **`dsl-exit-engine`** — the exit / trailing-stop ladder once in the trade.
- **`backtesting`** — MTF setups are rare → validate **out-of-sample / walk-forward**, not one window.
- **`trade-thesis`** — the bull/bear case before any live deployment.

## Sources

- Alexander Elder — *Triple Screen Trading System* (multi-timeframe; "factor of five").
- Freqtrade informative timeframes — https://www.freqtrade.io/en/stable/strategy-customization/#informative-decorator
