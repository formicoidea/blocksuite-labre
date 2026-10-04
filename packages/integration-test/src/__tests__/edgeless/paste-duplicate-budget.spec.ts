/**
 * Duplicating a large selection must not freeze the page.
 *
 * Production (lib 0.43.1): duplicating N canvas elements cost about 21 ms per
 * element and grew faster than linearly — 420 elements froze the tab for
 * 8.8 s, 840 for 19.9 s. This spec duplicates a realistic board — a frame
 * holding 400 shapes, a few of them grouped — through the real `duplicate()`
 * path (clone, paste command, frame adoption, selection, fit to viewport).
 *
 * Measured on the reference machine, best of three, 406 elements:
 * 8.7 s before (21.4 ms/element), 4.7 s once the paste was one transaction,
 * about 0.7 s after this budget's fixes (1.8 ms/element) — the paint of the
 * next frame adds some 30 ms, so what remains is model work, not rendering.
 *
 * The budget is set well above that, so a loaded runner does not trip it,
 * and well below the 4.7 s, so the quadratic paths it guards do. It is the
 * BEST sample that is asserted: a burst of load inflates the others and not
 * the claim. A load-sensitive bench is rerun alone before it is called a
 * regression (docs/lessons.md 23 and 31).
 *
 * One undo must remove the whole duplicate. The undo manager merges the
 * paste's transactions while each ends within its capture window, so a slow
 * transaction after the first would split the step: this is where a
 * regression of that kind shows.
 */
import {
  duplicate,
  type EdgelessRootBlockComponent,
} from '@labre/affine/blocks/root';
import { createGroupFromSelectedCommand } from '@labre/affine/gfx/group';
import { ShapeType } from '@labre/affine/model';
import type { BlockStdScope } from '@labre/std';
import type { GfxModel } from '@labre/std/gfx';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/** Shapes on the board, grouped ones included. */
const SHAPES = 400;
/** Groups of four shapes among them. */
const GROUPS = 5;
const SAMPLES = 3;
/** For the 406 elements, frame included, until the paint of the next frame. */
const BUDGET_MS = 2_500;

const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));

describe('duplicating a large selection', () => {
  let edgeless!: EdgelessRootBlockComponent;
  let service!: EdgelessRootBlockComponent['service'];
  let std!: BlockStdScope;

  beforeEach(async () => {
    sessionStorage.removeItem('blocksuite:prop:record');
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    service = edgeless.service;
    std = edgeless.std;
    return cleanup;
  });

  async function buildBoard() {
    const frameId = service.crud.addBlock(
      'affine:frame',
      { xywh: '[-50,-50,4100,2500]' },
      service.surface.id
    )!;
    await wait();

    const ids = Array.from({ length: SHAPES }, (_, i) =>
      service.crud.addElement('shape', {
        shapeType: i % 2 ? ShapeType.Rect : ShapeType.Ellipse,
        xywh: `[${(i % 25) * 160},${Math.floor(i / 25) * 150},120,100]`,
      })
    ) as string[];
    await wait();

    for (let g = 0; g < GROUPS; g++) {
      service.gfx.selection.set({
        elements: ids.slice(g * 4, g * 4 + 4),
        editing: false,
      });
      std.command.exec(createGroupFromSelectedCommand);
    }
    await wait();

    return window.doc.getBlock(frameId)!.model as GfxModel;
  }

  test(`${SHAPES} shapes, ${GROUPS} groups and their frame`, async () => {
    const frame = await buildBoard();
    const count = () => service.gfx.layer.canvasElements.length;
    const before = count();
    expect(before).toBe(SHAPES + GROUPS);

    const settledMs: number[] = [];
    const paintedMs: number[] = [];

    for (let i = 0; i < SAMPLES; i++) {
      std.store.captureSync();
      const start = performance.now();
      await duplicate(edgeless, [frame], false);
      // The frame adopts in a microtask after the paste; a macrotask is past it.
      await wait(0);
      settledMs.push(performance.now() - start);
      await nextFrame();
      paintedMs.push(performance.now() - start);

      expect(count()).toBe(2 * before);
      std.store.captureSync();
      std.store.undo();
      await wait(50);
      expect(count()).toBe(before);
    }

    const best = (samples: number[]) => Math.min(...samples);
    const elements = SHAPES + GROUPS + 1;
    console.log(
      `[bench] duplicate ${elements} elements: settled ${best(settledMs).toFixed(0)} ms ` +
        `(${(best(settledMs) / elements).toFixed(2)} ms/element), painted ` +
        `${best(paintedMs).toFixed(0)} ms; samples ` +
        settledMs.map(ms => ms.toFixed(0)).join(', ')
    );
    expect(best(paintedMs)).toBeLessThan(BUDGET_MS);
  }, 60_000);
});
