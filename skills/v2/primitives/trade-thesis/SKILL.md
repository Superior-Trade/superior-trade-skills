---
name: trade-thesis
description: "Structured pre-trade thesis builder — bull/bear cases, invalidation criteria, and sizing rationale before any live deployment. Read this page when a user proposes a trade idea, says 'should I trade X', asks for a bull/bear case, wants a pre-trade analysis, or before the agent deploys a new strategy live for the first time."
version: 0.1.0
updated: 2026-06-07
---

# Pre-Trade Thesis Builder

A structured framework the agent produces before any live deployment of a new strategy idea. Forces two-sided analysis and a measurable invalidation level so every trade has a thesis that can be killed.

## When to produce a thesis

- The user proposes a new trade idea ("I want to long ETH", "thinking about a funding squeeze on SOL")
- The user asks "should I trade X" or "is this a good setup"
- The agent is about to deploy a new strategy to live for the first time
- The user explicitly asks for a bull/bear case, conviction check, or pre-trade analysis

## When to skip

- **Backtests and parameter sweeps** — the thesis is for live capital, not for exploring an idea
- **Dry-run / paper deployments** — no real money at risk
- **Copy-trading** — the thesis belongs to the source trader, not the copier
- **Re-deploying a previously validated strategy** — if the user already ran this setup live and is restarting it, skip unless market conditions changed materially

## Thesis format

Produce all six sections below. Each section is 2-4 bullet points max. This is a pre-trade checklist, not a research paper.

### 1. Thesis statement

One sentence: what is the bet, which direction, what timeframe.

Force clarity. "Long ETH perp on a funding squeeze setup, targeting a 3-5% move over 24-48h" is a thesis. "ETH looks bullish" is not.

### 2. Bull case

2-3 concrete reasons this trade works. Every reason must reference observable, checkable data:

- Price action the agent can verify via `price_check` (e.g., "price reclaimed the 4h EMA-50 and is holding above")
- Volume dynamics via `volume_momentum_check` (e.g., "RVOL is 2.3x on the breakout candle")
- Funding / OI via the alpha scan (e.g., "funding APR is -18%, shorts are paying 0.002% per hour")
- On-chain flows if available (e.g., "exchange outflows spiked 3x over 24h")

No vague claims like "market sentiment is improving" or "BTC looks strong." If it cannot be checked with a tool call, it does not belong in the bull case.

### 3. Bear case

2-3 concrete reasons this trade fails. Same data-grounding rules as the bull case.

The agent must argue AGAINST the trade honestly. This is adversarial analysis, not a strawman disclaimer. Examples of real bear points:

- "Funding is negative but OI is declining — shorts are closing, not getting squeezed. The fuel is draining."
- "RVOL is elevated but the move happened on a single 15m candle — no follow-through across multiple sessions."
- "BTC is sitting at the 200-day moving average with a bearish divergence on 4h RSI. A rejection here takes alts down 10-15%."

### 4. Invalidation level

A specific, measurable condition that kills the thesis. This becomes the logical stoploss anchor.

Acceptable invalidation criteria:

- A price level: "Below $3,420 the reclaim is failed — thesis dead."
- A funding flip: "If funding APR crosses above 0% before the move, the squeeze pressure is gone."
- An RVOL collapse: "If RVOL drops below 1.0x within 4 hours of entry, the momentum thesis is invalidated."
- A time deadline: "If price hasn't moved +2% within 24h, the catalyst is stale — cut."

The stoploss in the deployment config should be anchored to this level, not an arbitrary percentage.

### 5. Data check

Which agent tools to call right now to verify the thesis before proceeding:

| Check | Tool | What to look for |
|---|---|---|
| Current price and recent structure | `price_check` | Is price where the thesis assumes it is? Has structure changed since the idea was formed? |
| Volume and momentum | `volume_momentum_check` | RVOL level, momentum acceleration/deceleration, any divergence |
| Available capital | `balance_check` | Main wallet balance on Hyperliquid — enough for the proposed stake? |
| Pair ranking | `alpha_scan` | Where does this pair sit in the current scan? Is the setup confirmed or fading? |
| Pair tradability | `pair_validate` | Is the pair active on Hyperliquid? What are the margin requirements and minimum order size? |

Run these checks and update the bull/bear case with the results before proceeding. If the data contradicts the thesis, say so.

### 6. Position sizing rationale

- State how much of the available balance this trade should use (referencing `stake_amount` and `max_open_trades`)
- Link the invalidation level to the stoploss: "Invalidation at $3,420 with entry at $3,580 = 4.5% downside. Stoploss set at -0.05 to give breathing room."
- Compute the risk per trade: "Risking $45 on a $1,000 wallet = 4.5% account risk per trade."
- If the risk per trade exceeds 5% of available balance, flag it explicitly and ask the user to confirm or reduce size
- Reference `max_open_trades` — if multiple positions may be open, total portfolio risk = risk per trade x max open trades

## Example thesis

**Setup:** Funding squeeze on ETH perps, 1h timeframe.

**1. Thesis statement**

Long ETH/USDC:USDC on a funding squeeze — shorts are deeply underwater with funding APR at -22%, price has reclaimed the 4h EMA-21 with rising volume, targeting a 4-6% forced-unwind move over 24-48h.

**2. Bull case**

- Funding APR is -22% and worsening over the last 8 hours — shorts are paying 0.0025% per hour with no relief. This is top-decile negative funding for ETH over the past 90 days.
- Price rallied +3.8% in the last 24h and is holding above the 4h EMA-21 ($3,540). The move has follow-through: RVOL is 1.9x on the breakout session.
- OI increased +4.2% while price rose — new shorts are entering into a rising market, adding squeeze fuel rather than draining it.

**3. Bear case**

- BTC is testing the $98,000 resistance level. A rejection here historically drags ETH down 5-8% regardless of ETH-specific setups. The macro is the dominant risk.
- The last two ETH funding squeezes in this regime (March 12, April 3) both reversed within 12h of funding hitting -25% APR. The squeeze may be closer to exhaustion than acceleration.
- Spot exchange inflows ticked up 1.8x in the last 6h — potential distribution into the rally, not accumulation.

**4. Invalidation level**

Below $3,420 (the pre-breakout consolidation low). If ETH gives back the entire reclaim candle, the squeeze is not catching and shorts are right. Stoploss anchored at -0.045 from entry to cover this level plus slippage.

Time stop: if the move hasn't produced +2% within 24h, the catalyst is stale. Exit via `custom_exit` timeout.

**5. Data check**

- `price_check ETH/USDC:USDC` — confirm price is still above $3,540 and the reclaim is intact
- `volume_momentum_check ETH` — confirm RVOL is still > 1.5x
- `balance_check` — confirm at least $150 USDC available (stake $100 + buffer)
- `alpha_scan` — confirm ETH ranks in the squeeze-fuel bucket with score > 0.7
- `pair_validate ETH/USDC:USDC` — confirm pair is active, check margin requirements

**6. Position sizing rationale**

Wallet balance: $1,200 USDC. Using `stake_amount: 100` with `max_open_trades: 1`. Invalidation at $3,420 with expected entry near $3,560 = 3.9% downside. Stoploss at -0.045 covers the invalidation level. Risking ~$4.50 on a $1,200 wallet = 0.375% account risk. Conservative sizing — appropriate for a first deployment of this setup. Room to scale up on the next squeeze if this one validates.
