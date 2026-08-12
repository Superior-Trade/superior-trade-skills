#!/usr/bin/env bash
# Finish ClawHub publish of the 12 remaining skills via explicit `clawhub publish`
# (sync is blocked by an ambiguous-slug error on generic names). Respects the
# 5-new-skills/hour cap by sleeping and retrying the same skill on rate-limit.
REPO="C:/Users/user/Desktop/superior/_clones/superior-skills"
LOG="$REPO/clawhub-finish.log"
cd "$REPO" || exit 1

# name:version  (new skills use frontmatter version; the two UPDATES exceed their registry version)
REMAINING="
grid-trading:1.5.4
polymarket:1.2.2
intelligence:0.1.0
large-fill-pressure:0.1.0
mean-reversion:0.2.0
probability-mean-reversion:0.1.0
probability-momentum:0.1.0
regime-overlay:0.1.0
related-market-spread:0.1.0
scalping:0.1.0
superior-trade-hyperliquid:4.5.0
trade-thesis:0.1.0
"
echo "=== finish loop started $(date) ===" >> "$LOG"
for pair in $REMAINING; do
  name="${pair%%:*}"; ver="${pair##*:}"
  while true; do
    out=$(clawhub publish "skills/$name" --version "$ver" --changelog "Per-skill packaging migration" 2>&1)
    if echo "$out" | grep -qi 'Published'; then
      echo "OK   $name@$ver $(date)" >> "$LOG"; break
    elif echo "$out" | grep -qi 'rate limit'; then
      echo "WAIT $name (rate limit) $(date)" >> "$LOG"; sleep 3900; continue
    else
      echo "ERR  $name: $(echo "$out" | tr '\n' ' ' | head -c 300)" >> "$LOG"; break
    fi
  done
done
echo "=== finish loop done $(date) ===" >> "$LOG"
