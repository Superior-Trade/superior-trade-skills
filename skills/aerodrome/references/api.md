# Aerodrome API Reference

Endpoint quick reference and a complete AERO/USDC backtest payload.

Reference for the `aerodrome` skill. See SKILL.md for the workflow and safety rules.

---

### Aerodrome API Quick Reference

Use `SUPERIOR_TRADE_API_KEY` from the environment. Do not paste API keys into commands, files, or logs.

Check data availability:

```bash
curl -sS --get "https://api.superior.trade/v2/backtesting-data/aerodrome" \
  --data-urlencode "pair=AERO/USDC" \
  --data-urlencode "timeframe=5m"
```

Expected success shape:

```json
{
  "available": true,
  "pair": "AERO/USDC",
  "timeframe": "5m",
  "from": "ISO8601 when cataloged",
  "to": "ISO8601 when cataloged",
  "candles": 1234
}
```

If `available` is false or the response says data will be fetched live from Bitquery, it is still acceptable to create the backtest unless the user requested only pre-downloaded data.

Create the backtest:

```bash
curl -sS -X POST "https://api.superior.trade/v2/backtesting" \
  -H "content-type: application/json" \
  -H "x-api-key: ${SUPERIOR_TRADE_API_KEY}" \
  --data @aero-backtest.json
```

Create response:

```json
{
  "id": "string",
  "status": "pending",
  "message": "Backtest created. Call PUT /:id/status with action \"start\" to begin."
}
```

Start the backtest:

```bash
curl -sS -X PUT "https://api.superior.trade/v2/backtesting/${BACKTEST_ID}/status" \
  -H "content-type: application/json" \
  -H "x-api-key: ${SUPERIOR_TRADE_API_KEY}" \
  --data '{"action":"start"}'
```

Poll status every 10 seconds until `completed` or `failed`:

```bash
curl -sS "https://api.superior.trade/v2/backtesting/${BACKTEST_ID}/status" \
  -H "x-api-key: ${SUPERIOR_TRADE_API_KEY}"
```

Fetch full details after completion:

```bash
curl -sS "https://api.superior.trade/v2/backtesting/${BACKTEST_ID}" \
  -H "x-api-key: ${SUPERIOR_TRADE_API_KEY}"
```

If failed, fetch logs:

```bash
curl -sS "https://api.superior.trade/v2/backtesting/${BACKTEST_ID}/logs?pageSize=100" \
  -H "x-api-key: ${SUPERIOR_TRADE_API_KEY}"
```

Cancel or delete a backtest:

```bash
curl -sS -X DELETE "https://api.superior.trade/v2/backtesting/${BACKTEST_ID}" \
  -H "x-api-key: ${SUPERIOR_TRADE_API_KEY}"
```

Status responses may include parsed `results`. Full details may include a signed `resultUrl`; download it for full Freqtrade metrics when present. Present at least total trades, win rate, total profit, max drawdown, and Sharpe ratio. If a backtest fails, summarize the relevant log lines and the likely fix.

### AERO/USDC Backtest Payload

Use this as the default `aero-backtest.json` for a simple AERO strategy unless the user requested different risk, timeframe, timerange, or indicators.

```json
{
  "config": {
    "exchange": {
      "name": "aerodrome",
      "pair_whitelist": ["AERO/USDC"],
      "ccxt_config": {
        "options": {
          "rpcUrl": "https://mainnet.base.org",
          "markets": [
            {
              "symbol": "AERO/USDC",
              "baseAddress": "0x940181a94A35A4569E4529A3CDfB74e38FD98631",
              "baseDecimals": 18,
              "quoteAddress": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
              "quoteDecimals": 6,
              "poolAddress": "0x6cdcb1c4a4d1c3c6d054b27ac5b77e89eafb971d",
              "stable": false
            },
            {
              "symbol": "CHECK/USDC",
              "baseAddress": "0x9126236476eFBA9Ad8aB77855c60eB5BF37586Eb",
              "baseDecimals": 18,
              "quoteAddress": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
              "quoteDecimals": 6,
              "poolAddress": "0x6a4BeFa1337865071E27c62dc9d7E3bCa253cE0f",
              "stable": false
            }
          ]
        }
      }
    },
    "stake_currency": "USDC",
    "stake_amount": 10,
    "max_open_trades": 1,
    "timeframe": "5m",
    "stoploss": -0.1,
    "minimal_roi": { "0": 0.05 },
    "order_types": {
      "entry": "market",
      "exit": "market",
      "force_entry": "market",
      "force_exit": "market",
      "emergency_exit": "market",
      "stoploss": "market",
      "stoploss_on_exchange": false
    },
    "entry_pricing": { "price_side": "other", "use_order_book": false },
    "exit_pricing": { "price_side": "other", "use_order_book": false },
    "pairlists": [{ "method": "StaticPairList" }]
  },
  "code": "from freqtrade.strategy import IStrategy\nimport pandas as pd\nimport talib.abstract as ta\n\n\nclass AeroRsiEmaStrategy(IStrategy):\n    timeframe = \"5m\"\n    process_only_new_candles = True\n    startup_candle_count = 50\n    minimal_roi = {\"0\": 0.05}\n    stoploss = -0.10\n    can_short = False\n\n    def populate_indicators(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:\n        dataframe[\"rsi\"] = ta.RSI(dataframe, timeperiod=14)\n        dataframe[\"ema_50\"] = ta.EMA(dataframe, timeperiod=50)\n        return dataframe\n\n    def populate_entry_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:\n        dataframe.loc[\n            (dataframe[\"volume\"] > 0)\n            & (dataframe[\"rsi\"] < 35)\n            & (dataframe[\"close\"] > dataframe[\"ema_50\"]),\n            \"enter_long\",\n        ] = 1\n        return dataframe\n\n    def populate_exit_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:\n        dataframe.loc[\n            (dataframe[\"rsi\"] > 65),\n            \"exit_long\",\n        ] = 1\n        return dataframe\n",
  "timerange": {
    "start": "2026-03-01",
    "end": "2026-04-01"
  }
}
```

Before submitting a modified payload, re-check it against the non-negotiables: spot-only, no `:USDC` pair suffix, no private keys, no orderbook pricing, market order types, numeric stake amount, and supported Aerodrome market metadata.

