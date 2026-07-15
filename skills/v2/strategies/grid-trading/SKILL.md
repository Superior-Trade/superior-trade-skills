---
name: grid-trading
description: Use when writing a profit-laddered position-adjustment strategy on Superior Trade — anything described as a grid bot, range fade, range harvest, ladder buy, scaling-in, pyramiding, or "buy more when it dips and sell partials when it rallies". Note this is a profit-driven ladder, not a true 20-rung order-book grid; explain that limitation when the user asks for true grid trading.
version: 0.1.0
updated: 2026-05-07
---

# Strategy: Grid · Range Fade (laddered)

## When to use

A user asks for "grid trading", "grid bot", "range fade", "ladder buy", "scale into the dip", "pyramid into a position", "DCA on drawdown" (*not* on calendar — that's `strategy-dca-weekly`). Anything where the trigger to add is a **price drawdown**, and there are **partial take-profits** on the way up.

## Important caveat — explain this upfront

Freqtrade is a **one-trade-per-pair** engine. A real 20-rung grid bot — placing 20 limit orders simultaneously on the order book and refilling each as it fills — is **not possible** without engine changes. What you can implement is a **profit-laddered position adjustment**:

- 1 initial entry at a trigger price
- Up to N additional entries, each at a deeper drawdown step (−1%, −2%, …)
- Partial take-profits at progressive profit steps (+1.5%, +3%, +4.5%, …)
- Hard exit on a band breakout

This is a working, profitable approximation of the spirit of grid trading. If the user explicitly wants 100s of small fills per day on a tight book, **say so** and recommend running a separate grid runtime alongside Freqtrade.

## Backtest reference

| Window | `ETH/USDC` 15m, 2026-03-01 → 2026-05-01 (61 days) |
|---|---|
| Trades | 4 |
| Win rate | **100%** |
| Wallet PnL | +0.66% / +$65.58 |
| Sharpe | **2.02** |
| Profit per trade | $15-30 |
| Avg holding | 14 days |
| Max DD | 0% (intraday only) |
| Backtest ID | `01kqyz25d0zrwwf5fzccjk44dk` |

Order pattern per trade: 2 entries (`""` initial + `grid_buy_1`) + 4 partial exits at `grid_tp_*` tags. Sparse — 4 trades over 61 days — because the 24h VWAP −1% trigger fires rarely on ETH. Tighten the trigger (e.g. `vwap × 0.995`) for more activity.

## Reference implementation

```python
from freqtrade.strategy import IStrategy
from freqtrade.persistence import Trade
from datetime import datetime
import pandas as pd


class EthGridStrategy(IStrategy):
    minimal_roi = {"0": 100.0}   # never auto-close on ROI; partials handled in adjust_trade_position
    stoploss = -0.30             # safety net, deeper than the deepest ladder rung
    trailing_stop = False
    timeframe = "15m"
    process_only_new_candles = True
    startup_candle_count = 200
    can_short = False

    position_adjustment_enable = True
    max_entry_position_adjustment = 5   # 5 ladder rungs below entry
    max_dca_multiplier = 6.0            # 1 + 5 adds

    def populate_indicators(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        # 24h VWAP on 15m bars (96 bars).
        tp = (dataframe["high"] + dataframe["low"] + dataframe["close"]) / 3.0
        pv = tp * dataframe["volume"]
        dataframe["vwap_24h"] = (
            pv.rolling(96).sum() / dataframe["volume"].rolling(96).sum()
        )
        return dataframe

    def populate_entry_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        # First grid rung: 1% below 24h VWAP.
        dataframe.loc[
            (dataframe["close"] <= dataframe["vwap_24h"] * 0.99)
            & (dataframe["volume"] > 0),
            "enter_long",
        ] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        # Hard close on band breakout up.
        dataframe.loc[
            dataframe["close"] >= dataframe["vwap_24h"] * 1.06,
            "exit_long",
        ] = 1
        return dataframe

    def custom_stake_amount(self, pair: str, current_time: datetime, current_rate: float,
                            proposed_stake: float, min_stake, max_stake: float,
                            leverage: float, entry_tag, side: str, **kwargs) -> float:
        return proposed_stake / self.max_dca_multiplier

    def adjust_trade_position(self, trade: Trade, current_time: datetime,
                              current_rate: float, current_profit: float,
                              min_stake, max_stake: float,
                              current_entry_rate: float, current_exit_rate: float,
                              current_entry_profit: float, current_exit_profit: float,
                              **kwargs):
        if trade.has_open_orders:
            return None
        n_entries = trade.nr_of_successful_entries
        n_exits = trade.nr_of_successful_exits

        # Ladder buys: every -1% from average entry, up to 5 adds.
        if n_entries <= 5 and current_profit <= -0.01 * n_entries:
            filled = trade.select_filled_orders(trade.entry_side)
            first_stake = filled[0].stake_amount_filled if filled else (min_stake or 10)
            return (first_stake, f"grid_buy_{n_entries}")

        # Partial profit-take: every +1.5% above avg entry, up to 3 ladders.
        if n_exits < 3 and current_profit >= 0.015 * (n_exits + 1):
            return (-(trade.stake_amount / 4.0), f"grid_tp_{n_exits}")

        return None
```

## Config requirements

```json
{
  "exchange": { "name": "hyperliquid", "pair_whitelist": ["ETH/USDC"] },
  "stake_currency": "USDC",
  "stake_amount": 1000,
  "dry_run_wallet": 10000,
  "timeframe": "15m",
  "max_open_trades": 1,
  "stoploss": -0.30,
  "minimal_roi": { "0": 100.0 },
  "entry_pricing": { "price_side": "same" },
  "exit_pricing": { "price_side": "same" },
  "pairlists": [{ "method": "StaticPairList" }]
}
```

`dry_run_wallet` ≥ `stake_amount` is enforced strictly. With 6 ladder rungs, leave headroom — `dry_run_wallet ≥ stake_amount × 1.5` is comfortable.

## Tunable parameters

| Knob | Effect |
|---|---|
| `0.99` (entry trigger) | Tighter (`0.995`) → more entries, more chop. Looser (`0.97`) → rarer, deeper fades. |
| `0.01 * n_entries` (ladder spacing) | Tighter spacing → faster ladder fills, smaller gain per rung. Wider spacing → fewer rungs in chop. |
| `max_entry_position_adjustment` | More rungs → bigger position when fully laddered, more wallet exposure. |
| `0.015 * (n_exits + 1)` (TP step) | Tighter TPs → more partial closes, less per close. |
| `1.06` (band breakout) | Tighter (`1.04`) → exit earlier on rallies, capture less. |
| `trade.stake_amount / 4.0` (TP size) | Smaller divisor → bigger partial closes. `/ 2.0` halves the position per TP. |

## Common pitfalls

1. **Naive single-rung implementation.** Using `populate_entry_trend` with `close < vwap × 0.94` and `populate_exit_trend` with `close > vwap × 1.06` produced **0 trades** on the same window — ETH never reached the lower band. The laddered version captures the moves the band misses.
2. **`stoploss` too shallow.** With 5 ladder rungs at −1% spacing, a `−6%` stop kills the trade before the deepest rung fills. Use `−30%` (or deeper) and rely on partial exits.
3. **Letting `minimal_roi` close trades early.** With the default `{"0": 0.02}`, the trade exits at +2% before the partial-TP ladder ever runs. Set `{"0": 100.0}` to disable.
4. **Forgetting `current_profit` is signed.** `current_profit <= -0.01 * n_entries` reads "drawdown is at least n × 1%". Inverting the sign disables the ladder.

## Variants

- **Wider band**: `0.97` entry / `1.10` exit for trending pairs (BTC, SOL).
- **Asymmetric ladder**: more buys than sells (`max_entry_position_adjustment = 8`, only 2 partial TPs) for accumulation modes.
- **Volatility-scaled steps**: replace fixed `0.01` with `atr_pct * 0.5` to make ladder spacing follow regime.

## When grid is the wrong tool

- Strong trends (the band breakout closes the trade after one cycle).
- Pairs that gap (Hyperliquid index pairs sometimes skip the trigger price entirely).
- Tight fee budgets — every ladder rung pays maker/taker fees twice (entry and partial exit). See `fees-optimizations` for cost analysis.

## Sources

- Freqtrade `adjust_trade_position` — https://www.freqtrade.io/en/stable/strategy-callbacks/#adjust-trade-position
- Internal audit — `docs/standard-strategies-audit.md`, backtest `01kqyz25d0zrwwf5fzccjk44dk`
