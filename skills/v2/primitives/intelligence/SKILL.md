---
name: intelligence
description: Use when the user asks "what's hot", "what's moving", "any alpha", "show me squeeze setups", "what's the setup on ETH", "is SOL coiled", "should I deploy NEAR" or any market-scan / single-pair-drilldown question. Surfaces Superior Trade's live multi-bucket scoring across Hyperliquid alts + HIP-3 (stocks/indices/commodities/FX) — Squeeze fuel, Stealth accumulation, Coiled spring, Basis flipping. The engine picks the strongest timeframe (15m/1h/4h/24h) per pair per bucket; you don't pick one. Pairs in to the existing strategy → backtest → deployment workflow at api.superior.trade.
version: 0.1.0
updated: 2026-05-09
---

# Intelligence

Live ranked alpha scan over Hyperliquid alts + HIP-3 markets. Returns the same data the **Intelligence page** at https://account.superior.trade/intelligence renders — bucket fits, per-pair best timeframes, snapshots, and recommended deploy templates.

## Files in this skill

| File | What it covers |
|---|---|
| [`references/buckets.md`](references/buckets.md) | The 4 buckets: **Squeeze fuel**, **Stealth accumulation**, **Coiled spring**, **Basis flipping**. Setup / Edge / Scoring + AI Critic concerns per bucket. Read this before presenting any scan output to the user. |
| [`references/api.md`](references/api.md) | The two endpoints: `GET /v2/intelligence/scan` (list mode) and `GET /v2/intelligence/setup/{pair}` (single-pair detail). Response schemas + examples. |
| [`references/workflow.md`](references/workflow.md) | Recommended end-to-end recipes: scan → pick → setup → backtest → deploy. How to translate a `best_fit` tuple into a `/v2/backtesting` call. |
| [`references/glossary.md`](references/glossary.md) | Plain-English definitions for the trading terms in scan responses (funding, OI, basis, fees-paid notional, OI turnover, CVD, etc.). Reference this when explaining results to a non-trader. |

## When to call which endpoint

- **List question** ("what's hot", "any squeeze setups", "show me coiled springs in HIP-3") → `GET /v2/intelligence/scan` with optional `bucket` and `category` filters.
- **Single-pair question** ("tell me about ETH", "is NEAR a stealth setup", "should I deploy AVAX") → `GET /v2/intelligence/setup/{pair}`. Always do this BEFORE backtesting / deploying so the choice is grounded in current data.

## Critical: do not improvise rankings

Both endpoints return **live, ranked data**. Never substitute a market scan from training data — prices are stale, the ranking framework is Superior's, and timeframes are picked by the engine. When presenting:

1. Lead with the **specific** `best_fit.bucket_title @ best_fit.timeframe (score)` tuple per pair.
2. Cite the snapshot fields that drove the score (e.g. for squeeze: `pct_change_24h` + `funding_paid_notional_usd_per_yr`).
3. Mention `bucket_fits` only if asked why another bucket wasn't picked.
4. Reference the AI Critic concerns from [`references/buckets.md`](references/buckets.md) before recommending a deploy.

## Caveats

- Majors (BTC / ETH / SOL) are **excluded** by design — this is for alt + HIP-3 alpha discovery. For majors, use the regular price/chart tools.
- Pairs below $100K daily volume are filtered out as too thin for live deployment.
- HIP-3 stocks (`xyz:NVDA`, `xyz:AAPL`, etc.) trade 24/7 but the underlying equities only trade during NYSE hours — see the US Market Closed warning in `references/buckets.md` § Stocks.
- News sentiment is **not** part of the current scan. The buckets are price + positioning + flow; news comes from external context.
