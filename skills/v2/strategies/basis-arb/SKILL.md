---
name: basis-arb
description: Use when the user asks for spot-perp basis trade, basis arbitrage, cash-and-carry, perp discount, or any setup that reads the spot–perp basis as a positioning signal. Long-perp leg only — pure two-leg basis arb requires a paired spot short (or long) which Freqtrade can't run cleanly. The strategy below captures the directional read, not the hedged carry.
version: 0.1.0
updated: 2026-05-08
---

# Strategy: Basis Flipping — Directional (Long-Perp Leg)

## Honest framing — read this first

**True basis arbitrage** is a two-leg trade:

- Long perp + short spot (when perp trades at a discount to spot, basis < 0)
- Short perp + long spot (when perp trades at a premium, basis > 0)

You earn the basis as the legs converge. **Freqtrade is a single-leg engine** — it can't run paired hedged trades on the same ticker. The strategy below captures the **directional signal** that "basis flipping negative + funding negative = bullish positioning shift" and goes long the perp accordingly. It's a momentum read on positioning, not a hedged arb.

If you want the actual hedged version, run an external system (or a custom Hyperliquid-only multi-leg runtime). Don't deploy this template thinking it's market-neutral.

## Backtest reference

| Window | `BTC/USDC:USDC` 1h, 2026-01-01 → 2026-05-01 |
|---|---|
| Trades | **0** (no spot leg available in the engine) |
| Backtest ID | `01kr42hegps9w20njsty2cqb41` |

The Superior Trade backtest engine doesn't currently expose Hyperliquid spot OHLCV alongside perp pairs via Freqtrade's `informative_pairs` mechanism, so the `spot_close` column is never populated and the entry filter never fires. The strategy code is structurally sound — it runs cleanly to completion with 0 trades — but **this template can't be validated end-to-end on the current backtest engine**. Two paths:

1. **Validate live, paper-traded** — run as a dry-run deployment for a week and compare the entries against an external basis tracker (CoinGlass `basisHistory` or a simple notebook).
2. **Substitute external basis feed** — replace the `informative_pairs` spot fetch with a CoinGlass `/api/futures/basis/history` call from a side-channel cache. Out of scope for this template; would be a Phase 2 backend change.

The strategy is shipped as a **directional blueprint**, not a live-validated runtime. Treat it as a teachable template for how to wire spot-perp basis into a Freqtrade strategy, rather than an off-the-shelf deployment.

## When to use

A user asks for:
- "Basis trade", "basis arb", "perp discount", "cash and carry"
- A directional follow-on to spot-side accumulation ("spot is buying, perp is short, going long the perp")
- Anything where the basis flipping negative is the trigger

This template **assumes Hyperliquid has both the spot and perp pair** for the asset (BTC, ETH, SOL — the few HL has spot books for). For perp-only assets, this strategy can't compute basis and won't fire.

## The Freqtrade primitive that makes this work

Two `dp.get_pair_dataframe` calls:
1. The current perp's funding rate (same pattern as `strategy-funding-rate-arbitrage`)
2. The corresponding **spot** pair's OHLCV via `informative_pairs()` so we can compute basis

Basis = `(perp_mark - spot_mid) / spot_mid`. Annualised by funding period.

## Reference implementation

```python
from freqtrade.strategy import IStrategy, informative
from datetime import datetime
import pandas as pd
import talib.abstract as ta


def perp_to_spot(pair: str) -> str:
    """`BTC/USDC:USDC` → `BTC/USDC`. HL spot lives at the un-suffixed pair."""
    return pair.split(":")[0] if ":" in pair else pair


class BasisFlippingStrategy(IStrategy):
    minimal_roi = {"0": 100.0}
    stoploss = -0.04
    trailing_stop = False
    timeframe = "1h"
    process_only_new_candles = True
    startup_candle_count = 30
    can_short = False

    def informative_pairs(self):
        # Tell Freqtrade we need spot-side OHLCV for every perp in the
        # whitelist. The base pair list is set by the user; we mirror
        # each entry to its spot equivalent.
        pairs = self.dp.current_whitelist()
        return [(perp_to_spot(p), self.timeframe) for p in pairs if ":" in p]

    def populate_indicators(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        perp_pair = metadata["pair"]
        spot_pair = perp_to_spot(perp_pair)

        # Funding rate via the dedicated candle type.
        try:
            funding = self.dp.get_pair_dataframe(
                pair=perp_pair,
                timeframe="1h",
                candle_type="funding_rate",
            )
        except Exception:
            funding = pd.DataFrame()
        if not funding.empty and "open" in funding.columns:
            f = funding[["date", "open"]].rename(columns={"open": "funding_rate"}).copy()
            dataframe = dataframe.merge(f, on="date", how="left")
            dataframe["funding_rate"] = dataframe["funding_rate"].ffill().fillna(0.0)
            dataframe["funding_apr"] = dataframe["funding_rate"] * 24 * 365
        else:
            dataframe["funding_rate"] = 0.0
            dataframe["funding_apr"] = 0.0

        # Spot OHLCV — declared via `informative_pairs`.
        try:
            spot = self.dp.get_pair_dataframe(pair=spot_pair, timeframe=self.timeframe)
        except Exception:
            spot = pd.DataFrame()
        # Initialise required columns up front so the entry guard can
        # read them even when the spot leg isn't available on this
        # dataset. Hyperliquid's backtest cache doesn't always expose
        # the matching spot pair via informative_pairs — without these
        # default columns the strategy crashes with KeyError on the
        # first candle.
        dataframe["spot_close"] = float("nan")
        dataframe["basis"] = 0.0
        dataframe["basis_apr"] = 0.0
        if not spot.empty and "close" in spot.columns:
            s = spot[["date", "close"]].rename(columns={"close": "spot_close"}).copy()
            dataframe = dataframe.drop(columns=["spot_close"])
            dataframe = dataframe.merge(s, on="date", how="left")
            dataframe["spot_close"] = dataframe["spot_close"].ffill()
            # Instantaneous basis (perp - spot) / spot. Annualise as
            # basis_apr ≈ basis * (8h_settlement_periods/year) ≈ basis * 1095
            # (3 settlements/day × 365). HL's actual basis convergence
            # path is messier but this is the standard back-of-envelope.
            dataframe["basis"] = (
                dataframe["close"] - dataframe["spot_close"]
            ) / dataframe["spot_close"]
            dataframe["basis_apr"] = dataframe["basis"] * 1095

        dataframe["atr_24"] = ta.ATR(dataframe, timeperiod=24)
        return dataframe

    def populate_entry_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        # Long perp when:
        #   1. Basis flipped negative (perp at discount to spot)
        #   2. Funding is also negative (shorts paying — same crowd)
        #   3. Spot isn't crashing (close > 24h SMA proxy)
        # Only fire when the spot leg is actually available — without
        # spot data the basis is meaningless and we'd be entering on a
        # zero-filled signal.
        sma_spot = dataframe["spot_close"].rolling(24).mean()
        spot_available = dataframe["spot_close"].notna()
        dataframe.loc[
            spot_available
            & (dataframe["basis_apr"] < -0.05)
            & (dataframe["funding_apr"] < 0.0)
            & (dataframe["spot_close"] > sma_spot)
            & (dataframe["volume"] > 0),
            "enter_long",
        ] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        # Exit when basis converges back to neutral (≥ 0) — the structural
        # pressure has been worked off.
        dataframe.loc[(dataframe["basis_apr"] >= 0.0), "exit_long"] = 1
        return dataframe

    def custom_exit(self, pair: str, trade, current_time: datetime,
                    current_rate: float, current_profit: float, **kwargs):
        # Basis convergence is slow but persistent. 48h is the patience floor.
        elapsed_h = (current_time - trade.open_date_utc).total_seconds() / 3600.0
        if elapsed_h >= 48:
            return "timeout_48h"
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
  "minimal_roi": { "0": 100.0 },
  "trading_mode": "futures",
  "margin_mode": "cross",
  "entry_pricing": { "price_side": "same" },
  "exit_pricing": { "price_side": "same" },
  "pairlists": [{ "method": "StaticPairList" }]
}
```

**Pair must have a corresponding HL spot pair**. Today that's effectively BTC, ETH, SOL, HYPE — the few assets with both perp and spot books on Hyperliquid. Other perps will return zero basis and never fire.

## Tunable parameters

| Knob | Effect |
|---|---|
| `basis_apr < -0.05` | Stricter (`-0.10`) → only deeper discounts. Looser (`-0.02`) → more entries, weaker signal. |
| `funding_apr < 0.0` | The "shorts paying" confirmation. Drop this to fire on basis alone (faster, noisier). |
| `spot_close > sma_24` | The "spot isn't crashing" filter. Without it, the strategy buys into spot drawdowns where the basis is negative because everything's down. |
| `timeout_48h` | Basis trades take days, not hours. Don't tighten below 24h. |

## Variants

- **Hedged via external runtime**: pair this with a spot-short (e.g. through Aerodrome or a CEX) for true delta-neutral. Out of scope for Freqtrade.
- **Reverse premium** (variant): when basis > +0.10 APR with positive funding, short the perp. Mirror logic, requires `can_short = True` and an isolated-margin perp config.
- **Term-structure variant**: skip same-pair basis and use the 1d-MA basis vs 1h basis as the signal. Less noisy, more reliable for swing horizon.

## Common pitfalls

1. **Treating this as market-neutral.** It isn't. The price exposure is full perp delta. The basis convergence is an *additional* edge on top of that exposure, not a substitute for it.
2. **Pairs without spot.** Perp-only HL pairs (most alts) won't have basis data — the strategy will never fire and the user gets confused why "no trades". Always confirm `informative_pairs` declared the spot leg.
3. **Hourly basis noise.** Basis at the 1h scale flickers around zero. Without the funding-confirming filter, you get whipsawed by every tick of perp-spot divergence.
4. **Tight stops.** Convergence trades take days, not hours. `-0.04` is the floor; tighter and ATR noise stops you out before the trade works.

## Sources

- Internal plan: [docs/alpha-scan-improvement-plan.md](https://github.com/Superior-Trade/superior-turborepo/blob/main/docs/alpha-scan-improvement-plan.md) — basis-flipping bucket
- Freqtrade `informative_pairs` — https://www.freqtrade.io/en/stable/strategy-customization/#additional-data-informative_pairs
- Sibling: the `funding-rate-arbitrage` skill
