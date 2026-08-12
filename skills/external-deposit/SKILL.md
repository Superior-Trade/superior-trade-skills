---
name: external-deposit
description: Use when a user wants to fund or bridge from an external wallet through a third-party UI such as Relay, especially when asking for MetaMask Mobile QR codes, bridge links, prefilled deposit URLs, Robinhood Chain USDG, or avoiding high-fee transaction QR mistakes.
---

# External Deposit

Use this skill for deposits that should be completed in an external wallet or third-party bridge UI rather than by exporting Superior-managed keys or encoding arbitrary transaction calldata into a QR code.

## When to Use

- The user wants to bridge or deposit from their own wallet into a destination chain/token.
- The user asks for a MetaMask Mobile QR code, Relay bridge link, Robinhood Chain USDG, or a prefilled bridge URL.
- The user needs Polygon USDC, USDC.e, or pUSD payment links.
- A QR transaction attempt shows unexpectedly high gas or wrong-network behavior.
- The flow is not a simple native/ERC-20 transfer to a known Superior-managed wallet.

Use `skills/deposit-qr` only for simple wallet funding QRs: native token sends or ERC-20 `transfer` payment URIs to a destination address.

## Safety Rules

- Never ask for private keys, seed phrases, passwords, or wallet credentials.
- Do not encode arbitrary contract calldata such as `approve(...)` or bridge deposit calls into MetaMask Mobile QR/deeplinks. MetaMask Mobile supports native sends and token transfers better than arbitrary transaction calldata; forcing calldata can show wrong or high fees.
- If source chain and destination chain are the same and the token contract is the same, use a direct ERC-20 `transfer` payment URI instead of Relay.
- Prefer a provider UI prefill URL or WalletConnect when the user uses MetaMask Mobile.
- Always show the source chain, source token contract, destination chain, destination token contract, recipient, quote amount, and expected gas before the user signs.
- If MetaMask shows a high fee when the quote gas is tiny, tell the user to reject the transaction.
- Do not claim funds arrived. Verify with the bridge status URL, explorer, wallet balance, or Superior Trade API.

## Same-Chain ERC-20 Transfer

When the source chain, destination chain, and token contract are identical, do not use Relay. Generate an EIP-681 ERC-20 transfer URI:

```text
ethereum:<token-address>@<chain-id>/transfer?address=<recipient>&uint256=<amount-base-units>
```

The bundled script automatically switches to this mode when `--from-chain`, `--to-chain`, `--from-token`, and `--to-token` resolve to the same chain/token and `--recipient` plus `--to-amount` are provided. In this mode:

- `mode` is `direct_erc20_transfer`.
- `payment_uri` contains the transfer URI.
- `relay_url` and `quote` are `null`.
- Every wallet link points to the payment URI.

Supported built-in chains and tokens:

| Chain | Tokens |
|---|---|
| `ethereum` | `USDC` |
| `arbitrum` | `USDC` |
| `base` | `USDC` |
| `avalanche` | `USDC` |
| `polygon` | `USDC`, `USDC.e`, `pUSD` |
| `robinhood` | `USDG` |

Custom ERC-20 token addresses are also accepted and default to 18 decimals.

## Relay Bridge Prefill

Relay supports bridge URLs shaped like:

```text
https://relay.link/bridge/<destination-chain>?toCurrency=<destination-token>&fromChainId=<source-chain-id>&fromCurrency=<source-token>&toAddress=<recipient>&amount=<target-amount>&tradeType=EXPECTED_OUTPUT
```

Use `toAddress`, `amount`, and `tradeType=EXPECTED_OUTPUT` when a recipient and target output amount are known. Relay's web app uses `EXPECTED_OUTPUT` to prefill the Buy field; keep using the quote API with `EXACT_OUTPUT` when you need a live exact-output quote.

For MetaMask Mobile, wrap the Relay URL:

```text
https://link.metamask.io/dapp/<url-encoded-relay-url>
```

Supported wallet link targets:

| Wallet target | Link format |
|---|---|
| `metamask` | `https://link.metamask.io/dapp/<encoded-url>` |
| `trust` | `https://link.trustwallet.com/open_url?coin_id=60&url=<encoded-url>` |
| `okx` | `okx://wallet/dapp/url?dappUrl=<encoded-url>` |
| `plain` | raw Relay URL |

Always include `plain` as a fallback when a wallet-specific link fails to open.

Example: Arbitrum USDC to Robinhood Chain USDG:

```text
https://relay.link/bridge/robinhood?toCurrency=0x5fc5360d0400a0fd4f2af552add042d716f1d168&fromChainId=42161&fromCurrency=0xaf88d065e77c8cc2239327c5edb3a432268e5831&toAddress=0xF60CA00ef5e510137bC09691b52BA7863F52158F&amount=20&tradeType=EXPECTED_OUTPUT
```

This opens Relay with the route prefilled. The user still reviews the live quote and signs normal wallet prompts inside Relay.

## QR Generator

Use the bundled script:

```bash
node skills/external-deposit/scripts/create-relay-bridge-qr.mjs \
  --from-chain arbitrum \
  --from-token USDC \
  --to-chain robinhood \
  --to-token USDG \
  --wallet metamask \
  --wallet trust \
  --wallet okx \
  --wallet plain \
  --recipient 0xF60CA00ef5e510137bC09691b52BA7863F52158F \
  --to-amount 20 \
  --quote
```

It prints JSON with:

- `mode` — `direct_erc20_transfer` for same-chain token sends, otherwise `relay_bridge`.
- `relay_url` — prefilled Relay bridge URL.
- `payment_uri` — EIP-681 ERC-20 transfer URI for same-chain direct transfers.
- `wallet_links` — wallet-specific dapp URLs and QR URLs for requested targets.
- `metamask_mobile_url` — backward-compatible alias for the MetaMask link when requested.
- `qr_url` — hosted QR image URL for the default wallet link.
- `quote` — live Relay quote summary when `--quote` is provided.
- `summary` — route, token contracts, recipient, and amount.

If no `--wallet` flags are provided, the script emits `metamask` and `plain`.

Display the QR in Markdown when the client supports images:

```markdown
![Relay Deposit QR](https://quickchart.io/qr?size=360&text=...)
```

## Example Response

```text
Relay Deposit Summary:
* From: Arbitrum USDC
* Source token: 0xaf88d065e77c8cc2239327c5edb3a432268e5831
* To: Robinhood Chain USDG
* Destination token: 0x5fc5360d0400a0fd4f2af552add042d716f1d168
* Recipient: 0xF60CA00ef5e510137bC09691b52BA7863F52158F
* Quote: pay 20.14 USDC, receive 20 USDG
* Expected gas: tiny Arbitrum ETH gas

Scan this QR with your phone camera to open Relay inside MetaMask Mobile.
Reject the transaction if MetaMask shows the wrong chain or a high network fee.
```

## Common Mistakes

- Generating a QR for Relay `approve` or deposit calldata and expecting MetaMask Mobile to show a safe transaction popup.
- Using a plain address QR for a bridge route; it omits source chain, destination chain, token mapping, and quote.
- Treating a Relay quote as permanent. Quotes are time-sensitive; refresh immediately before signing.
- Assuming the Relay UI prefilled every field. The agent must tell the user which values to confirm in Relay before signing.
