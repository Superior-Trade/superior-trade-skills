# Unified API Skills Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Synchronize the finalized Unified API skill package into the public `Superior-Trade/superior-skills` repository and open a validated pull request.

**Architecture:** Treat `superior-turborepo/tools/superior-skills` as the package source and mirror its tracked package files into an isolated public-repository worktree. Preserve Git metadata and the design/plan records, adapt the monorepo-only migration link, and use the Unified OpenAPI snapshot plus endpoint audit to enforce the published API surface.

**Tech Stack:** Markdown Agent Skills, Node.js test runner, ECMAScript modules, pnpm, Git, GitHub CLI

---

### Task 1: Prove the public baseline lacks the Unified endpoint checks

**Files:**
- Create: `scripts/audit-endpoints.test.mjs`
- Create: `scripts/endpoint-claims.mjs`

- [ ] **Step 1: Add the already-reviewed regression test and parser**

```bash
rsync -a /Users/trmaphi/source/superior-trade/worktrees/unified-superior-skills/tools/superior-skills/scripts/audit-endpoints.test.mjs scripts/audit-endpoints.test.mjs
rsync -a /Users/trmaphi/source/superior-trade/worktrees/unified-superior-skills/tools/superior-skills/scripts/endpoint-claims.mjs scripts/endpoint-claims.mjs
```

- [ ] **Step 2: Run the test against the legacy public tree**

```bash
node --test scripts/audit-endpoints.test.mjs
```

Expected: FAIL because the public tree lacks the Unified `references/` package and endpoint-audit implementation. This proves the synchronized behavior is absent.

### Task 2: Mirror the finalized Unified API package

**Files:**
- Modify: `README.md`, `SKILL.md`, `AUTHORING.md`, `package.json`, `.turbo-upstream.json`
- Modify: `scripts/audit-endpoints.mjs` and affected `skills/**`
- Create: `scripts/api-contract/unified.json`, `references/unified-runtime.md`
- Delete: `scripts/api-contract/agent-skill.json`, `scripts/api-contract/v2.json`, `scripts/api-contract/v3.json`

- [ ] **Step 1: Mirror package-owned files**

```bash
rsync -a --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='docs' \
  /Users/trmaphi/source/superior-trade/worktrees/unified-superior-skills/tools/superior-skills/ \
  /Users/trmaphi/source/superior-trade/worktrees/sync-unified-api-skills/
```

Expected: package-owned content matches the finalized source; Git metadata and `docs/superpowers/` remain intact; legacy contract snapshots are deleted.

- [ ] **Step 2: Adapt the public migration link**

Change `[full migration guide](../../apps/docs/content/en/reference/migration.md)` to `[full migration guide](https://docs.superior.trade/reference/migration)`.

- [ ] **Step 3: Run the focused regression suite**

```bash
node --test scripts/audit-endpoints.test.mjs
```

Expected: 5 tests pass, including legacy-guidance rejection and comparison-table validation.

- [ ] **Step 4: Validate the complete package**

```bash
pnpm validate
```

Expected: all Node tests pass; 30 skills validate; 46 documented endpoint claims resolve against 46 Unified routes; zero errors and zero warnings.

### Task 3: Review and commit the synchronized tree

**Files:**
- Review: complete branch diff against `origin/main`

- [ ] **Step 1: Confirm content and boundaries**

```bash
rg -n "Unified API migration|legacy-api-comparison:start|single migration prompt" README.md
test -f scripts/api-contract/unified.json
test ! -e scripts/api-contract/v2.json
test ! -e scripts/api-contract/v3.json
test ! -e scripts/api-contract/agent-skill.json
git diff --check
git status --short
```

Expected: migration content is present, only the Unified contract snapshot remains, and the diff has no whitespace errors.

- [ ] **Step 2: Review the final diff**

```bash
git diff --stat origin/main...HEAD
git diff --stat
git diff -- README.md package.json scripts/audit-endpoints.mjs scripts/audit-endpoints.test.mjs scripts/endpoint-claims.mjs
```

Expected: changes are limited to the approved design/plan and synchronized package.

- [ ] **Step 3: Commit the synchronized package**

```bash
git add -A
git commit -m "refactor(skills): migrate public package to Unified API"
```

### Task 4: Publish the pull request and request review

**Files:**
- No repository file changes

- [ ] **Step 1: Re-run committed-tree verification**

```bash
pnpm validate
git diff --check origin/main...HEAD
git status --short --branch
```

Expected: validation passes, the committed diff has no whitespace errors, and the worktree is clean.

- [ ] **Step 2: Push and open the PR**

```bash
git push -u origin codex/sync-unified-api
gh pr create --repo Superior-Trade/superior-skills --base main --head codex/sync-unified-api --title "refactor(skills): migrate public package to Unified API" --body-file /tmp/superior-skills-unified-api-pr.md
```

The PR body summarizes the Unified-only migration, README single migration prompt and operation table, updated evals/audit, verification evidence, risk, and source monorepo PR.

- [ ] **Step 3: Request core review**

Request `Superior-Trade/core` when GitHub exposes it as assignable; otherwise request an individual core collaborator and report any permission limitation.
