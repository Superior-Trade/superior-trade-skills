---
name: deposit-qr
description: Use when a user needs a QR code or wallet payment URI to fund a Superior-managed EVM wallet on a specific chain before using Lighter, Polymarket, Hyperliquid, or other Superior Trade workflows.
---

# Deposit QR

Use this skill to create a wallet-scannable QR code for sending a coin or ERC-20 token to a Superior-managed EVM wallet address on a named chain.

This is for funding the wallet itself. It is not the same as a venue-specific
deposit intent. Use `GET /wallet` for the managed destination and deposit
details currently exposed by Unified API.

For external bridge/provider flows such as Relay, Robinhood Chain USDG, MetaMask Mobile bridge links, or prefilled third-party deposit URLs, use `skills/external-deposit` instead. Do not use this primitive to encode arbitrary bridge calldata, approvals, or contract deposit calls into transaction QRs.

## Required Inputs

Ask for or verify all four fields:

- Destination wallet address, for example `0x1111111111111111111111111111111111111111`
- Chain, for example `arbitrum`, `base`, `avalanche`, `polygon`, or `ethereum`
- Asset, for example `USDC`, `USDC.e`, `ETH`, `AVAX`, `MATIC`, or a token contract address
- Amount

Never guess the chain. The same address can exist on many EVM chains, and sending a token on the wrong chain can strand funds.

## Safety Rules

- Do not request private keys, seed phrases, passwords, or exchange credentials.
- Show the destination address, chain, asset, token contract, and amount before presenting the QR code.
- Warn that the user must send the correct asset on the correct chain.
- For ERC-20 tokens, include the token contract address in the summary.
- For wallet compatibility, provide both the EIP-681 QR and a plain-address fallback QR.
- Do not claim a deposit arrived. Verify with the relevant chain explorer, wallet balance, or Superior Trade API after the user sends funds.
- Do not use MetaMask deeplinks or QR codes for arbitrary contract calldata. This skill only covers native-token and ERC-20 `transfer` payment URIs.

## QR Generator

Use the bundled script:

```bash
node skills/deposit-qr/scripts/create-deposit-qr.mjs \
  --address 0x1111111111111111111111111111111111111111 \
  --chain arbitrum \
  --asset USDC \
  --amount 5
```

It prints JSON with:

- `payment_uri` — EIP-681 URI for the requested token transfer
- `qr_url` — hosted QR image URL for the payment URI
- `plain_address_qr_url` — fallback QR image URL containing only the destination address
- `summary` — human-readable chain, asset, token, amount, and destination

Display the QR in Markdown when the client supports images:

```markdown
![Deposit QR](https://quickchart.io/qr?size=360&text=...)
```

## Example: Fund a Superior Wallet with Arbitrum USDC

```bash
node skills/deposit-qr/scripts/create-deposit-qr.mjs \
  --address 0x1111111111111111111111111111111111111111 \
  --chain arbitrum \
  --asset USDC \
  --amount 5
```

Tell the user:

```text
Deposit QR Summary:
* Destination: 0x1111111111111111111111111111111111111111
* Chain: Arbitrum One
* Asset: native USDC
* Token contract: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831
* Amount: 5 USDC

Scan the QR with a wallet that supports Arbitrum token-transfer URIs. If the wallet does not prefill the token transfer correctly, use the plain address fallback and manually select Arbitrum native USDC.
```

## Common Mistakes

- Using this QR as the Lighter intent address. The destination here is the Superior wallet, not the Lighter deposit intent.
- Omitting the chain. A plain address QR alone does not specify Arbitrum vs Base vs Avalanche.
- Using Ethereum mainnet USDC when the workflow needs Arbitrum/Base/Avalanche USDC.
- Assuming every wallet supports ERC-20 EIP-681 transfer URIs. Always provide the plain-address fallback.
- Using this primitive for Relay or other bridge UIs. Use `skills/external-deposit` for prefilled bridge links and quote-backed external wallet flows.

## Next Step for Lighter

After sending funds, use Unified API to inspect the managed wallet and deposit
history:

```text
GET /wallet
GET /wallet/deposits
```

If the current OpenAPI contract does not expose a Lighter CCTP intent action,
report that venue-funding step as unavailable.
