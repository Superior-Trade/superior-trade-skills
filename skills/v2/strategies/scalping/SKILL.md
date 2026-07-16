---
name: scalping
description: Use when writing a high-turnover intraday strategy on Superior Trade — anything described as scalping, momentum bursts, fast in/out, RSI thrust, volume spike entry, 5-minute strategy. Note this template was unprofitable in our reference backtest (33% WR, -0.34%); use it as a structural template, not a recommendation.
version: 0.1.0
updated: 2026-05-07
---

# Strategy: Scalp · Momentum Bursts

## When to use

A user asks for a scalping strategy, "fast in/out", "5m strategy", "ride the thrust", "buy when volume spikes". Single-pair, tight stops, time-stopped trades.

## Honest framing

The reference backtest below was **unprofitable** (33% WR, −0.34% PnL, Sharpe −5.6) on SOL 5m over April 2026. The strategy *executes correctly* — it's not broken — it's just a losing parameter set on this window. The 0.6% target / 0.4% stop ratio needs ~41% hit rate to break even before fees, which the entry filter didn't deliver. **Do not deploy as-is.** Tune the entry threshold and validate before recommending to a user.

This skill exists as a **structural template** for high-turnover momentum entries. Real edge requires parameter search, regime filtering, or a different signal.

## Backtest reference

| Window | `SOL/USDC:USDC` 5m, 2026-04-01 → 2026-05-01 (30 days) |
|---|---|
| Trades | 76 |
| Win rate | 33% |
| Wallet PnL | **−0.34%** |
| Sharpe | −5.6 |
| Backtest ID | `01kqypvbmjjhqjn3ae8bgqr9p0` |

## Reference implementation

```python
from freqtrade.strategy import IStrategy
from datetime import datetime
import pandas as pd
import talib.abstract as ta


class SolScalpMomentumStrategy(IStrategy):
    minimal_roi = {"0": 0.006}    # 0.6% profit target
    stoploss = -0.004              # 0.4% stop
    trailing_stop = False
    timeframe = "5m"
    process_only_new_candles = True
    startup_candle_count = 100
    can_short = False

    def populate_indicators(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        # Session VWAP approximation over the last 288 bars (~24h).
        tp = (dataframe["high"] + dataframe["low"] + dataframe["close"]) / 3.0
        pv = tp * dataframe["volume"]
        dataframe["vwap"] = pv.rolling(288).sum() / dataframe["volume"].rolling(288).sum()
        dataframe["rsi"] = ta.RSI(dataframe, timeperiod=14)
        dataframe["vol_avg20"] = dataframe["volume"].rolling(20).mean()
        dataframe["vol_thrust"] = dataframe["volume"] / dataframe["vol_avg20"]
        return dataframe

    def populate_entry_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        dataframe.loc[
            (dataframe["close"] > dataframe["vwap"])
            & (dataframe["rsi"] > 70)
            & (dataframe["vol_thrust"] > 2.0),
            "enter_long",
        ] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        dataframe.loc[(dataframe["rsi"] < 50), "exit_long"] = 1
        return dataframe

    def custom_exit(self, pair: str, trade, current_time: datetime,
                    current_rate: float, current_profit: float, **kwargs):
        # Time stop at 12 minutes (~3 bars on 5m).
        elapsed = (current_time - trade.open_date_utc).total_seconds()
        if elapsed >= 12 * 60:
            return "time_stop_12m"
        return None
```

## Config requirements

```json
{
  "exchange": { "name": "hyperliquid", "pair_whitelist": ["SOL/USDC:USDC"] },
  "stake_currency": "USDC",
  "stake_amount": 100,
  "timeframe": "5m",
  "max_open_trades": 1,
  "stoploss": -0.004,
  "minimal_roi": { "0": 0.006 },
  "trading_mode": "futures",
  "margin_mode": "cross",
  "entry_pricing": { "price_side": "same" },
  "exit_pricing": { "price_side": "same" },
  "pairlists": [{ "method": "StaticPairList" }]
}
```

## Tunable parameters

| Knob | Effect |
|---|---|
| `rsi > 70` | Stricter (`> 80`) → fewer entries, only the strongest thrusts. |
| `vol_thrust > 2.0` | Tighter (`> 3.0`) → only volume blowouts; very rare. |
| `0.006` ROI | Wider target → more time in trade, more tail risk. |
| `0.004` stop | Tighter stop → more stops out, lower per-trade loss. |
| `12 * 60` time stop | Faster timeout → more trades but lower edge per trade. |

## Why this loses (and how to fix)

Three structural issues in the reference parameters:

1. **No regime filter**: enters in chop AND in trend. Chop kills the 0.6% target before it hits.
2. **Entry on overbought + thrust**: RSI > 70 *plus* high volume usually marks a local top, not a continuation. Inverting (`rsi < 30 + vol_thrust > 2.0`) for a fade entry is worth testing.
3. **Single pair**: Scalping edges thin out on a single asset. Top-30 perp scan with `VolumePairList` increases hit count, lets the law of large numbers help.

Practical refinements before suggesting to a user:
- Add a higher-timeframe trend filter (`1h close > 1h ema_50`).
- Use ATR-scaled stops instead of fixed 0.4%.
- Test the inverted (mean-reversion-on-thrust) variant.

## Common pitfalls

1. **Slippage eats the edge.** A 0.6% target on a 5m candle leaves ~3 ticks of room. With Hyperliquid taker fee + slippage, effective edge is closer to 0.4% — barely above the stop. See `fees-optimizations`.
2. **`startup_candle_count` too low.** The 288-bar VWAP needs 288 bars of warmup; default 30 produces NaN VWAP for the first 24h.
3. **Single-pair scalping is undercapitalized signal.** 76 trades / 30 days is fine for statistics, not for an edge.

## Sources

- Internal audit — `docs/standard-strategies-audit.md`, backtest `01kqypvbmjjhqjn3ae8bgqr9p0`
- See `fees-optimizations` for fee-aware sizing of tight-target strategies.
