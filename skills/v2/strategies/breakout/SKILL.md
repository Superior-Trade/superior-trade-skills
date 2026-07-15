---
name: breakout
description: Use when writing a swing/intraday breakout strategy on Superior Trade — anything described as breakout, momentum, trend following, 12-hour high, range expansion, riding new highs, Donchian breakout. Note this template was unprofitable in our reference backtest (long-only in a -13% market); explain regime sensitivity to the user.
version: 0.1.0
updated: 2026-05-07
---

# Strategy: Momentum · Breakout

## When to use

A user asks for "breakout", "momentum", "trend following", "buy new highs", "Donchian breakout", "range expansion". Single or multi-pair, hour-scale, with a trailing stop.

## Honest framing

The reference backtest was **unprofitable** (36% WR, −0.95% PnL) on `BTC/USDC:USDC` 1h Jan-May 2026 — but BTC fell **−13%** in that window. **Long-only breakouts in a downtrend are structurally a losing setup.** The strategy is correct; the regime was wrong.

Two practical paths to make this work:

- **Add a regime filter** (e.g. only enter when `close > ema_200` on the higher timeframe).
- **Run on a wider, multi-pair scan** so trending alts contribute even when BTC is weak.

## Backtest reference

| Window | `BTC/USDC:USDC` 1h, 2026-01-01 → 2026-05-01 (BTC −13%) |
|---|---|
| Trades | 64 |
| Win rate | 36% |
| Wallet PnL | **−0.95%** |
| Backtest ID | `01kqypw5bqsaezpgm8pxcrpvyb` |

Trailing stop kept losses small per trade, but the entry signal fired into too many failed breakouts in a downtrend. Re-run on Q4 2025 or a trending alt to see the strategy in its native regime.

## Reference implementation

```python
from freqtrade.strategy import IStrategy
import pandas as pd
import talib.abstract as ta


class MomentumBreakoutStrategy(IStrategy):
    minimal_roi = {"0": 100.0}   # let trailing stop manage exits
    stoploss = -0.05
    trailing_stop = True
    trailing_stop_positive = 0.015
    trailing_stop_positive_offset = 0.025
    trailing_only_offset_is_reached = True
    timeframe = "1h"
    process_only_new_candles = True
    startup_candle_count = 30
    can_short = False

    def populate_indicators(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        dataframe["high_12h"] = dataframe["high"].rolling(12).max().shift(1)
        dataframe["low_6h"] = dataframe["low"].rolling(6).min().shift(1)
        dataframe["vol_avg20"] = dataframe["volume"].rolling(20).mean()
        dataframe["atr_14"] = ta.ATR(dataframe, timeperiod=14)
        return dataframe

    def populate_entry_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        # Break the prior 12h high on above-average volume.
        dataframe.loc[
            (dataframe["close"] > dataframe["high_12h"])
            & (dataframe["volume"] > dataframe["vol_avg20"]),
            "enter_long",
        ] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        # Break the prior 6h low → exit (momentum failed).
        dataframe.loc[(dataframe["close"] < dataframe["low_6h"]), "exit_long"] = 1
        return dataframe
```

## Config requirements

```json
{
  "exchange": { "name": "hyperliquid", "pair_whitelist": ["BTC/USDC:USDC"] },
  "stake_currency": "USDC",
  "stake_amount": 100,
  "timeframe": "1h",
  "max_open_trades": 1,
  "stoploss": -0.05,
  "minimal_roi": { "0": 100.0 },
  "trading_mode": "futures",
  "margin_mode": "cross",
  "trailing_stop": true,
  "trailing_stop_positive": 0.015,
  "trailing_stop_positive_offset": 0.025,
  "trailing_only_offset_is_reached": true,
  "entry_pricing": { "price_side": "same" },
  "exit_pricing": { "price_side": "same" },
  "pairlists": [{ "method": "StaticPairList" }]
}
```

The trailing-stop block is what makes this template worth keeping — it locks in profits once a breakout extends past +2.5%, then trails 1.5% behind.

## Tunable parameters

| Knob | Effect |
|---|---|
| `12` (rolling high length) | Shorter (`6`) → more entries, lower-quality breakouts. Longer (`24`) → fewer, higher-conviction. |
| `volume > vol_avg20` | Stricter (`> vol_avg20 × 1.5`) → only volume-confirmed breakouts. |
| `trailing_stop_positive_offset` (0.025) | Higher → trailing stop activates later, gives more room. Lower → locks in earlier, exits more often. |
| `trailing_stop_positive` (0.015) | Tighter trail → exits closer to highs, more stops out. |
| `low_6h` exit | Shorter window → faster invalidation. Longer → patience but bigger giveback. |

## Variants worth testing

- **Higher-timeframe regime filter**: only enter when `1d close > 1d ema_50`. Removes trades in clear downtrends (would have killed most of the −0.95% in the reference).
- **Donchian channel proper**: rolling 20-bar high (instead of 12) is the textbook breakout. Test with longer rolling window.
- **Multi-pair (top 30 perps)**: replace `StaticPairList` with `VolumePairList` filtered to top 30 by 24h volume. Diversifies regime risk.
- **Add ATR-scaled position sizing**: smaller stake when ATR is high (more risk per trade) keeps risk-per-trade flat.

## Common pitfalls

1. **Long-only in downtrends.** As shown by the reference. Add a regime filter or accept the strategy will lose money in bear markets.
2. **`process_only_new_candles = False`.** Default `True` is correct here; setting it false fires on every tick during backtest dry-run and triple-counts entries.
3. **Conflict between `minimal_roi` and trailing stop.** Setting `minimal_roi: { "0": 0.05 }` exits at +5% before the trailing stop activates at +2.5% offset. Use `{"0": 100.0}` and let the trailing stop run.
4. **`startup_candle_count` too small for ATR-14.** ATR needs 14 bars of warmup; the default 30 is fine. If you switch to ATR-100, bump startup to 100+.

## Sources

- Internal audit — `docs/standard-strategies-audit.md`, backtest `01kqypw5bqsaezpgm8pxcrpvyb`
- Freqtrade trailing stop — https://www.freqtrade.io/en/stable/stoploss/#trailing-stop-loss
