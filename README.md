# Superior Skills

Trading strategies and intelligence tools for [Superior Trade](https://superior.trade) — natural-language strategy authoring, backtesting, and autonomous deployment on Hyperliquid, Lighter, and Polymarket.

Designed for OpenClaw users adding trading capabilities to their agent, and for traders who want validated templates rather than rolling their own.

[Website](https://superior.trade) · [Discord](https://discord.gg/aVZR8cCxcR) · [Twitter](https://x.com/SuperiorTrade_)

---

## Start here

[`superior-trade`](skills/superior-trade/SKILL.md) is the entry skill. It carries the whole path — API key, trading account, funding, strategy selection, backtest, live deployment, monitoring — and hands off to the venue skill once the user has picked one. Point an agent at this skill and it can take someone from no account to a running strategy without further instruction.

Everything below is what it routes to.

## Unified API migration

Backtests, deployments, executions, and venue onboarding now use the Unified
API first. Read [`references/unified-runtime.md`](references/unified-runtime.md)
for the runtime workflow and the temporary compatibility rule. Legacy `/v2`
and `/v3` calls remain only when the Unified OpenAPI contract cannot perform
the selected venue/framework operation.

## v2 — Hyperliquid and Aerodrome

v2 contains the Freqtrade-based exchange integrations and the existing crypto strategy library.

### Validated strategies (with backtest evidence)

These strategies have backtest evidence on real Hyperliquid data. Numbers are full-period (162 days, 2025-11-20 → 2026-05-01) unless noted.

| Strategy                   | Regime                   | Pairs tested     | Trades | Win   | Profit     | Max DD | File                                                                             |
| -------------------------- | ------------------------ | ---------------- | ------ | ----- | ---------- | ------ | -------------------------------------------------------------------------------- |
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

### v2 exchanges

- [`hyperliquid`](skills/hyperliquid/SKILL.md) — Hyperliquid/Freqtrade API reference, account bootstrap, funding, deployment, and live trading workflows.
- [`aerodrome`](skills/aerodrome/SKILL.md) — Aerodrome/Base spot-AMM execution.

### Intelligence references

The `skills/intelligence/` folder provides the platform's pair-ranking system. Aliases: **opportunity scanner**, **pair scanner**, **market screener**, **smart-money detector**, **four-stage funnel**.

- [`references/buckets.md`](skills/intelligence/references/buckets.md) — The four bucket framework: squeeze fuel, stealth accumulation, coiled spring, basis flipping.
- [`references/api.md`](skills/intelligence/references/api.md) — `/v2/intelligence/scan` endpoint and setup.
- [`references/workflow.md`](skills/intelligence/references/workflow.md) — Scan-to-deploy recipes.
- [`references/glossary.md`](skills/intelligence/references/glossary.md) — Terminology reference.

## v3 — Polymarket and Lighter

v3 contains Nautilus-based venue integrations.

- [`polymarket`](skills/polymarket/SKILL.md) — Polymarket market discovery, funding, backtests, deployments, and one-off order workflows.
- [`lighter`](skills/lighter/SKILL.md) — Lighter account bootstrap, Superior-wallet CCTP deposit intents, secure returns to the Superior wallet, balance checks, and Nautilus deployments. Use this for `venue: "lighter"` configs and `<symbol>.LIGHTER` instruments such as `BTC-PERP.LIGHTER`.
- [`lighter-robinhood`](skills/lighter-robinhood/SKILL.md) — Robinhood Chain Lighter planning and signed proxy operations. Use this for `venue: "lighter-robinhood"` configs and `.LIGHTER-RH` instruments; perps funding is USDG and live Nautilus starts are blocked until chain id 4663 signing is supported.

### v3 primitives

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

| Capability                                | Where it lives                                                                                                                | Aliases                                                        |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| API key onboarding                        | `SKILL.md` → `/auth/sign-in/magic-link`                                                                                       | auth setup, email API key, x-api-key                           |
| Hyperliquid account bootstrap             | `skills/hyperliquid/SKILL.md` → `/v3/account/{address}/hyperliquid` + `/v3/account/{address}/status/hyperliquid` | setup readiness, agent wallet, builder fee                     |
| Lighter account bootstrap                 | `skills/lighter/SKILL.md` → `/v3/account/{address}/lighter` + `/v3/account/{address}/status/lighter`             | Lighter readiness, API key index 4                             |
| v2 strategy backtesting                   | `skills/hyperliquid/SKILL.md` → `/v2/backtesting`                                                                | walk-forward, parameter sweep                                  |
| v2 live deployment                        | `skills/hyperliquid/SKILL.md` → `/v2/deployment`                                                                 | Hyperliquid, Aerodrome, Freqtrade                              |
| Lighter Nautilus deployment               | `skills/lighter/SKILL.md` → `/v3/deployments` with `venue: "lighter"`                                            | Lighter strategy, BTC-PERP.LIGHTER, lighter-tokyo              |
| Robinhood Chain Lighter Nautilus planning | `skills/lighter-robinhood/SKILL.md` → `/v3/deployments` with `venue: "lighter-robinhood"`                        | PLTR-PERP.LIGHTER-RH, lighter-robinhood-tokyo                  |
| Polymarket Nautilus deployment            | `skills/polymarket/SKILL.md` → `/v3/deployments` with `venue: "polymarket"`                                      | prediction-market strategy                                     |
| Opportunity scanner                       | `skills/intelligence/`                                                                                          | pair scanner, market screener, ranking funnel                  |
| Fee optimizer                             | `skills/fees-optimizations/SKILL.md`                                                                            | ALO vs MARKET, maker vs taker, fee budgeting                   |
| Two-phase trailing stop                   | `skills/dsl-exit-engine/SKILL.md`                                                                               | ratcheting stop, DSL exit engine                               |
| Pre-trade thesis                          | `skills/trade-thesis/SKILL.md`                                                                                  | trade plan, conviction check, bull/bear case                   |
| Regime gate                               | `skills/regime-overlay/SKILL.md`                                                                                | trend filter, directional confirmation                         |
| Sub-account orchestration                 | `skills/hyperliquid/SKILL.md` → `/v2/portfolio/...`                                                              | multi-strategy isolation                                       |
| Hyperliquid deposit                       | `skills/hyperliquid/SKILL.md` → `/v2/portfolio/hyperliquid/deposit`                                              | Arbitrum USDC deposit, fund trading                            |
| Hyperliquid withdrawal                    | `skills/hyperliquid/SKILL.md` → `/v3/portfolio/hyperliquid/withdraw`                                             | Hyperliquid → Superior wallet, 1 USDC fee, delayed arrival      |
| Lighter CCTP deposit                      | `skills/lighter/SKILL.md` → `/v3/portfolio/lighter/deposit`                                                      | Superior wallet, native USDC, Arbitrum/Base/Avalanche           |
| Lighter secure withdrawal                 | `skills/lighter/SKILL.md` → `/v3/portfolio/lighter/withdraw`                                                     | Lighter → Superior wallet, delayed claim, idempotent            |
| Deposit QR generation                     | `skills/deposit-qr/SKILL.md`                                                                                    | QR code, payment URI, fund wallet, chain-specific deposit      |
| External bridge deposit                   | `skills/external-deposit/SKILL.md`                                                                                            | Relay bridge, MetaMask, OKX, Trust Wallet, prefilled deposit URL |
| Atomic exit-all                           | `skills/hyperliquid/SKILL.md` → `/v2/portfolio/hyperliquid/exit`                                                 | kill-switch, emergency exit                                    |
| HIP3 RWA support                          | `skills/hyperliquid/SKILL.md` → HIP3 section                                                                     | tokenized stocks, commodities, indices                         |
| Polymarket strategy archetypes            | `skills/probability-momentum/`, `skills/deadline-drift/`, +4                                         | prediction-market archetypes                                   |
| Managed wallet                            | `skills/hyperliquid/references/wallets-and-accounts.md` → Wallet Architecture                                                                    | no-key trading, custodial-style UX                             |

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
curl https://api.superior.trade/v3/account \
  -H "x-api-key: $SUPERIOR_TRADE_API_KEY"

# Backtest a strategy
curl -X POST https://api.superior.trade/v2/backtesting \
  -H "x-api-key: $SUPERIOR_TRADE_API_KEY" \
  -H "content-type: application/json" \
  -d @config-and-code.json

# Start the backtest (note: action, not status)
curl -X PUT https://api.superior.trade/v2/backtesting/{id}/status \
  -H "x-api-key: $SUPERIOR_TRADE_API_KEY" \
  -d '{"action": "start"}'

# Poll until completion
curl https://api.superior.trade/v2/backtesting/{id} \
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
