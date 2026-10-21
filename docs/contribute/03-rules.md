# Rules of the road

**What must never be merged without a human, what we never do, and the
conventions that keep the code uniform.**

## Red zones: human review, usually an ADR

| Zone                                                  | Why                                                                        |
| ----------------------------------------------------- | -------------------------------------------------------------------------- |
| `packages/framework/store`, `packages/framework/sync` | the Yjs document format. A bad change corrupts documents irreversibly.     |
| `packages/affine/model` (schemas, element models)     | the file format. Every document created before the change must still load. |
| License headers, MPL-2.0 obligations                  | file-level copyleft.                                                       |
| Publishing, release scripts, CI workflows             | a mistake ships to every host.                                             |
| A flag that touches content                           | forbidden outright (ADR 0009).                                             |

How to change a model safely:

- Add optional fields with an `undefined` default: `@field()` never writes
  them, so no migration and no schema bump.
- Enum-like values are append-only. Never rename or remove a value that a
  document may contain.
- Identifiers (roles, tag ids, command ids) are deprecated, never removed.
- Write the ADR first: context, decision, what stays loadable.

## Upstream policy

We do not track BlockSuite or AFFiNE. A shallow reference clone lives beside
the repo (`../AFFiNE-upstream`, editor under `blocksuite/`) for targeted
cherry-picks: security bumps, block bug fixes, renderer fixes. A monthly
triage lists upstream commits touching `blocksuite/` and skips AI, mobile,
server and app-importer work.

Never publish under `@blocksuite/*`. It belongs to the AFFiNE team.

## No privileged host

The Labre application consumes the library through the same seams as any
other host. If the app needs something, the library exposes a seam; the app
never patches library code and never imports from `store/test`.

## Language

- Code, comments, identifiers, commit messages, ADRs and documentation are
  in **English**.
- User-visible strings are never hard-coded: they are `com.labre.*`
  translation keys with an English fallback. The host provides the catalogue.

## Style

- TypeScript strict, plus `noImplicitOverride`, `noUnusedLocals`,
  `verbatimModuleSyntax`. `override` and `import type` are mandatory where
  they apply.
- Relative imports carry the `.js` suffix in `src/`. Test files under
  `__tests__` import siblings without it.
- Named exports only. No default exports in library code.
- Prettier formats everything. No ESLint.
- Every package: `"private": true`, `"type": "module"`,
  `"sideEffects": false`, `"license": "MPL-2.0"`, a hand-written `exports`
  map with narrow entries.
- No `customElements.define` at import time. Registration happens in the
  package's `effects.ts`, called from a provider's `effect()`.

## Comments

Comments explain **why**, not what. A docblock cites the issue, the PR or
the ADR that motivated the code. This repo's docblocks are long on purpose:
they are the memory of decisions.

A deliberate shortcut is marked with a `ponytail:` line naming the ceiling
and the upgrade path:

```ts
// ponytail: global lock, per-account locks if throughput matters
```

## Dependencies

Do not add a dependency for what a few lines can do. If you must, pin it,
and mention it in the PR body. A new peer-level dependency (anything a host
also imports) is a red-zone-adjacent change: it affects every host's
deduplication.

## Architecture map

The library's architecture map lives in `architecture/` and is generated
from the code, never drawn ([ADR 0040](../adr/0040-architecture-map-as-code.md)).

- `architecture/code.c4` is written by `yarn architecture`
  (`scripts/architecture.mjs`, dependency-cruiser): layers, package families,
  packages and `src/*` folders, with `uses` (package to package) and
  `imports` (folder to folder) relations titled by their count of (importing file, imported file) pairs. **Never
  edit it by hand.**
- `yarn architecture --check` exits 1 when the committed map is not what
  the code produces. Run `yarn architecture` and commit the diff: it is the
  architecture change your PR makes, and the reviewer reads it.
- On a merge conflict in `code.c4`, take either side and rerun
  `yarn architecture`; never merge it by hand.
- `architecture/model.c4` holds the element and relationship kinds and the
  views. A view includes by predicate (`include *`, `where kind is …`, a
  scope), never by naming a package, so a new package needs no edit there.
- `packages/affine/all/src/__tests__/architecture-map.unit.spec.ts` asserts
  on the map: no package cycle, no edge up a layer (framework, model,
  features, assembly, then tooling), no framework package importing another.
- Check it with `npx likec4 validate architecture`. Browsing it
  (`likec4 start`, `likec4 build`) needs `react` and `react-dom` 19.3 beside
  likeC4, which this repo does not install: run likeC4 from a directory that
  has the three and pass it this `architecture/` path.
- The likeC4 MCP server runs over stdio only, launched by an agent on a
  workstation: its `--http` mode has no authentication and is never
  deployed, exposed or run in CI.

## Definition of done for any change

1. The change does what the issue says, nothing more.
2. A test fails without it and passes with it.
3. `yarn build`, `yarn lint:format`, the relevant unit suite, and the
   integration suite if the canvas is touched.
4. A changeset if a host can see the change.
5. The docs updated if a rule, a seam or a flag changed.

Next: [04-testing.md](04-testing.md).
