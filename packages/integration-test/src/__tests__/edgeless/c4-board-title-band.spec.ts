import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
// Straight off the framework package, as the bpmn, wardley and c4-morph specs
// already reach for theirs: `@labre/affine` re-exports the blocks, not the
// framework modules.
import { C4_BOARD_TITLE_BAND_HEIGHT, C4_ROLE } from '@labre/affine-gfx-c4';
import type { C4BoardElementModel } from '@labre/affine/model';
import type { GfxModel } from '@labre/std/gfx';
import { beforeEach, describe, expect, test } from 'vitest';

import { pointerdown, pointermove, pointerup, wait } from '../utils/common.js';
import { getDocRootBlock, getSurface } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * The C4 board's title band, driven through the REAL pointer pipeline.
 *
 * The unit suites own the geometry: which strip the model carves out of the
 * border-only hit test (`affine-model`), and which strip the view hands a
 * double-click to (`gfx/c4`). What only a live editor can answer is whether the
 * gesture ever ARRIVES — and the first version of this file got that wrong. It
 * called `view.dispatch('dblclick', …)` by hand, which walks past everything
 * between a mouse and a view; it passed while the real board, under a real
 * mouse, renamed nothing (lead's recette, 02/09/2026).
 *
 * So every case below dispatches real `PointerEvent`s on the editor host at
 * real screen coordinates and lets the dispatcher, the tool controller, the
 * default tool and the interactivity manager do the whole of their own work.
 * Nothing here reaches into a view.
 *
 * ## The routing bug the recette found
 *
 * `GfxViewEventManager` delivered a click or a double-click to the top of its
 * HOVERED stack, and rebuilt that stack on `pointermove` alone. A pointer that
 * arrives without a move reaching the manager — the first gesture in a freshly
 * mounted editor, whose `pointermove` is dropped before the dispatcher is
 * active; an element created under a stationary pointer — therefore left the
 * stack empty, and the double-click was delivered to nobody. Selection still
 * worked, because `handleElementSelection` re-picks by point on every click:
 * one pointer, two answers, one of them stale. `_targetOf` now falls back to
 * the event's own coordinates, and the two agree again.
 *
 * The first case below is that exact sequence, and it is RED without that fix.
 */
describe('the C4 board wears a selectable title band', () => {
  let edgeless!: EdgelessRootBlockComponent;

  const BOARD_W = 1400;
  const BOARD_H = 900;
  const BAND = C4_BOARD_TITLE_BAND_HEIGHT;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    return cleanup;
  });

  /** A board at the origin, the size a fresh one is created at. */
  const addBoard = async () => {
    const surface = getSurface(window.doc, window.editor).model;
    const id = surface.addElement({
      type: 'c4Board',
      role: C4_ROLE.board,
      name: 'Internet banking',
      xywh: `[0,0,${BOARD_W},${BOARD_H}]`,
    });
    await wait();
    return surface.getElementById(id) as C4BoardElementModel;
  };

  /** What the editor's own picking says is under a MODEL-space point. */
  const pick = (x: number, y: number): GfxModel | null =>
    edgeless.gfx.getElementByPoint(x, y);

  /* ── Driving the real pipeline ───────────────────────────────────────── */

  const host = () => window.editor.host as HTMLElement;

  /** A model point, as the position the pointer helpers take. */
  const at = (x: number, y: number) => {
    const [vx, vy] = edgeless.gfx.viewport.toViewCoord(x, y);
    return { x: vx, y: vy };
  };

  /** One press and release — the dispatcher synthesizes `click` from these. */
  const tap = (p: { x: number; y: number }) => {
    pointerdown(host(), p);
    pointerup(host(), p);
  };

  /**
   * A real double-click: two presses in the same place, close enough in time
   * that `ClickController` counts them as one gesture.
   */
  const doubleClick = async (p: { x: number; y: number }) => {
    tap(p);
    tap(p);
    await wait();
  };

  /** The in-place `<input>` the view opens, or null. */
  const titleEditor = () =>
    (Array.from(document.body.children).findLast(
      el => el.tagName === 'INPUT'
    ) as HTMLInputElement | undefined) ?? null;

  /* ── Selecting ───────────────────────────────────────────────────────── */

  test('a click in the band picks the board', async () => {
    const board = await addBoard();

    // Well inside the header and well clear of every edge, so the answer is
    // the BAND's and not the border band's.
    expect(pick(BOARD_W / 2, BAND / 2)?.id).toBe(board.id);
    // Full width: the far end of the header answers as the near end does.
    expect(pick(BOARD_W - 100, BAND / 2)?.id).toBe(board.id);
  });

  test('a click under the band does not pick the board', async () => {
    const board = await addBoard();

    // One node height under the painted edge, and in the middle of the sheet:
    // the plot is where the diagram goes, so a click there belongs to whatever
    // is drawn under the pointer — never to the sheet itself.
    expect(pick(BOARD_W / 2, BAND + 40)?.id).not.toBe(board.id);
    expect(pick(BOARD_W / 2, BOARD_H / 2)?.id).not.toBe(board.id);
  });

  test('a node dropped under the band still takes its own click', async () => {
    const board = await addBoard();
    const surface = getSurface(window.doc, window.editor).model;

    // A C4 system sitting at the very top of the plot, immediately under the
    // header — the position the band would swallow if it reached past what it
    // paints.
    const nodeId = surface.addElement({
      type: 'c4Node',
      kind: 'system',
      role: C4_ROLE.system,
      filled: true,
      xywh: `[600,${BAND + 10},240,120]`,
    });
    await wait();

    expect(pick(720, BAND + 70)?.id).toBe(nodeId);
    // …and the band above it is still the board's, so neither took the other's.
    expect(pick(720, BAND / 2)?.id).toBe(board.id);
  });

  /* ── Renaming, through the pointer pipeline ──────────────────────────── */

  test('a double-click in the band renames the board, with no move first', async () => {
    const board = await addBoard();

    // THE recette case, and the one the routing bug broke: the pointer's first
    // gesture on this editor, so no `pointermove` has reached the interactivity
    // manager and its hovered stack is empty. The double-click has to be routed
    // from its own coordinates or it reaches nobody.
    //
    // Deliberately far from the drawn glyphs, 200 units in from the right edge:
    // the whole band is the target, which is the point of painting it.
    await doubleClick(at(BOARD_W - 200, BAND / 2));

    const input = titleEditor();
    expect(input).not.toBeNull();
    // Opened on the words currently DRAWN, never on an empty box.
    expect(input!.value).toBe('Internet banking');
    // The board is held in editing so the global delete/escape keys stand down.
    expect(edgeless.gfx.selection.editing).toBe(true);

    input!.value = 'System context';
    input!.dispatchEvent(new Event('blur'));
    await wait();
    expect(board.name).toBe('System context');
    expect(titleEditor()).toBeNull();
  });

  test('…and after the pointer has moved onto the band, as a hand does', async () => {
    const board = await addBoard();
    const point = at(BOARD_W - 200, BAND / 2);

    // The ordinary path: a real hand moves onto the band before clicking, which
    // fills the hovered stack. Asserted beside the case above so the fallback
    // can never be mistaken for the only route that works.
    tap(at(5, BOARD_H / 2));
    await wait();
    pointermove(host(), point);
    await wait();

    await doubleClick(point);

    expect(titleEditor()).not.toBeNull();
    expect(titleEditor()!.value).toBe(board.name);
  });

  test('a double-click on an ALREADY selected board still renames it', async () => {
    const board = await addBoard();
    const point = at(BOARD_W - 200, BAND / 2);

    // Select it first, the way the recette did: the second gesture then arrives
    // on an element that is already selected, which is where the lead suspected
    // the double-click was being consumed.
    edgeless.gfx.selection.set({ elements: [board.id], editing: false });
    await wait();
    expect(edgeless.gfx.selection.selectedIds).toEqual([board.id]);

    await doubleClick(point);

    expect(titleEditor()).not.toBeNull();
    expect(titleEditor()!.value).toBe('Internet banking');
  });

  test('a double-click under the band opens nothing', async () => {
    const board = await addBoard();

    // The middle of the sheet, where the diagram goes…
    await doubleClick(at(BOARD_W / 2, BOARD_H / 2));
    expect(titleEditor()).toBeNull();

    // …and immediately under the painted edge, which is the boundary the band
    // must not reach past or it steals the clicks meant for what is drawn below.
    await doubleClick(at(BOARD_W / 2, BAND + 20));
    expect(titleEditor()).toBeNull();
    expect(board.name).toBe('Internet banking');
  });
});
