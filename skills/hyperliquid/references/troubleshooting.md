# Operations and Troubleshooting

Diagnosing deployments that fail, trade zero times, hit rate limits, or leave orphan positions.

Reference for the `hyperliquid` skill. See SKILL.md for the workflow and safety rules.

---

## Operations and Troubleshooting

### Reporting DCA Trades

For DCA strategies: distinguish trades from orders ("X trades, Y buy orders, Z sell orders"), show per-order detail for at least the first trade, flag minimum order rejections or dust positions. Order-level detail comes from `GET /v2/backtesting/{id}/logs`; `resultUrl` is null on completed runs. Skip breakdown for non-DCA strategies.

### Log Interpretation

- **Heartbeat messages are normal** — the bot sends periodic heartbeats to confirm it's alive
- **"Analyzing candle"** — bot is checking strategy conditions on the latest candle
- **"Buying"/"Selling"** — trade execution
- **Rate limit warnings** — reduce API calls, consider stopping if persistent
- **Websocket disconnection ("Couldn't reuse watch…falling back to REST api")** — normal and expected. The bot automatically reconnects via REST API. Trading is **not** affected. Do not treat this as an error or suggest redeployment.

### Diagnosing Zero-Trade Deployments

Check in order:

1. **Main wallet balance** — agent wallet $0 is normal; check the platform-managed main wallet
2. **`stake_amount`** — for simple single-entry strategies, if `"unlimited"` with a small balance, redeploy with an explicit numeric amount slightly below balance. For `position_adjustment_enable` / `adjust_trade_position` strategies, either use fixed stake with enough wallet room for planned adds, or keep `stake_amount: "unlimited"` and reduce `custom_stake_amount`, ladder count, or total planned exposure.
3. **Credentials** — verify `credentials_status: "stored"` and `WALLET_ADDRESS` in startup logs
4. **Strategy conditions** — check if entry conditions are met on recent candles
5. **Logs** — check for rate limits, exchange rejections, pair errors
6. **Pair validity** — verify pair is active on Hyperliquid

### Rate Limit Mitigation

Hyperliquid enforces rate limits. Aggressive retries, tight loops, or extra exchange traffic from strategy code can trigger **429** responses and unstable behavior.

**Prevention:**

- Set `process_only_new_candles = True` so the bot does not reprocess every candle unnecessarily
- Prefer candle-close pricing for exits where it fits the strategy (fewer edge-case order updates)
- Do not add **custom polling** of Hyperliquid’s API (or other heavy network work) inside hot strategy paths — it stacks on top of normal bot traffic

**If you see rate limits or 429s in logs:**

- Avoid rapid stop/start cycles; that often worsens retries against the limit
- After the deployment stops, wait several minutes before starting again; if the issue persists, simplify the strategy or reduce anything that drives extra exchange requests

### Orphan Position Handling

When a bot crashes, it may leave open positions that lock up margin. Strategy code pattern:

- In `bot_loop_start()`, check for positions not in the bot's trade database
- Close orphans with a limit order before entering fresh
- Use a flag (`_orphan_closed`) to run cleanup exactly once per lifecycle

### Backtest `limit_exceeded` Error

If you get a `limit_exceeded` error when creating a backtest, the user has hit the concurrent backtest limit. Delete completed/failed backtests first: `DELETE /v2/backtesting/{id}`

### Timezone Reminder

All API timestamps are in **UTC (ISO8601)**. Convert to the user's local timezone when presenting times conversationally. If timezone is unknown, show both UTC and ask.
