---
name: fees-optimizations
description: Use when the user asks about fees, slippage, maker vs taker, post-only orders, fee tiers, fee optimization, why my strategy is losing more than backtest, builder code fee, effective spread, order pricing, or wants to lower trading costs on a Hyperliquid Freqtrade deployment. Also use proactively when the user designs a high-turnover strategy (5m or faster, tight ROI < 0.5%) — fees often dominate edge there.
version: 0.1.0
updated: 2026-05-07
---

# Freqtrade × Hyperliquid: Fee Optimization

## When to use

- A user asks why their backtest PnL doesn't match live PnL.
- A user designs a tight-target scalp / market-making / grid strategy and you want to flag fee-as-a-fraction-of-edge concerns _before_ they deploy.
- A user explicitly asks about maker vs taker, post-only, fee tiers, builder code, or slippage.
- Any time you're about to suggest an order_types/entry_pricing/exit_pricing block, anchor it to this skill's recommendations.

## What you're actually paying

Fees on a Superior Trade Hyperliquid deployment have **three layers**, each tunable:

### 1. Hyperliquid exchange fees (the floor)

Hyperliquid's perp fees as of writing (verify against `https://hyperliquid.gitbook.io/hyperliquid-docs/trading/fees` for current numbers):

| Tier                 | Maker                                 | Taker           |
| -------------------- | ------------------------------------- | --------------- |
| Default              | 0.010% (1 bp)                         | 0.045% (4.5 bp) |
| Tier 2 ($5M 14d vol) | 0.005%                                | 0.040%          |
| Tier 3+              | scales toward 0% maker / 0.030% taker |

**Spot** is typically slightly lower; **HLP/staking discounts** can shave another 0.001-0.005%.

The big takeaway: **maker is ~4.5× cheaper than taker.** A round-trip taker trade pays ~9 bp; a round-trip maker trade pays ~2 bp. On a 0.6% scalp target, taker fees consume **15% of gross PnL** before slippage.

### 2. Builder code fee (Superior's cut)

Every order on Superior-managed Hyperliquid deployments goes through a **builder code**, which adds a separate fee that goes to Superior. Default is **5 bp on volume traded**, taker or maker. Verify the actual rate for the user's account in the Superior dashboard.

This fee is **always paid** regardless of order type. It can't be optimized away with maker/post-only — it scales with notional volume traded. The only knob is reducing turnover (fewer trades, larger size, longer holds).

### 3. Slippage (the variable cost)

Slippage = the difference between the price your strategy assumed and the price you actually filled at. On Hyperliquid:

- **Liquid majors (BTC, ETH, SOL)**: typically 0–2 bp on $10K notional with tight spread.
- **Mid-cap perps**: 5-20 bp on $10K notional.
- **Thin alts / new listings**: can be 50+ bp on a single market order.

Slippage is **always taker-flavored** for market orders and **near-zero** for filled limit orders. Backtest engine uses last-trade price assumption, which understates real-world slippage on illiquid pairs.

## The four knobs Freqtrade exposes

### Knob 1: `order_types` — limit vs market

```json
{
  "order_types": {
    "entry": "limit",
    "exit": "limit",
    "stoploss": "market",
    "stoploss_on_exchange": false
  }
}
```

| Setting              | Effect                                                                                | When to use                                                                         |
| -------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `entry: "limit"`     | Posts a limit at the bid (long) / ask (short). Maker if it sits, taker if it crosses. | **Default**. Pairs with `entry_pricing.price_side: "same"` to maximize maker fills. |
| `entry: "market"`    | Crosses immediately at best opposing quote. Always taker.                             | Only when entry timing dominates fee cost (e.g. funding-rate exit window closing).  |
| `stoploss: "market"` | Stops fire as market orders.                                                          | **Always**. A limit stop in a fast move never fills.                                |
| `stoploss: "limit"`  | Stops fire as limit at stop price.                                                    | **Never** in production — gets bag-held in real moves.                              |

### Knob 2: `entry_pricing` / `exit_pricing` — where on the book

```json
{
  "entry_pricing": {
    "price_side": "same",
    "use_order_book": true,
    "order_book_top": 1,
    "price_last_balance": 0.0,
    "check_depth_of_market": { "enabled": false }
  },
  "exit_pricing": {
    "price_side": "same",
    "use_order_book": true,
    "order_book_top": 1
  }
}
```

| Field                | Maker-friendly                                  | Taker-friendly                         |
| -------------------- | ----------------------------------------------- | -------------------------------------- |
| `price_side`         | `"same"` (long buys at bid, short sells at ask) | `"other"` (cross the spread)           |
| `use_order_book`     | `true` + `order_book_top: 1` (joins best level) | `false` (uses last trade — random)     |
| `price_last_balance` | `0.0` (pure book level)                         | `1.0` (interpolates toward last trade) |

**Default for cost-sensitive strategies:** `price_side: "same"`, `use_order_book: true`, `order_book_top: 1`, `price_last_balance: 0.0`. This posts at the best bid (long) / best ask (short), maker-only unless the market crosses you.

### Knob 3: `unfilledtimeout` — how patient is the maker?

```json
{
  "unfilledtimeout": {
    "entry": 10,
    "exit": 10,
    "exit_timeout_count": 0,
    "unit": "minutes"
  }
}
```

A limit order sitting on the book is great until the market walks away. `unfilledtimeout` is when Freqtrade gives up and re-prices (or cancels). For a 5m strategy, `entry: 5` minutes is sane — give the limit one bar to fill, then chase. For a daily DCA, `entry: 60+` is fine.

`exit_timeout_count: 3` means: after 3 timeout cycles on the exit, fall back to a market order. Good for ensuring the exit eventually happens.

### Knob 4: `stake_amount` — fewer, bigger trades

The builder code fee scales with notional volume. **Two trades at $1000 each pay the same builder fee as four trades at $500 each.** If your strategy works at higher position size, prefer fewer larger trades to reduce per-trade fixed cost.

This isn't a Freqtrade knob per se, but an engineering choice: lower-frequency strategies amortize per-trade fees better.

## Recommended starting block (cost-sensitive)

For any strategy where fees matter (scalping, grid, frequent entries), start here:

```json
{
  "order_types": {
    "entry": "limit",
    "exit": "limit",
    "stoploss": "market",
    "stoploss_on_exchange": false,
    "trailing_stop_loss": "market"
  },
  "entry_pricing": {
    "price_side": "same",
    "use_order_book": true,
    "order_book_top": 1,
    "price_last_balance": 0.0
  },
  "exit_pricing": {
    "price_side": "same",
    "use_order_book": true,
    "order_book_top": 1,
    "price_last_balance": 0.0
  },
  "unfilledtimeout": {
    "entry": 10,
    "exit": 10,
    "exit_timeout_count": 3,
    "unit": "minutes"
  }
}
```

For a "fill at any cost" deployment (e.g. funding harvest where missing the entry costs more than the spread), use `price_side: "other"` and `entry: "market"`.

## Fee budget rule of thumb

Before recommending any tight-target strategy, compute the **edge-to-fee ratio**:

```
edge_to_fee = (avg_per_trade_pnl_bp) / (round_trip_fee_bp + slippage_bp)
```

Where:

- `round_trip_fee_bp` ≈ 9 bp (taker, both sides) or 2 bp (maker, both sides) on top of HL native fees
- Plus **builder code fee × 2** (entry + exit) — typically 10 bp round trip
- Plus slippage estimate (1 bp majors, 5-20 bp mid-cap)

So **realistic round-trip cost** on majors ≈ 12-15 bp (taker) or 5-8 bp (maker).

| Avg per-trade PnL   | Round-trip cost | Edge-to-fee | Verdict                                        |
| ------------------- | --------------- | ----------- | ---------------------------------------------- |
| 60 bp (0.6% target) | 13 bp taker     | 4.6×        | OK if ≥ 50% hit rate                           |
| 30 bp               | 13 bp taker     | 2.3×        | Marginal — needs >55% hit rate                 |
| 15 bp (tight scalp) | 13 bp taker     | 1.15×       | **Too thin** — fees eat edge unless maker-only |
| 15 bp               | 6 bp maker      | 2.5×        | Acceptable if you can stay maker-only          |

**The Scalp template's 0.6% target / 0.4% stop** with default taker pricing has edge_to_fee ≈ 4.6× on win, but the 33% win rate from the reference backtest means it's a net loser. Forcing maker-only would help significantly.

## Common pitfalls

1. **Defaulting to `entry: "market"` because limits "might not fill"**. A maker limit that fills 70% of the time at 1 bp beats a market that fills 100% of the time at 5 bp on most strategies. Pair `limit` entries with a sane `unfilledtimeout` and accept some signals will be skipped.
2. **Backtest assumes `price_side: "same"` will always fill**. The Freqtrade backtester treats limit orders as filled at the bar's price — it does NOT simulate queue priority or partial fills. Live behavior on illiquid pairs is worse. **Always slippage-stress your backtest** by re-running with `entry: "market"` to see worst-case PnL.
3. **Forgetting `stoploss_on_exchange: false` is the default and correct**. Setting `true` puts the stop on the exchange (avoids gap risk) BUT only fires on next candle close on Freqtrade's polling cadence. The agent wallet model on Superior already handles this; leave it `false`.
4. **Stacking `trailing_stop` with `exit_pricing.price_side: "same"`**. The trail emits a sell signal; combined with same-side maker pricing, the limit sits on the bid waiting for a buyer that may never come. For trailing exits, force `exit_pricing.price_side: "other"` OR rely on `stoploss: "market"`.
5. **Ignoring builder code fee in projections**. A "0% fee crypto exchange" Twitter post is useless if Superior's builder code is 5 bp. The 5 bp is on the user's _gross volume_, not net PnL.

## When you don't optimize fees

For low-turnover strategies (DCA weekly, funding harvest with avg holding > 8h), fee optimization is secondary to correctness. A 10 bp round-trip cost amortized over a week-long hold is a 0.014% APR drag — invisible. Spend the optimization budget on entry quality instead.

## Source-of-truth checks

When the user reports unexpected fee outcomes, verify in this order:

1. **Hyperliquid fee tier**: `https://app.hyperliquid.xyz/portfolio` shows current 14-day volume tier.
2. **Builder code rate**: Superior dashboard, deployment detail page, fees section.
3. **Slippage on filled orders**: Compare `order_filled_avg_price` to bar `close` in the Freqtrade trade log. Persistent > 5 bp slippage on majors means the order_book pricing is wrong.
4. **Maker vs taker ratio**: Hyperliquid trade history shows `maker: true/false` per fill. Aim for > 70% maker in production for cost-sensitive strategies.

## Sources

- Hyperliquid fees — https://hyperliquid.gitbook.io/hyperliquid-docs/trading/fees
- Freqtrade configuration reference — https://www.freqtrade.io/en/stable/configuration/#understand-order_types
- Freqtrade pricing — https://www.freqtrade.io/en/stable/configuration/#understand-entry_pricing-and-exit_pricing
