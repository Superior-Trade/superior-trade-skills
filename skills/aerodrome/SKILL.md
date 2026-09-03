---
name: aerodrome
description: Use when creating, validating, backtesting, deploying, sizing, or troubleshooting Aerodrome/Base spot trading strategies through the Superior Trade API, especially Freqtrade configs using exchange.name "aerodrome", AERO/USDC or CHECK/USDC pairs, AMM market swaps, wallet/gas balance checks, no-orderbook pricing, or Aerodrome live deployment safety.
metadata:
  version: "0.1.0"
---

# Aerodrome Trading

## Overview

Use this skill only for Aerodrome trading on Base through Superior Trade. Aerodrome is spot-only AMM swap execution: no futures, no margin, no shorting, no leverage, no sub-accounts, and no order book.

## Production Defaults

- Superior Trade API base URL: `https://api.superior.trade`
- Auth header: `x-api-key: $SUPERIOR_TRADE_API_KEY`
- Base RPC URL: `https://mainnet.base.org`
- Keep setup simple: one pair, one numeric stake amount, static pairlist, market orders, and no orderbook pricing.

## Source Of Truth

When behavior is unclear, inspect these local sources before answering:

- Production API: `https://api.superior.trade`

## Non-Negotiables

- Use `exchange.name: "aerodrome"`.
- Use only the supported spot pairs: `AERO/USDC` and `CHECK/USDC`. Never use `:USDC`.
- Omit `trading_mode`, or set it to `"spot"` only.
- Never set `margin_mode`, `leverage`, short entries, or futures fields.
- Set `entry_pricing.use_order_book: false` and `exit_pricing.use_order_book: false`.
- Do not call `self.dp.orderbook()`, `fetch_order_book`, `fetch_l2_order_book`, or order-book depth checks in strategy code.
- Use market orders. Aerodrome's CCXT adapter supports AMM market swaps, not limit-order-book execution.
- Use explicit numeric `stake_amount`. Avoid `"unlimited"` unless the user explicitly accepts balance exhaustion risk.
- Never include wallet private keys or platform-injected exchange credentials in config.
- Use `https://mainnet.base.org` for `exchange.ccxt_config.options.rpcUrl` unless the user explicitly provides another Base RPC.
- Always backtest before suggesting live deployment.
- Never start live trading without explicit user confirmation.

## Wallet And Balance Rules

Aerodrome live trading depends heavily on the Base wallet balances because every order is an on-chain swap.

Before live deployment or when troubleshooting zero trades:

1. Verify the wallet has enough quote token for buys, usually USDC.
2. Verify it has enough base token for sells, such as AERO for `AERO/USDC`.
3. Verify it has Base ETH for gas. A small ETH balance is required even when trading USDC pairs.
4. Size `stake_amount * max_open_trades` below free quote balance and leave room for AMM slippage, token fees, and gas. Prefer 70-90% of available quote balance, lower for small wallets.
5. If the wallet balance cannot be checked in the current turn, say it has not been checked. Do not infer or fabricate balances.

Important distinction: Aerodrome uses Base wallet balances directly for on-chain swaps. Do not apply external exchange account rules here.

## Supported Markets

Hard-code these Aerodrome/Base market definitions when configuring `exchange.ccxt_config.options.markets`:

| Symbol | Base address | Base decimals | Quote address | Quote decimals | Pool address | Stable |
| --- | --- | ---: | --- | ---: | --- | --- |
| `AERO/USDC` | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` | 18 | `0x833589fcd6edb6e08f4c7c32d4f71b54bda02913` | 6 | `0x6cdcb1c4a4d1c3c6d054b27ac5b77e89eafb971d` | false |
| `CHECK/USDC` | `0x9126236476eFBA9Ad8aB77855c60eB5BF37586Eb` | 18 | `0x833589fcd6edb6e08f4c7c32d4f71b54bda02913` | 6 | `0x6a4BeFa1337865071E27c62dc9d7E3bCa253cE0f` | false |

Backtesting data is available for both supported pairs on `5m`, `15m`, `1h`, `4h`, and `1d`.

## Minimum Config

Start from this shape and only change `pair_whitelist`, timeframe, stake, and strategy parameters. Keep the hard-coded supported markets and no-orderbook fields.

```json
{
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
}
```

Notes:

- `stake_currency` must appear in the configured markets. For `AERO/USDC`, use `USDC`.
- Use `trading_min_order_amount` only when the strategy needs an explicit minimum; the API pads Aerodrome configs to `1` when omitted.
- Do not include `dry_run`, `initial_state`, `api_server`, `walletAddress`, `privateKey`, `wallet_address`, or `private_key`.
- `ccxt_async_config` is usually unnecessary for Aerodrome authoring unless current API tests show otherwise.

## Backtest Workflow

1. Build Aerodrome config and Freqtrade strategy code.
2. Check data availability with `GET https://api.superior.trade/v2/backtesting-data/aerodrome?pair=AERO/USDC&timeframe=5m`.
3. Create a backtest with `POST https://api.superior.trade/v2/backtesting` using `{ "config": {}, "code": "...", "timerange": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" } }`.
4. Start it with `PUT https://api.superior.trade/v2/backtesting/{id}/status` and `{ "action": "start" }`.
5. Poll `GET https://api.superior.trade/v2/backtesting/{id}/status` until `completed` or `failed`.
6. Fetch `GET https://api.superior.trade/v2/backtesting/{id}` and inspect `result_url` for full metrics.
7. Present total trades, win rate, profit, drawdown, and whether results justify live testing.

Do not offer live deployment after a zero-trade backtest unless the user explicitly wants to debug live behavior.

## Live Deployment Workflow

1. Create deployment with `POST https://api.superior.trade/v2/deployment` using Aerodrome config and strategy code.
2. Store or confirm credentials using the current API behavior:
   - Prefer the documented v2 flow when supported: `POST https://api.superior.trade/v2/deployment/{id}/credentials` with `{"exchange":"aerodrome"}`.
   - If the current API rejects Aerodrome on the v2 credentials route, inspect the local `api/src/routes/credentials-v2.ts`, `api/src/routes/deployment.ts`, and OpenAPI before proceeding. Do not ask the user for private keys unless the live API explicitly requires that legacy flow.
3. Run the pre-deployment checklist below.
4. Show a concise live trading summary and wait for explicit confirmation.
5. Start with `PATCH https://api.superior.trade/v2/deployment/{id}/status` and `{ "action": "start" }`.
6. Monitor status and logs with `GET https://api.superior.trade/v2/deployment/{id}/status` and `GET https://api.superior.trade/v2/deployment/{id}/logs`.
7. Stop with `PATCH https://api.superior.trade/v2/deployment/{id}/status` and `{ "action": "stop" }`.

### Pre-Deployment Checklist

- Backtest completed and was reviewed.
- Config is Aerodrome spot-only and has no `margin_mode`, leverage, shorting, or `:USDC` pair suffix.
- `entry_pricing.use_order_book` and `exit_pricing.use_order_book` are false.
- `stake_amount` is numeric and fits wallet balances with gas/slippage buffer.
- Wallet has Base ETH for gas and enough relevant token balance for intended buys/sells.
- Strategy has no custom orderbook or RPC polling.
- User explicitly confirmed live trading.

Use this confirmation format:

```text
Deployment Summary:
- Exchange: aerodrome on Base
- Trading mode: spot only
- Pair: [pair]
- Stake amount: [amount] [stake_currency] per trade
- Max open trades: [n]
- Stoploss: [percentage]
- Order execution: AMM market swaps, no orderbook
- Wallet balance checked: [yes/no, source]
- Base ETH gas checked: [yes/no, source]

This will trade with real funds. Proceed? (yes/no)
```


## Reference files

Load on demand.

| Read | When |
| --- | --- |
| `references/api.md` | You need endpoint shapes or a complete AERO/USDC backtest payload. |
| `references/strategy-template.md` | You are writing or adapting the strategy code. |
| `references/troubleshooting.md` | A swap failed, gas is short, or a deployment trades zero times. |
