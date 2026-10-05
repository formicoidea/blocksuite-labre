# Setup

**Clone, install, run the playground, run one package's tests. Ten minutes.**

## Install

```bash
git clone https://github.com/formicoidea/blocksuite-labre.git
cd blocksuite-labre
git checkout blocksuite-labre-main
yarn install --immutable
```

Node `>=18.19 <23`. Yarn 4 is pinned by `packageManager` in `package.json`;
Corepack picks it up. The install takes about three minutes; `postinstall`
installs the git hooks.

## Run the playground

```bash
yarn dev
```

Opens Vite on `http://localhost:5173`. Useful entries:

- `/starter/?init` a fresh document, page mode.
- `/starter/?init&mode=edgeless` the whiteboard.
- `/starter/?init&room=x` plus a second tab on `/starter/?room=x` to see
  collaboration through a broadcast channel.

The playground imports the packages from source: edits reload live.

## Build and typecheck

```bash
yarn build          # tsc -b on every package, playground and tests included
```

This is what CI runs. A partial `tsc -b packages/affine/gfx/wardley` may
reuse a stale `.tsbuildinfo` and skip a file you just added; use `--force`
when in doubt.

## Tests

```bash
yarn test:unit                  # every unit suite (vitest workspace)
yarn test:integration           # browser suite, chromium, serial
npx vitest run --config packages/affine/gfx/wardley/vitest.config.ts roles   # one package, one filter
cd packages/affine/all && npx vitest run registry                              # same, other kind of config
```

Where to run one package depends on its `vitest.config.ts`:

- **It sets `test.root: './packages/…'`** (every `gfx/*/vitest.config.ts`,
  `model`, `components`, `fragments/outline`,
  `blocks/{callout,code,frame,latex,note,root,surface-ref}`, `widgets/*`,
  `inlines/{latex,link}`): run it **from the repo root** with
  `--config <pkg>/vitest.config.ts`. From its own directory the root resolves
  to a path that does not exist and vitest finds no files.
- **It does not** (`affine/all`, `shared`, `blocks/surface`, `framework/*`,
  and every browser-mode config, `vitest.browser.config.ts` included): run it
  **from its package directory**. From the root, `--config` finds no files.

`yarn vitest` only works in a package that declares `vitest`; `npx vitest`
works everywhere. `--project` filters hang.

Run `yarn test:unit` alone: a concurrent `tsc -b` starves the browser-mode
projects and the vanilla-extract transforms time out.

The first integration run downloads chromium: `npx playwright install`.

## Format

```bash
yarn lint:format    # prettier --check
yarn format         # prettier --write
```

Prettier is the only formatter. There is no ESLint. The pre-commit hook runs
Prettier on staged files.

## Things that bite on a fresh checkout

- **Worktrees and CRLF.** Git worktrees created by tools often check out with
  `core.autocrlf=true`; `prettier --check` then flags every file. Check only
  your files with `prettier --check --end-of-line auto <files>`, or check the
  committed blobs. Git normalizes to LF on commit. CRLF can also break the
  declaration emit: thousands of TS1005 in one `dist/*.d.ts` come from a
  `/** */` on a property inside a `z.object({...})` literal, not from a
  transient state; write that comment with `//`
  ([lessons.md](../lessons.md) 32, guard `zod-schema-jsdoc.unit.spec.ts`).
- **Worktrees have no `node_modules`.** Run `yarn install --immutable` in
  each.
- **No `python` on some machines.** Script edits with Node.
- **The Wardley benchmark is load-sensitive.** `validation.bench.unit.spec.ts`
  asserts a 16 ms frame budget and fails about one run in three under load.
  Rerun it alone before calling it a regression.
- **Browser pane screenshots may fail** on the playground. Verify through the
  integration suite or by reading application state, not by subscribing to
  signals from the console (Vite serves a second signals-core instance).

## Layout to know

| Path                                                                | What                                   |
| ------------------------------------------------------------------- | -------------------------------------- |
| `packages/framework/`                                               | store, sync, std, global               |
| `packages/affine/model/`                                            | schemas and element models             |
| `packages/affine/{blocks,gfx,widgets,fragments,components,shared}/` | features                               |
| `packages/affine/all/`                                              | assembly, flags, framework descriptors |
| `packages/playground/`                                              | dev app                                |
| `packages/integration-test/`                                        | browser tests                          |
| `scripts/`                                                          | bundle build and publish               |
| `docs/adr/`                                                         | decisions                              |
| `.changeset/`                                                       | pending release notes                  |

Next: [02-workflow.md](02-workflow.md).
