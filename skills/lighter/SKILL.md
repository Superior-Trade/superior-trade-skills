---
name: lighter
description: "Use when onboarding, funding, trading, or withdrawing on Lighter through Superior Trade — account bootstrap, CCTP deposits from a Superior wallet, immediate orders, withdrawals, proxying signed Lighter transactions, or deploying and monitoring a Lighter Nautilus strategy."
metadata:
  version: 1.0.2
  updated: 2026-07-22
  homepage: https://account.superior.trade
  source: https://github.com/Superior-Trade
  primaryEnv: SUPERIOR_TRADE_API_KEY
  auth:
    type: api_key
    env: SUPERIOR_TRADE_API_KEY
    header: x-api-key
    scope: "Read-write the user's own Lighter account readiness, funding operations, immediate market orders, withdrawals, signed transaction proxy submissions, and live Nautilus deployments. Can create CCTP deposit intents, fund them from a confirmed Superior wallet, place one confirmed Lighter market order with stored credentials, securely return Lighter USDC to the Superior owner wallet, submit user-approved pre-signed Lighter transactions, and start live Lighter deployments that execute real trades. Cannot export private keys, withdraw directly to arbitrary external wallets, or access other users' data."
  env:
    - name: SUPERIOR_TRADE_API_KEY
      description: "Superior Trade API key (x-api-key header). Obtained at https://account.superior.trade. Can onboard Lighter accounts, create deposit intents, place immediate Lighter market orders, submit withdrawals, proxy signed Lighter transactions, and manage Lighter Nautilus deployments for the user's owned Superior trading wallets."
      required: true
      type: api_key
  externalEndpoints:
    - url: https://api.superior.trade
      purpose: "All Lighter account, funding, withdrawal, and deployment operations"
    - url: https://mainnet.zklighter.elliot.ai
      purpose: "Read-only public Lighter checks are performed by the Superior Trade API; agents should not send secrets directly to Lighter."
---

# Superior Trade Lighter

Use this skill for Lighter account onboarding, Superior-wallet CCTP funding, immediate market orders, signed transaction proxy submission, secure returns to the Superior wallet, and v3 Nautilus deployments on Superior Trade.

**Base URL:** `https://api.superior.trade`
**Auth:** `x-api-key: $SUPERIOR_TRADE_API_KEY`
**Venue config:** `{ "venue": "lighter", "instrument_id": "<SYMBOL>.LIGHTER" }`

## Robinhood Chain Variant

Use the separate `lighter-robinhood` skill and exchange name for Robinhood Chain Lighter. Do not treat `lighter-robinhood` as an alias for this default `lighter` profile; it uses a different API base, chain id, deposit asset, and instrument suffix.

## Safety Rules

- Never ask for private keys, seed phrases, API private keys, passwords, or wallet credentials.
- Never log, echo, store, or display secrets. The only credential an agent should use is `SUPERIOR_TRADE_API_KEY`.
- Never move funds or start live trading without explicit user confirmation.
- Never submit a Lighter order or `sendTx` proxy payload without explicit user confirmation of market, side, size, order type, and risk.
- Treat Lighter deposits and withdrawals as real fund-moving actions.
- Treat signed `sendTx` payloads as real trading actions. The proxy forwards the signed transaction; it does not simulate or validate the trading intent.
- Do not retry an ambiguous withdrawal automatically. Poll the withdrawal status endpoint and report the persisted state.
- Use the user's Superior-managed owner wallet as both the Lighter owner and deposit payer. External funds must enter that wallet before funding Lighter.
- Do not claim Lighter readiness or balance without querying the API.

## Account Model

Lighter does not reuse the Hyperliquid funding flow.

```text
Deposit:
External wallet -> Superior-managed wallet -> Lighter CCTP intent -> Lighter

Ownership and signing:
Superior-managed Privy wallet -> Lighter L1 owner -> Lighter API key index 4

Withdrawal:
Lighter -> secure withdrawal -> Superior-managed owner wallet
```

The Lighter account index is created only after the first credited deposit. Readiness can move through:

```text
needs_deposit -> deposit_pending -> account_created
              -> api_key_approving -> ready
                                    -> key_provisioning_unknown
```

Proceed with live deployment only when the account status is `ready`.
## Reference files

Load on demand.

| Read | When |
| --- | --- |
| `references/api.md` | You need the exact shape for onboarding, status, balance, an immediate order, a CCTP deposit, a withdrawal, or the signed-transaction proxy. |
| `references/deployment.md` | You are creating, starting, stopping or monitoring a Lighter Nautilus deployment. |


## Related Skills

- Use `superior-trade-auth` first when the user needs an API key.
- Use `trade-thesis` before deploying a new live strategy idea.
- Use `hyperliquid` for Hyperliquid Freqtrade deployments. Lighter uses v3 Nautilus deployment APIs instead.
