---
name: superior-trade-auth
description: Request and use a Superior Trade API key for https://api.superior.trade. Use when an agent needs to onboard a user by email, request an API key with POST /auth/sign-in/magic-link, set up x-api-key authentication, or recover from missing/invalid Superior Trade credentials (401/403) before backtesting or deploying a strategy.
license: see LICENSE
version: "1.0.0"
metadata:
  openclaw:
    requires:
      env:
        - SUPERIOR_TRADE_API_KEY
    primaryEnv: SUPERIOR_TRADE_API_KEY
    envVars:
      - name: SUPERIOR_TRADE_API_KEY
        required: true
        description: Superior Trade API key, sent as the x-api-key header.
---

# Superior Trade Authentication

Use this skill to get a Superior Trade API key and make authenticated requests to `https://api.superior.trade`.

## API Key Onboarding

If a user does not already have a Superior Trade API key, ask for the email address that should receive the key. Do not ask for wallet keys, seed phrases, private keys, passwords, or other secrets.

Request the key with:

```bash
curl -sS https://api.superior.trade/auth/sign-in/magic-link \
  -X POST \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com"}'
```

The API sends the key directly to the user's inbox. Tell the user to retrieve the key from their email and configure it in their normal credential store or environment, usually as `SUPERIOR_TRADE_API_KEY`.

Do not paste the received key into chat, source files, logs, or examples. If the user provides a key in chat, treat it as a secret and avoid repeating it.

## Authenticated Requests

Use the key in the `x-api-key` header:

```bash
curl -sS https://api.superior.trade/v2/account \
  -H "x-api-key: $SUPERIOR_TRADE_API_KEY"
```

The email is verified once the API key is used successfully in an authenticated request such as the status check above. If the first authenticated request fails with `401` or `403`, ask the user to confirm they copied the full key from the latest email and that the credential is being passed as the `x-api-key` header.

## Operating Rules

- Prefer `SUPERIOR_TRADE_API_KEY` from the environment or credential manager when it is available.
- Use `https://api.superior.trade` as the production API base URL.
- Use `Content-Type: application/json` for JSON request bodies.
- Never fabricate authentication status. Verify by making a real API call when credentials are available.
- Never request or handle private keys, seed phrases, or wallet credentials.
- Never start live trading, deposits, or other fund-moving actions without the explicit confirmations required by the relevant Superior Trade trading skill.

## Related Skills

- Use the v2 `skills/v2/exchanges/hyperliquid` skill for Hyperliquid strategy backtests, deployments, wallets, funding, and live trading workflows.
- Use the v2 `skills/v2/exchanges/aerodrome` skill for Aerodrome/Base spot-AMM strategy workflows.
- Use the v3 `skills/v3/exchanges/polymarket` skill for Polymarket market discovery, backtests, deployments, and funding workflows.
- Use the v3 `skills/v3/exchanges/lighter` skill for Lighter account bootstrap, direct CCTP deposits, fast withdrawals, and Nautilus deployments.
- Use the v3 `skills/v3/primitives/deposit-qr` skill when a user needs a QR code or payment URI to fund a Superior-managed wallet on a specific EVM chain.
