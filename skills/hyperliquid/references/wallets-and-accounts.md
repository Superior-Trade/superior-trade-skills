# Wallets, Funding, and Markets

Wallet architecture, balance checks, sub-accounts, multi-strategy capacity, pair formats, and HIP-3 assets.

Reference for the `hyperliquid` skill. See SKILL.md for the workflow and safety rules.

---

## Platform Model

### Wallet Architecture (CRITICAL)

Superior Trade uses Hyperliquid's native **agent wallet** pattern. Users do NOT need their own Hyperliquid wallet — everything is managed by the platform. If a user asks "how do I link my Hyperliquid account," the answer is: **they don't need one** — create or select a Superior trading account wallet with `GET /v3/account` / `POST /v3/account`, then bootstrap Hyperliquid setup with `POST /v3/account/{address}/hyperliquid`.

1. **Main wallet** — a platform-managed trading account wallet. Users fund this address with native USDC on Arbitrum One, then deposit that USDC into Hyperliquid using the API when needed. The address is shown at https://account.superior.trade and returned by `GET /v3/account`.
2. **Agent wallet** — a platform-managed signing key authorized via Hyperliquid's `approveAgent`. Signs trades against the main wallet's balance.

**Key facts:**

- The agent wallet does NOT need its own funds — $0 balance is normal and expected
- Each trading account has its own agent wallet. Deployments can auto-resolve an idle trading account, or target one explicitly.
- The credentials endpoint returns `wallet_type: "agent_wallet"` for auto-resolved wallets
- Always check the **main wallet's** balance, not the agent wallet's
- `POST /v3/account/{address}/hyperliquid` can configure the Hyperliquid referral, approve Superior's builder fee, create/approve the agent wallet, and persist the agent wallet metadata
- The API can deposit native Arbitrum USDC from the user's platform-managed wallet into Hyperliquid via `POST /v2/portfolio/hyperliquid/deposit`
- The API can return Hyperliquid USDC to the server-resolved Superior wallet via `POST /v3/portfolio/hyperliquid/withdraw`
- The API cannot bridge unsupported assets/chains or withdraw without explicit user confirmation
- **NEVER tell users to deposit to the agent wallet address**

### Funding, Deposits, and Balance Checks

Funding is a two-stage flow:

1. The user funds their platform-managed trading wallet with native USDC on Arbitrum One using their own capital. The wallet address is shown at https://account.superior.trade.
2. The agent can call `POST /v2/portfolio/hyperliquid/deposit` to transfer native Arbitrum USDC from that platform wallet to Hyperliquid Bridge2.
3. After the deposit confirms, the agent wallet signs trades against the main wallet's Hyperliquid balance.

Before calling the deposit endpoint, tell the user that this sends real USDC from their platform wallet into Hyperliquid and ask for explicit confirmation. If the platform wallet does not have enough Arbitrum USDC, tell the user they need to add more of their own capital to the platform account before the agent can deposit or trade.

**Supported deposit only:** native USDC on Arbitrum One to Hyperliquid. Do not suggest the deposit endpoint for Ethereum mainnet USDC, bridged USDC variants, Base, Optimism, other assets, external user wallets, or withdrawals. Use the dedicated withdrawal endpoint for Hyperliquid USDC withdrawals.

Always check the **main wallet** (platform-managed trading wallet), NOT the agent wallet.

**Balance query for master account (single deployment):**

```
POST https://api.hyperliquid.xyz/info
{"type":"clearinghouseState","user":"<MAIN_WALLET_ADDRESS>"}
{"type":"spotClearinghouseState","user":"<MAIN_WALLET_ADDRESS>"}
```

**Balance query for master account (multi-strategy with sub-accounts):**

When the master account has sub-accounts, its total balance is the sum of its own perp + spot balances PLUS all sub-account balances. Query both:

```
POST https://api.hyperliquid.xyz/info
{"type":"subAccounts2","user":"<MAIN_WALLET_ADDRESS>"}
```

Sub-account balances are included in the master account's total — funds allocated to sub-accounts are not available for master deployments. Always query `subAccounts2` first when the user has sub-accounts, then sum across all sub-account `spotState.balances` and `dexToClearinghouseState` entries to get the true total balance.

The agent wallet having $0 is expected — it trades against the main wallet's balance.

### Multi-Strategy Trading

Each strategy runs on its own wallet (one active deployment per wallet). To run multiple strategies concurrently there are two mechanisms — prefer the first:

**1. Multiple trading accounts (primary).** A user can hold several trading accounts (Free: up to 3, Pro: up to 6), each its own Hyperliquid master with its own agent wallet. To start an additional concurrent strategy, create the deployment and call `POST /v2/deployment/{id}/credentials` **omitting `wallet_address`** — the server auto-assigns the next **idle** trading account. Pass an explicit `wallet_address` to target a specific account. Errors: `all_accounts_in_use` (400) when every trading account is already running a strategy.

**2. Hyperliquid sub-accounts (overflow, HL-only).** When all trading accounts are busy, a master with **≥ $100,000 USD in lifetime trading volume** on Hyperliquid can create sub-accounts to run further strategies, each with its own isolated balance and positions.

**Key facts:**

- Sub-accounts inherit the master account's collateral (USDC, USDE, USDT0, USDH)
- Each sub-account can have its own deployment with isolated margin/positions
- Maximum 10 sub-accounts per master account
- Sub-accounts use **unified account mode** — spot and perps share a single balance

**Sub-account query** (read-only):

```
POST https://api.hyperliquid.xyz/info
{"type":"subAccounts2","user":"<MAIN_WALLET_ADDRESS>"}
```

Returns each sub-account's name, address, `abstraction` mode ("unifiedAccount" or legacy), spot balances, and perps state (`dexToClearinghouseState`). Always verify the sub-account has `abstraction: "unifiedAccount"` — legacy sub-accounts cannot be used with unified margin strategies.

**Balance composition for a sub-account:**

- **Perps account value:** from `dexToClearinghouseState[0][1].marginSummary.accountValue`
- **Perps withdrawable:** from `dexToClearinghouseState[0][1].withdrawable`
- **Spot USDC:** from `spotState.balances` where `coin === "USDC"`

The sub-account's total balance = perps account value + spot USDC (in unified mode these merge).

### Hyperliquid Authorize-and-Send API

`POST https://api.superior.trade/v2/authorize-and-send/hyperliquid`

A unified endpoint for Hyperliquid operations. All requests use `{"type": "...", ...}` body. Requires `x-api-key` header.

**Supported operation types:**

| Operation | Description |
| --------- | ----------- |
| `createSubAccount` | Create a new sub-account |
| `subAccountTransfer` | Transfer between main and sub-account |
| `sendAsset` | Move assets (main→sub, sub→main, or sub→sub) |
| `userSetAbstraction` | Set account mode (unified/legacy) |
| `subAccountModify` | Modify sub-account settings |

**Create sub-account:**
```json
{"type":"createSubAccount","user":"<MAIN_WALLET_ADDRESS>","name":"My Strategy"}
```

**Sub-account transfer (main → sub):**
```json
{"type":"subAccountTransfer","from":"<MAIN_WALLET_ADDRESS>","to":"<SUB_ACCOUNT_ADDRESS>","token":"USDC","amount":1000}
```

**Sub-account transfer (sub → main):**
```json
{"type":"subAccountTransfer","from":"<SUB_ACCOUNT_ADDRESS>","to":"<MAIN_WALLET_ADDRESS>","token":"USDC","amount":500}
```

**Transfer via sendAsset (main → sub):**
```json
{"type":"sendAsset","destination":"<SUB_ACCOUNT_ADDRESS>","sourceDex":"spot","destinationDex":"spot","token":"USDC","amount":1000}
```

**Transfer via sendAsset (sub → main):**
```json
{"type":"sendAsset","fromSubAccount":"<SUB_ACCOUNT_ADDRESS>","destination":"<MASTER_WALLET_ADDRESS>","sourceDex":"spot","destinationDex":"spot","token":"USDC","amount":500}
```

**Set unified account mode on a sub-account:**
```json
{"type":"userSetAbstraction","user":"<SUB_ACCOUNT_ADDRESS>","abstraction":"unifiedAccount"}
```

When creating a sub-account via the API, unified mode is set automatically after creation by calling `userSetAbstraction` with `abstraction: "unifiedAccount"`.

**Modify sub-account:**
```json
{"type":"subAccountModify","user":"<SUB_ACCOUNT_ADDRESS>","action":"disable"}
```

**Safety check before moving funds out of a trading account.** Any `sendAsset` / `subAccountTransfer` that pulls USDC OUT of a wallet (one trading account to another, or master to sub) lowers the source wallet's collateral. If that source wallet is running a live strategy, the withdrawal can raise liquidation risk on open positions or drop the balance below the strategy's reserved stake (`stake_amount × max_open_trades × buffer`). Before sending:

1. List the source wallet's live deployments — `GET /v2/deployment?status=running` — and check whether any has a `walletAddress` matching the source.
2. If one does, confirm with the user, and verify the **post-transfer** balance (current balance minus amount) still covers that strategy's reservation before transferring. If it would underfund the strategy, reduce the amount or move funds from an idle account instead.

### Hyperliquid Credentials

Credentials are managed automatically. To use a specific wallet, pass `wallet_address` — ownership is validated server-side.

## Exchange and Pair Rules

### Supported Exchanges

| Exchange    | Stake Currencies                       | Trading Modes |
| ----------- | -------------------------------------- | ------------- |
| Hyperliquid | USDC (also USDT0, USDH, USDE via HIP3) | spot, futures |

### Hyperliquid Notes

**Pair format by trading mode** (CCXT convention):

- **Spot**: `BTC/USDC`
- **Futures/Perp**: `BTC/USDC:USDC`

**Spot limitations:** No stoploss on exchange (bot handles internally), no market orders (simulated via limit with up to 5% slippage).

**Futures:** Margin modes `"cross"` and `"isolated"`. Stoploss on exchange via `stop-loss-limit` orders. No market orders (same simulation).

**Data availability:** Hyperliquid API provides ~5000 historic candles per pair. Superior Trade pre-downloads data; availability starts from ~November 2025.

**Hyperliquid is a DEX** — uses wallet-based signing, not API key/secret. Wallet credentials are managed automatically by the platform.

### HIP3 — Tokenized Real-World Assets

HIP3 assets (stocks, commodities, indices) are perpetual futures.

> **CRITICAL: HIP3 uses a HYPHEN, not a colon. This is the #1 format mistake.** Wrong: `XYZ:AAPL/USDC:USDC`. Correct: `XYZ-AAPL/USDC:USDC`.

**Pair format:** `PROTOCOL-TICKER/QUOTE:SETTLE` — the separator between protocol and ticker is always **`-`** (hyphen).

| Protocol | Dex name | Asset Types                               | Stake Currency | Examples                                   |
| -------- | -------- | ----------------------------------------- | -------------- | ------------------------------------------ |
| `XYZ-`   | `xyz`    | US/KR stocks, metals, currencies, indices | USDC           | `XYZ-AAPL/USDC:USDC`, `XYZ-GOLD/USDC:USDC` |
| `CASH-`  | `cash`   | Stocks, commodities                       | USDT0          | `CASH-GOLD/USDT0:USDT0`                    |
| `FLX-`   | `flx`    | Commodities, metals, crypto               | USDH           | `FLX-GOLD/USDH:USDH`                       |
| `KM-`    | `km`     | Stocks, indices, bonds                    | USDH           | `KM-GOOGL/USDH:USDH`                       |
| `HYNA-`  | `hyna`   | Leveraged crypto, metals                  | USDE           | `HYNA-SOL/USDE:USDE`                       |
| `VNTL-`  | `vntl`   | Sector indices, pre-IPO                   | USDH           | `VNTL-SPACEX/USDH:USDH`                    |

**XYZ tickers (USDC):** do not work from a hard-coded list — the universe grows. Query `{"type":"meta","dex":"xyz"}` and read `universe[].name`; that is the only authoritative set. As of 2026-08-12 it held 109 tickers, including AAPL, AMZN, AVGO, ASML, GOLD, IBM, META, MSFT, NVDA, QCOM, SILVER, SP500, TSLA and URANIUM. If a user names a ticker you do not recognise, check the live universe before telling them it is unavailable.

**Data:** XYZ from ~November 2025, KM/CASH/FLX from ~February 2026. Timeframes: 1m, 3m, 5m, 15m, 30m, 1h (also 2h, 4h, 8h, 12h, 1d, 3d, 1w for some). Funding rate data at 1h.

**Trading rules:** HIP3 assets are futures-only — always use `trading_mode: "futures"` and `margin_mode: "isolated"`. XYZ pairs use `stake_currency: "USDC"`. Stock-based assets may have reduced liquidity outside US market hours.

### Pair Discovery

- **Standard perps:** `{"type":"meta"}` — check `universe[].name`
- **HIP3 pairs:** `{"type":"meta", "dex":"xyz"}` (or `"cash"`, `"km"`, etc.) — HIP3 pairs are NOT in the default meta call
- **List all dexes:** `{"type":"perpDexs"}`
- **Name conversion:** API returns `xyz:AAPL` → CCXT format `XYZ-AAPL/USDC:USDC` (uppercase prefix, colon→hyphen)

### Unified vs Legacy Account Mode

Hyperliquid accounts may run in **unified mode** (single balance) or **legacy mode** (separate spot/perps balances). Do NOT assume which mode the user has.

- If perps shows $0 but spot shows funds, ask about unified mode before suggesting the user move funds themselves.
- In unified mode, spot USDC is automatically available as perps collateral.

