# Testing

**Unit tests for logic and declarations, browser tests for the canvas,
parity tests for anything spelled twice.**

## Two suites

| Suite       | Files                                                  | Runner                                             | Runs where                                                             |
| ----------- | ------------------------------------------------------ | -------------------------------------------------- | ---------------------------------------------------------------------- |
| unit        | `packages/**/src/__tests__/**/*.unit.spec.ts`          | vitest, happy-dom (some packages use browser mode) | `yarn test:unit`, or one package from where its config expects (below) |
| integration | `packages/integration-test/src/__tests__/**/*.spec.ts` | vitest browser mode, Playwright chromium, serial   | `yarn test:integration`                                                |

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

Every spec file runs in ONE shared page (`isolate: false`): what a spec leaves
behind — a docked panel, a zoom, a scroll, a granted permission — is the next
spec's starting point. Hence:

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
  `commands.systemClipboard(false)` in a `finally`, so the rest of the suite
  runs without it. These browser commands are declared in
  `packages/integration-test/vitest.config.ts`.

## Parity and coverage tests

Whenever one thing is spelled in two places, a test holds them equal:

- `templates-parity.unit.spec.ts` (per framework): every palette entry
  re-runs its command and produces the same snapshot.
- `commands-manifest.unit.spec.ts`: the hand-committed manifest equals the
  projection of the descriptors, row for row.
- `registry.unit.spec.ts` (in `affine/all`): every framework has a
  descriptor, every command an icon key, every chord its owner's prefix, no
  sub-menu over the cap.
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

## Manual verification in the playground

`yarn dev`, then open the entry you need. To drive the editor from the
console: `window.doc`, `window.editor.std`, and commands via
`getRegisteredCommands(std)` then `descriptor.run(std, {})`. UI lives in
shadow DOM for widgets: query through `shadowRoot`, or use Playwright.

Next: [05-release.md](05-release.md).
