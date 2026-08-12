# Lighter API Reference

Account onboarding and status, balance, immediate market orders, CCTP deposits, withdrawals to the Superior wallet, and the signed-transaction proxy.

Reference for the `lighter` skill. See SKILL.md for the workflow and safety rules.

---

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

## CCTP Deposit

### POST `/v3/portfolio/lighter/deposit`

Creates a Lighter intent and moves the exact amount from the authenticated Superior-managed wallet into Lighter. Fund the Superior wallet first when the user's USDC is external.

Supported source chains: `arbitrum`, `base`, `avalanche`.
Minimum amount: `5` USDC.
Required header: `Idempotency-Key` with a stable unique value for this deposit attempt.

Before calling this endpoint, show the user:

```text
Lighter Deposit Summary:
* Source chain: [arbitrum | base | avalanche]
* Asset: native USDC
* Amount: [amount] USDC
* Payer wallet: [Superior-managed owner wallet]
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
    "source_chain": "arbitrum",
    "amount": "5",
    "confirmed": true
  }'
```

The response includes the chain, native USDC contract, transfer destination, beneficiary owner, and operation id. The API signs server-side and never returns the key.

### GET `/v3/portfolio/lighter/deposit/{depositId}`

Poll deposit status and reconcile the persisted operation.

```bash
curl -sS "https://api.superior.trade/v3/portfolio/lighter/deposit/${DEPOSIT_ID}?owner_address=${OWNER_ADDRESS}" \
  -H "x-api-key: ${SUPERIOR_TRADE_API_KEY}"
```

Reconciliation is read-only and never submits funds.

## Secure Withdrawal To Superior Wallet

### POST `/v3/portfolio/lighter/withdraw`

Returns Lighter USDC to the Superior-managed L1 owner wallet. This is the canonical treasury route; direct external withdrawal is intentionally not exposed here.

Minimum amount: `1` USDC.
Required header: `Idempotency-Key` with a stable unique value for this withdrawal attempt.

Before calling this endpoint, show the user:

```text
Lighter Withdrawal Summary:
* Asset: USDC
* Amount: [amount] USDC
* Lighter owner: [owner_address]
* Destination: [owner_address] Superior wallet

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
    "amount": "3",
    "confirmed": true
  }'
```

The API returns `202` when the withdrawal is submitted, replayed, or recorded as `unknown` for reconciliation. If the response or status is `unknown`, do not resubmit with a new idempotency key. Poll the withdrawal id.

### GET `/v3/portfolio/lighter/withdraw/{withdrawalId}`

```bash
curl -sS "https://api.superior.trade/v3/portfolio/lighter/withdraw/${WITHDRAWAL_ID}?owner_address=${OWNER_ADDRESS}" \
  -H "x-api-key: ${SUPERIOR_TRADE_API_KEY}"
```

Use this to reconcile withdrawal state. Reconciliation never resubmits the Lighter withdrawal. When Lighter marks the secure withdrawal claimable, polling may submit one deterministic Privy-sponsored claim and completes only after provider evidence plus the exact Superior-wallet balance delta.

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

