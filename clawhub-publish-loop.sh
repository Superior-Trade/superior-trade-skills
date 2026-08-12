#!/usr/bin/env bash
# Finish the ClawHub publish despite the 5-new-skills/hour cap.
# Runs `clawhub sync --all` every ~65 min until nothing is left to upload.
SKILLS="C:/Users/user/Desktop/superior/_clones/superior-skills/skills"
LOG="C:/Users/user/Desktop/superior/_clones/superior-skills/clawhub-publish.log"
cd "$SKILLS" || exit 1
echo "=== loop started $(date) ===" >> "$LOG"
for i in $(seq 1 7); do
  echo "--- batch $i $(date) ---" >> "$LOG"
  clawhub sync --all --changelog "Per-skill packaging migration" >> "$LOG" 2>&1
  pending=$(clawhub sync --dry-run 2>&1 | grep -cE '^- .*(NEW|UPDATE)')
  echo "pending after batch $i: $pending" >> "$LOG"
  if [ "$pending" -eq 0 ]; then
    echo "=== all published, done at batch $i $(date) ===" >> "$LOG"
    break
  fi
  sleep 3900
done
echo "=== loop finished $(date) ===" >> "$LOG"
