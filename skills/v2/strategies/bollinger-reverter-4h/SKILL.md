---
name: bollinger-reverter-4h
description: Use when writing a symmetric Bollinger-band mean-reversion strategy on the 4h timeframe — anything described as BB reverter, range trader, chop strategy, ADX-gated mean reversion, band-fade with ROI ladder. Long-or-short on 2σ band touches with RSI confirmation, gated to ADX<25 range regimes. Validated +8.77%/65.5% win across BTC/ETH/SOL/DOGE over 162d; depends entirely on its minimal_roi ladder (2.5% → 1.5% → 0.5% → breakeven). Pairs with donchian-strong-regime for full-regime coverage.
version: 0.1.0
updated: 2026-05-18
---

# Bollinger Reverter 4h

Symmetric mean-reversion strategy on the 4h timeframe. Long-or-short on band touches, gated to range regimes via ADX. Validated across BTC/ETH/SOL/DOGE over 162 days.

Searchable under: **mean reversion**, **bollinger band**, **range trader**, **chop strategy**, **ADX filter**.

## Backtest evidence

| Config | Trades | Win rate | Profit | Max DD |
|---|---|---|---|---|
| BTC/USDC:USDC, 162d | 18 | 72.2% | **+8.14%** | 10% |
| BTC/USDC:USDC, second-half / chop (80d) | 8 | **100%** | **+9.88%** | **0%** |
| BTC/USDC:USDC, first-half / strong bear (82d) | 10 | 50% | -1.75% | 10% |
| Multi-pair (BTC/ETH/SOL/DOGE), 162d | 84 | **65.5%** | **+8.77%** | 18.5% |

Per-pair breakdown (multi-pair 162d):

| Pair | Trades | Win | Profit |
|---|---|---|---|
| BTC/USDC:USDC | 29 | 72% | +3.76% |
| ETH/USDC:USDC | 19 | 74% | +4.39% |
| SOL/USDC:USDC | 15 | 60% | +1.27% |
| DOGE/USDC:USDC | 21 | 52% | -0.65% |

3 of 4 majors profitable, DOGE marginally negative. Generalizes well; not BTC-specific.

## Thesis

When the market is range-bound (ADX < 25), price touching the upper or lower Bollinger Band is statistically likely to revert to the midline. Tight ROI ladder takes profit fast since mean-reversion targets are small; tight stop prevents the position from holding if the band touch turns into a trend break.

## Mechanics

- **Pair:** validated on majors; extend to any pair with sustained 24h volume > $50M
- **Timeframe:** 4h
- **Indicators:** 20-bar Bollinger Bands (2σ), RSI(14), ADX(14)
- **Entry short:** `close > upper_band` AND `RSI > 65` AND `ADX < 25`
- **Entry long:** `close < lower_band` AND `RSI < 35` AND `ADX < 25`
- **Exit short:** `close < bb_mid`
- **Exit long:** `close > bb_mid`
- **Stops:** -2% hard stop
- **ROI ladder:** 2.5% immediate, 1.5% after 4h, 0.5% after 12h, breakeven after 24h
- **No trailing stop** (mean reversion targets are short — let ROI or signal-exit fire)

## Full strategy code

```python
from freqtrade.strategy import IStrategy
import pandas as pd
import talib.abstract as ta


class BollingerReverter4hStrategy(IStrategy):
    INTERFACE_VERSION = 3
    timeframe = "4h"
    can_short = True

    stoploss = -0.02
    trailing_stop = False

    minimal_roi = {
        "0": 0.025,    # take 2.5% immediately
        "240": 0.015,  # 1.5% after 4 hours (1 bar)
        "720": 0.005,  # 0.5% after 12 hours (3 bars)
        "1440": 0,     # breakeven after 24 hours
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

Strategy-level `minimal_roi` overrides config-level — the ROI ladder is what makes this work.

## Honest framing

The 100% second-half BTC win rate is partly small sample (8 trades). The full-period multi-pair result (+8.77%, 84 trades, 65.5% win) is the more credible expectation. **Range-bound regimes are when this prints**; in strong trends it modestly loses (-1.75% on BTC during the first-half strong bear) because band touches keep continuing rather than reverting.

In any window with **mixed regimes**, the strategy should be net positive because the chop periods dominate by count.

The DOGE result (-0.65%) is the failure case — meme-coin volatility breaks more bands than reverts to them. Use this strategy on majors, not meme pairs.

## Tunables

| Parameter | Range | Effect |
|---|---|---|
| BB period | 18 - 24 | Length of mean-reversion window |
| BB σ | 1.8 - 2.5 | Wider = rarer signals, deeper reversion |
| RSI confirmation | 60-70 / 30-40 | Confirms exhaustion at band edge |
| ADX cutoff | 20 - 30 | Below = range regime; above = trend (skip) |
| ROI tier 0 | 0.020 - 0.030 | Initial take-profit |
| Stop | -0.015 to -0.025 | Tight enough that one trend break doesn't erase the lifetime edge |

## Known failure modes

- **Regime transition**: when chop turns into trend mid-trade, the band-touch-revert signal becomes a band-break-continuation. Stops should fire fast; this is what the -2% stop is for
- **Meme/low-cap pairs**: bands break more than they revert. Restrict to majors
- **News spikes**: a sudden 5%+ move blows through multiple bands; the stop will fire but execution slippage hurts. Consider pausing during scheduled macro events

## Pairing

- Designed to coexist with `donchian-strong-regime` — they fire on mutually exclusive regimes (ADX < 25 here, regime-strong gate there)
- Supersedes the prior 1h variant of `mean-reversion`

## Deployment recommendation

Run as its own sub-account with stake_amount sized so 4× max_open_trades fits within the wallet plus 1.5× buffer. Multi-pair allocation across BTC/ETH/SOL is the validated default.
