# ADR 0040 — The library publishes its architecture map, generated from the code

- Status: **proposed** (2026-10-21)
- Deciders: Mathieu Jolly (likeC4 study and spike, 2026-10-21)
- **Red zone**: this ADR announces two red-zone changes, each in its own PR
  with a maintainer's explicit approval: a job in `.github/workflows/test.yml`
  and a copy step in `scripts/build-bundles.mjs`. No stored format, schema or
  model changes; every document reads and writes exactly what it did before.
- Related ADRs: [0001](0001-assumed-divergence-from-upstream.md) (assumed
  divergence: the map measures it), [0009](0009-reversed-flag-contract.md)
  (flags are not part of the map).

## Context

The Labre app draws its architecture by hand (a C4 level-2 SVG in its admin,
with a geometry linter). It knows nothing below the container level and
drifts with every PR. The product owner wants the diagram to be "the code
seen at a more abstract scale": zoomable from the system to a source folder,
every element backed by code, never declared by hand.

A throwaway spike (draft PR #506, 2026-10-21) generated a
[likeC4](https://likec4.dev) model from `packages/**` with a 200-line import
scanner, then validated, built and queried it:

- 85 packages, 396 `src/*` folders, 3343 folder edges; `likec4 validate`
  green; static site built in 38 s; drift check by regeneration in memory.
- "Four layers, one direction" holds: no package cycle, no upward edge, no
  framework module importing another. The same generator run on
  `toeverything/AFFiNE` `blocksuite/` (commit 0b69a6d, 2026-10-11) found 7
  upward `import type` edges closing a 65-package cycle there: the layering
  is a property of this fork, and nothing guards it today.
- The likeC4 MCP server (`likec4 mcp --stdio`) answered structural questions
  in milliseconds (blast radius of `store`, direct `yjs` importers, parity of
  `gfx/wardley` and `gfx/edgy`).
- Traps measured: likeC4 reserves ids (`model`, `icons`, `apps`…); tools do
  not aggregate folder edges to packages; `query-graph` truncates at 100
  results silently; barrel `index.ts` files create fake folder cycles; a
  60-package view times out a PNG export.

The library is consumed as compiled bundles, so a host cannot rebuild this
map from source, and a host must not need to: the map of the library is
useful on its own (principle 17, no privileged consumer).

## Decision

1. The library owns its map in `architecture/`: `model.c4` (specification,
   hand-written views that include by predicate, never by list) and
   `code.c4`, generated, never edited by hand.
2. `code.c4` is generated from the code by `dependency-cruiser` (it tells
   `import type` from runtime imports), through `scripts/architecture.mjs`.
   The hierarchy is the repository's only: layer, package, `src/*` folder.
   No tag, no domain, no hand-placed element.
3. Relations come at two grains, each with its own kind: `uses` package to
   package and `imports` folder to folder, with the import count as title.
   Every package and folder carries a `link` to its directory and `path` and
   `files` metadata. Reserved ids are suffixed with `_`; files that only
   re-export are skipped.
4. `yarn architecture` regenerates; `yarn architecture --check` exits 1 when
   the committed `code.c4` is not what the code produces. `test.yml` runs
   `--check` and `likec4 validate` (separate PR, red zone).
5. `scripts/build-bundles.mjs` copies `architecture/*.c4` into the
   `labre-core` bundle under `architecture/` (separate PR, red zone). Hosts
   import it as a likeC4 project named `blocksuite`; no host regenerates it.
   The first bundle to carry it is 0.56.
6. The likeC4 MCP server runs over stdio only, launched by an agent on a
   workstation. Its `--http` mode has no authentication: it is never
   deployed, exposed or added to any CI job.
7. A business-domain overlay, when it comes, is scored metadata written by a
   weekly agent routine in a PR, never a blocking gate and never a hierarchy.

## Consequences

- A PR that adds, moves or rewires a package shows its architecture diff in
  `code.c4`; the reviewer reads three new edges instead of guessing them.
- The layering and the absence of package cycles become checkable: a guard
  test can assert them on the generated graph (a follow-up, not this ADR).
- `likec4` and `dependency-cruiser` become dev dependencies of the root
  workspace only; nothing in `packages/*` imports them, no bundle depends on
  them at runtime.
- Every bundle release ships the map of the version it is, so a host's map
  always says which library version runs.
- Cherry-picks from upstream that bring back `import type` from
  `@blocksuite/affine/...` now show as an upward edge in the diff.
- Contributors respect: never edit `code.c4`; a hand view includes by
  predicate; run `yarn architecture` when `--check` fails.

## Amendments
