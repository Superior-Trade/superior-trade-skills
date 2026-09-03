---
name: superior-trade
description: "Use when a user wants to start trading with Superior Trade and does not have everything set up yet — getting an API key, creating and funding a trading account, choosing a venue or strategy, running a first backtest, or going live. Start here, then hand off to the venue skill. Covers Hyperliquid, Polymarket, Lighter, and Aerodrome."
license: see LICENSE
metadata:
  version: 1.0.0
  updated: 2026-08-12
  homepage: https://account.superior.trade
  source: https://github.com/Superior-Trade
  primaryEnv: SUPERIOR_TRADE_API_KEY
  auth:
    type: api_key
    env: SUPERIOR_TRADE_API_KEY
    header: x-api-key
    scope: "Read-write the user's own account, trading wallets, backtests, and deployments. Can start live deployments that trade real funds after explicit confirmation. Cannot export private keys or access other users' data."
  env:
    - name: SUPERIOR_TRADE_API_KEY
      required: true
      description: "Superior Trade API key, sent as the x-api-key header. Covers every venue."
      type: api_key
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

# Superior Trade — Start Here

Getting a user from nothing to a running strategy. This skill owns the path; each venue skill owns the venue.

**Primary API base URL:** `${SUPERIOR_UNIFIED_API_URL:-https://unified-api-zag4gzx6gq-an.a.run.app}`
**Auth:** `x-api-key` header on every protected endpoint
**Account UI:** `https://account.superior.trade`

Read [`../../references/unified-runtime.md`](../../references/unified-runtime.md)
before a backtest, deployment, execution, or venue setup. The Unified API is
the default. Legacy `/v2` and `/v3` routes are temporary, declared fallbacks
only when the Unified OpenAPI contract lacks the required operation.

## The path

Work through these in order. Skip a step only after an API call confirms it is already done — never on assumption.

- [ ] **1. Credentials** — is `SUPERIOR_TRADE_API_KEY` set?
- [ ] **2. Trading account** — does the user have a trading wallet?
- [ ] **3. Funds** — is there capital on the venue the strategy will trade?
- [ ] **4. Strategy** — what are they trying to do, and which template fits?
- [ ] **5. Backtest** — does the idea survive contact with historical data?
- [ ] **6. Deploy** — confirm explicitly, then start.
- [ ] **7. Monitor** — status and logs, and how to stop.

### 1. Credentials

One key covers every venue. `SUPERIOR_TRADE_API_KEY` authenticates Hyperliquid, Polymarket, Lighter and Aerodrome alike — the API validates the key against the user, not against a product, so there is no per-venue credential to obtain.

If it is already in the environment, use it and move on — do not ask the user for it.

If it is missing, ask for the email address that should receive a verification
OTP, then request it from the Unified API:

```bash
curl -sS "${SUPERIOR_UNIFIED_API_URL:-https://unified-api-zag4gzx6gq-an.a.run.app}/account/register" \
  -X POST -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com"}'
```

Ask for the OTP, exchange it with `POST /account/verify`, and tell the user to
store the returned key as `SUPERIOR_TRADE_API_KEY` in their agent's environment
or credential manager. Use the legacy magic-link endpoint only when Unified
registration is unavailable, and state that fallback explicitly. Users can also
create a key (`st_live_...`) from account settings at https://account.superior.trade.

```bash
curl -sS "${SUPERIOR_UNIFIED_API_URL:-https://unified-api-zag4gzx6gq-an.a.run.app}/account/verify" \
  -X POST -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","otp":"123456"}'
```

Verify it works before going further:

```bash
curl -sS "${SUPERIOR_UNIFIED_API_URL:-https://unified-api-zag4gzx6gq-an.a.run.app}/account" -H "x-api-key: $SUPERIOR_TRADE_API_KEY"
```

A `401`/`403` means the key is wrong or truncated — ask the user to re-copy the full key from the latest email. The email is verified by the first successful authenticated call, so this doubles as activation.

Never paste the key into chat, files, logs, or examples. If a user pastes theirs, treat it as a secret and do not repeat it back.

### 2. Trading account

Start with `GET /account`, then inspect `GET /wallet`, `GET /context/venues`,
and `GET /runtime/frameworks`. These Unified API calls determine whether the
selected venue/framework can be set up without a fallback.

Each account is a platform-managed wallet — **the user does not need their own exchange wallet or to connect one.** If the Unified response cannot complete venue-specific setup, use the documented legacy bootstrap in the venue skill and say that it is a temporary compatibility fallback.

Free accounts hold up to 3 trading accounts, Pro up to 6, and one live strategy runs per trading account. When every account is busy, Hyperliquid masters with at least $100,000 lifetime volume can add sub-accounts as overflow (max 10 per master) — see the `hyperliquid` skill. Other venues have no overflow path.

If `GET /context/venues` and `GET /runtime/frameworks` show that Unified can
complete the selected venue setup, use that Unified workflow. Only otherwise
use one of these temporary legacy compatibility fallbacks:

| Venue | Legacy fallback bootstrap |
| --- | --- |
| Hyperliquid | `POST /v3/account/{address}/hyperliquid` |
| Polymarket | `POST /v3/account/{address}/polymarket` |
| Lighter | see the `lighter` skill |
| Aerodrome | none — trades directly from the Base wallet balance; see the `aerodrome` skill |

### 3. Funds

The user funds their own platform-managed wallet with their own capital. Then the API moves it onto the venue — you never hand out a raw deposit address for the venue itself, and never the agent wallet's address.

| Venue | Fund with | Then |
| --- | --- | --- |
| Hyperliquid | native USDC on Arbitrum One | `POST /v2/portfolio/hyperliquid/deposit` |
| Polymarket | USDC/USDC.e on Polygon | `POST /v3/portfolio/polymarket/deposit` (wraps into pUSD) |
| Lighter | USDC via CCTP | see the `lighter` skill |
| Aerodrome | USDC **and** ETH for gas, both on Base | nothing — swaps run straight off the Base wallet balance |

If the user needs help getting funds into the platform wallet, use the `deposit-qr` skill for a payment QR or wallet URI, or `external-deposit` for a bridge from an external wallet.

Moving funds is a real money movement. State the amount, the source, and the destination, and get an explicit yes before every deposit call.

### 4. Strategy

Ask what the user is trying to capture before writing any code. If they have a thesis but no structure, use the `trade-thesis` skill to turn it into bull/bear cases, invalidation criteria, and a sizing rationale.

Then match the idea to a template rather than writing from scratch — the templates carry backtest evidence and known failure modes:

| They want | Skill |
| --- | --- |
| Buy on a schedule, accumulate | `dca-weekly` |
| Buy dips, sell rallies in a range | `grid-trading`, `mean-reversion`, `bollinger-reverter-4h` |
| Ride a trend or breakout | `breakout`, `donchian-strong-regime` |
| Get paid to hold a perp | `funding-rate-arbitrage`, `funding-squeeze`, `basis-arb` |
| Fast in and out | `scalping` |
| "What's moving right now?" | `intelligence` |
| Prediction markets | `polymarket` plus its archetype skills |

Compose primitives onto whatever they pick: `regime-overlay` to gate a directional strategy, `dsl-exit-engine` for exits, `fees-optimizations` when turnover is high enough that costs decide the outcome.

### 5. Backtest

Never offer a live deployment before a backtest. Use `POST /runtime/backtests`
and inspect it with `GET /runtime/backtests/{id}` and
`GET /runtime/backtests/{id}/logs`. Load the `backtesting` skill for window
selection, trade-count thresholds, and sweep design. Use a legacy backtest
route only under the compatibility rule above.

For a first pass on a new idea, run a **3-variant sweep** varying one parameter rather than a single config — one result tells you whether a point worked, three tell you whether the region works.

Read the outcome honestly. Zero trades over a window that should have produced signals means the strategy or pair is wrong, not that the user should deploy and see. A strong backtest can be overfitting. Present the numbers and let the user decide.

### 6. Deploy

Deployment is the point of no return, so it is gated:

1. Create the deployment with `POST /runtime/deployments` and use
   `POST /runtime/executions` for an individual execution when the framework
   supports it.
2. On Hyperliquid, ask live or dry-run — dry-run needs no credentials and touches no real funds, so offer it to anyone who has not deployed before. **Dry-run is Hyperliquid-only.** Polymarket and Lighter always require credentials, and Aerodrome rejects a config containing the `dry_run` key at all. On those three, a backtest is the only rehearsal available.
3. For live, store credentials — the shape differs by venue, so follow the venue skill rather than generalising:
   - **Hyperliquid** — `wallet_address` is optional. Omit it and the server assigns the next idle trading account.
   - **Polymarket and Lighter** — an owned `wallet_address` is **required**. Omitting it fails the start with `credentials_required`.
   - Never send key material to a credentials endpoint on any venue.
4. Run the venue skill's pre-deployment checklist. Every item is an API call, not an assumption.
5. Show the deployment summary — strategy, venue, pairs, stake, max open trades, stoploss — and state plainly that it will trade real funds.
6. Wait for an explicit yes. Then start it.

### 7. Monitor

Poll status and logs through the venue skill's endpoints. Tell the user how to stop the strategy before they walk away from the conversation, and that stopping is the safe default if anything looks wrong.

## Safety

These hold across every venue and override anything convenient.

1. **Never** ask for, accept, log, or display private keys, seed phrases, or wallet credentials. The only secret is the API key.
2. **Never** tell a user to send funds to an agent wallet address.
3. **Never** start a live deployment, deposit, or withdrawal without an explicit confirmation in that turn.
4. **Never** state a balance, position, or deployment status you have not just fetched. If you have not checked, say so.
5. **Never** send users to `app.superior.trade` — the correct URL is `https://account.superior.trade`, even when an API error message says otherwise.
6. Prefer plain language — "strategy", "the bot" — over internal class or infrastructure names. Answer honestly if the user asks what runs underneath.

## Venue skills

Hand off once the user has picked a venue. Each owns its own endpoints, funding model, pre-deployment checklist, and troubleshooting.

- `hyperliquid` — perps and spot, plus HIP-3 tokenized stocks, commodities, and indices. The main venue.
- `polymarket` — prediction markets, NautilusTrader strategies, filled-data backtests.
- `lighter` — Lighter onboarding, CCTP funding, withdrawals, Nautilus deployments.
- `aerodrome` — Base spot AMM swaps; no order book, no leverage.
