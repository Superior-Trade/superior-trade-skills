---
name: funding-rate-arbitrage
description: Use when writing a funding-rate-driven perp strategy on Superior Trade — anything described as funding harvest, funding arbitrage, funding rate carry, negative funding, paid to long, paid to short, basis trade. The strategy reads Hyperliquid hourly funding via `dp.get_pair_dataframe(candle_type="funding_rate")`, which is automatically downloaded for backtests.
version: 0.1.0
updated: 2026-05-07
---

# Strategy: Funding · Negative-Rate Harvest

## When to use

A user wants to capture funding payments by being on the side that gets paid:

- Long a perp when funding APR is **deeply negative** (shorts paying longs).
- Short a perp when funding APR is **deeply positive** (longs paying shorts) — variant below.

This is the most profitable of the six standard templates in our audit and the engine supports it natively. **Promote this template** when a user asks "what's a strategy that actually works?".

## Backtest reference (the real one)

| Window | `BTC/USDC:USDC` 1h, 2026-01-01 → 2026-05-01 (BTC −13% over the window) |
|---|---|
| Trades | **55** |
| Win rate | **58.2%** |
| Wallet PnL | **+1.38% / +$13.76** |
| Profit factor | 1.57 |
| Sharpe | **1.52** |
| Max drawdown | 0.58% |
| Avg holding | 9h 40m |
| Backtest ID | `01kqyz3ejgy5b7tdemhb6gj9nf` |

**~+4% APR on a single pair** through a market that fell 13%. A multi-pair scan (e.g. top 20 perps) compounds this.

## The Freqtrade primitive that makes this work

The DataProvider exposes funding-rate candles directly. **No Hyperliquid REST call from inside the strategy is needed** for backtest — Freqtrade auto-downloads funding history when it sees a `candle_type="funding_rate"` request:

```python
funding = self.dp.get_pair_dataframe(
    pair=metadata["pair"],
    timeframe="1h",          # Hyperliquid funds hourly
    candle_type="funding_rate",
)
```

The returned dataframe has the same shape as OHLCV — `date`, `open`, `high`, `low`, `close`, `volume` — but `open` is the funding rate at the start of that hour, expressed as a fraction (`-0.0000135` = -0.0014% per hour). Annualize as `funding_rate * 24 * 365`.

The naive v1 (placeholder column filled with 0.0) produced **0 trades**. v2 with `dp.get_pair_dataframe(...)` produced 55 trades and Sharpe 1.52.

## Reference implementation

```python
from freqtrade.strategy import IStrategy
from datetime import datetime
import pandas as pd
import talib.abstract as ta


class FundingHarvestStrategy(IStrategy):
    minimal_roi = {"0": 100.0}   # let funding work; no profit-target exit
    stoploss = -0.05
    trailing_stop = False
    timeframe = "1h"
    process_only_new_candles = True
    startup_candle_count = 30
    can_short = False

    def populate_indicators(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        # Hyperliquid funds hourly — request 1h funding-rate candles.
        try:
            funding = self.dp.get_pair_dataframe(
                pair=metadata["pair"],
                timeframe="1h",
                candle_type="funding_rate",
            )
        except Exception:
            funding = pd.DataFrame()

        if not funding.empty and "open" in funding.columns:
            f = funding[["date", "open"]].rename(columns={"open": "funding_rate"}).copy()
            dataframe = dataframe.merge(f, on="date", how="left")
            dataframe["funding_rate"] = dataframe["funding_rate"].ffill().fillna(0.0)
            # Annualize hourly funding: APR = rate * 24 * 365.
            dataframe["funding_apr"] = dataframe["funding_rate"] * 24 * 365
        else:
            dataframe["funding_rate"] = 0.0
            dataframe["funding_apr"] = 0.0

        dataframe["atr_24"] = ta.ATR(dataframe, timeperiod=24)
        return dataframe

    def populate_entry_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        # Long when funding APR is deeply negative (shorts paying longs).
        dataframe.loc[
            (dataframe["funding_apr"] < -0.10) & (dataframe["volume"] > 0),
            "enter_long",
        ] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        # Exit when funding flips back to non-negative (no more carry).
        dataframe.loc[(dataframe["funding_apr"] >= 0.0), "exit_long"] = 1
        return dataframe

    def custom_exit(self, pair: str, trade, current_time: datetime,
                    current_rate: float, current_profit: float, **kwargs):
        # Hard timeout — the entry condition was wrong if we're still in
        # after 24h without an exit signal.
        elapsed_h = (current_time - trade.open_date_utc).total_seconds() / 3600.0
        if elapsed_h >= 24:
            return "timeout_24h"
        return None
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
  "entry_pricing": { "price_side": "same" },
  "exit_pricing": { "price_side": "same" },
  "pairlists": [{ "method": "StaticPairList" }]
}
```

**Pair format must be `<COIN>/USDC:USDC`** (futures). `BTC/USDC` (spot) won't have funding rate data.

## Tunable parameters

| Knob | Effect |
|---|---|
| `-0.10` (entry threshold APR) | Stricter (`-0.20`) → fewer trades, only the deepest negative funding episodes. Looser (`-0.05`) → more trades, lower edge per trade. |
| `>= 0.0` (exit threshold) | Stricter (`>= -0.05`) → exit before funding fully normalizes, lock more carry. |
| `stoploss` | Funding pays slowly. A tight stop (`-0.02`) gets shaken out by routine volatility. `-0.05` is the sweet spot from the audit. |
| `timeout_24h` | Max holding. Funding episodes typically last 4–12h on majors; 24h is a safety net. |

## Variants

- **Short variant** (positive funding harvest): set `can_short = True`, `enter_short` when `funding_apr > 0.30`, `exit_short` when `funding_apr <= 0.0`. Profitable when alts are paying high positive funding (squeezes).
- **Multi-pair scan**: replace `StaticPairList` with `VolumePairList` filtered to top 20 perps. Loop the same logic per pair. PnL compounds.
- **Combine with delta-neutral hedge**: short the spot leg while long the perp to lock pure funding yield. Requires two-account setup; outside this strategy.

## Common pitfalls

1. **Spot pair instead of perp.** `BTC/USDC` returns no funding rate — the column will be all zeros and zero trades fire. Always use `BTC/USDC:USDC`.
2. **Non-Hyperliquid exchange.** This works on Hyperliquid because `dp.get_pair_dataframe(candle_type="funding_rate")` is wired up for HL. Other exchanges may return empty.
3. **No fallback for missing data.** The `try/except` plus the `dataframe.empty` check matters — if funding history isn't downloaded yet, the strategy must not crash. The reference above handles both.
4. **Misreading the unit.** `funding_rate` is per-hour (HL funds hourly). Annualizing as `* 365` instead of `* 24 * 365` is off by 24×.
5. **Treating Sharpe 1.52 as a forward predictor.** The audit window (Jan-May 2026) had unusually negative funding episodes during BTC's drawdown. Forward results will vary; always run a fresh backtest before deploying live.

## Sources

- Freqtrade DataProvider — https://www.freqtrade.io/en/stable/strategy-customization/
- Hyperliquid funding mechanics — https://hyperliquid.gitbook.io/hyperliquid-docs/trading/funding
- Internal audit — `docs/standard-strategies-audit.md`, backtest `01kqyz3ejgy5b7tdemhb6gj9nf`
