---
name: mean-reversion
description: Use when writing a Bollinger-band mean-reversion strategy on Superior Trade — anything described as mean reversion, BB bands, oversold bounce, fade, range trade, ADX low, sigma extension. Upgraded 2026-05-18 from the prior 1h/2.5σ variant to the validated 4h/2σ/ADX<25 version (+8.77% multi-pair, 65.5% win over 162d). Prior 1h variant is preserved at the end of the file as an archived reference.
version: 0.2.0
updated: 2026-05-18
---

# Mean Reversion — Bollinger Reverter 4h

**Note:** This template was upgraded from the prior 1h / 2.5σ / ADX<30 version to the 4h / 2σ / ADX<25 version after backtesting showed the 4h variant produces meaningfully more trades with comparable risk and validated multi-pair edge. The prior 1h version is preserved at the end for reference.

---

Symmetric mean-reversion strategy on the 4h timeframe. Long-or-short on Bollinger band touches, gated to range regimes via ADX. Validated across BTC/ETH/SOL/DOGE over 162 days.

## Backtest evidence

| Config | Trades | Win | Profit | Max DD |
|---|---|---|---|---|
| BTC/USDC:USDC, 162d | 18 | 72% | **+8.14%** | 10% |
| BTC/USDC:USDC, range-regime sub-window (80d) | 8 | **100%** | **+9.88%** | **0%** |
| BTC/ETH/SOL/DOGE multi-pair, 162d | 84 | **65.5%** | **+8.77%** | 18.5% |

## Thesis

When the market is range-bound (ADX < 25), price touching the upper or lower Bollinger Band reliably reverts to the midline. Tight ROI takes profit fast since mean-reversion targets are small; tight stop closes positions that turn into trend breaks rather than reversions.

## Mechanics

- Timeframe: 4h
- 20-bar Bollinger Bands at 2σ
- Entry short: `close > bb_upper AND rsi > 65 AND adx < 25`
- Entry long: `close < bb_lower AND rsi < 35 AND adx < 25`
- Exit: close crosses the band midline
- Stop: -2%
- ROI ladder: 2.5% → 1.5% → 0.5% → breakeven over 24h
- No trailing stop (band reversion targets are small; ROI ladder handles take-profit)

## Strategy code

```python
from freqtrade.strategy import IStrategy
import pandas as pd
import talib.abstract as ta


class MeanReversionStrategy(IStrategy):
    INTERFACE_VERSION = 3
    timeframe = "4h"
    can_short = True

    stoploss = -0.02
    trailing_stop = False

    minimal_roi = {
        "0": 0.025,
        "240": 0.015,
        "720": 0.005,
        "1440": 0,
    }

    process_only_new_candles = True
    startup_candle_count = 60
    use_exit_signal = True

    def populate_indicators(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        bb = ta.BBANDS(dataframe, timeperiod=20, nbdevup=2.0, nbdevdn=2.0)
        dataframe["bb_upper"] = bb["upperband"]
        dataframe["bb_mid"] = bb["middleband"]
        dataframe["bb_lower"] = bb["lowerband"]
        dataframe["rsi"] = ta.RSI(dataframe, timeperiod=14)
        dataframe["adx"] = ta.ADX(dataframe, timeperiod=14)
        return dataframe

    def populate_entry_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        cond_short = (
            (dataframe["close"] > dataframe["bb_upper"])
            & (dataframe["rsi"] > 65)
            & (dataframe["adx"] < 25)
        )
        dataframe.loc[cond_short, "enter_short"] = 1
        dataframe.loc[cond_short, "enter_tag"] = "bb_upper_revert"

        cond_long = (
            (dataframe["close"] < dataframe["bb_lower"])
            & (dataframe["rsi"] < 35)
            & (dataframe["adx"] < 25)
        )
        dataframe.loc[cond_long, "enter_long"] = 1
        dataframe.loc[cond_long, "enter_tag"] = "bb_lower_revert"
        return dataframe

    def populate_exit_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        dataframe.loc[dataframe["close"] < dataframe["bb_mid"], "exit_short"] = 1
        dataframe.loc[dataframe["close"] > dataframe["bb_mid"], "exit_long"] = 1
        return dataframe
```

## Reference config (multi-pair)

```json
{
  "exchange": {
    "name": "hyperliquid",
    "pair_whitelist": ["BTC/USDC:USDC", "ETH/USDC:USDC", "SOL/USDC:USDC", "DOGE/USDC:USDC"]
  },
  "stake_currency": "USDC",
  "stake_amount": 75,
  "dry_run_wallet": {"USDC": 350},
  "timeframe": "4h",
  "max_open_trades": 4,
  "minimal_roi": {"0": 100.0},
  "stoploss": -0.02,
  "trading_mode": "futures",
  "margin_mode": "isolated",
  "entry_pricing": {"price_side": "same", "price_last_balance": 0.0},
  "exit_pricing": {"price_side": "same", "price_last_balance": 0.0},
  "pairlists": [{"method": "StaticPairList"}]
}
```

## Honest framing

In strong-trend windows the strategy loses small (-1.75% on BTC during the first-half strong bear). In rangy windows it shines (+9.88% on BTC second-half). The mixed-regime full-period multi-pair number (+8.77% in 162d on $350 wallet) is the credible expectation.

DOGE was the negative pair (-0.65%) — meme volatility breaks more bands than reverts to them. Use this strategy on majors.

Pair with `donchian-strong-regime` for full-regime coverage.

---

## Prior version (1h, 2.5σ, archived)

The previous version was tighter (2.5σ bands, ADX<30) on a 1h timeframe. Its own honest framing noted "5 trades in 4 months" — too rare to be useful. The 4h version produces ~3× the signal density with the same risk profile. The 1h version is preserved here for users who want a deeper-fade variant:

```python
# Archived 1h variant — fewer, deeper signals
timeframe = "1h"
# bb = ta.BBANDS(dataframe, timeperiod=100, nbdevup=2.5, nbdevdn=2.5)
# rsi gates same; adx < 30 (looser)
```

If you prefer the rarer-but-deeper setup, restore the 1h timeframe and 2.5σ. The exit logic is unchanged.
