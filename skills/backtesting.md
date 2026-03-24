---
version: alpha-0.0.1
updated: 2026-03-24
---

# Backtesting — Superior Trade

Sub-skill for running and interpreting backtests.

**Load when:** Strategy is written and user wants to test it, or user asks about backtest results.

## Backtest Workflow

1. Build config + strategy code from user requirements
2. `POST /v2/backtesting` — create
3. `PUT /v2/backtesting/{id}/status` with `{"action": "start"}`
4. Poll `GET /v2/backtesting/{id}/status` every 10s until `completed` or `failed` (1–10 min)
5. `GET /v2/backtesting/{id}` — fetch full results; download `result_url` for detailed JSON
6. Present summary: total trades, win rate, profit, drawdown, Sharpe ratio
7. If failed, check `GET /v2/backtesting/{id}/logs`
8. To cancel: `DELETE /v2/backtesting/{id}`

## API Reference

### POST `/v2/backtesting` — Create Backtest

```json
// Request
{ "config": {}, "code": "string (Python strategy)", "timerange": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" } }

// Response (201)
{ "id": "string", "status": "pending", "message": "Backtest created. Call PUT /:id/status with action \"start\" to begin." }
```

### PUT `/v2/backtesting/{id}/status` — Start Backtest

```json
// Request — only "start" is supported; to cancel, use DELETE
{ "action": "start" }

// Response (200)
{ "id": "string", "status": "running", "previous_status": "pending", "job_name": "backtest-01kjvze9" }
```

### GET `/v2/backtesting/{id}/status` — Poll Status

Response: `{ "id": "string", "status": "pending | running | completed | failed", "results": null }`. `results` is `null` while running — use `result_url` from full details for complete results.

### GET `/v2/backtesting/{id}` — Full Details

```json
{
  "id": "string",
  "config": {},
  "code": "string",
  "timerange": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" },
  "status": "pending | running | completed | failed",
  "results": null,
  "result_url": "https://storage.googleapis.com/... (signed URL, valid 7 days)",
  "started_at": "ISO8601",
  "completed_at": "ISO8601",
  "job_name": "string",
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```

### DELETE `/v2/backtesting/{id}`

Cancels if running and deletes. Response: `{ "message": "Backtest deleted" }`

### Logs — GET `/v2/backtesting/{id}/logs`

Query: `pageSize` (default 100), `pageToken`. Response: `{ "items": [{ "timestamp": "ISO8601", "message": "string", "severity": "string" }], "nextCursor": "string | null" }`

### Paginated Lists

`GET /v2/backtesting` returns `{ "items": [], "nextCursor": "string | null" }`. Pass `cursor` query param to paginate.

## Result Interpretation

After status = `completed`, download the `result_url` JSON for full results. Present these key metrics:

- **Total trades** — number of completed round-trips
- **Win rate** — percentage of profitable trades
- **Total profit %** — net profit as percentage of starting balance
- **Max drawdown** — worst peak-to-trough decline
- **Sharpe ratio** — risk-adjusted return (>1.0 is good, >2.0 is excellent)
- **Average trade duration** — how long positions are held

### Reporting DCA Trades

For DCA strategies: distinguish trades from orders ("X trades, Y buy orders, Z sell orders"), show per-order detail for at least the first trade, flag minimum order rejections or dust positions. Always download `result_url` for full order-level data. Skip breakdown for non-DCA strategies.

## Failure Handling

If a backtest fails:

1. Check `GET /v2/backtesting/{id}/logs` for error messages
2. Common causes:
   - **Timerange too early** — no data before November 2025
   - **Invalid pair format** — spot vs futures mismatch
   - **Strategy code error** — Python syntax/runtime error
   - **No candles** — pair doesn't exist or no data for timeframe
3. Fix the issue and create a new backtest (failed ones can't be restarted)

### `limit_exceeded` Error

If you get a `limit_exceeded` error when creating a backtest, the user has hit the concurrent backtest limit. Delete completed/failed backtests first: `DELETE /v2/backtesting/{id}`

## Data Availability

- Hyperliquid data available from **~November 2025**
- ~5000 historic candles per pair
- XYZ HIP3 from ~November 2025, KM/CASH/FLX from ~February 2026
- Backtests with no data for the timerange will fail
