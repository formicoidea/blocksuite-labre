/**
 * One drag-to-reorder for the side panels (ADR 0034).
 *
 * Why it exists: the frame panel and the selection pane each wrote their own
 * drag, and the two drifted — mouse events against pointer events, a
 * read-only document refused by one only, a drop line drawn at 0 after the
 * last card, Escape swallowed by one and ignored by the other. Only the
 * threshold was shared; a comment ("the frame panel's model") held the rest
 * together, and nothing failed when it stopped being true. Both panels now
 * run on `createPanelReorderDrag` (`@labre/affine-shared/utils`).
 *
 * This spec reads the SHIPPED sources (like the translation guards, through
 * `translations/source-files.ts`) and fails the day a panel grows its own
 * gesture again: both panels import the controller, the threshold is applied
 * in the controller alone, neither panel listens to pointer or mouse moves
 * itself, and the frame panel's old drag stays deleted.
 *
 * Out of scope on purpose: the presentation toolbar's order menu
 * (`blocks/frame/src/present/frame-order-menu.ts`) keeps its own gesture in
 * its popover, with a `ponytail:` line saying when it joins.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  allSourceFiles,
  ROOT,
  sourceFiles,
  toRepoRelative,
} from './translations/source-files.js';

const FRAME_PANEL_BODY =
  'packages/affine/fragments/frame-panel/src/body/frame-panel-body.ts';
const SELECTION_PANE =
  'packages/affine/widgets/edgeless-toolbar/src/selection-pane/selection-pane-widget.ts';
const CONTROLLER = 'packages/affine/shared/src/utils/panel-reorder-drag.ts';

const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

/** `import { …name… } from 'module'`, the braces spanning lines or not. */
function importsFrom(source: string, name: string, module: string): boolean {
  const pattern = new RegExp(
    `import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*'${module}'`
  );
  return pattern.test(source);
}

describe('the side panels share one reorder drag', () => {
  it.each([
    ['the frame panel', FRAME_PANEL_BODY],
    ['the selection pane', SELECTION_PANE],
  ])('%s runs on createPanelReorderDrag', (_, path) => {
    expect(
      importsFrom(
        read(path),
        'createPanelReorderDrag',
        '@labre/affine-shared/utils'
      )
    ).toBe(true);
  });

  it('the drag threshold is applied in the controller alone', () => {
    const callers = allSourceFiles()
      .filter(file => /\bpanelDragStarted\(/.test(readFileSync(file, 'utf8')))
      .map(toRepoRelative)
      // The declaration itself is not a call.
      .filter(file => !file.endsWith('styles/panel-header.ts'));
    expect(callers).toEqual([CONTROLLER]);
  });

  it.each([
    'packages/affine/fragments/frame-panel/src',
    'packages/affine/widgets/edgeless-toolbar/src/selection-pane',
  ])('no panel file under %s listens to moves itself', dir => {
    const own = sourceFiles(join(ROOT, dir)).filter(file =>
      /addEventListener\(\s*['"](pointermove|mousemove)['"]|\bon\([^,]+,\s*['"](pointermove|mousemove)['"]/.test(
        readFileSync(file, 'utf8')
      )
    );
    expect(own.map(toRepoRelative)).toEqual([]);
  });

  it('the frame panel’s old drag stays deleted', () => {
    expect(
      existsSync(
        join(ROOT, 'packages/affine/fragments/frame-panel/src/utils/drag.ts')
      )
    ).toBe(false);
  });
});
