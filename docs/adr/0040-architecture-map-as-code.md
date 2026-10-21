# ADR 0040 — The library publishes its architecture map, generated from the code

- Status: **accepted** (2026-10-21)
- Deciders: Mathieu Jolly (likeC4 study, 2026-10-21)
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

Three needs follow for the library:

- **A map nobody maintains.** Only a map generated from the imports and
  checked against them in CI stays true; a hand-drawn one is wrong by the next
  PR.
- **A map a host can read without the sources.** Hosts consume compiled
  bundles, so they cannot rebuild the library's map, and they must not need
  to: the library's map is useful on its own (principle 17, no privileged
  consumer).
- **A visible structure.** "Four layers, one direction" and "no framework
  imports another" are written rules that no tool checks today; a generated
  graph makes a breach show in a PR diff, and a guard test can assert them.

[likeC4](https://likec4.dev) fits: a text model (`.c4`) the code can
generate, `likec4 validate`, a static site, a React component a host embeds
without a server, multi-project import, and an MCP server agents can query.

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
