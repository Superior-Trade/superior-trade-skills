---
name: lighter-robinhood
description: "Use when planning a Robinhood Chain Lighter strategy through Superior Trade, or when a config needs the venue name lighter-robinhood."
metadata:
  version: 1.0.0
  updated: 2026-07-16
  homepage: https://robinhoodchain.lighter.xyz
  source: https://github.com/Superior-Trade
  primaryEnv: SUPERIOR_TRADE_API_KEY
  auth:
    type: api_key
    env: SUPERIOR_TRADE_API_KEY
    header: x-api-key
    scope: "Read Unified venue capabilities and prepare contract-supported Robinhood Chain Lighter backtests or deployments. Cannot submit an undocumented signed proxy action, export private keys, or access other users' data."
  env:
    - name: SUPERIOR_TRADE_API_KEY
      description: "Superior Trade API key (x-api-key header). Obtained at https://account.superior.trade."
      required: true
      type: api_key
  externalEndpoints:
    - url: https://unified-api-zag4gzx6gq-an.a.run.app
      purpose: "Unified venue discovery, backtests, and deployment planning"
---

# Superior Trade Robinhood Chain Lighter

Use this skill when the user asks about Robinhood Chain Lighter, Robinhood Wallet perps on Lighter, or the Superior Trade exchange named `lighter-robinhood`.

**Exchange name:** `lighter-robinhood`
**Venue config:** `{ "venue": "lighter-robinhood", "instrument_id": "<SYMBOL>-PERP.LIGHTER-RH" }`
**Superior API base:** `https://unified-api-zag4gzx6gq-an.a.run.app`
**Robinhood Chain id:** `4663`
**Perps deposit asset:** `USDG`

## Safety Rules

- Never ask for private keys, seed phrases, API private keys, passwords, or wallet credentials.
- Never treat `lighter-robinhood` as an alias for `lighter`; it has a different venue profile, chain id, deposit asset, and instrument suffix.
- Do not reuse the default Lighter USDC CCTP deposit wording. Robinhood Chain Lighter perps require USDG.
- Do not claim live Nautilus execution support until signed transaction generation supports Robinhood Chain id `4663`.
- Never move funds or start live trading without explicit user confirmation.

## Deployment Planning

First read `GET /context/venues`, `GET /runtime/frameworks`, and
`GET /context/markets`. Create a deployment only if the returned capabilities
include `lighter-robinhood`; otherwise report it as unavailable through Unified
API. When supported, use `POST /runtime/deployments` with top-level fields from
`GET /openapi.json`, `venue: "lighter-robinhood"`, and the instrument identifier
returned by market discovery.

```json
{
  "framework": "nautilus",
  "venue": "lighter-robinhood",
  "mode": "paper",
  "name": "robinhood-lighter-plan",
  "code": "class RobinhoodLighterStrategy: pass\n",
  "config": {
    "instrument_id": "PLTR-PERP.LIGHTER-RH"
  }
}
```

Do not claim a fixed region profile or status code. Read the created deployment
and its logs, and use `PUT /runtime/deployments/{id}/status` only after the user
confirms the exact live action.

## One-time actions

The current committed Unified contract does not define a Robinhood Chain
Lighter execution action. Report one-off order or signed-proxy requests as
unavailable. Do not adapt an older payload to `POST /runtime/executions`.

## Deposits

Robinhood Chain Lighter perps require USDG, not USDC. `GET /wallet/deposits`
is history only and must not be presented as a Robinhood Chain Lighter deposit
action.

Until Superior adds a dedicated Robinhood Chain Lighter deposit route, instruct the user to fund Robinhood Chain Lighter with USDG through the official Robinhood Chain Lighter or Robinhood Wallet flow, then verify account readiness through Superior once the API supports venue-specific Robinhood readiness.

## Troubleshooting

- Confirm the venue and instrument against `GET /context/venues` and
  `GET /context/markets`; do not rely on hard-coded suffix rules alone.
- If creation or start fails, report the Unified deployment status and logs.
  Do not reinterpret an older venue-specific error contract.
