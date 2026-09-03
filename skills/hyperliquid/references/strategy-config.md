# Config and Strategy Authoring

Freqtrade config fields, the strategy code template, TA-Lib usage, and multi-entry patterns.

Reference for the `hyperliquid` skill. See SKILL.md for the workflow and safety rules.

---

## Config and Strategy Authoring

### Config Reference

The config object is a Freqtrade trading bot configuration. Do not include `api_server` (platform-managed). To run in **dry-run/paper mode**, skip the credentials step — a deployment without credentials trades in simulation. Do not set `dry_run` manually in config.

#### Futures Config (recommended)

```json
{
  "exchange": { "name": "hyperliquid", "pair_whitelist": ["BTC/USDC:USDC"] },
  "stake_currency": "USDC",
  "stake_amount": 100,
  "dry_run_wallet": { "USDC": 1000 },
  "timeframe": "5m",
  "max_open_trades": 3,
  "minimal_roi": { "0": 100.0 },
  "stoploss": -0.1,
  "trading_mode": "futures",
  "margin_mode": "cross",
  "entry_pricing": { "price_side": "same", "price_last_balance": 0.0 },
  "exit_pricing": { "price_side": "same", "price_last_balance": 0.0 },
  "pairlists": [{ "method": "StaticPairList" }]
}
```

#### Spot Config

Same as futures but omit `trading_mode` and `margin_mode`. Pairs use `BTC/USDC` format (no `:USDC` suffix). Stoploss on exchange not supported for spot.

#### HIP3 Config Example

```json
{
  "exchange": {
    "name": "hyperliquid",
    "pair_whitelist": ["XYZ-AAPL/USDC:USDC"]
  },
  "stake_currency": "USDC",
  "stake_amount": 100,
  "dry_run_wallet": { "USDC": 1000 },
  "timeframe": "15m",
  "max_open_trades": 3,
  "minimal_roi": { "0": 100.0 },
  "stoploss": -0.05,
  "trading_mode": "futures",
  "margin_mode": "isolated",
  "entry_pricing": { "price_side": "same", "price_last_balance": 0.0 },
  "exit_pricing": { "price_side": "same", "price_last_balance": 0.0 },
  "pairlists": [{ "method": "StaticPairList" }]
}
```

#### Additional Config Fields

Other common config fields include `trailing_stop` (boolean), `trailing_stop_positive` (number), `entry_pricing.price_side` / `exit_pricing.price_side` (`"ask"`, `"bid"`, `"same"`, `"other"`), and `pairlists` (`StaticPairList`, `VolumePairList`, etc.). Use `"same"` as the default pricing side. `"other"` crosses the spread for faster fills and is mainly appropriate when intentionally modeling market-order-style execution.

### Strategy Code Template

The `code` field must be valid Python with a strategy class. Class name must end with `Strategy` in PascalCase. Use `import talib.abstract as ta` for indicators.

```python
from freqtrade.strategy import IStrategy
import pandas as pd
import talib.abstract as ta


class MyCustomStrategy(IStrategy):
    minimal_roi = {"0": 0.10, "30": 0.05, "120": 0.02}
    stoploss = -0.10
    trailing_stop = False
    timeframe = '5m'
    process_only_new_candles = True
    startup_candle_count = 20

    def populate_indicators(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        dataframe['rsi'] = ta.RSI(dataframe, timeperiod=14)
        dataframe['sma_20'] = ta.SMA(dataframe, timeperiod=20)
        return dataframe

    def populate_entry_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        dataframe.loc[
            (dataframe['rsi'] < 30) & (dataframe['close'] > dataframe['sma_20']),
            'enter_long'
        ] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        dataframe.loc[(dataframe['rsi'] > 70), 'exit_long'] = 1
        return dataframe
```

**Requirements:** Must use standard imports/inheritance (see template), `import talib.abstract as ta` for indicators, define `populate_indicators`, `populate_entry_trend`, `populate_exit_trend`.

### Multi-Output TA-Lib Functions (CRITICAL)

Some TA-Lib functions return **multiple columns**. Assigning directly to one column causes a runtime crash.

| Function                    | Returns                                |
| --------------------------- | -------------------------------------- |
| `ta.BBANDS`                 | `upperband`, `middleband`, `lowerband` |
| `ta.MACD`                   | `macd`, `macdsignal`, `macdhist`       |
| `ta.STOCH`                  | `slowk`, `slowd`                       |
| `ta.STOCHF` / `ta.STOCHRSI` | `fastk`, `fastd`                       |
| `ta.AROON`                  | `aroondown`, `aroonup`                 |
| `ta.HT_PHASOR`              | `inphase`, `quadrature`                |
| `ta.MAMA`                   | `mama`, `fama`                         |
| `ta.MINMAXINDEX`            | `minidx`, `maxidx`                     |

```python
# WRONG — runtime crash
dataframe["bb_upper"] = ta.BBANDS(dataframe, timeperiod=20)

# CORRECT
bb = ta.BBANDS(dataframe, timeperiod=20)
dataframe["bb_upper"] = bb["upperband"]
dataframe["bb_middle"] = bb["middleband"]
dataframe["bb_lower"] = bb["lowerband"]

macd = ta.MACD(dataframe)
dataframe["macd"] = macd["macd"]
dataframe["macd_signal"] = macd["macdsignal"]
dataframe["macd_hist"] = macd["macdhist"]

stoch = ta.STOCH(dataframe)
dataframe["slowk"] = stoch["slowk"]
dataframe["slowd"] = stoch["slowd"]
```

Single-output functions (RSI, SMA, EMA, ATR, ADX) return a Series and can be assigned directly.

### Multi-Entry Strategies — DCA, Grid, Scaling-In

The engine enforces **one open trade per pair**. A second `enter_long = 1` while a position is open is silently rejected. Anything that wants to "buy more of the same thing" — DCA, scaling-in, grid laddering, weekly buys — must use `adjust_trade_position`, not repeated entry signals.

Config and strategy code must be set together. If using dynamic stake, keep `max_open_trades` finite and divide the initial entry in `custom_stake_amount` so later adjustment orders have wallet room.

```python
class MyStrategy(IStrategy):
    position_adjustment_enable = True    # required for adjust_trade_position to fire
    max_entry_position_adjustment = 5    # cap on additional entries (-1 = unlimited)
    max_dca_multiplier = 6.0             # initial size × (1 + planned adds)

    def custom_stake_amount(self, pair, current_time, current_rate, proposed_stake,
                            min_stake, max_stake, leverage, entry_tag, side, **kwargs):
        # MANDATORY: divide initial entry so room remains for future adds.
        return proposed_stake / self.max_dca_multiplier
```

Fixed `stake_amount` is also valid with position adjustment, but the wallet must still have enough free balance for the planned additional entries. With `"unlimited"` stake, `custom_stake_amount` is mandatory to avoid allocating the whole wallet to the initial order.

`adjust_trade_position` is called very frequently while a trade is open: in dry-run/live it runs every bot loop (about every 5 seconds by default), while backtesting runs it once per candle (`timeframe` or `timeframe_detail`). Return positive = add stake, negative = partial close, `None` = do nothing. Keep the logic strict and always check the last filled order / open orders so the bot cannot re-enter repeatedly while one condition remains true.

**Pattern A — Profit-driven DCA (averaging down):**

```python
def adjust_trade_position(self, trade, current_time, current_rate, current_profit,
                          min_stake, max_stake, *args, **kwargs):
    if trade.has_open_orders:
        return None
    n_entries = trade.nr_of_successful_entries
    if n_entries <= self.max_entry_position_adjustment and current_profit <= -0.025 * n_entries:
        first_stake = trade.select_filled_orders(trade.entry_side)[0].stake_amount_filled
        return (first_stake, f"dca_buy_{n_entries}")
    return None
```

**Pattern B — Schedule-driven DCA (weekly / daily fixed-time buys).** Gate on `current_time.weekday()` / `.hour`. **Critical**: include a same-day guard, otherwise the initial entry's Monday and `adjust_trade_position`'s Monday collide and double-buy:

```python
def adjust_trade_position(self, trade, current_time, current_rate, current_profit,
                          min_stake, max_stake, *args, **kwargs):
    if trade.has_open_orders:
        return None
    if current_time.weekday() != 0:  # Monday only
        return None
    filled = trade.select_filled_orders(trade.entry_side)
    if filled and filled[-1].order_filled_utc.date() == current_time.date():
        return None  # same-day guard
    first_stake = filled[0].stake_amount_filled
    return (first_stake, "weekly_dca")
```

**Pattern C — Grid / range fade with laddered buys + partial profits:**

```python
def adjust_trade_position(self, trade, current_time, current_rate, current_profit,
                          min_stake, max_stake, *args, **kwargs):
    if trade.has_open_orders:
        return None
    n_entries = trade.nr_of_successful_entries
    n_exits = trade.nr_of_successful_exits
    # Ladder buys at every -1% drawdown, up to 5 rungs
    if n_entries <= 5 and current_profit <= -0.01 * n_entries:
        first = trade.select_filled_orders(trade.entry_side)[0].stake_amount_filled
        return (first, f"grid_buy_{n_entries}")
    # Partial profit-takes at every +1.5% above avg, up to 3
    if n_exits < 3 and current_profit >= 0.015 * (n_exits + 1):
        return (-(trade.stake_amount / 4.0), f"grid_tp_{n_exits}")
    return None
```

A true 20-rung grid (multiple simultaneous orders at distinct price levels) is NOT supported by Freqtrade. Pattern C is the closest faithful approximation — describe it as "laddered range fade" not "20-level grid."

**Hyperliquid minimum: $10 per order.** Engine inflates by stoploss reserve (up to 1.5x) — always use `min_stake` as a floor.

`max_open_trades` limits total concurrent trades across all pairs, not entries per pair.

### Funding Rate (Futures Only)

For "harvest negative funding" / "long when shorts pay longs" / any funding-aware strategy, the historical funding rate is **automatically downloaded** for backtest. Do not poll Hyperliquid's REST API from inside the strategy. Hyperliquid pays funding hourly. The example below assumes the strategy timeframe is `1h` or faster; do not merge a faster funding timeframe into a slower strategy timeframe without first resampling/alignment:

```python
from freqtrade.strategy import merge_informative_pair


def populate_indicators(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
    funding_tf = "1h"
    funding = self.dp.get_pair_dataframe(
        pair=metadata["pair"],
        timeframe=funding_tf,
        candle_type="funding_rate",
    )
    if not funding.empty and "open" in funding.columns:
        funding = funding[["date", "open"]].rename(columns={"open": "funding_rate"})
        dataframe = merge_informative_pair(
            dataframe,
            funding,
            self.timeframe,
            funding_tf,
            ffill=True,
        )
        dataframe["funding_rate"] = dataframe[f"funding_rate_{funding_tf}"].fillna(0.0)
        dataframe["funding_apr"] = dataframe["funding_rate"] * 24 * 365
    else:
        dataframe["funding_rate"] = 0.0
        dataframe["funding_apr"] = 0.0
    return dataframe
```

Available only for futures pairs (`BTC/USDC:USDC`), not spot.

### Required Config Fields

The schema validator rejects payloads that omit any of these — **even when the strategy class declares its own equivalent**:

- `entry_pricing` and `exit_pricing` — both required. Safe default: `{"price_side": "same", "price_last_balance": 0.0}`.
- `minimal_roi` — required at the config level. Use `{"0": 100.0}` to effectively disable config-level ROI and let the strategy's own exit logic run.
- `dry_run_wallet` — must contain enough `stake_currency` balance for the configured `stake_amount` and `max_open_trades`, **plus ~50% buffer** to cover fees, funding payments, and slippage. For `stake_amount: 1000` and `max_open_trades: 1`, use at least `{ "USDC": 1500 }`. For futures multi-pair setups, scale up by `max_open_trades`. Tighter buffers (≤10%) cause silent signal rejection mid-run. For DCA / grid strategies that ladder up to `max_dca_multiplier × initial`, set `dry_run_wallet ≈ stake_amount × 10`. See the "Backtest Wallet and Stake Sizing" section above for the full sizing rationale.

### Choosing a `minimal_roi` shape

The class-level `minimal_roi = {"0": 100.0}` pattern fully disables ROI take-profit.
Use it ONLY when your strategy has a signal-driven exit (`populate_exit_trend`) that
fires on most bars where the trade should close — typically trend-follow strategies
with structural exits like "break of N-bar high" or trailing stops.

For mean-reversion, scalp, range, and any strategy where wins are small (under ~3%),
use an explicit ROI ladder:

```python
minimal_roi = {
    "0":    0.025,   # take 2.5% immediately if available
    "240":  0.015,   # 1.5% after 4 hours (relevant for 1h+ timeframes)
    "720":  0.005,   # 0.5% after 12 hours
    "1440": 0,       # breakeven after 24 hours — close any open position
}
```

The keys are **minutes since trade open**. Tiers decay so stale trades close at breakeven
rather than sitting forever. Without an ROI ladder, mean-reversion strategies give back
wins waiting for a signal exit that may never come.

See `dsl-exit-engine` for full Phase 0 / Phase 1 / Phase 2 guidance.

### `stake_amount: "unlimited"` Warning

`"unlimited"` bypasses minimum-order validation. The bot starts but **silently executes zero trades** if balance is insufficient — no error, just heartbeats. For simple single-entry strategies, prefer explicit numeric `stake_amount` with small balances (<$50). For strategies using `position_adjustment_enable` and `adjust_trade_position`, fixed stake is valid if enough wallet balance remains for planned adds; if `stake_amount` is `"unlimited"`, use `custom_stake_amount` to divide the first entry so there is room for later adds.

Do **not** set both `stake_amount: "unlimited"` and `max_open_trades: -1`. Use a finite positive `max_open_trades` instead. For single-pair DCA/grid/scaling strategies, use `max_open_trades: 1`; repeated same-pair entries come from `adjust_trade_position`, not extra open-trade slots.

| Stoploss | Effective minimum |
| -------- | ----------------- |
| -0.5%    | ~$10.55           |
| -5%      | ~$11.05           |
| -10%     | ~$11.67           |
| -30%     | ~$15.00           |
