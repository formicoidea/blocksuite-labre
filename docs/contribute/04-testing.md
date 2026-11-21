# Testing

**Unit tests for logic and declarations, browser tests for the canvas,
parity tests for anything spelled twice.**

## Two suites

| Suite       | Files                                                  | Runner                                                         | Runs where                                                             |
| ----------- | ------------------------------------------------------ | -------------------------------------------------------------- | ---------------------------------------------------------------------- |
| unit        | `packages/**/src/__tests__/**/*.unit.spec.ts`          | vitest, happy-dom (some packages use browser mode)             | `yarn test:unit`, or one package from where its config expects (below) |
| integration | `packages/integration-test/src/__tests__/**/*.spec.ts` | vitest browser mode, Playwright chromium, serial, two sessions | `yarn test:integration`                                                |

One unit package runs from the repo root, with `--config`, when its
`vitest.config.ts` sets `test.root: './packages/…'`, and from its own
directory when it does not; the wrong place finds no files. Commands and the
list of which is which: [01-setup.md](01-setup.md#tests).

## What to test where

| Change                                                            | Test                                                                                                |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| a declaration (roles, commands, rules, presets, templates)        | unit: assert the data, and the parity with what derives from it                                     |
| a pure function (parser, exporter, geometry, hit-test)            | unit: inputs and outputs, edge cases, a fixture from `__tests__/corpus/`                            |
| a store watcher or cascade                                        | unit: drive `elementUpdated` with `local: true` and `local: false`                                  |
| something a user sees on the canvas (selection, toolbar, drawing) | integration: mount the editor, act, read the DOM or the store                                       |
| a keyboard path                                                   | integration: the dispatcher needs real events; synthetic keydowns in the playground do not drive it |
| a gesture watched mid-way (a drag's ghost, its drop line)         | integration: Playwright's mouse a step at a time, `__tests__/utils/pointer.ts`                      |
| performance                                                       | a budget test in the unit suite, asserting a number (`FRAME_BUDGET_MS = 16`)                        |

## Writing a unit test

```ts
import { describe, expect, it } from 'vitest';
import { WARDLEY_NUDGES } from '../nudges';

describe('the quality checklist', () => {
  it('ships the four nudges, in order, namespaced to wardley', () => {
    expect(WARDLEY_NUDGES.map(n => n.id)).toEqual([
      'wardley.q1-title',
      'wardley.q2-context',
      'wardley.q3-legend',
      'wardley.q4-evolution-axis',
    ]);
  });
});
```

- The file starts with a docblock saying **why the spec exists**: which
  regression it pins, which rule it enforces.
- `describe` and `it` names read as sentences about intent.
- Fixtures live next to the spec in `corpus/`; stubs are explicit files
  (`canvas-stub.ts`), not inline mocks.

## Writing an integration test

```ts
import { beforeEach, expect, test } from 'vitest';
import { setupEditor } from '../utils/setup.js';

beforeEach(async () => {
  const cleanup = await setupEditor('edgeless');
  return cleanup;
});

test('a board is picked by its border', () => {
  const surface = window.doc.getBlocksByFlavour('affine:surface')[0];
  …
});
```

Globals `window.doc` and `window.editor` are set by the setup. Keep
`--no-file-parallelism`; the suite is load-sensitive and retries on CI.

`yarn test:integration` runs two browser sessions one after the other
(`scripts/test-integration.mjs`, Vitest `--shard=1/2` then `--shard=2/2`);
both always run and the command fails when either did. Extra arguments go to
both sessions, so a filter that lands in one leaves the other with no file:
that session prints "No test files found, exiting with code 1" yet exits 0
(Vitest 3.1.3 applies the shard after finding the files), while a filter that
matches no file at all fails.

Every spec file of a session runs in ONE shared page (`isolate: false`): what
a spec leaves behind — a docked panel, a zoom, a scroll, a granted permission
— is the next spec's starting point. Vitest sorts the files by a hash of
their path relative to the package and cuts the list at ceil(n/2), so adding
one spec moves at most one existing file to the other session, where it has
new neighbours. The paths are normalised to forward slashes, so Windows and
Linux get the same halves: a local run reproduces CI's sessions. Hence:

- **Run the whole suite before a PR**, not only your spec: a spec that passes
  alone can fail after another one.
- **Never press "the middle of the canvas".** `dragModel(edgeless, model)`
  (`__tests__/utils/canvas-gesture.ts`, options `alt` and `dx`) selects the
  default tool, sets zoom 1, moves the model's centre under an on-screen point clear
  of the edges and of a pane docked on the left, checks that the canvas
  answers that model there, then drags it with the real mouse.
- **A gesture watched mid-way** (a drag's ghost, its drop line) uses
  `pointerMoveTo(selector, fx, fy, steps)`, `pointerDown()` and `pointerUp()`
  from `__tests__/utils/pointer.ts`: Playwright's mouse a step at a time,
  where `userEvent.dragAndDrop` does it all in one call.
- **A real copy then paste** needs the clipboard permission Chromium denies by
  default: `await commands.systemClipboard(true)` before, and
  `commands.systemClipboard(false)` in a `finally`, so the rest of the
  session runs without it. These browser commands are declared in
  `packages/integration-test/vitest.config.ts`.

## Parity and coverage tests

Whenever one thing is spelled in two places, a test holds them equal:

- `templates-parity.unit.spec.ts` (per framework): every palette entry
  re-runs its command and produces the same snapshot.
- `commands-manifest.unit.spec.ts`: the hand-committed manifest equals the
  projection of the descriptors, row for row.
- `registry.unit.spec.ts` (in `affine/all`): every framework has a
  descriptor, every command an icon key, no sub-menu over the cap.
- `chord-prefixes.unit.spec.ts` (in `affine/all`): every chord on its
  owner's declared prefix, no prefix on a single-key shortcut, no shared
  prefix nobody declared (ADR 0055).
- `reading-coverage.unit.spec.ts`: mounts the real view extensions and reads
  the container back, so a deleted `context.register(…)` line fails the test.
  Importing the exported constant would not catch it.

When you add a framework, these tests fail until it is complete. That is
their job.

## Typecheck is part of the tests

CI runs `tsc -b` on the whole workspace, test files included. After adding a
test file, run `tsc -b --force <package>` so the cache does not skip it.

## Flaky

- The Wardley validation benchmark holds the best of several samples against
  16 ms; under load it still fails about one run in three. Rerun alone.
- Two integration specs fetch a dead public asset host; a ticket exists to
  vendor the fixtures.
- The integration page keeps about 6 MB per test (measured on Windows,
  2026-11-21: one session over 1341 tests, at d91150343, grew linearly to
  8.2 GB, all in the page's renderer; `setupEditor`'s cleanup removes the
  editor and three globals, nothing more). The 16 GB hosted runner died near
  the end of the suite, with no log: "The runner has received a shutdown
  signal" or "lost communication with the server"; that memory killed it is
  inferred, not measured on the runner. Two sessions halve the peak (148
  files, 1315 tests at b72177321: 4.2 GB per session); the leak is not fixed.
  Trigger: a session's peak nearing the runner's memory again (the job dying
  late without a log, or a sampled peak past about 6 GB) — add a session in
  `scripts/test-integration.mjs`, or fix the teardown.

## Manual verification in the playground

`yarn dev`, then open the entry you need. To drive the editor from the
console: `window.doc`, `window.editor.std`, and commands via
`getRegisteredCommands(std)` then `descriptor.run(std, {})`. UI lives in
shadow DOM for widgets: query through `shadowRoot`, or use Playwright.

Next: [05-release.md](05-release.md).
