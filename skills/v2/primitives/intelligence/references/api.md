---
name: intelligence-api
description: Endpoint reference for the two Intelligence routes — GET /v2/intelligence/scan (list mode) and GET /v2/intelligence/setup/{pair} (single-pair detail). Includes request params, response schemas, and concrete example responses.
version: 0.1.0
updated: 2026-05-09
---

# Intelligence API

Both endpoints live on `https://api.superior.trade` and require `x-api-key` like every other authenticated route in this skill.

## `GET /v2/intelligence/scan`

Live ranked alpha scan, top-N pairs per bucket. Refreshes every 5 minutes server-side; the response includes `computed_at` so you can show the user how fresh the data is.

### Query parameters

| Param | Type | Default | Description |
|---|---|---|---|
| `bucket` | `"all"` \| `"squeeze"` \| `"stealth"` \| `"coiled"` \| `"basis"` | `"all"` | Filter to one bucket. |
| `category` | `"alts"` \| `"tradfi"` \| `"both"` | `"alts"` | `"alts"` = standard perps. `"tradfi"` = HIP-3 (stocks / indices / commodities / FX). |
| `top_n` | integer 1–10 | `5` | Pairs per bucket (or per tradfi category). |

### Response (alts, all buckets, top 5)

```json
{
  "computed_at": "2026-05-09T16:42:13.041Z",
  "methodology": {
    "squeeze": "Positive recent move × dollars-of-funding shorts are bleeding (|APR| × OI) × volume.",
    "stealth": "Open positions × OI/volume turnover (days of stuck money) × flat price.",
    "coiled": "Quietness × stuck-money days (multiplicative gate) × composite × volume.",
    "basis": "|perp − spot| × log(OI) × volume; +25% bonus when basis sign opposes funding sign."
  },
  "timeframes": ["15m", "1h", "4h", "24h"],
  "alts": {
    "scanned": 184,
    "buckets": {
      "squeeze": [
        {
          "pair": "RED",
          "timeframe": "1h",
          "score": 0.872,
          "snapshot": {
            "pair": "RED",
            "mark_px": 0.4321,
            "pct_change_24h": 17.43,
            "volume_usd_24h": 4_215_000,
            "oi_usd": 12_900_000,
            "funding_apr_pct": -98.5,
            "funding_paid_notional_usd_per_yr": 12_706_500,
            "oi_turnover_days": 3.06,
            "basis_pct": 0.184,
            "liquidity_tier": "tradable"
          },
          "best_fit": {
            "bucket": "squeeze",
            "bucket_title": "Squeeze fuel",
            "timeframe": "1h",
            "score": 0.872,
            "deploy_template": "funding-squeeze"
          }
        }
        // ... up to top_n total
      ],
      "stealth": [...],
      "coiled": [...],
      "basis": [...]
    }
  }
}
```

For `category="tradfi"` you get `tradfi: { scanned, stocks: [...], indices: [...], commodities: [...], fx: [...] }` instead. Tradfi pairs are composite-ranked (no buckets at the top level) but each row still carries its own `best_fit` so you can drill in.

### Notes

- **Each pair's `timeframe` is engine-picked** for THAT bucket. Don't reweight or aggregate across timeframes — present them verbatim.
- `liquidity_tier`:
  - `"tradable"` ≥ $1M/day → safe to backtest + deploy live.
  - `"watch"` $100K–$1M/day → backtest only; live deployments may hit slippage.
  - `"microcap"` < $100K/day → filtered out by default; surfaces only via direct setup query.
- `basis_pct: null` means no Hyperliquid spot market for the base symbol — basis bucket scoring will be 0 for that pair.

## `GET /v2/intelligence/setup/{pair}`

Single-pair full setup card — same data the Intelligence Setup artifact panel surfaces in the UI.

### Path parameter

- `{pair}` — pair name. Alts use just the symbol (`ETH`, `SOL`, `NEAR`). HIP-3 stocks/indices/commodities use the prefixed form (`xyz:NVDA`, `xyz:GOLD`). URL-encode the colon if needed.

### Response

```json
{
  "pair": "ETH",
  "found": true,
  "computed_at": "2026-05-09T16:42:13.041Z",
  "snapshot": {
    "pair": "ETH",
    "mark_px": 2431.57,
    "pct_change_24h": 5.21,
    "volume_usd_24h": 24_600_000,
    "oi_usd": 89_400_000,
    "funding_apr_pct": -3.18,
    "funding_paid_notional_usd_per_yr": 2_842_920,
    "oi_turnover_days": 3.63,
    "basis_pct": 0.052,
    "liquidity_tier": "tradable"
  },
  "best_fit": {
    "bucket": "squeeze",
    "bucket_title": "Squeeze fuel",
    "timeframe": "4h",
    "score": 0.871,
    "deploy_template": "funding-squeeze"
  },
  "bucket_fits": [
    {
      "bucket": "squeeze",
      "bucket_title": "Squeeze fuel",
      "best_timeframe": "4h",
      "best_score": 0.871,
      "score_by_timeframe": { "15m": 0.612, "1h": 0.798, "4h": 0.871, "24h": 0.624 }
    },
    {
      "bucket": "stealth",
      "bucket_title": "Stealth accumulation",
      "best_timeframe": "1h",
      "best_score": 0.752,
      "score_by_timeframe": { "15m": 0.488, "1h": 0.752, "4h": 0.731, "24h": 0.690 }
    },
    {
      "bucket": "coiled",
      "bucket_title": "Coiled spring",
      "best_timeframe": "24h",
      "best_score": 0.420,
      "score_by_timeframe": { "15m": 0.180, "1h": 0.260, "4h": 0.342, "24h": 0.420 }
    },
    {
      "bucket": "basis",
      "bucket_title": "Basis flipping",
      "best_timeframe": "1h",
      "best_score": 0.314,
      "score_by_timeframe": { "15m": 0.314, "1h": 0.314, "4h": 0.314, "24h": 0.314 }
    }
  ],
  "tradfi_category": null
}
```

### Not-found case

If the pair isn't in the latest scan (it's a major, below the $100K daily-volume floor, or delisted):

```json
{
  "pair": "BTC",
  "found": false,
  "_note": "Pair not in the latest scan. Either it's a major (BTC/ETH/SOL — excluded by design), below the $100K daily-volume floor, or delisted. Use the regular price tools for the current price even when the pair isn't scored."
}
```

### How to present the setup card

1. **Lead with `best_fit`** — `"{bucket_title} @ {timeframe} (score {score})"`.
2. Cite the snapshot fields that drove the score, framed against the bucket's setup (see `buckets`). For squeeze, that's `pct_change_24h` + `funding_paid_notional_usd_per_yr`. For stealth, it's `oi_usd` + `oi_turnover_days`. Etc.
3. Mention `bucket_fits` only if the user asks "why not stealth?" or similar — surface the runner-up bucket and its score gap.
4. Before recommending a deploy, walk the AI Critic concerns from `buckets` for the chosen bucket.
5. The deploy template is `best_fit.deploy_template`. Use the **scan timeframe** as the strategy's source-of-truth timeframe and one step lower for the live deploy timeframe (per `workflow`).

## Caching

Both endpoints share the underlying scan cache (5-minute TTL). Repeated calls within the cache window return identical data — don't be surprised if you call both `/scan` and `/setup/{pair}` in succession and see exactly matching numbers. That's expected.
