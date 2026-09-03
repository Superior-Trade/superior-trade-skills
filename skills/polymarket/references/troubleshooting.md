# Polymarket Operations and Troubleshooting

Diagnosing strategy-source, backtest, and deployment failures, including zero-trade deployments.

Reference for the `polymarket` skill. See SKILL.md for the workflow and safety rules.

---

## Troubleshooting

### Strategy Source Issues

- **Python syntax/import errors** — fix the inline strategy source or deployment code; Unified API has no separate strategy-validation resource.
- **Config mismatch** — make sure `strategyConfig` or `deployment.config` keys match the `StrategyConfig` class fields.
- **Missing instrument** — live deployment config requires `instrument_id` formatted as `<clobTokenId>.POLYMARKET`; do not use condition IDs or market slugs as instrument IDs.
- **Backtest-only mismatch** — backtests replay trade ticks. Quote-only strategies may run live but produce zero backtest callbacks.

### Backtest Failures

- A no-data failure means the identifier is wrong or the dataset has no coverage. Re-check `GET /context/markets?venue=polymarket`, require `backtest_ready: true`, and verify the range with `GET /context/datasets`.
- `message: "Process exited with code N"` — the strategy crashed at runtime. Common causes: config kwargs that don't match the config class fields, or referencing an instrument the engine didn't load.
- **Zero fills** — the strategy's conditions never triggered, or it only subscribes to quote ticks (backtests replay trade ticks only).

### Deployment Issues

- **`credentials_required`** — call `PUT /runtime/deployments/{id}/credentials` with an owned wallet address before starting.
- **`deployment_not_ready`** — call `GET /context/venues` and resolve blockers: not onboarded, approvals missing, or balance below 5 USDC.
- **Start returns 500** — resource submission failed. Check `GET /runtime/deployments/{id}/logs` if a runtime exists, otherwise retry after the platform issue is resolved.
- **Orders rejected at the venue** — usually readiness/balance, an order below the 5 pUSD / 5 share minimum, invalid instrument ID, or a market that has resolved or closed.
- **Rate limits** — if order submissions exceed ~30/minute, the venue throttles. Reduce re-quote frequency (e.g. only re-quote when the mid moves more than a threshold) rather than rapid stop/start cycles.

### Diagnosing Zero-Trade Deployments

Check in order:

1. **Wallet readiness** — `GET /wallet` and `GET /context/venues` show the required support and balance
2. **Runtime logs** — `GET /runtime/deployments/{id}/logs` for startup errors, order rejections, or strategy exceptions
3. **Market still active** — not resolved, `end_date` in the future
4. **Strategy conditions** — are entry thresholds reachable at current prices? (e.g. a carry strategy with `min_probability: 0.90` does nothing while the market trades at 0.60)
5. **Order minimums** — trade size at least 5 pUSD (market BUY) / 5 shares (limit/sell)
