# Unified API Skills Sync Design

## Goal

Publish the finalized Unified API migration from
`superior-turborepo/tools/superior-skills` to the public
`Superior-Trade/superior-skills` repository.

## Scope

- Mirror the source package's skill instructions, references, evaluations,
  validation scripts, API contract snapshot, and root documentation.
- Remove public files made obsolete by the Unified API migration, including the
  legacy v2, v3, and agent-skill contract snapshots.
- Preserve public-repository metadata and files that are not owned by the
  monorepo package.
- Adapt links that only work inside the monorepo. In particular, the README's
  migration-guide link must point to the public documentation site.
- Do not copy `apps/docs`; those documentation changes remain in the monorepo.

## Sync Method

Use a file-level mirror from the finalized monorepo package into an isolated
public-repository worktree. Compare the resulting tree against public `main`,
then review destination-specific differences before committing.

This is preferred over cherry-picking monorepo commits because the repositories
have different roots and history, and over selecting files manually because a
partial copy could leave legacy API guidance behind.

## Validation

- Run the public repository's full `pnpm validate` command.
- Confirm the endpoint audit accepts only Unified API routes outside the marked
  historical migration table.
- Confirm the README migration prompt and previous-to-Unified comparison table
  are present and its public documentation link resolves to the intended URL.
- Inspect the complete diff for accidental repository metadata changes,
  unintended generated files, and stale v2/v3 API guidance.

## Delivery

Commit the synchronized package on a branch from public `main`, push it, open a
pull request to `main`, and request review from the repository's core team when
GitHub permits it.
