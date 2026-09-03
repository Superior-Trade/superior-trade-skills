# Superior Skills

Trading strategies and intelligence tools for [Superior Trade](https://superior.trade) — natural-language strategy authoring, backtesting, and autonomous deployment on Hyperliquid, Lighter, and Polymarket.

Designed for OpenClaw users adding trading capabilities to their agent, and for traders who want validated templates rather than rolling their own.

[Website](https://superior.trade) · [Discord](https://discord.gg/aVZR8cCxcR) · [Twitter](https://x.com/SuperiorTrade_)

---

## Start here

[`superior-trade`](skills/superior-trade/SKILL.md) is the entry skill. It carries the whole path — API key, trading account, funding, strategy selection, backtest, live deployment, monitoring — and hands off to the venue skill once the user has picked one. Point an agent at this skill and it can take someone from no account to a running strategy without further instruction.

Everything below is what it routes to.

## Unified API migration

All Superior Trade operations in this package use the unversioned Unified API.
The committed OpenAPI snapshot and endpoint audit reject versioned API guidance.
Read [`references/unified-runtime.md`](references/unified-runtime.md) for the
shared lifecycle.

Use this single prompt to migrate another skill:

```text
Migrate this Superior Trade skill to the Unified API. In the Superior skills package, read references/unified-runtime.md and scripts/api-contract/unified.json first. Replace every versioned Superior Trade endpoint, method, payload, polling step, and response assumption with the functionally equivalent Unified API operation. Do not keep compatibility fallbacks. When Unified API has no equivalent, state that the operation is unavailable instead of inventing a route. Preserve the skill's domain strategy and safety rules, update examples and linked references, then run pnpm run validate and fix every endpoint-audit error.
```

### Operation comparison

Equivalent operations across the previous API surfaces are grouped together.
"Unavailable" means the skill must report the limitation instead of falling
back to a versioned route. See the
[full migration guide](https://docs.superior.trade/reference/migration) for
the product-level lifecycle.

<!-- legacy-api-comparison:start -->

| Operation                             | Previous API                                                                                 | Unified API                                                                        | Change                                                                              |
| ------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Health check                          | `GET /health`                                                                                | `GET /health`                                                                      | Direct                                                                              |
| Request API access                    | `POST /auth/sign-in/magic-link`                                                              | `POST /account/register`, then `POST /account/verify`                              | Replaced by an OTP flow                                                             |
| List API keys                         | `GET /auth/api-key`                                                                          | `GET /account/keys`                                                                | Direct                                                                              |
| Create API key                        | `POST /auth/api-key`                                                                         | `POST /account/keys`                                                               | Direct                                                                              |
| Delete API key                        | `DELETE /auth/api-key/{id}`                                                                  | `DELETE /account/keys/{id}`                                                        | Direct                                                                              |
| Rename API key                        | `PATCH /auth/api-key/{id}`                                                                   | —                                                                                  | Unavailable                                                                         |
| Read account identity                 | No dedicated equivalent                                                                      | `GET /account`                                                                     | New account, plan, limits, and usage view                                           |
| Read account usage                    | No dedicated equivalent                                                                      | `GET /account/usage`                                                               | New                                                                                 |
| Read trading account / managed wallet | `GET /v2/account`, `GET /v3/account`, venue balance reads                                    | `GET /wallet`                                                                      | Same managed-wallet domain; the collection becomes the authenticated wallet summary |
| Create managed trading wallet         | `POST /v2/account`, `POST /v3/account`                                                       | Implicit on first use                                                              | No explicit Unified creation call                                                   |
| Rename trading account                | `PATCH /v2/account/{address}`, `PATCH /v3/account/{address}`                                 | —                                                                                  | Unavailable                                                                         |
| Read venue availability               | `GET /v2/account/{address}/status/{exchange}`, `GET /v3/account/{address}/status/{exchange}` | `GET /context/venues`, `GET /wallet`                                               | Consolidated capability and wallet-readiness checks                                 |
| Bootstrap a venue account             | `POST /v3/account/{address}/hyperliquid`, `/polymarket`, or `/lighter`                       | Implicit for the managed path when a deployment starts                             | No public bootstrap mutation                                                        |
| List backtests                        | `GET /v1/backtesting`, `GET /v2/backtesting`                                                 | `GET /runtime/backtests`                                                           | Direct                                                                              |
| Create backtest                       | `POST /v1/backtesting`, `POST /v2/backtesting`, `POST /v3/backtest`                          | `POST /runtime/backtests`                                                          | Creation automatically queues the run                                               |
| Get backtest                          | Versioned `GET` by ID                                                                        | `GET /runtime/backtests/{id}`                                                      | Direct                                                                              |
| Read backtest status/result           | Versioned `/status` and `/result` reads                                                      | `GET /runtime/backtests/{id}`                                                      | Embedded in the resource                                                            |
| Start backtest                        | Versioned status update                                                                      | —                                                                                  | Removed; creation queues the run                                                    |
| Update backtest                       | `PATCH /v2/backtesting/{id}`                                                                 | —                                                                                  | Unavailable                                                                         |
| Delete or cancel backtest             | Versioned `DELETE` by ID                                                                     | `DELETE /runtime/backtests/{id}`                                                   | Direct                                                                              |
| Read backtest logs                    | Versioned `GET` logs by ID                                                                   | `GET /runtime/backtests/{id}/logs`                                                 | Direct                                                                              |
| Check dataset availability            | `GET /v2/backtesting-data/hyperliquid`, `/binance`, or `/aerodrome`                          | `GET /context/datasets`, `GET /runtime/backtests/dataset`                          | Catalog plus exact-market lookup                                                    |
| Scan intelligence                     | `GET /v2/intelligence/scan`                                                                  | `GET /context/scan`                                                                | New parameters and response schema                                                  |
| Read symbol setup                     | `GET /v2/intelligence/setup/{pair}`                                                          | `GET /context/setup/{symbol}`                                                      | Renamed identifier and response model                                               |
| Search markets                        | `POST /v3/markets/search`                                                                    | `GET /context/markets`                                                             | Search command becomes a context read                                               |
| Read leaderboard                      | `GET /v2/leaderboard-strategies`                                                             | `GET /context/leaderboard`                                                         | Direct                                                                              |
| List/read tracked traders             | `GET /v2/copy-trading/traders`, `GET /v2/copy-trading/traders/{wallet}`                      | `GET /context/traders`, `GET /context/traders/{wallet}`                            | Direct                                                                              |
| Read candles                          | No dedicated equivalent                                                                      | `GET /context/candles`                                                             | New                                                                                 |
| Read funding                          | No dedicated equivalent                                                                      | `GET /context/funding`                                                             | New                                                                                 |
| List runtime frameworks               | No dedicated equivalent                                                                      | `GET /runtime/frameworks`                                                          | New                                                                                 |
| List deployments                      | Versioned deployment lists                                                                   | `GET /runtime/deployments`                                                         | Consolidated                                                                        |
| Create deployment                     | Versioned live and paper creation                                                            | `POST /runtime/deployments`                                                        | `framework`, `venue`, and `mode` are request fields                                 |
| Get deployment                        | Versioned `GET` by ID                                                                        | `GET /runtime/deployments/{id}`                                                    | Direct                                                                              |
| Update deployment metadata            | `PATCH /v2/deployment/{id}`                                                                  | `PATCH /runtime/deployments/{id}`                                                  | Direct                                                                              |
| Delete deployment                     | Versioned `DELETE` by ID                                                                     | `DELETE /runtime/deployments/{id}`                                                 | Direct                                                                              |
| Read deployment status                | Versioned `/status` reads                                                                    | `GET /runtime/deployments/{id}`                                                    | Embedded in the resource                                                            |
| Start or stop deployment              | Versioned `PATCH` or `PUT` status operations                                                 | `PUT /runtime/deployments/{id}/status`                                             | Standardized lifecycle action                                                       |
| Attach deployment credentials         | Versioned `POST` credentials operations                                                      | `PUT /runtime/deployments/{id}/credentials`                                        | Method and contract changed                                                         |
| Read deployment credentials           | `GET /v2/deployment/{id}/credentials`                                                        | —                                                                                  | No standalone credential read; safe metadata may appear on the deployment           |
| Read deployment logs                  | Versioned `GET` logs by ID                                                                   | `GET /runtime/deployments/{id}/logs`                                               | Direct                                                                              |
| Read deployment metrics               | Paper profit and pod-proxy reads                                                             | `GET /runtime/deployments/{id}/metrics`                                            | Normalized across frameworks                                                        |
| Paper deployment                      | `/v2/paper-deployment` resource tree                                                         | `POST /runtime/deployments` with `mode: "paper"`                                   | Mode becomes a field, not a separate resource                                       |
| Deployment history                    | `GET /v2/deployment-history`                                                                 | `GET /runtime/deployments`                                                         | No dedicated history resource                                                       |
| Exit all positions                    | Versioned deployment and portfolio `/exit` operations                                        | —                                                                                  | Unavailable                                                                         |
| Deposit to a venue                    | Versioned Hyperliquid, Polymarket, and Lighter deposit operations                            | Fund the address from `GET /wallet`; allocation occurs on managed deployment start | Removed as a public venue mutation                                                  |
| Read deposit history                  | Venue reconciliation reads                                                                   | `GET /wallet/deposits`                                                             | Read-only history, not a transfer action                                            |
| Withdraw Hyperliquid funds            | `POST /v3/portfolio/hyperliquid/withdraw`                                                    | `POST /wallet/withdraw`                                                            | Unified, tracked withdrawal to the verified login wallet                            |
| Withdraw Lighter funds                | `POST /v3/portfolio/lighter/withdraw`                                                        | —                                                                                  | Unavailable                                                                         |
| Read withdrawal history/status        | Venue reconciliation reads                                                                   | `GET /wallet/withdrawals`, `GET /wallet/withdrawals/{id}`                          | Unified wallet withdrawals only                                                     |
| Hyperliquid order/cancel              | `POST /v2/authorize-and-send/hyperliquid`                                                    | `POST /runtime/executions`                                                         | Typed `order` and `cancel` actions only                                             |
| Polymarket order/cancel               | `POST /v3/authorize-and-send/polymarket`                                                     | `POST /runtime/executions`                                                         | Typed `placeMarketOrder` and `cancelOrder` actions only                             |
| Lighter signed action                 | `POST /v3/authorize-and-send/lighter`                                                        | —                                                                                  | Unavailable                                                                         |
| List/read execution records           | No dedicated equivalent                                                                      | `GET /runtime/executions`, `GET /runtime/executions/{id}`                          | New durable, sanitized records                                                      |
| Hyperliquid brackets                  | `/v2/bracket` resource tree                                                                  | —                                                                                  | No bracket-resource equivalent                                                      |
| Hyperliquid wallet transfer           | `POST /v2/portfolio/hyperliquid/transfer`                                                    | —                                                                                  | Unavailable                                                                         |
| Discover the HTTP contract            | Versioned OpenAPI documents                                                                  | `GET /openapi.json`                                                                | One authoritative contract                                                          |
| Discover or call MCP                  | No dedicated equivalent                                                                      | `GET /.well-known/mcp.json`, `POST /mcp`                                           | New                                                                                 |

<!-- legacy-api-comparison:end -->

## Hyperliquid and Aerodrome

These integrations use Unified runtime resources with the Freqtrade framework.

### Validated strategies (with backtest evidence)

These strategies have backtest evidence on real Hyperliquid data. Numbers are full-period (162 days, 2025-11-20 → 2026-05-01) unless noted.

| Strategy                   | Regime                   | Pairs tested     | Trades | Win   | Profit     | Max DD | File                                                               |
| -------------------------- | ------------------------ | ---------------- | ------ | ----- | ---------- | ------ | ------------------------------------------------------------------ |
| **Donchian Strong-Regime** | Strong directional trend | BTC              | 6      | 100%  | **+6.69%** | **0%** | [`donchian-strong-regime`](skills/donchian-strong-regime/SKILL.md) |
| **Bollinger Reverter 4h**  | Range / chop (ADX<25)    | BTC/ETH/SOL/DOGE | 84     | 65.5% | **+8.77%** | 18.5%  | [`bollinger-reverter-4h`](skills/bollinger-reverter-4h/SKILL.md)   |

Paired together as separate sub-accounts, the two strategies are **regime-complementary**: the Donchian gate fires zero trades during the chop windows where the Bollinger reverter thrives, and the Bollinger reverter mildly underperforms during the strong-trend windows the Donchian captures.

### Template strategies (starting points)

Reference templates for adapting to your own thesis. Backtest before deploying.

- [`dca-weekly`](skills/dca-weekly/SKILL.md) — dollar-cost averaging with scheduled buys
- [`grid-trading`](skills/grid-trading/SKILL.md) — profit-laddered position adjustment
- [`funding-rate-arbitrage`](skills/funding-rate-arbitrage/SKILL.md) — negative-funding capture (carry)
- [`funding-squeeze`](skills/funding-squeeze/SKILL.md) — funding-extreme squeeze ride
- [`basis-arb`](skills/basis-arb/SKILL.md) — spot-perp basis convergence
- [`breakout`](skills/breakout/SKILL.md) — Donchian breakout with trailing stop
- [`mean-reversion`](skills/mean-reversion/SKILL.md) — Bollinger band fade (4h validated; see file)
- [`scalping`](skills/scalping/SKILL.md) — RSI + volume-thrust template

Categories covered: **trend-following**, **mean-reversion**, **carry**, **arbitrage**, **scalping**.

### Reusable primitives

Building blocks that compose across strategies.

- [`trade-thesis`](skills/trade-thesis/SKILL.md) — Structured pre-trade thesis builder: bull/bear cases, invalidation criteria, and sizing rationale before any live deployment of a new strategy idea. Aliases: **pre-trade analysis**, **conviction check**, **trade plan**, **bull/bear case**.
- [`regime-overlay`](skills/regime-overlay/SKILL.md) — Triple-confirmation regime gate (EMA separation + ADX + N-bar return). Turns fragile directional strategies into regime-robust ones. Aliases: **regime filter**, **trend gate**, **directional confirmation**.
- [`dsl-exit-engine`](skills/dsl-exit-engine/SKILL.md) — Three-phase exit primitive: ROI ladder, hard stop, ratcheting trailing stop. Aliases: **ratcheting trailing stop**, **two-phase exit**, **take-profit ladder**.
- [`fees-optimizations`](skills/fees-optimizations/SKILL.md) — Maker (ALO) vs taker (MARKET) order-type decisioning, builder fees, parameter sweeps. Aliases: **fee optimizer**, **ALO vs MARKET**, **maker pricing**.
- [`backtesting`](skills/backtesting/SKILL.md) — Window selection, walk-forward, parameter sweeps.
- [`intelligence`](skills/intelligence/SKILL.md) — Opportunity scanner / pair-ranking system.

### Exchanges

- [`hyperliquid`](skills/hyperliquid/SKILL.md) — Hyperliquid/Freqtrade API reference, account bootstrap, funding, deployment, and live trading workflows.
- [`aerodrome`](skills/aerodrome/SKILL.md) — Aerodrome/Base spot-AMM execution.

### Intelligence references

The `skills/intelligence/` folder provides Unified market scans and single-symbol setup context. Aliases: **opportunity scanner**, **pair scanner**, and **market screener**.

- [`references/buckets.md`](skills/intelligence/references/buckets.md) — Optional strategy lenses; not Unified response categories.
- [`references/api.md`](skills/intelligence/references/api.md) — `/context/scan` endpoint and setup.
- [`references/workflow.md`](skills/intelligence/references/workflow.md) — Scan-to-deploy recipes.
- [`references/glossary.md`](skills/intelligence/references/glossary.md) — Terminology reference.

## Polymarket and Lighter

These integrations use Unified runtime resources with the Nautilus framework.

- [`polymarket`](skills/polymarket/SKILL.md) — Polymarket market discovery, funding, backtests, deployments, and one-off order workflows.
- [`lighter`](skills/lighter/SKILL.md) — Lighter market discovery, wallet checks, backtests, and contract-supported Nautilus deployments. Use this for `venue: "lighter"` and instrument identifiers returned by `/context/markets`.
- [`lighter-robinhood`](skills/lighter-robinhood/SKILL.md) — Robinhood Chain Lighter capability checks and deployment planning. Use this only when `/context/venues` advertises `lighter-robinhood`; Unified API currently exposes no signed-proxy execution action for it.

### Funding primitives

- [`deposit-qr`](skills/deposit-qr/SKILL.md) — Create a wallet-scannable QR code and payment URI for funding a Superior-managed EVM wallet on a specific chain before a venue deposit flow.
- [`external-deposit`](skills/external-deposit/SKILL.md) — Create quote-backed external wallet bridge/deposit links and wallet QR URLs, including Relay prefilled routes and same-chain ERC-20 transfer URIs.

### Polymarket archetypes

- [`probability-momentum`](skills/probability-momentum/SKILL.md)
- [`probability-mean-reversion`](skills/probability-mean-reversion/SKILL.md)
- [`deadline-drift`](skills/deadline-drift/SKILL.md)
- [`related-market-spread`](skills/related-market-spread/SKILL.md)
- [`large-fill-pressure`](skills/large-fill-pressure/SKILL.md)
- [`catalyst-confirmation`](skills/catalyst-confirmation/SKILL.md)

## Capability matrix

| Capability                                | Where it lives                                                                                 | Aliases                                                          |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| API key onboarding                        | `SKILL.md` → `/account/register` + `/account/verify`                                           | auth setup, email OTP, x-api-key                                 |
| Managed wallet                            | `skills/superior-trade/SKILL.md` → `/wallet`                                                   | wallet, deposit details, balances                                |
| Venue and framework discovery             | `references/unified-runtime.md` → `/context/venues` + `/runtime/frameworks`                    | capability check, readiness                                      |
| Strategy backtesting                      | `references/unified-runtime.md` → `/runtime/backtests`                                         | walk-forward, parameter sweep                                    |
| Live and paper deployment                 | `references/unified-runtime.md` → `/runtime/deployments`                                       | Hyperliquid, Aerodrome, Lighter, Polymarket                      |
| Lighter Nautilus deployment               | `skills/lighter/SKILL.md` → `/runtime/deployments` with `venue: "lighter"`                     | Lighter strategy, BTC-PERP.LIGHTER, lighter-tokyo                |
| Robinhood Chain Lighter Nautilus planning | `skills/lighter-robinhood/SKILL.md` → `/runtime/deployments` with `venue: "lighter-robinhood"` | PLTR-PERP.LIGHTER-RH, lighter-robinhood-tokyo                    |
| Polymarket Nautilus deployment            | `skills/polymarket/SKILL.md` → `/runtime/deployments` with `venue: "polymarket"`               | prediction-market strategy                                       |
| Opportunity scanner                       | `skills/intelligence/`                                                                         | pair scanner, market screener, ranking funnel                    |
| Fee optimizer                             | `skills/fees-optimizations/SKILL.md`                                                           | ALO vs MARKET, maker vs taker, fee budgeting                     |
| Two-phase trailing stop                   | `skills/dsl-exit-engine/SKILL.md`                                                              | ratcheting stop, DSL exit engine                                 |
| Pre-trade thesis                          | `skills/trade-thesis/SKILL.md`                                                                 | trade plan, conviction check, bull/bear case                     |
| Regime gate                               | `skills/regime-overlay/SKILL.md`                                                               | trend filter, directional confirmation                           |
| One-time venue action                     | `references/unified-runtime.md` → `/runtime/executions`                                        | order, cancel, typed execution                                   |
| Deposit history                           | `references/unified-runtime.md` → `/wallet/deposits`                                           | funding verification                                             |
| Withdrawal                                | `references/unified-runtime.md` → `/wallet/withdraw`                                           | verified destination, idempotent withdrawal                      |
| Deposit QR generation                     | `skills/deposit-qr/SKILL.md`                                                                   | QR code, payment URI, fund wallet, chain-specific deposit        |
| External bridge deposit                   | `skills/external-deposit/SKILL.md`                                                             | Relay bridge, MetaMask, OKX, Trust Wallet, prefilled deposit URL |
| HIP3 RWA support                          | `skills/hyperliquid/SKILL.md` → HIP3 section                                                   | tokenized stocks, commodities, indices                           |
| Polymarket strategy archetypes            | `skills/probability-momentum/`, `skills/deadline-drift/`, +4                                   | prediction-market archetypes                                     |

## Folder layout

Every skill is a self-contained directory at `skills/<name>/`, following the [Agent Skills](https://agentskills.io) standard. Skill loaders resolve exactly one level, so this depth is a hard requirement rather than a convention — a skill nested any deeper is never discovered. `pnpm validate` enforces it.

```
SKILL.md                     auth/onboarding, also served at superior.trade/SKILL.md
skills/superior-trade/       start here — access → funding → backtest → deploy
skills/<venue>/              hyperliquid, polymarket, lighter, lighter-robinhood, aerodrome
skills/<strategy>/           dca-weekly, grid-trading, breakout, mean-reversion, …
skills/<primitive>/          regime-overlay, dsl-exit-engine, fees-optimizations, backtesting, trade-thesis
skills/<archetype>/          probability-momentum, deadline-drift, catalyst-confirmation, …
skills/<funding>/            deposit-qr, external-deposit
```

Larger skills keep `SKILL.md` to a spine — safety rules, gotchas, workflow, routing — and move detail into `references/`, loaded only when the task calls for it.

Adding or editing a skill: see [AUTHORING.md](AUTHORING.md), and run `pnpm validate` before pushing.

## Getting started

```
# List trading accounts
curl https://unified-api-zag4gzx6gq-an.a.run.app/wallet \
  -H "x-api-key: $SUPERIOR_TRADE_API_KEY"

# Backtest a strategy
curl -X POST https://unified-api-zag4gzx6gq-an.a.run.app/runtime/backtests \
  -H "x-api-key: $SUPERIOR_TRADE_API_KEY" \
  -H "content-type: application/json" \
  -d @config-and-code.json

# Creation queues the backtest; poll until completion
curl https://unified-api-zag4gzx6gq-an.a.run.app/runtime/backtests/{id} \
  -H "x-api-key: $SUPERIOR_TRADE_API_KEY"
```

## Install

Superior skills follow the open [Agent Skills](https://agentskills.io) standard — one folder per
skill with a `SKILL.md`. Install through whichever entry point your agent uses:

| Entry point | Command |
|---|---|
| **npx skills** (universal — Claude Code, OpenClaw, Cursor, Codex, Gemini CLI, +50) | `npx skills add Superior-Trade/superior-skills` |
| **GitHub CLI** (gh ≥ v2.90.0) | `gh skill install Superior-Trade/superior-skills` — browse & pick, or name one: `gh skill install Superior-Trade/superior-skills hyperliquid` |
| **Claude Code** | `/plugin marketplace add Superior-Trade/superior-skills` then `/plugin install superior-skills@superior-trade` |
| **OpenClaw / ClawHub** | `openclaw skills install @superior-ai/<skill>` (owner-qualified) &nbsp;·&nbsp; or from git: `openclaw skills install git:Superior-Trade/superior-skills@main` |
| **From our domain** | point any agent at `https://superior.trade/SKILL.md` |
| **Manual** | clone this repo and copy the needed `skills/<name>/` folder into your agent's skills folder |

Installing the repo pulls the whole library; grab a single skill with `--skill <name>` (npx) or by
naming it (`gh skill install Superior-Trade/superior-skills <name>`). On **ClawHub** several skill
names are generic and shared by other publishers, so always use the owner-qualified form
**`@superior-ai/<skill>`** to install ours.

Hyperliquid, Aerodrome, and Lighter skills need a **`SUPERIOR_TRADE_API_KEY`**; Polymarket skills use
**`SUPERIOR_TRADE_API_KEY`**. New users should start with the `superior-trade` skill, which walks the whole path from
getting a key to a running strategy and then hands off to the venue skill.

## Workflow

The platform emphasizes a structured progression: **draft → backtest → review → deploy**. No live deployment without explicit user confirmation. Every parameter is logged; every trade is tracked.

## Risk disclosure

Trading involves risk. Backtests do not guarantee future performance. The validated strategies above showed positive returns on a single 162-day window (2025-11-20 → 2026-05-01); a strategy that worked then may not work in a different regime. Users remain responsible for strategy choice, deployment decisions, exchange connectivity, and capital risk. Pair every deployment with the [`regime-overlay`](skills/regime-overlay/SKILL.md) gate or equivalent — strategies without regime confirmation are demonstrably fragile.

## Topics

`hyperliquid`, `lighter`, `nautilus`, `deposit-qr`, `external-deposit`, `relay`, `qrcode`, `trading-bot`, `ai-agents`, `openclaw`, `backtesting`, `fee-optimization`, `opportunity-scanner`, `trailing-stop`, `algorithmic-trading`, `regime-filter`, `mean-reversion`, `trend-following`, `funding-arbitrage`, `mcp`
