# Lighter Nautilus Deployments

Creating a Lighter deployment, storing credentials, starting and stopping it, and monitoring.

Reference for the `lighter` skill. See SKILL.md for the workflow and safety rules.

---

## Nautilus Deployment

Lighter strategy deployment uses the v3 Nautilus deployment API. It is separate from Hyperliquid Freqtrade deployments.

### Create a Lighter deployment

```bash
curl -sS -X POST "https://api.superior.trade/v3/deployments" \
  -H "x-api-key: ${SUPERIOR_TRADE_API_KEY}" \
  -H "content-type: application/json" \
  -d '{
    "region": "tokyo",
    "deployment": {
      "code": "class LighterStrategy: pass\n",
      "config": {
        "venue": "lighter",
        "instrument_id": "BTC-PERP.LIGHTER"
      }
    }
  }'
```

Rules:

- `config.venue` must be exactly `lighter`.
- `config.instrument_id` must be formatted as `<symbol>.LIGHTER`, for example `BTC-PERP.LIGHTER`.
- The API plans the `lighter-tokyo` venue profile.
- Lighter live deployments require a ready Lighter account and stored credentials.

### Store deployment credentials

```bash
curl -sS -X POST "https://api.superior.trade/v3/deployments/${DEPLOYMENT_ID}/credentials" \
  -H "x-api-key: ${SUPERIOR_TRADE_API_KEY}" \
  -H "content-type: application/json" \
  -d '{ "wallet_address": "0xSuperiorManagedWallet" }'
```

The wallet address must be owned by the authenticated user. The response reports `credentials_status: "stored"` and `exchange: "lighter"`. It does not return private keys.

### Start or stop deployment

Before starting, verify:

1. `GET /v3/account/{address}/status/lighter` reports `ready`.
2. `GET /v3/portfolio/lighter/balance?owner_address=...` shows enough USDC for the strategy.
3. The deployment has `credentials_status: "stored"`.
4. The user explicitly confirms live trading.

Show this confirmation before starting:

```text
Deployment Summary:
* Strategy: [name]
* Exchange: lighter
* Runtime: Nautilus
* Instrument: [instrument_id]
* Owner wallet: [owner_address]
* Lighter balance: [balance] USDC

This will trade with REAL funds on Lighter. Proceed? (yes/no)
```

Start:

```bash
curl -sS -X PATCH "https://api.superior.trade/v3/deployments/${DEPLOYMENT_ID}/status" \
  -H "x-api-key: ${SUPERIOR_TRADE_API_KEY}" \
  -H "content-type: application/json" \
  -d '{ "action": "start" }'
```

Stop:

```bash
curl -sS -X PATCH "https://api.superior.trade/v3/deployments/${DEPLOYMENT_ID}/status" \
  -H "x-api-key: ${SUPERIOR_TRADE_API_KEY}" \
  -H "content-type: application/json" \
  -d '{ "action": "stop" }'
```

### Monitor deployment

```bash
curl -sS "https://api.superior.trade/v3/deployments/${DEPLOYMENT_ID}" \
  -H "x-api-key: ${SUPERIOR_TRADE_API_KEY}"

curl -sS "https://api.superior.trade/v3/deployments/${DEPLOYMENT_ID}/logs?pageSize=100" \
  -H "x-api-key: ${SUPERIOR_TRADE_API_KEY}"
```

Use logs and status responses to verify runtime health. Do not infer that a deployment is trading from a successful start response alone.

## Error Handling

- `400 validation_failed`: Fix request shape, especially `venue`, `instrument_id`, wallet addresses, amount precision, or idempotency input.
- `401` or `403`: Check that `SUPERIOR_TRADE_API_KEY` is present and sent as `x-api-key`.
- `404 not_found`: The Lighter feature can be disabled or the resource does not belong to the user.
- `409`: A deposit is already active, a Lighter account is not ready, or the idempotency key was reused with different input.
- `502`: Upstream Lighter lookup, intent creation, key provisioning, or withdrawal submission failed.

