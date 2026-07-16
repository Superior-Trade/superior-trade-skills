---
name: dca-weekly
description: Use when writing, validating, or troubleshooting a recurring scheduled buy strategy (DCA, dollar-cost averaging, weekly buys, daily buys, monthly accumulation, accumulator) on Superior Trade — especially anything that should "buy more of the same pair" on a calendar trigger rather than a price trigger.
version: 0.1.0
updated: 2026-05-07
---

# Strategy: DCA · Scheduled Buys

## When to use

A user asks to "buy X every week", "DCA into BTC", "scheduled buy", "accumulator", "monthly buy", or any variation that means *open a position once, then keep adding to it on a calendar cadence*. **Not** for "buy when price drops" — that's grid trading (see `grid-trading`).

## What it does

- Holds **one open trade per pair** (Freqtrade's hard rule).
- The first calendar trigger opens the trade with a **small** initial stake.
- Every subsequent trigger calls `adjust_trade_position` and adds the **same notional** to the open trade.
- The position grows in fills inside a single Trade row. PnL is reported per-trade.
- Exits only when the user sets one (typically never, for true DCA — `stoploss = -0.99` and no `populate_exit_trend`).

## Backtest reference

| Window | `BTC/USDC` 1d, 2025-11-15 → 2026-05-01 (auto-narrowed to data availability, ~10 weeks) |
|---|---|
| Trades | 1 (still open at end, force-closed) |
| Entry orders inside the trade | **10** (1 initial + 9 weekly DCA, tagged `weekly_dca`) |
| Stake per buy | ~$36.87 |
| Total invested | ~$365 of $10,000 wallet |
| Per-trade PnL | +10.0% |
| Wallet PnL | +0.37% / +$36.61 |
| Holding | 66 days |
| Backtest ID | `01kqyz1ysdy9dyw7tbdrhz5gek` |

The `(rejected_signals: 9)` warning in logs is normal: `populate_entry_trend` keeps emitting Monday flags even while a trade is open, but `adjust_trade_position` does the actual buys.

## The Freqtrade primitives that make this work

These four flags are the difference between v1 (1 trade ever, the rest rejected) and v2 (a real ladder of fills). All four are required:

```python
position_adjustment_enable = True
max_entry_position_adjustment = 26   # cap on number of weekly adds
max_dca_multiplier = 27.0            # 1 initial + 26 adds
```

Plus two callbacks:
- `custom_stake_amount` — divides the user-configured stake by `max_dca_multiplier` so the **initial** entry leaves room for the future weekly adds.
- `adjust_trade_position` — the calendar trigger. Returns `(stake, tag)` to add, `None` to do nothing.

## Reference implementation

```python
from freqtrade.strategy import IStrategy
from freqtrade.persistence import Trade
from datetime import datetime
import pandas as pd


class WeeklyDcaBtcStrategy(IStrategy):
    minimal_roi = {"0": 100.0}   # never exit on profit target
    stoploss = -0.99             # never exit on stop
    trailing_stop = False
    timeframe = "1d"
    process_only_new_candles = True
    startup_candle_count = 5
    can_short = False

    # The piece naive translations miss.
    position_adjustment_enable = True
    max_entry_position_adjustment = 26   # ~6 months of weekly buys
    max_dca_multiplier = 27.0            # 1 initial + 26 weekly adds

    def populate_indicators(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        dataframe["dow"] = pd.to_datetime(dataframe["date"]).dt.dayofweek
        return dataframe

    def populate_entry_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        # Initial entry on the first Monday encountered.
        dataframe.loc[(dataframe["dow"] == 0) & (dataframe["volume"] > 0), "enter_long"] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        return dataframe

    def custom_stake_amount(self, pair: str, current_time: datetime, current_rate: float,
                            proposed_stake: float, min_stake, max_stake: float,
                            leverage: float, entry_tag, side: str, **kwargs) -> float:
        # Reserve room for the future weekly adds.
        return proposed_stake / self.max_dca_multiplier

    def adjust_trade_position(self, trade: Trade, current_time: datetime,
                              current_rate: float, current_profit: float,
                              min_stake, max_stake: float,
                              current_entry_rate: float, current_exit_rate: float,
                              current_entry_profit: float, current_exit_profit: float,
                              **kwargs):
        if trade.has_open_orders:
            return None
        if current_time.weekday() != 0:   # Monday only
            return None
        # Skip the Monday on which the initial entry was placed (Freqtrade
        # calls adjust_trade_position on the same candle as the initial
        # entry; without this guard you double-buy on week 1).
        filled = trade.select_filled_orders(trade.entry_side)
        if filled:
            last_dt = filled[-1].order_filled_utc
            if last_dt and last_dt.date() == current_time.date():
                return None
        # Buy the same notional as the initial entry every Monday.
        first_stake = filled[0].stake_amount_filled if filled else (min_stake or 10)
        return (first_stake, "weekly_dca")
```

## Config requirements

```json
{
  "exchange": { "name": "hyperliquid", "pair_whitelist": ["BTC/USDC"] },
  "stake_currency": "USDC",
  "stake_amount": 1000,
  "dry_run_wallet": 10000,
  "timeframe": "1d",
  "max_open_trades": 1,
  "stoploss": -0.99,
  "minimal_roi": { "0": 100.0 },
  "entry_pricing": { "price_side": "same" },
  "exit_pricing": { "price_side": "same" },
  "pairlists": [{ "method": "StaticPairList" }]
}
```

`stake_amount` is the **post-division** budget the user wants per buy times `max_dca_multiplier`. With `stake_amount: 1000` and `max_dca_multiplier: 27`, each Monday buy is ~$37; total budget is ~$1000.

`dry_run_wallet` must be ≥ `stake_amount` (Freqtrade keeps a 1% reserve, so the strict gate is `stake_amount ≤ dry_run_wallet × 0.99`). Default `dry_run_wallet` is 1000; bump it up if you raise stake.

## Common pitfalls

1. **No `position_adjustment_enable`.** Without it, repeat Monday flags are silently rejected and you get one trade ever. The classic v1 mistake.
2. **No same-day guard in `adjust_trade_position`.** Without the `filled[-1].order_filled_utc.date() == current_time.date()` check, the strategy double-buys on the Monday the initial entry was placed.
3. **Forgetting to scale `stake_amount`.** Without `custom_stake_amount` returning `proposed_stake / max_dca_multiplier`, the first buy uses the full configured stake and the wallet runs out before week 5.
4. **Using `populate_exit_trend` to "exit half".** Doesn't work — Freqtrade only knows full exits via `populate_exit_trend`. Partial exits go through `adjust_trade_position` returning a *negative* stake.
5. **Setting `stoploss` ≥ -0.5.** A real DCA isn't supposed to stop out on a 50% drawdown. Use `-0.99` so the stop never triggers, then exit manually if needed.

## Variants

- **Daily / monthly cadence**: change `current_time.weekday() != 0` to `current_time.day != 1` (1st of month) or remove the guard entirely (every candle close).
- **Drawdown-aware DCA**: add a check on `current_profit < -0.10` to add EXTRA on top of the calendar — buy more when down 10%. Combine the calendar check with `current_profit < threshold`.
- **Spot vs futures**: works on both. Use `BTC/USDC` for spot (`trading_mode: "spot"` or omit) or `BTC/USDC:USDC` for perp (`trading_mode: "futures"`, `margin_mode: "cross"`). DCA is most idiomatic on spot.

## Sources

- Freqtrade `adjust_trade_position` — https://www.freqtrade.io/en/stable/strategy-callbacks/#adjust-trade-position
- DigDeeperStrategy reference — https://github.com/freqtrade/freqtrade/issues/7052
- Internal audit — `docs/standard-strategies-audit.md`, backtest `01kqyz1ysdy9dyw7tbdrhz5gek`
