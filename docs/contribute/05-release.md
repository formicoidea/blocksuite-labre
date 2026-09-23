# Release

**Version from the changesets, commit, build the bundles, publish. Manual,
local, idempotent.**

There is no release workflow in CI. A maintainer with npm publish rights on
`@formicoidea` runs it.

## 1. Version

On an up-to-date `blocksuite-labre-main`:

```bash
yarn ci:version
```

This consumes every file in `.changeset/`, bumps **all** `@labre/*` packages
together (they are a fixed group) by the **highest bump the pending
changesets declare** (SemVer: `patch` < `minor` < `major`), writes the
`CHANGELOG.md` files and re-runs `yarn install`. It does not commit and does
not publish. Review the diff; a new package's untracked `CHANGELOG.md` must
be added.

Do not hand-edit the version. If the number looks wrong, the changeset is
wrong: fix the changeset (see the bump table in
[02-workflow.md](02-workflow.md)), then run `ci:version` again.

```bash
git commit -am "chore: version packages (x.y.z)"
git push
```

## 2. Publish

```bash
npm whoami          # must answer your npm user; a 401 here is the usual blocker
yarn ci:publish
```

`ci:publish` runs `build:packages`, then `build:bundles`
(`scripts/build-bundles.mjs` generates the `@formicoidea/*` packages into the
git-ignored `dist-bundles/`, `scripts/compile-bundles.mjs` compiles them and
rewrites import specifiers so Node resolves them), then
`scripts/publish-bundles.mjs latest`. A bundle whose version is already on
the registry is skipped, so re-running is safe. Each generated bundle gets a
copy of the root `LICENSE` (npm packs it whatever `files` says), and
`publish-bundles.mjs` refuses to publish a bundle whose directory has none.

## Traps

- **npm masks an expired token as a 404.** `npm publish` on a scoped package
  returns "404 Not Found" and never prompts. Run `npm login`, check
  `npm whoami`, retry.
- **Do not bump the host's range before the version exists** on the
  registry; its install breaks.
- **The bundle compiler has an audit** for extensionless or directory
  imports. A failure there is real: the published output would not load
  under Node.
- **Canary**: `yarn ci:version:canary` and `yarn ci:publish:canary` publish
  under the `canary` tag for a host to try a branch.

## What a release contains

| Bundle                                                      | Built from                                                                       |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `@formicoidea/labre-core`                                   | every package except the business frameworks, source-vendored under `src/_pkgs/` |
| `@formicoidea/labre-framework-<id>`                         | one framework package each; depends on the exact core version                    |
| `@formicoidea/labre-ddd-shared`, `-framework-ddd-aggregate` | shared DDD helpers and the DDD template categories                               |

The framework list the build script reads is `packages/affine/all/src/frameworks.ts`.
It must stay data-only (no Lit import) so the script can load it.

## After publishing

- `yarn i18n:manifest <version>.csv` writes the whole translation-key manifest
  as `key,fallback,domain`, sorted — `diff` it against the previous release's
  file to hand the host exactly the keys it has to translate.
- Tell the host maintainers the version and the changelog highlights.
- The Labre app bumps its ranges and runs its upgrade checklist
  ([integrate/07-upgrade.md](../integrate/07-upgrade.md)).

Next: [06-decisions.md](06-decisions.md).
