---
description: Managed-wallet, balance, credential, and pair rules for Hyperliquid through Unified API.
---

# Hyperliquid wallets and accounts

## Managed wallet

`GET /wallet` is the source of truth for the authenticated account's managed
wallet, deposit details, and balances exposed by Unified API. Never invent a
second wallet, ask for a seed phrase, or tell the user to fund an agent signing
address.

Hyperliquid may use an agent wallet to sign against a main wallet's balance.
The signing wallet does not need its own funds. When checking collateral, query
the main wallet returned by Unified API and the live venue state.

Use `GET /context/venues` and `GET /runtime/frameworks` before backtesting or
deploying. A read from `GET /wallet` does not bootstrap a venue, bridge funds,
create a sub-account, or approve an agent. If Unified OpenAPI does not publish
the required mutation, report it as unavailable.

## Balance checks

For a live Hyperliquid decision, read both public venue states for the managed
wallet:

- Perps: `POST https://api.hyperliquid.xyz/info` with
  `{"type":"clearinghouseState","user":"0x..."}`
- Spot: `POST https://api.hyperliquid.xyz/info` with
  `{"type":"spotClearinghouseState","user":"0x..."}`

Also inspect open positions and orders. Size total reserved stake below free
collateral and retain a fee and margin buffer. Never infer a balance from a
deployment record or an agent wallet.

## Deployment credentials

Create the deployment first, then inspect `GET /runtime/deployments/{id}`. If
the resource requires credentials, send only a credential form explicitly
defined by `GET /openapi.json` to
`PUT /runtime/deployments/{id}/credentials`. Never reuse a payload from another
API generation and never log or display secret material.

## Transfers and withdrawals

`GET /wallet/deposits` and `GET /wallet/withdrawals` are history endpoints;
they do not move funds. `POST /wallet/withdraw` is the Unified withdrawal
operation and requires an exact amount/destination summary plus explicit user
confirmation.

Sub-account transfers, bridge deposits, and exit-all operations are available
only if the current Unified OpenAPI contract publishes them. A typed execution
must use one of the supported action schemas; do not disguise an unsupported
transfer as an order execution.

## Pair rules

Use `GET /context/markets?venue=hyperliquid` and copy the returned canonical and
framework-specific identifiers exactly. Standard perps, spot markets, and HIP-3
markets use different identifiers and fee/margin profiles. Verify the market is
live and supported before a backtest or deployment.
