---
name: backtesting
description: Use when running, interpreting, or designing backtests on Superior Trade — anything about backtest windows, trade-count thresholds, exit-reason mix, parameter sweeps, walk-forward validation, zero-trade diagnosis, compute-cost estimation, or "is this backtest result trustworthy?". Pair with the relevant strategy template from `strategies/`.
version: 0.1.0
updated: 2026-05-07
---

# Backtesting Best Practices

The mechanics of submitting a backtest are in the main [SKILL.md](https://github.com/Superior-Trade/superior-skills/blob/main/SKILL.md) under "Backtest Workflow". This page is about the **judgment calls** — picking a window that means something, telling signal from noise in the result, and knowing when to give up vs. iterate.

## The trade-count bar (sample size first)

Trade count is the single most important number on a result page. Look at it before PnL, before Sharpe, before win rate.

| Trade count | Verdict                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------- |
| < 30        | **Coincidence, not a strategy.** Don't promise anything; widen entries or extend window. |
| 30-50       | Marginal. Sharpe is noisy. Treat results as directional, not numeric.                    |
| 50-200      | **Useful.** Sharpe / profit factor start to mean something.                              |
| 200+        | Statistical confidence. Now you can compare variants on micro-differences.               |

**Watch for the trap**: backtests with 5-10 trades and a 100% win rate. They look like world-beaters and almost always disintegrate live. The strategy is too selective — every signal is a coin flip you've cherry-picked, not a repeatable edge. Widen the entry threshold, lengthen the window, or accept that there's no statistical signal here.

## Pick a backtest window that means something

> A great backtest over the wrong window is a great fiction.

The window should answer: _"if I had deployed this strategy on day one of this window, what would have happened?"_ — **not** _"what's the prettiest curve I can fit?"_

### Cover at least one regime change

Pure bull, pure bear, sideways chop — your window should include **at least two of the three**. A 90-day backtest in a one-direction market is a 90-day cherry-pick. A momentum strategy that prints +50% over a +60% trending window has told you nothing about itself; it's just measured beta.

### Useful default windows

- **6 months of 1h data**, or
- **18 months of 1d data**

Less than that and you're really looking at noise. More than that and Hyperliquid's history may not cover the pair (HL was launched in 2023; many alts have < 12mo of data).

### When you can't get a long window

Some HIP3 / new-listing pairs only have a few weeks of data. Two pragmatic responses:

1. **Walk-forward to a similar pair.** Pick a sibling perp with longer history (e.g. test the strategy on `BTC` if `BTC-AAPL` is too new), then assume the result transfers ±20%.
2. **Defer the deployment recommendation.** A 14-day backtest is too thin to recommend live capital, period. Tell the user that.

## Don't optimize against the test set (the cardinal sin)

If you tune parameters and validate on the same window, your backtest is a souvenir, not a forecast. This is the single most common reason strategies that look brilliant on paper die in the first week of live trading.

The honest workflow:

1. Pick parameters from theory or a single observation, NOT from a sweep.
2. Run the backtest.
3. If results are bad, change the **idea**, not the **parameters**.

If you do sweep, **walk forward to a different period or pair** before promoting the winner. A parameter that wins on Q1 BTC and also wins on Q1 ETH (out-of-sample for the second pair) is real. A parameter that wins on Q1 BTC and gets re-validated on Q1 BTC is theatre.

### Red flag

If the user's "strategy" started as a 5-variant sweep and now they want to deploy the winner — the result on the test window is overstated. Tell them to either run an out-of-sample check or accept they're deploying on optimistic numbers.

## The 3-variant parameter sweep

When the user wants to find the right parameter (e.g. RSI threshold, ATR multiplier, lookback length), run **3 variants in one batch**, not iterative single backtests. The shape of the 3-result table tells you what to do:

| Variant | Config   | PnL% | Trades | Sharpe | Max DD |
| ------- | -------- | ---- | ------ | ------ | ------ |
| A       | RSI < 25 | …    | …      | …      | …      |
| B       | RSI < 30 | …    | …      | …      | …      |
| C       | RSI < 35 | …    | …      | …      | …      |

Read the shape:

- **All 3 profitable** → pick the **best Sharpe** (not best PnL — PnL rewards luck on small samples). Parameter is robust; proceed to walk-forward / deployment with confidence.
- **1-2 profitable** → pick the winner, but flag that the param is sensitive. Either (a) walk-forward to a 2nd pair, or (b) one tighter sweep around the winner.
- **All 3 unprofitable / < 10 trades each** → the **idea** doesn't work on this pair. Don't sweep again. Switch pair or strategy.
- **Monotonic edge** (PnL strictly improves A → B → C) → the best variant is at the edge of the grid. Run **one more** variant past it (e.g. RSI < 40). Don't run another full 3-grid; just extend by one.

## Read the exit-reason mix

After the backtest completes, look at the breakdown of how trades ended. A healthy strategy ends through a mix of:

- Take-profit / `minimal_roi`
- Signal-based exit (`populate_exit_trend`)
- Trailing stop
- Time-based timeout (`custom_exit`)

Each one tells a different story. Distortions diagnose specific bugs:

| Distortion              | Meaning                                                                                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 90% stoploss hits       | Stop is too tight relative to the strategy's natural noise. Widen, or accept this strategy is in the wrong volatility regime for this pair.    |
| 90% time-based timeouts | Exit signal does nothing. Either the exit conditions are too restrictive, or there's no real edge — you're just holding until the timer rings. |
| 100% take-profit hits   | `minimal_roi` is the strategy. The exit signal isn't earning its keep — could be removed or tightened.                                         |
| 50/50 stop vs profit    | Healthy. Strategy is choosing actively in both directions.                                                                                     |

## Zero-trade diagnosis

Zero trades from a backtest means the **entry condition never fired**. Five common causes, in order of likelihood:

1. **Indicator threshold too strict** (e.g. `RSI < 30` rarely triggers on BTC 15m).
2. **`startup_candle_count` larger than available data** — the indicator stays NaN forever.
3. **Pair has no data for the requested timerange.**
4. **Wrong pair format** for trading mode (`BTC/USDC` for futures will silently produce no fills).
5. **Multi-condition entry that's effectively `false AND false`** — each condition individually rare, joined by `AND` rarer still.

### The escalation rule (don't burn cycles)

- **1st zero-trade backtest**: Diagnose. Widen the threshold, drop one of the AND conditions, or extend the window. Next attempt should be a **3-variant sweep**, not a single guess — gives sensitivity in one shot.
- **2nd consecutive all-zero result**: **STOP.** Don't run a third. Tell the user: _"Two consecutive attempts returned zero trades. The strategy needs a fundamentally different approach."_ Suggest a different signal (mean-reversion vs momentum, BB vs RSI), a different timeframe, or a different pair.
- **Never run 3+ all-zero attempts in a row** on the same idea. Wastes compute and user trust.

## Compute cost (estimate before submitting)

Backtest run time scales with **candle count**. Estimate before submitting so you can set the user's expectations:

```
candles ≈ (days × 24) / timeframe_hours × number_of_pairs
```

| Candle count | Behavior                                                     |
| ------------ | ------------------------------------------------------------ |
| < 100K       | Submit normally, poll every 10s.                             |
| 100K–500K    | Warn user "may take a few minutes", use exponential polling. |
| > 500K       | Warn user "could take 10+ minutes", longer poll intervals.   |

Reference points:

- 1 pair × 15m × 90 days = **8.6K candles** (fast)
- 3 pairs × 5m × 90 days = **78K candles** (fast)
- 12 pairs × 1m × 90 days = **1.5M candles** (slow — warn upfront)

**Always allow the user to proceed.** Just set expectations. Don't block on size.

### Exponential polling cadence

When polling `backtest_status` on long runs:

- Polls 1-3: every **10s**
- Polls 4-6: every **20s**
- Polls 7-9: every **30s**
- Polls 10+: every **60s**

This prevents hitting the 20-step tool limit on million-candle backtests.

## What headline numbers to trust (and not)

| Metric             | Trust at                                                  | Notes                                                                             |
| ------------------ | --------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Total trades**   | Always look first.                                        | Below 30 = ignore everything else.                                                |
| **Total profit %** | Useful for ranking, weak for forecasting.                 | Large windows + small per-trade edge can produce big PnL from luck.               |
| **Win rate**       | OK above 50 trades.                                       | A 60% WR on 8 trades is one good week, not an edge.                               |
| **Sharpe ratio**   | Above 1.0 = good, above 2.0 = excellent.                  | But fragile under 50 trades; don't quote "Sharpe 2.0" off a 12-trade run.         |
| **Profit factor**  | Gross gains / gross losses. > 1.3 is the practical floor. | Penalizes hidden tail losses better than Sharpe.                                  |
| **Max drawdown**   | > 20% is risky for retail-sized accounts.                 | A 5% Sharpe-1 strategy with 30% DD is unrunnable for most users.                  |
| **Avg holding**    | Sanity check — does it match the strategy's intent?       | A "scalp" with 12h avg holding is misnamed; a "swing" with 5min holding likewise. |

## Walk-forward (the honest validation)

Before recommending live deployment, run the strategy on **out-of-sample data** at least once:

1. **Out-of-sample period**: take the most recent 30 days that weren't in your tuning window. Re-run unchanged. Numbers should be in the same ballpark — not better, not dramatically worse.
2. **Out-of-sample pair**: run on a sibling pair (`ETH` if you tuned on `BTC`). Allow ±30% degradation; anything beyond that means the parameters were pair-specific not regime-specific.

If both walk-forwards survive, you have a defensible recommendation. If either falls apart, you have a backtest, not a strategy.
