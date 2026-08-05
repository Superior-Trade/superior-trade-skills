---
name: lighter-robinhood
version: 1.0.0
updated: 2026-07-16
description: "Use Robinhood Chain Lighter through Superior Trade with exchange name lighter-robinhood."
homepage: https://robinhoodchain.lighter.xyz
source: https://github.com/Superior-Trade
primaryEnv: SUPERIOR_TRADE_API_KEY
auth:
  type: api_key
  env: SUPERIOR_TRADE_API_KEY
  header: x-api-key
  scope: "Read-write the user's own Robinhood Chain Lighter deployment plans and signed transaction proxy submissions. Cannot export private keys or access other users' data."
env:
  - name: SUPERIOR_TRADE_API_KEY
    description: "Superior Trade API key (x-api-key header). Obtained at https://account.superior.trade."
    required: true
    type: api_key
externalEndpoints:
  - url: https://api.superior.trade
    purpose: "Superior Trade deployment planning and signed transaction proxy operations"
  - url: https://api.rh.lighter.xyz
    purpose: "Robinhood Chain Lighter public API and signed transaction submission through Superior Trade"
---

# Superior Trade Robinhood Chain Lighter

Use this skill when the user asks about Robinhood Chain Lighter, Robinhood Wallet perps on Lighter, or the Superior Trade exchange named `lighter-robinhood`.

**Exchange name:** `lighter-robinhood`
**Venue config:** `{ "venue": "lighter-robinhood", "instrument_id": "<SYMBOL>-PERP.LIGHTER-RH" }`
**API base:** `https://api.rh.lighter.xyz`
**WebSocket:** `wss://api.rh.lighter.xyz/stream`
**Robinhood Chain id:** `4663`
**Perps deposit asset:** `USDG`

## Safety Rules

- Never ask for private keys, seed phrases, API private keys, passwords, or wallet credentials.
- Never treat `lighter-robinhood` as an alias for `lighter`; it has a different API base, chain id, deposit asset, and instrument suffix.
- Do not reuse the default Lighter USDC CCTP deposit wording. Robinhood Chain Lighter perps require USDG.
- Do not claim live Nautilus execution support until signed transaction generation supports Robinhood Chain id `4663`.
- Never move funds, submit a signed proxy action, or start live trading without explicit user confirmation.

## Deployment Planning

Create deployment plans through `/v3/deployments` with `venue: "lighter-robinhood"` and `.LIGHTER-RH` instruments.

```json
{
  "region": "tokyo",
  "deployment": {
    "code": "class RobinhoodLighterStrategy: pass\n",
    "config": {
      "venue": "lighter-robinhood",
      "runtime": "nautilus-pyo3",
      "instrument_id": "PLTR-PERP.LIGHTER-RH"
    }
  }
}
```

The API plans the `lighter-robinhood-tokyo` venue profile. Starting the deployment currently returns `409` with reason `LighterRobinhoodChainIdUnsupported`; endpoint overrides alone are insufficient because the current Nautilus Lighter signer only supports built-in mainnet/testnet chain ids.

## Signed Proxy

For one-off signed order proxy calls, include the top-level exchange selector so the API signs against Robinhood Chain Lighter settings:

```json
{
  "exchange": "lighter-robinhood",
  "action": {
    "type": "placeOrder",
    "from": "0xSuperiorManagedWallet",
    "market_id": 12,
    "side": "buy",
    "quote_amount": "10",
    "max_slippage": "0.005",
    "reduce_only": false,
    "price_protection": true
  }
}
```

The signer uses `base_url: "https://api.rh.lighter.xyz"` and `chain_id: 4663` for this request.

## Deposits

Robinhood Chain Lighter perps require USDG, not USDC. The current Superior `/v3/portfolio/lighter/deposit` route is the default Lighter USDC CCTP flow and must not be presented as a Robinhood Chain Lighter deposit path.

Until Superior adds a dedicated Robinhood Chain Lighter deposit route, instruct the user to fund Robinhood Chain Lighter with USDG through the official Robinhood Chain Lighter or Robinhood Wallet flow, then verify account readiness through Superior once the API supports venue-specific Robinhood readiness.

## Troubleshooting

- `validation_failed`: confirm `config.venue` is exactly `lighter-robinhood` and the instrument ends with `.LIGHTER-RH`.
- `LighterRobinhoodChainIdUnsupported`: expected for live Nautilus starts until chain id `4663` signing is supported.
- `lighter_error`: do not retry blindly; report the upstream message and verify market id, size, slippage, nonce, and account readiness.
