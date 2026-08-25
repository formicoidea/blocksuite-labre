# ADR 0001 — Assumed divergence from BlockSuite upstream

- Status: accepted (June 2026)
- Deciders: Mathieu Jolly

## Context

This repo forked the BlockSuite mirror ~mid-2025 to build Wardley/EDGY
whiteboard tooling. Upstream development moved into the AFFiNE monorepo
(`toeverything/AFFiNE`, `blocksuite/` directory). A June 2026 study
(autoDevFactory `docs/etude-affine-upstream.md`) measured the drift: upstream
went 0.22.4 → 0.26.3 with **no structural reorganization** (same packages,
same 20 blocks, same registration mechanism, same telemetry service).

## Decision

We own this code and do not track upstream. A shallow reference clone
(`..\AFFiNE-upstream`) is kept for **targeted cherry-picks only** (security
dependency bumps, block bug fixes, turbo-renderer improvements). A periodic
"upstream diff" check (monthly, eventually an agent in the factory) watches
for cherry-pick candidates.

## Consequences

- We can simplify and specialize aggressively (flags registry, telemetry
  taxonomy, framework modules) without merge debt.
- Security fixes must be back-ported deliberately — nobody does it for us.
- Packages must be renamed before publication: `@blocksuite/*` belongs to
  the AFFiNE team; ours publish under `@labre/*`.

## Upstream watch (added 2026-08-26)

The monthly check promised above is one command (last triage: 2026-08-26,
covering 2025-07-07 → 2026-08-24, harvested on branch
`upstream-harvest-2026-08`):

```sh
gh api --paginate "repos/toeverything/AFFiNE/commits?path=blocksuite&since=<last-triage-date>&per_page=100" \
  --jq '.[] | [.commit.author.date[0:10], (.commit.message | split("\n")[0])] | @tsv'
```

Triage rules: skip AI/copilot, comments, mobile/iOS/Android, server,
app-level importers and upstream toolchain; check every remaining fix
against our tree before porting (our files may have diverged or already
carry the fix). Fetch a PR's exact patch with
`gh api repos/toeverything/AFFiNE/pulls/<PR>/files`. The reference clone
lives at `..\AFFiNE-upstream` (sparse checkout of `blocksuite/`); refresh it
with `git -C ..\AFFiNE-upstream pull`.
