# Writing skills for this library

What we learned building it, and the rules `pnpm validate` enforces. Sources at the bottom.

## The three hard rules

**1. `skills/<name>/SKILL.md`. Exactly one level.**

Loaders resolve one level deep. A skill at `skills/v2/exchanges/hyperliquid/SKILL.md` is not "organised" — it is invisible. It never appears in the skill listing and cannot be invoked. We shipped that layout and lost 29 of 30 skills to it; verified by running a live session against both depths and watching only the flat one appear. Express taxonomy in `metadata`, never in the directory tree.

**2. Six frontmatter keys, and no others.**

`name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`. Claude Code tolerates more, but claude.ai upload, the Skills API, and `package_skill.py` reject an unknown key with a hard error rather than ignoring it. Everything else — `version`, `updated`, `homepage`, `auth`, `env` — goes under `metadata`.

**3. `SKILL.md` stays under 500 lines and ~5,000 tokens.**

Once a skill activates, its whole body sits in context for the rest of the conversation. Detail beyond the spine goes in `references/`, and the spine says *when* to read each file. "Read `references/api.md` when you need an exact request shape" works; "see references/ for details" does not — the agent has no trigger to act on.

## Descriptions are a shared budget

Every skill's description loads at startup so the model knows what exists. The budget is a fraction of the context window, each entry is capped, and when the listing overflows the least-used descriptions get dropped. **A bloated description costs other skills their trigger keywords.**

So: lead with when to use it, in the words a user would actually say. Keep it under ~400 characters. Backtest results, mechanics, and caveats belong in the body — they do not help the model decide whether to open the file.

```yaml
# No — 500 chars, half of it evidence the model can't act on yet
description: Use when writing a symmetric Bollinger-band mean-reversion strategy on the 4h
  timeframe — BB reverter, range trader, chop strategy. Validated +8.77%/65.5% win across
  BTC/ETH/SOL/DOGE over 162d; depends entirely on its minimal_roi ladder (2.5% → 1.5% → …

# Yes — triggers first, evidence stays in the file
description: Use when writing a symmetric Bollinger-band mean-reversion strategy on the 4h
  timeframe — BB reverter, range trader, chop strategy, ADX-gated mean reversion. Backtest
  evidence and the exact ladder are in the body.
```

## Put gotchas in `SKILL.md`, not a reference

The highest-value content in most of these skills is the list of things that defy a reasonable assumption: HIP-3 pairs use a hyphen, the agent wallet holding $0 is normal, a balance that exactly covers the stake still fails. These have to be in the body, because the agent has to read them *before* it recognises the situation — it will not know to open `references/gotchas.md` for a mistake it doesn't know it's making.

When you correct an agent's mistake, add it here. That is the cheapest improvement available.

## Write what the agent doesn't already know

Cut anything explaining what a perp is or how HTTP works. Every line competes for attention with the conversation. The test for a line: *would the agent get this wrong without it?* If no, delete it.

Give a default rather than a menu. "Use the 4h Bollinger template; for trending regimes use `donchian-strong-regime` instead" beats listing five options as equals.

Be prescriptive where the operation is fragile — an exact deployment sequence, a confirmation gate — and loose where judgment is fine. Most skills need both; calibrate per section.

## Test cold, not warm

A skill that triggers is not a skill that works. Put test cases in `evals/evals.json` (see `skills/superior-trade/` and `skills/hyperliquid/`) and run each prompt in a **fresh session** — context from authoring the skill will mask gaps in what you actually wrote.

Two things worth asserting separately: that the skill fires on prompts it should (and stays quiet on prompts it shouldn't), and that detail you moved into `references/` still gets reached. The second is how you know progressive disclosure is working rather than just shrinking the file.

The `skill-creator` plugin automates the with/without comparison:

```
/plugin install skill-creator@claude-plugins-official
```

## Before you push

```bash
pnpm validate
```

Checks layout depth, frontmatter spec compliance, description budget, body size, and that every `references/` file is actually pointed at from its `SKILL.md`.

## Sources

- [Agent Skills specification](https://agentskills.io) — the six-key frontmatter contract and progressive disclosure
- [Best practices for skill creators](https://agentskills.io/skill-creation/best-practices)
- [Evaluating skill output quality](https://agentskills.io/skill-creation/evaluating-skills)
- [Claude Code skills documentation](https://code.claude.com/docs/en/skills) — discovery paths, listing budget, `context: fork`
