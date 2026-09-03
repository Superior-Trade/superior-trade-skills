# Aerodrome Strategy Template

A working Freqtrade strategy shaped for AMM spot execution on Base.

Reference for the `aerodrome` skill. See SKILL.md for the workflow and safety rules.

---

## Strategy Template

```python
from freqtrade.strategy import IStrategy
import pandas as pd
import talib.abstract as ta


class AerodromeRsiStrategy(IStrategy):
    timeframe = "5m"
    process_only_new_candles = True
    startup_candle_count = 50
    minimal_roi = {"0": 0.05}
    stoploss = -0.10
    can_short = False

    def populate_indicators(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        dataframe["rsi"] = ta.RSI(dataframe, timeperiod=14)
        dataframe["ema_50"] = ta.EMA(dataframe, timeperiod=50)
        return dataframe

    def populate_entry_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        dataframe.loc[
            (dataframe["volume"] > 0)
            & (dataframe["rsi"] < 35)
            & (dataframe["close"] > dataframe["ema_50"]),
            "enter_long",
        ] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        dataframe.loc[
            (dataframe["rsi"] > 65),
            "exit_long",
        ] = 1
        return dataframe
```

Rules for generated strategy code:

- Implement `populate_indicators`, `populate_entry_trend`, and `populate_exit_trend`.
- Use `enter_long` and `exit_long` only. Do not use `enter_short`.
- Do not do custom network calls from strategy hot paths.
- Do not rely on bid/ask spread, order-book imbalance, depth, or maker/taker limit placement.
- If using multi-output TA-Lib functions such as `BBANDS`, `MACD`, or `STOCH`, assign their returned columns explicitly.
