---
name: intelligence-glossary
description: Plain-English definitions for trading terms in Intelligence scan responses — funding APR, open interest, basis, fees-paid notional, OI turnover, etc. Reference when the user is unfamiliar with the vocabulary or asks "what does X mean".
version: 0.1.0
updated: 2026-05-09
---

# Glossary

Quick references for the fields in `/v2/intelligence/*` responses. Use these to translate jargon into one-sentence explanations when the user asks.

---

### `mark_px`
Current perpetual futures price in USD. The reference price for funding payments and liquidations on Hyperliquid.

### `pct_change_24h`
Percent change in `mark_px` over the last 24 hours. Positive = up. Used as the "momentum" input across all bucket scoring.

### `volume_usd_24h`
Dollar value of all trades on this pair in the last 24 hours. Higher = easier to enter and exit at size. Below $100K/day pairs are filtered out as too thin to deploy.

### `oi_usd` (Open Interest, in USD)
Dollar value of all unsettled futures positions on this pair right now. **High OI = lots of money is positioned**, regardless of direction. The mark price moves; OI is the stake on the table.

### `funding_apr_pct`
The fee one side pays the other, expressed as an annualised rate.

- **Positive** → longs pay shorts. Market is long-heavy; longs pay rent to keep the position.
- **Negative** → shorts pay longs. Market is short-heavy; shorts pay rent.

The fee is paid hourly in tiny increments — the displayed number is the annualised rate. A funding APR of -50% means shorts are paying longs at a rate of ~5.7%/year if held continuously, but in practice rates change every hour as positioning shifts.

### `funding_paid_notional_usd_per_yr` (Fees paid)
`|funding_apr| × oi_usd` — the dollar amount per year being paid by one side to the other on this pair right now. Captures **real-money intensity** of funding pressure.

A -1% APR with $200M OI = $2M/yr being paid → **louder** than a -10% APR with $1M OI = $100K/yr. Squeeze bucket scores by this rather than raw rate so big-money squeezes outrank cosmetic-rate ones.

### `oi_turnover_days` (Stuck money)
`oi_usd / volume_usd_24h` — how many days of daily volume is currently parked as open interest.

- **>1 day** → positions are sitting, not being recycled. Classic accumulation / coiled-spring marker.
- **<0.5 day** → liquid churn. OI changes hands rapidly.

The stealth and coiled buckets weight this heavily.

### `basis_pct` (Spot–perp gap)
`(mark_px − hl_spot_mid) / hl_spot_mid × 100` — percent difference between the perpetual futures price and the actual market price (Hyperliquid spot mid).

- **Positive** → perp trading at a premium to spot. Longs paying premium.
- **Negative** → perp trading at a discount to spot. Shorts paying premium.
- **null** → no Hyperliquid spot pair exists for this base symbol; the basis bucket excludes the pair.

The futures price almost always pulls back to spot eventually — `basis_pct` is the convergence opportunity.

### `liquidity_tier`
Coarse bucketing by 24h volume:

- `"tradable"` ≥ $1M/day → backtest + deploy live.
- `"watch"` $100K–$1M/day → backtest only.
- `"microcap"` < $100K/day → too thin to deploy live; filtered out by default.

### `score`, `best_score`
Per-bucket score in `[0, 1]`. **Per-bucket scores are NOT comparable across buckets** — squeeze 0.87 and stealth 0.87 are computed by different formulas. Compare within a single bucket only.

### `timeframe`, `best_timeframe`
One of `"15m"`, `"1h"`, `"4h"`, `"24h"`. The engine ranks every pair across all four timeframes for every bucket and picks the strongest. See `buckets` § Lens weights for what each timeframe emphasises.

### `composite_score` (tradfi rows only)
Z-scored composite of momentum + volume + OI + funding (the older single-score ranking, kept for tradfi where bucket scoring is less informative). Useful for relative ordering within stocks/indices/commodities/FX.

---

## Concepts not in the response (but referenced in `buckets`)

### CVD (Cumulative Volume Delta)
Running sum of buy volume − sell volume at the trade level. Rising CVD with flat price = buyers absorbing supply (bullish stealth confirmation). Falling CVD with flat price = sellers distributing into bids (bearish). Surfaced via CoinGlass in the web UI; not yet in the API response.

### Funding-z
Current funding rate normalised by the trailing standard deviation. `z < -1.5` = funding is at an unusual extreme negative vs recent norm (fresh shorts piling in — confirms a squeeze setup). Surfaced via CoinGlass in the web UI; not yet in the API response.

### Liquidation cluster
A price level where a large dollar value of leveraged positions would be force-closed. Pairs with a >$10M cluster within 2% of mark have asymmetric upside (the cluster is "magnet" fuel). Surfaced via CoinGlass in the web UI; not yet in the API response.

### "Pattern (geometric only)"
The web UI labels things like "range break" or "vol contraction" as detected from the candle series. The labels are honest geometric findings — they're NOT backed by historical win-rate calibration. Treat as a light "this looks like X" signal; don't claim it forecasts a specific outcome.
