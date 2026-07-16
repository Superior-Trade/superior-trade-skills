---
name: funding-squeeze
description: Use when writing a strategy that captures short-squeeze setups on Hyperliquid perps — anything described as squeeze, short squeeze fuel, negative funding rally, fade the shorts, paid to long. Goes long when funding APR is deeply negative (shorts paying longs) AND price has been rising, exits on funding normalisation or time-stop. Sibling of strategy-funding-harvest but reads the squeeze-fuel signal instead of the carry.
version: 0.1.0
updated: 2026-05-08
---

# Strategy: Funding · Short-Squeeze Fuel

## When to use

A user asks for "squeeze trade", "fade the shorts", "short squeeze fuel", "longs eat shorts", "negative funding rally", or any framing where they want to **ride the squeeze** by going long when the order book is short-heavy and the price is already turning up.

This is the inverse of pure carry: instead of waiting for funding to mean-revert (`strategy-funding-rate-arbitrage`), this strategy enters when shorts are getting **squeezed harder** (funding worsening AND price rising), expecting forced unwinds to fuel further upside.

## Honest framing — when this works and when it doesn't

Squeeze setups are time-sensitive and regime-dependent:

- **Best regime**: choppy or rotating markets where shorts get caught after a deeper pullback. Recent up-move + persistent negative funding = textbook fuel.
- **Worst regime**: structural downtrends. Negative funding is normal in bear markets — shorts are right, not trapped. Without confirming up-move, this strategy gets stopped repeatedly.
- **The take-profit problem**: squeezes are explosive and reverse fast. Holding past funding normalisation gives the gain back.

Use the time-stop and the funding-flip exit. Don't try to ride the trend after funding turns positive.

## Backtest reference

| Window | `BTC/USDC:USDC` 1h, 2026-01-01 → 2026-05-01 (BTC −13% over the window) |
|---|---|
| Trades | 8 |
| Win rate | 38% (3W / 5L) |
| Wallet PnL | **−0.75%** |
| Sharpe | −0.75 |
| Max drawdown | 0.75% |
| Avg holding | 12h 30m |
| Backtest ID | `01kr42gvqnyessxdrsf3qym7sa` |
| Exit-reason mix | 6 signal exits · 1 trailing-stop win · 1 stoploss |

**The strategy executed correctly** — the negative PnL is a regime call, not a broken implementation. The window covers BTC's −13% slide; long-only squeezes in a structural downtrend get stopped repeatedly. The trailing-stop win shows the trade thesis works when a squeeze actually catches (the one trade that resolved up made +1.3%); the issue is that the entry filter fired on too many bear-market dead-cat bounces.

Two practical refinements before recommending live:
1. **Add a higher-timeframe regime filter** (e.g. only enter when `1d close > 1d ema_50`). Removes most of the bear-market false starts.
2. **Run on a multi-pair scan** rather than BTC alone. Squeezes are uncorrelated across alts — diversification compounds.

See `docs/alpha-scan-improvement-plan.md` for context on the squeeze-fuel bucket of the alpha scan.

## The Freqtrade primitive that makes this work

Same `dp.get_pair_dataframe(candle_type="funding_rate")` pattern as `strategy-funding-rate-arbitrage` — Hyperliquid funds hourly and the data is auto-downloaded for backtest. Layer the recent return condition on top.

## Reference implementation

```python
from freqtrade.strategy import IStrategy
from datetime import datetime
import pandas as pd
import talib.abstract as ta


class FundingSqueezeStrategy(IStrategy):
    minimal_roi = {"0": 100.0}     # exits managed by the funding flip + time stop
    stoploss = -0.04
    trailing_stop = True
    trailing_stop_positive = 0.02
    trailing_stop_positive_offset = 0.03
    trailing_only_offset_is_reached = True
    timeframe = "1h"
    process_only_new_candles = True
    startup_candle_count = 30
    can_short = False

    def populate_indicators(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        # Funding rate via the dedicated candle type. HL funds hourly.
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
            # Annualise hourly funding: APR = rate * 24 * 365.
            dataframe["funding_apr"] = dataframe["funding_rate"] * 24 * 365
        else:
            dataframe["funding_rate"] = 0.0
            dataframe["funding_apr"] = 0.0

        # Recent up-move (squeeze fuel needs the move already started).
        dataframe["ret_24h"] = dataframe["close"].pct_change(24)
        dataframe["ret_4h"] = dataframe["close"].pct_change(4)
        dataframe["atr_24"] = ta.ATR(dataframe, timeperiod=24)
        dataframe["vol_avg20"] = dataframe["volume"].rolling(20).mean()
        return dataframe

    def populate_entry_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        # Long when funding is deeply negative AND price is already rising AND
        # volume confirms (avoid dead-tape squeezes that can't propagate).
        dataframe.loc[
            (dataframe["funding_apr"] < -0.10)
            & (dataframe["ret_24h"] > 0.03)
            & (dataframe["ret_4h"] > 0.0)
            & (dataframe["volume"] > dataframe["vol_avg20"])
            & (dataframe["volume"] > 0),
            "enter_long",
        ] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        # Exit when funding flips back to non-negative — the squeeze has been
        # paid out and we're now competing with reset shorts and tired longs.
        dataframe.loc[(dataframe["funding_apr"] >= 0.0), "exit_long"] = 1
        return dataframe

    def custom_exit(self, pair: str, trade, current_time: datetime,
                    current_rate: float, current_profit: float, **kwargs):
        # Squeezes resolve fast. If we haven't gotten paid in 24h the thesis is
        # invalidated; bail rather than wait for the funding flip.
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
  "stoploss": -0.04,
  "trailing_stop": true,
  "trailing_stop_positive": 0.02,
  "trailing_stop_positive_offset": 0.03,
  "trailing_only_offset_is_reached": true,
  "minimal_roi": { "0": 100.0 },
  "trading_mode": "futures",
  "margin_mode": "cross",
  "entry_pricing": { "price_side": "same" },
  "exit_pricing": { "price_side": "same" },
  "pairlists": [{ "method": "StaticPairList" }]
}
```

Pair format must be `<COIN>/USDC:USDC` (futures perp) — spot doesn't have funding.

## Tunable parameters

| Knob | Effect |
|---|---|
| `funding_apr < -0.10` | Stricter (`-0.20`) → only the deepest squeezes; rare. Looser (`-0.05`) → more entries, lower per-trade edge. |
| `ret_24h > 0.03` | The "move already started" filter. Tighter (`> 0.05`) waits for clearer momentum; looser (`> 0.0`) catches earlier but noisier. |
| `trailing_stop_positive_offset` | When trailing kicks in. The squeeze should hand you 3% before you start protecting it. |
| `timeout_24h` | Squeezes typically resolve within a session. 24h = sane safety net; 12h is more aggressive. |

## Variants

- **Multi-pair scan**: replace `StaticPairList` with `VolumePairList` filtered to top 30 perps. Squeezes are uncorrelated across pairs — diversifying captures more.
- **OI-confirmed variant** (Phase 2): require `oi_delta_4h > 0.05` to confirm fresh shorts entering, not just stale negative funding. Needs OI history feed.
- **Fade-the-squeeze inverse**: same setup, but short on extreme squeezes (`funding_apr < -0.50`) on the assumption the squeeze is exhausted. Higher risk, opposite thesis.

## Common pitfalls

1. **Entering before the move starts.** Negative funding alone is the carry trade (`strategy-funding-rate-arbitrage`). Waiting for `ret_24h > 0` is what makes this a squeeze trade not a carry trade. Don't drop that filter.
2. **Holding past the funding flip.** When funding goes from `-0.10` to `+0.05`, the structural pressure is gone. Holding for "more upside" is just directional speculation — exit and re-evaluate.
3. **Tight stops killing entries.** Squeezes are volatile by definition. `-0.02` stops chop you out before the move; `-0.04` is the practical floor for hourly entries.
4. **Spot pair instead of perp.** `BTC/USDC` doesn't have funding rate data — the entry never fires. Always `BTC/USDC:USDC`.

## Sources

- Sibling strategy: the `funding-rate-arbitrage` skill
- Internal: [docs/alpha-scan-improvement-plan.md](https://github.com/Superior-Trade/superior-turborepo/blob/main/docs/alpha-scan-improvement-plan.md) — squeeze-fuel bucket
- Freqtrade DataProvider — https://www.freqtrade.io/en/stable/strategy-customization/
