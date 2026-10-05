# Workflow

**Branch from `blocksuite-labre-main`, one issue per pull request, a
conventional commit, a changeset, a squash merge.**

## Branches

- `blocksuite-labre-main` is the integration and release branch. Every
  feature branch starts from it and every pull request targets it.
- `main` is dead: it is the old mirror of upstream. A PR against it shows
  thousands of files. If that happens, `gh pr edit N --base blocksuite-labre-main`.
- `trimed-lib` is historical, dormant since June 2026. Do not branch from it.

```bash
git fetch origin
git switch -c feat/my-change origin/blocksuite-labre-main
git log -1     # confirm you are on the current tip, not a stale base
```

Sync a long-lived branch with `git merge origin/blocksuite-labre-main`. Merge
commits are fine: the squash flattens them. Avoid stacking branches on other
feature branches; a squash-merged base makes the stack conflict. A branch
chained anyway is moved onto the new tip once its base is squashed, replaying
only its own commits:

```bash
git rebase --onto origin/blocksuite-labre-main <old-base-tip> <branch>
```

A branch still checked out in another worktree refuses the rebase without any
conflict: free it there first.

## Commits

Conventional commits, checked by a hook on the message and by CI on the PR
title.

```
type(scope): subject
```

- **type**: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`, `perf`.
- **scope**, from a closed list: `page`, `edgeless`, `database`, `blocks`,
  `store`, `sync`, `std`, `presets`, `playground`, `inline`, `lit`,
  `examples`. There is no `wardley`, `bpmn` or `ddd` scope: canvas
  frameworks use `edgeless`; use `blocks` when unsure.
- **subject**: sentence-case or fully lowercase. A lowercase subject with a
  capital inside (`URL`, a class name) is rejected. Keep identifiers in the
  body.

Validate before pushing:

```bash
printf 'feat(edgeless): add the C4 board legend\n' | ./node_modules/.bin/commitlint
```

Commits made with an AI assistant end with the `Co-Authored-By` trailer the
assistant adds.

## Changesets

Every user-facing change ships with one changeset:

```bash
yarn changeset
```

Pick the packages touched, the bump, and write one or two sentences a host
developer will read in the changelog. Internal refactors and test-only
changes need none.

The bump follows Semantic Versioning and is the only place it is decided
(`yarn ci:version` applies the highest pending bump):

| Bump    | When                                          | Ask yourself                                                                                        |
| ------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `patch` | a fix; nothing a host wrote changes behaviour | "Can a host upgrade without reading the changelog?"                                                 |
| `minor` | something new; everything old still works     | "Does every existing host integration compile and behave the same?"                                 |
| `major` | a host must change its code or migrate data   | "Did I change a descriptor shape, a seam signature, a flag key, a stored format, an exported name?" |

We apply this strictly even while the version is `0.x`: a `0.x` minor never
breaks a host. If in doubt between `minor` and `major`, it is `major`.

## Pull requests

- One issue, one PR. Title obeys the commit rules.
- Body: what changed, why, how it was verified (commands and results). Link
  the ADR if one applies.
- CI runs format, typecheck, unit and integration. All green before review.
  Green means every check of the PR's HEAD commit is completed and
  successful (`gh pr view N --json statusCheckRollup`);
  `gh pr checks --watch` can return on the previous run.
- Run the whole integration suite before opening the PR, not only your spec
  ([04-testing.md](04-testing.md#writing-an-integration-test)).
- Squash merge. The PR title becomes the commit subject.
- `Closes #N` does not auto-close on a non-default branch: close the issue by
  hand after the merge.

## Review

A human reviews every PR. A change in a red zone (see [03-rules.md](03-rules.md))
needs a maintainer's explicit approval and usually an ADR.

## Local full-CI run

When CI quota is short, run locally, in this order, each alone:

```bash
yarn lint:format
yarn build
yarn test:unit
yarn test:integration
```

Next: [03-rules.md](03-rules.md).
