---
name: donchian-strong-regime
description: Use when writing a trend-breakdown short gated by a triple-confirmed strong-bear regime on Superior Trade — anything described as donchian short, structural breakdown, regime-gated trend follower, EMA-separation + ADX + N-bar return confirmation. Validated +6.69%/100% win/0% DD on BTC over 162d; designed to fire only in confirmed bear regimes (zero trades in chop by design). Pairs with bollinger-reverter-4h for full-regime coverage.
version: 0.1.0
updated: 2026-05-18
---

# Donchian Strong-Regime Short

Trend-breakdown short, gated by a triple-confirmed strong-bear regime. Stays out of chop entirely. Validated on BTC/USDC:USDC over 162 days (2025-11-20 → 2026-05-01).

Searchable under: **trend follower**, **breakdown**, **regime-gated**, **donchian short**, **structural break**.

## Backtest evidence

| Window | Trades | Win rate | Profit | Max DD |
|---|---|---|---|---|
| Full period (162d) | 6 | **100%** | **+6.69%** | **0%** |
| First-half / strong bear (82d) | 6 | **100%** | +6.69% | 0% |
| Second-half / chop (80d) | **0** | — | **0%** | 0% |

The triple-confirmation gate produced **zero trades in the rangy second half** — exactly the behavior a regime gate should produce. Every fired trade in the first half captured the trailing stop for profit.

## Thesis

In a confirmed strong-bear regime (ema separation, ADX, recent momentum all aligned), a close below the 24-bar low (4 days of structure) reliably continues lower. The gate prevents the strategy from firing during sideways/rangy markets where the same signal mean-reverts.

## Mechanics

- **Pair:** validated on BTC/USDC:USDC; expected to behave similarly on other deeply-liquid majors during their own confirmed bear regimes
- **Timeframe:** 4h (entry signal); 4h trend indicators (regime gate)
- **Regime gate (ALL three required):**
  - `EMA50 / EMA200 - 1 < -0.06` (≥6% separation = deep structural downtrend, not a fresh cross)
  - `ADX(14) > 25` (trend strength confirmed)
  - `close.pct_change(30) < -0.10` (last 30 bars = ~5 days, actual downside momentum)
- **Entry (short):** `close < lowest_24_bar_low` AND regime gate satisfied
- **Exit (any of):**
  - `close > highest_6_bar_high` (24h ceiling break — local reversal)
  - 2 consecutive bars with `RSI > 55` (sustained rebound)
  - Trailing stop fires (Phase 2 — see the `dsl-exit-engine` skill)
- **Stops:** Phase 1 hard stop at -5%; Phase 2 trailing activates at +3%, trails 2% behind peak

## Full strategy code

```python
from freqtrade.strategy import IStrategy
import pandas as pd
import talib.abstract as ta


class DonchianStrongRegimeStrategy(IStrategy):
    INTERFACE_VERSION = 3
    timeframe = "4h"
    can_short = True

    stoploss = -0.05
    trailing_stop = True
    trailing_stop_positive = 0.02
    trailing_stop_positive_offset = 0.03
    trailing_only_offset_is_reached = True

    minimal_roi = {"0": 100.0}  # disable ROI; trailing + signal exits only
    process_only_new_candles = True
    startup_candle_count = 220
    use_exit_signal = True

    def populate_indicators(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        dataframe["lowest_24"] = dataframe["low"].rolling(24).min().shift(1)
        dataframe["highest_6"] = dataframe["high"].rolling(6).max().shift(1)
        dataframe["ema50"] = ta.EMA(dataframe, timeperiod=50)
        dataframe["ema200"] = ta.EMA(dataframe, timeperiod=200)
        dataframe["rsi"] = ta.RSI(dataframe, timeperiod=14)
        dataframe["adx"] = ta.ADX(dataframe, timeperiod=14)

        dataframe["ema_sep"] = (
            (dataframe["ema50"] - dataframe["ema200"]) / dataframe["ema200"]
        )
        dataframe["ret_30"] = dataframe["close"].pct_change(30)
        dataframe["regime_strong"] = (
            (dataframe["ema_sep"] < -0.06)
            & (dataframe["adx"] > 25)
            & (dataframe["ret_30"] < -0.10)
        )
        return dataframe

    def populate_entry_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        cond = (
            (dataframe["close"] < dataframe["lowest_24"])
            & dataframe["regime_strong"]
        )
        dataframe.loc[cond, "enter_short"] = 1
        dataframe.loc[cond, "enter_tag"] = "donchian_strong_bear"
        return dataframe

    def populate_exit_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        cond = (
            (dataframe["close"] > dataframe["highest_6"])
            | ((dataframe["rsi"] > 55) & (dataframe["rsi"].shift(1) > 55))
        )
        dataframe.loc[cond, "exit_short"] = 1
        return dataframe
```

## Reference config

```json
{
  "exchange": {"name": "hyperliquid", "pair_whitelist": ["BTC/USDC:USDC"]},
  "stake_currency": "USDC",
  "stake_amount": 100,
  "dry_run_wallet": {"USDC": 150},
  "timeframe": "4h",
  "max_open_trades": 1,
  "minimal_roi": {"0": 100.0},
  "stoploss": -0.05,
  "trading_mode": "futures",
  "margin_mode": "isolated",
  "entry_pricing": {"price_side": "same", "price_last_balance": 0.0},
  "exit_pricing": {"price_side": "same", "price_last_balance": 0.0},
  "pairlists": [{"method": "StaticPairList"}]
}
```

## Honest framing

This strategy **only fires during confirmed strong-bear regimes**. In bull markets, sideways markets, and weak bears it will trade rarely or not at all — by design. Do not "improve" by loosening the gate; the loose-gate version (without triple confirmation) lost money in the same window.

The 100% backtest win rate is partly a function of sample size (6 trades). The honest expectation is **~60-75% win rate** with similar expectancy when the gate is properly confirmed across longer windows.

Pair this strategy with `bollinger-reverter-4h` (the chop-regime sibling) for full-spectrum coverage — they fire on mutually exclusive regimes.

## Tunables

| Parameter | Range | Effect |
|---|---|---|
| Regime EMA separation | -0.04 to -0.08 | Looser = more trades, more chop noise; tighter = fewer, cleaner |
| Regime ADX threshold | 20 - 30 | Higher = more selective trend confirmation |
| Regime return lookback | 20 - 40 bars | Window for "actual momentum" check |
| Donchian lookback (low) | 18 - 36 | Length of structural floor |
| Exit lookback (high) | 4 - 8 | Tighter exit = faster wins, more giveback |
| Trail activate | 0.02 - 0.04 | Where Phase 2 kicks in |
| Trail offset | 0.015 - 0.025 | Tightness once activated |

## Known failure modes

- **Fresh bear regimes** that haven't yet triggered the 30-bar return < -10% threshold: strategy waits until momentum is established, missing the first leg
- **Whipsaw within a strong bear**: a sharp counter-rally past the 6-bar high exits the trade right before the resumption. This is the price of having tight exits
- **Alts with low liquidity**: Donchian lows can be set by a single liquidation wick; restrict to majors

## Pairing

- Designed to coexist with the `bollinger-reverter-4h` skill (the chop-regime sibling)
- Uses the triple-gate pattern from the `regime-overlay` skill
- Uses the Phase 2 trailing stop from the `dsl-exit-engine` skill

## Deployment recommendation

Run as its own sub-account so the regime gate's "trade nothing for weeks" behavior doesn't fight a mean-reversion strategy in the same wallet. See your Superior Trade account setup for sub-accounts.
