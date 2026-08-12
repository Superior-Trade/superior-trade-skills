---
name: intelligence-buckets
description: Reference for the four Intelligence buckets — Squeeze fuel, Stealth accumulation, Coiled spring, Basis flipping. Read before presenting scan results so you can explain WHY a pair scored, what the AI Critic flags, and which deploy template fits.
version: 0.1.0
updated: 2026-05-09
---

# The Four Buckets

Every scan classifies pairs into four mutually exclusive setup types. Each bucket has a specific shape — what we look for, what the alpha is if you're right, and how the score is computed. The engine ranks pairs **per bucket** at every timeframe (15m / 1h / 4h / 24h) and picks the strongest fit per pair.

Use this file to translate a raw `best_fit.bucket` value into a meaningful explanation for the user.

---

## 🔥 Squeeze fuel

**Setup**
Coins climbing in price while shorts are paying real money to bet against them. We rank by the dollar value of funding fees being bled — `|funding APR| × open positions`, not just the rate — so a -1% APR with $200M OI ranks higher than -10% APR with $1M OI.

**Edge**
When the shorts can't keep paying the fee, they're forced to close their bets by buying — adding fuel to the existing up-move.

**Scoring** (per timeframe, lens-reweighted)

```
mom = saturate(pctChange, 0.05)              if pctChange > 0 else 0
fund_paid = saturate(log10(|fundingApr| × OI), 7)   if fundingApr < 0 else 0
volume = saturate(log10(volUsd), 6)
score = lens.momentum × mom + lens.funding × fund_paid + lens.volume × volume
```

**Deploy template:** `funding-squeeze` (see `funding-squeeze`)

**AI Critic concerns** (raise these before deployment)

1. Bears can keep paying funding for days without ever being squeezed — they may simply be right, not trapped.
2. The up-move may already be priced in. By the time the signal fires, the squeeze can have paid out.
3. A market-wide sell-off drags everything down regardless of the structural setup here.
4. The price move can be driven by news or a fresh listing rather than positioning.
5. Fees-paid is large because OI is large, not because new shorts just piled in. Cross-check with funding-z (CoinGlass-derived).

---

## 🎯 Stealth accumulation

**Setup**
Coins where open positions are large compared to a single day of volume — meaning positions are sitting, not being recycled — while price stays flat. Big money rarely buys all at once; they let their position settle in.

**Edge**
You're stepping in alongside someone already buying at scale, before their move shows up in price.

**Scoring**

```
oi = saturate(log10(oiUsd), 7)
turnover = saturate(oiTurnoverRatio, 2)       # 2 days of volume = saturated
flat = clamp01(1 − |pctChange| / 0.05)
volume = saturate(log10(volUsd), 6)
score = 0.5 × oi × turnover + lens.flatness × flat + 0.3 × volume
```

**Deploy template:** `funding-rate-arbitrage` (extended with `oi_delta_min` filter — see `funding-rate-arbitrage`)

**AI Critic concerns**

1. Open positions don't reveal WHO is positioned — could be a wrong-way trader, not smart money.
2. Some positions are hedged (long futures + short spot) — no directional view, just collecting fees.
3. Flat price can simply mean a dead market that eventually breaks DOWN, not up.
4. The accumulator can unwind silently before it ever moves the price.
5. A negative OI delta (CoinGlass) means money is leaving while the trade looks 'stuck' — verify before deploying.

---

## 💎 Coiled spring

**Setup**
Coins that are very quiet right now AND have multiple days of volume parked as open positions. Like a wound clock — the longer the calm, the bigger the eventual move tends to be. Both signals must be present (multiplicative gate); composite score and volume only refine on top.

**Edge**
You're positioned early in a regime change before the silence breaks. Direction NOT predicted — coiled springs can release UP or DOWN.

**Scoring**

```
flat = clamp01(1 − |pctChange| / 0.025)
turnover = saturate(oiTurnoverRatio, 2)
gate = flat × turnover
if gate < 0.15: score = 0
composite = clamp01((p.score + 2) / 4)
score = 0.65 × gate + 0.15 × composite × gate + lens.volume × 0.4 × volume
```

**Deploy template:** `breakout` (Donchian-style)

**AI Critic concerns**

1. We don't predict direction — a coiled spring can release UP or DOWN.
2. Compression can persist for weeks longer than expected; capital sits idle the whole time.
3. Outside news (a new listing, depeg, hack) can invalidate the prior range entirely.
4. Breakouts often fake out and reverse within a few candles before resuming the real direction.
5. We don't yet measure proper volatility contraction over time — this is a 'flat price + stuck money' proxy.

---

## 🔱 Basis flipping

**Setup**
Coins where the perp price has drifted noticeably away from the actual market price (Hyperliquid spot mid), while real money sits in open positions on both sides. We rank by the size of the gap × open positions × volume. Sign-opposed basis vs funding earns a 25% bonus — the dislocation hasn't been bled off by funding flow yet.

**Edge**
The futures price almost always pulls back to the market price — you get paid for the convergence by being on the right side.

**Scoring**

```
if basisPct == null: score = 0    # no HL spot pair, excluded
mag = saturate(|basisPct|, 0.005)            # 50bp ≈ saturated
oi = saturate(log10(oiUsd), 7)
volume = saturate(log10(volUsd), 6)
aligned = 1.25 if sign(basisPct) ≠ sign(fundingApr) else 1
score = aligned × (0.55 × mag × oi + 0.20 × volume + lens.flatness × 0.10)
```

**Deploy template:** `basis-arb` (see `basis-arb`)

**AI Critic concerns**

1. These trades are slow — the gap can persist for days while your capital is tied up.
2. Pairs without a Hyperliquid spot market are excluded entirely — coverage is thin outside the majors.
3. The market price can move TO the futures price instead of futures converging back to market, especially during fast moves.
4. If the gap is already small, there's no edge left to capture even if the math says converge.
5. We use an instant snapshot of the gap — we don't yet check whether the gap has been there for hours (stronger signal) or just appeared (weaker).

---

## How the per-pair best fit is picked

For each pair, the engine computes all 16 (4 buckets × 4 timeframes) scores via the lens-reweight described per bucket above, then:

1. Per bucket: picks the timeframe where the pair scores strongest → `bestPerBucket[bucket] = { tf, score }`
2. Across all (bucket, tf) combos: picks the single strongest → `best = { bucket, tf, score }`

**The user-facing "best fit" is `best`** — that's the bucket × timeframe the engine recommends for this pair. `bestPerBucket` is for "show all four bucket fits" drilldown.

## Lens weights (for transparency)

| Timeframe | momentum | funding | oi | volume | flatness |
|---|---|---|---|---|---|
| 15m  | 0.45 | 0.10 | 0.05 | 0.35 | 0.05 |
| 1h   | 0.35 | 0.15 | 0.15 | 0.25 | 0.10 |
| 4h   | 0.25 | 0.25 | 0.25 | 0.15 | 0.10 |
| 24h  | 0.20 | 0.30 | 0.30 | 0.10 | 0.10 |

Short timeframes weight momentum + volume (intraday signals). Long timeframes weight funding + OI (structural positioning). Same 24h underlying fields — different emphasis.
