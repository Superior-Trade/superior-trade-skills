---
name: intelligence-workflow
description: Recommended end-to-end recipes that turn an Intelligence scan into a live trade. Covers the standard scan → pick → setup → backtest → deploy flow plus the variants for "user already named the pair" and "user wants to compare across buckets". Read before chaining /v2/intelligence/* into /v2/backtesting + /v2/deployment.
version: 0.1.0
updated: 2026-05-09
---

# Intelligence workflows

Three recipes covering most user requests. Pick the one that matches the user's framing.

---

## Recipe A — Open-ended discovery

**User asks:** "what's hot", "any alpha", "show me squeeze setups", "what should I trade".

```
1. GET /v2/intelligence/scan
       ?bucket={user-implied bucket or "all"}
       ?category={user-implied category or "alts"}
       ?top_n=5

2. Present 2–3 specific pairs from the response. For each:
   - Lead with "{pair}: {bucket_title} @ {timeframe} ({score})"
   - One sentence on the snapshot field(s) that drove the score
   - One AI Critic concern from buckets.md

3. Ask which pair the user wants to dig into — do NOT auto-deploy.
```

If the user picks a pair → switch to Recipe B from step 1.

---

## Recipe B — Single-pair drilldown then deploy

**User asks:** "tell me about ETH", "is SOL a good squeeze", "should I deploy NEAR".

```
1. GET /v2/intelligence/setup/{pair}

2. If found=false:
   - Tell the user the pair isn't scored (probably a major or microcap)
   - Use price-check / chart tools instead. Stop here.

3. If found=true:
   - Present best_fit verbatim ("Squeeze fuel @ 4h, score 0.871")
   - Cite snapshot fields that drove it (per buckets.md)
   - Walk the AI Critic concerns for best_fit.bucket
   - Ask the user if they want to backtest + deploy

4. If yes → POST /v2/backtesting:
   {
     "pair": "{pair}",
     "config": <derived from best_fit.deploy_template — see strategies/{deploy_template}.md>,
     "code": <the strategy file's code>,
     "timerange": { "start": "2026-01-01", "end": "2026-05-01" }
   }
   Use the scan timeframe (best_fit.timeframe) as the strategy's source-of-truth timeframe.
   Run a 3-variant sweep per the existing best practice (see strategies/SKILL.md and optimizations/backtesting.md).

5. Pick winner by Sharpe + drawdown.

6. POST /v2/deployment with the winning config. Use one timeframe lower
   than scan timeframe for live execution (15m scan → 5m live, 1h → 15m,
   4h → 1h, 24h → 4h) unless the user overrides.

7. POST /v2/deployment/{id}/credentials with hyperliquid wallet info.
```

The deploy timeframe step-down is intentional — the scan timeframe is what surfaced the candidate; the live strategy should react faster than the cadence we used to surface it.

---

## Recipe C — Cross-bucket comparison

**User asks:** "should I trade ETH as a squeeze or a stealth play", "is the AVAX setup better at 1h or 4h".

```
1. GET /v2/intelligence/setup/{pair}

2. Read bucket_fits — every bucket has a best_timeframe and a
   score_by_timeframe map. Compare.

3. Present a small table:
     Bucket          Best TF   Score
     Squeeze fuel    4h        0.871   ← engine recommended
     Stealth         1h        0.752
     Coiled          24h       0.420
     Basis           1h        0.314   (n/a if basisPct null)

4. Recommend best_fit but explicitly call out the runner-up if it's
   close (gap < 10pp) — those are pairs where the user's preference
   for hold-time / volatility might tip the choice.
```

---

## Recipe D — Scheduled scan (advanced)

**User asks:** "alert me when something hits squeeze score above 0.85", "watch for stealth setups overnight".

The `/v2/intelligence/scan` endpoint is read-only and unauthenticated-rate-limited, so polling-style alerts are fine in client code. For server-side scheduling integrate with the existing `scheduled-agent` infrastructure (see `apps/agent-server/src/lib/scheduled-agent-executor.ts` if you have monorepo access — otherwise this is a roadmap item rather than a current capability).

---

## Things to NOT do

- **Don't reweight scores client-side.** The engine already picks the best timeframe per pair per bucket. Re-aggregating across timeframes (averaging, summing) breaks the lens design.
- **Don't auto-deploy from a scan response.** Always run setup first, walk AI Critic, run a backtest sweep. The scan tells you "this is interesting"; the workflow above tells you "this is worth real money".
- **Don't skip the snapshot citation.** Saying "ETH is a squeeze setup" without naming the pct_change + fees-paid number is the kind of vague statement the user has zero reason to trust. Lead with the numbers.
- **Don't substitute training-data prices.** If the scan response is empty / errored, ask the user to retry or fall back to `price-check`. Don't fabricate.
