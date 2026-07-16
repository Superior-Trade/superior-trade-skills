---
name: lighter
version: 1.0.0
updated: 2026-07-14
description: "Onboard, fund, place immediate orders, withdraw, proxy signed Lighter transactions, and deploy Lighter Nautilus strategies through Superior Trade."
homepage: https://account.superior.trade
source: https://github.com/Superior-Trade
primaryEnv: SUPERIOR_TRADE_API_KEY
auth:
  type: api_key
  env: SUPERIOR_TRADE_API_KEY
  header: x-api-key
  scope: "Read-write the user's own Lighter account readiness, funding operations, immediate market orders, withdrawals, signed transaction proxy submissions, and live Nautilus deployments. Can create direct CCTP deposit intents, place one confirmed Lighter market order with stored credentials, fast-withdraw Lighter USDC to user-confirmed EVM addresses, submit user-approved pre-signed Lighter transactions, and start live Lighter deployments that execute real trades. Cannot export private keys or access other users' data."
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

Use this skill for Lighter account onboarding, direct CCTP funding, immediate market orders, signed transaction proxy submission, fast withdrawals, and v3 Nautilus deployments on Superior Trade.

**Base URL:** `https://api.superior.trade`
**Auth:** `x-api-key: $SUPERIOR_TRADE_API_KEY`
**Venue config:** `{ "venue": "lighter", "instrument_id": "<SYMBOL>.LIGHTER" }`

## Safety Rules

- Never ask for private keys, seed phrases, API private keys, passwords, or wallet credentials.
- Never log, echo, store, or display secrets. The only credential an agent should use is `SUPERIOR_TRADE_API_KEY`.
- Never move funds or start live trading without explicit user confirmation.
- Never submit a Lighter order or `sendTx` proxy payload without explicit user confirmation of market, side, size, order type, and risk.
- Treat Lighter deposits and withdrawals as real fund-moving actions.
- Treat signed `sendTx` payloads as real trading actions. The proxy forwards the signed transaction; it does not simulate or validate the trading intent.
- Do not retry an ambiguous withdrawal automatically. Poll the withdrawal status endpoint and report the persisted state.
- Use the user's Superior-managed owner wallet as `owner_address`. An external deposit wallet is only the payer; it does not become the Lighter owner.
- Do not claim Lighter readiness or balance without querying the API.

## Account Model

Lighter does not reuse the Hyperliquid funding flow.

```text
Deposit:
External wallet -> native USDC transfer to Lighter CCTP intent -> Lighter

Ownership and signing:
Superior-managed Privy wallet -> Lighter L1 owner -> Lighter API key index 4

Withdrawal:
Lighter -> fast withdrawal -> external EVM wallet
```

The Lighter account index is created only after the first credited deposit. Readiness can move through:

```text
needs_deposit -> deposit_pending -> account_created
              -> api_key_approving -> ready
                                    -> key_provisioning_unknown
```

Proceed with live deployment only when the account status is `ready`.

## Account Onboarding

### POST `/v3/account/{address}/lighter`

Onboard or repair a Lighter account for an owned Superior-managed wallet. After the first credited deposit, this endpoint records the Lighter account index and approves Superior-managed Lighter API key index `4` when needed.

```bash
curl -sS -X POST "https://api.superior.trade/v3/account/${OWNER_ADDRESS}/lighter" \
  -H "x-api-key: ${SUPERIOR_TRADE_API_KEY}" \
  -H "content-type: application/json"
```

Use this after the first deposit is credited, or when status shows `account_ready: true` and `api_key_ready: false`.

Response fields:

- `account_ready`: Lighter account exists and collateral can be read.
- `api_key_ready`: Superior-managed Lighter API key is approved and stored.
- `ready`: both `account_ready` and `api_key_ready`.
- `api_key_approval_tx_hash`: Lighter transaction hash for approving API key index `4`.

If the response status is `api_key_approving`, poll `GET /v3/account/{address}/status/lighter` until `ready: true` or manual review is required.

### GET `/v3/account/{address}/status/lighter`

Check account and API-key readiness before deposits, signed proxy submissions, withdrawals, or live deployment.

```bash
curl -sS "https://api.superior.trade/v3/account/${OWNER_ADDRESS}/status/lighter" \
  -H "x-api-key: ${SUPERIOR_TRADE_API_KEY}"
```

Expected statuses include `needs_deposit`, `deposit_pending`, `account_created`, `api_key_approving`, `key_provisioning_unknown`, and `ready`.

If the status is `key_provisioning_unknown`, stop and report that manual review is required. Do not rotate keys or retry blindly.

If `account_ready: true` and `api_key_ready: false`, call `POST /v3/account/{address}/lighter` only after the user confirms they want to onboard the account for trading/API-key use.

## Balance

### GET `/v3/portfolio/lighter/balance`

```bash
curl -sS "https://api.superior.trade/v3/portfolio/lighter/balance?owner_address=${OWNER_ADDRESS}" \
  -H "x-api-key: ${SUPERIOR_TRADE_API_KEY}"
```

Returns the Lighter account balance associated with `owner_address`. Before the first credited deposit, the API can return zero balance with `needs_deposit`.

## Immediate Market Order

### POST `/v3/authorize-and-send/lighter`

Use `placeOrder` when the user asks for one immediate Lighter market order, such as "buy $10 ETH". The Superior API resolves the user's owned wallet, loads the stored Lighter API key, signs the Lighter order server-side, and submits it to Lighter. Agents only send `SUPERIOR_TRADE_API_KEY`; never ask for or handle Lighter API private keys.

Before calling this endpoint, verify:

1. `GET /v3/account/{address}/status/lighter` reports `ready`.
2. `GET /v3/portfolio/lighter/balance?owner_address=...` shows enough collateral.
3. The market minimum quote/base amount can support the requested size.
4. The user explicitly confirms the live order.

Show this confirmation before submitting:

```text
Lighter Order Summary:
* Market: [symbol / market_id]
* Side: [buy | sell]
* Quote amount: [amount] USDC
* Max slippage: [fraction, e.g. 0.005 = 0.5%]
* Owner wallet: [owner_address]

This will place a REAL market order on Lighter. Proceed? (yes/no)
```

Request:

```bash
curl -sS -X POST "https://api.superior.trade/v3/authorize-and-send/lighter" \
  -H "x-api-key: ${SUPERIOR_TRADE_API_KEY}" \
  -H "content-type: application/json" \
  -d '{
    "action": {
      "type": "placeOrder",
      "from": "0xSuperiorManagedWallet",
      "market_id": 0,
      "side": "buy",
      "quote_amount": "10",
      "max_slippage": "0.005",
      "reduce_only": false,
      "price_protection": true
    }
  }'
```

Notes:

- `market_id: 0` is ETH perp on Lighter mainnet. Query market metadata before using other ids.
- `quote_amount` is USDC notional, not base size.
- If Lighter returns a minimum-size or slippage error, do not retry blindly. Re-check market metadata and ask the user to confirm the adjusted order.
- The legacy `sendTx` action remains available only for already-signed Lighter payloads.

## Direct CCTP Deposit

### POST `/v3/portfolio/lighter/deposit`

Creates a Lighter intent address for an external wallet to fund directly with native USDC. Funds do not pass through a Superior balance.

Supported source chains: `arbitrum`, `base`, `avalanche`.
Minimum amount: `5` USDC.
Required header: `Idempotency-Key` with a stable unique value for this deposit attempt.

Before calling this endpoint, show the user:

```text
Lighter Deposit Summary:
* Source chain: [arbitrum | base | avalanche]
* Asset: native USDC
* Amount: [amount] USDC
* Payer wallet: [source_address or user's external wallet]
* Lighter owner: [owner_address]
* Destination: Lighter CCTP intent address returned by the API

This will move REAL USDC from the payer wallet to Lighter. Proceed? (yes/no)
```

Request:

```bash
curl -sS -X POST "https://api.superior.trade/v3/portfolio/lighter/deposit" \
  -H "x-api-key: ${SUPERIOR_TRADE_API_KEY}" \
  -H "content-type: application/json" \
  -H "Idempotency-Key: ${IDEMPOTENCY_KEY}" \
  -d '{
    "owner_address": "0xSuperiorManagedWallet",
    "source_address": "0xOptionalExternalPayer",
    "source_chain": "arbitrum",
    "amount": "5"
  }'
```

The response includes the chain, native USDC contract, transfer destination, beneficiary owner, and operation id. The user or browser wallet signs the USDC transfer; the API never exports the Superior-managed key for deposits.

### GET `/v3/portfolio/lighter/deposit/{depositId}`

Poll deposit status and reconcile the persisted operation.

```bash
curl -sS "https://api.superior.trade/v3/portfolio/lighter/deposit/${DEPOSIT_ID}?owner_address=${OWNER_ADDRESS}" \
  -H "x-api-key: ${SUPERIOR_TRADE_API_KEY}"
```

Reconciliation is read-only and never submits funds.

## Fast Withdrawal

### POST `/v3/portfolio/lighter/withdraw`

Withdraws Lighter USDC to an external EVM wallet. The API signs with the Superior-managed owner and its encrypted Lighter API key.

Minimum amount: `4` USDC.
Required header: `Idempotency-Key` with a stable unique value for this withdrawal attempt.

Before calling this endpoint, show the user:

```text
Lighter Withdrawal Summary:
* Asset: USDC
* Amount: [amount] USDC
* Lighter owner: [owner_address]
* Destination: [to_address]

This will move REAL USDC out of Lighter. Ambiguous submissions are recorded as unknown and must be reconciled by polling status. Proceed? (yes/no)
```

Request:

```bash
curl -sS -X POST "https://api.superior.trade/v3/portfolio/lighter/withdraw" \
  -H "x-api-key: ${SUPERIOR_TRADE_API_KEY}" \
  -H "content-type: application/json" \
  -H "Idempotency-Key: ${IDEMPOTENCY_KEY}" \
  -d '{
    "owner_address": "0xSuperiorManagedWallet",
    "to_address": "0xExternalDestination",
    "amount": "4"
  }'
```

The API returns `202` when the withdrawal is submitted, replayed, or recorded as `unknown` for reconciliation. If the response or status is `unknown`, do not resubmit with a new idempotency key. Poll the withdrawal id.

### GET `/v3/portfolio/lighter/withdraw/{withdrawalId}`

```bash
curl -sS "https://api.superior.trade/v3/portfolio/lighter/withdraw/${WITHDRAWAL_ID}?owner_address=${OWNER_ADDRESS}" \
  -H "x-api-key: ${SUPERIOR_TRADE_API_KEY}"
```

Use this to reconcile withdrawal state. Reconciliation never resubmits a withdrawal.

## Signed Transaction Proxy

### POST `/v3/authorize-and-send/lighter`

Submits one pre-signed Lighter transaction payload through Superior Trade's Lighter proxy. This is the next step for placing an order when another component has already produced a signed Lighter `tx_type` and `tx_info`.

The proxy:

- verifies the optional `from` wallet is owned by the authenticated user;
- accepts only `action.type: "sendTx"`;
- forwards `tx_type`, `tx_info`, and `price_protection` to Lighter `/api/v1/sendTx`;
- does not build, sign, decode, simulate, or explain the order payload.

Before submitting an order payload, show the user:

```text
Lighter Order Proxy Summary:
* Owner wallet: [from or default Superior-managed wallet]
* Market: [market/instrument from the order builder]
* Side: [buy/sell or long/short]
* Size: [quantity/notional]
* Order type: [market/limit/etc.]
* Price / limit: [price or N/A]
* Price protection: [true/false]

This will submit a REAL signed Lighter transaction. Proceed? (yes/no)
```

Request:

```bash
curl -sS -X POST "https://api.superior.trade/v3/authorize-and-send/lighter" \
  -H "x-api-key: ${SUPERIOR_TRADE_API_KEY}" \
  -H "content-type: application/json" \
  -d '{
    "action": {
      "type": "sendTx",
      "from": "0xOptionalSuperiorManagedWallet",
      "tx_type": 14,
      "tx_info": "{\"AccountIndex\":123,\"MarketIndex\":0}",
      "price_protection": true
    }
  }'
```

Rules:

- Do not invent `tx_type` or `tx_info`. They must come from a trusted Lighter order builder/signer.
- Keep `price_protection` enabled unless the user explicitly asks to disable it and understands the risk.
- If the proxy returns `lighter_error`, do not resubmit blindly. Report the error and inspect whether the signed payload, market, price, or account readiness is invalid.
- Before placing an order, `GET /v3/account/{address}/status/lighter` should report `ready: true`.

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

## Related Skills

- Use `superior-trade-auth` first when the user needs an API key.
- Use `trade-thesis` before deploying a new live strategy idea.
- Use `hyperliquid` for Hyperliquid Freqtrade deployments. Lighter uses v3 Nautilus deployment APIs instead.
