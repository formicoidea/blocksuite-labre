# Building and testing

Short version. The full contributor guide is in
[docs/contribute/](docs/contribute/01-setup.md).

## Requirements

Node `>=18.19 <23` and Yarn 4 (pinned by `packageManager`; Corepack picks
it up).

## Install and run

```bash
yarn install --immutable
yarn dev
```

The playground opens on `http://localhost:5173`:

- `/starter/?init` a fresh document in page mode
- `/starter/?init&mode=edgeless` the whiteboard
- `/starter/?init&room=hello` and, in a second tab, `/starter/?room=hello`:
  two editors syncing through a broadcast channel

The playground imports the packages from source, so edits reload live.

## Build

```bash
yarn build            # tsc -b on the whole workspace, tests included
yarn build:bundles    # generate and compile the @formicoidea/* bundles into dist-bundles/
```

## Test

```bash
yarn test:unit                                  # every unit suite
yarn test:integration                           # browser suite (chromium, serial)
npx vitest run --config packages/affine/gfx/wardley/vitest.config.ts roles   # one package, one filter
```

A package whose `vitest.config.ts` sets `test.root: './packages/…'` runs from
the repo root with `--config`, as above; one without `test.root` runs from its
own directory (`cd packages/affine/all && npx vitest run registry`). The wrong
place finds no files; the list is in `docs/contribute/01-setup.md`. Run `yarn test:unit` on its
own: a concurrent `tsc -b` starves the browser-mode projects. The first
integration run needs `npx playwright install`.

## Format

```bash
yarn lint:format      # prettier --check
yarn format           # prettier --write
```

Prettier is the only formatter. The pre-commit hook runs it on staged files.

## Commit and release

Conventional commits with a closed scope list (`page`, `edgeless`,
`database`, `blocks`, `store`, `sync`, `std`, `presets`, `playground`,
`inline`, `lit`, `examples`); one changeset per user-facing change
(`yarn changeset`). Releases are manual: `yarn ci:version`, commit,
`yarn ci:publish`. See [docs/contribute/02-workflow.md](docs/contribute/02-workflow.md)
and [docs/contribute/05-release.md](docs/contribute/05-release.md).
