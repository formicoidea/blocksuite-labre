import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
// Straight off the framework package, as the bpmn, wardley and c4-morph specs
// already reach for theirs: `@labre/affine` re-exports the blocks, not the
// framework modules.
import { C4_BOARD_TITLE_BAND_HEIGHT, C4_ROLE } from '@labre/affine-gfx-c4';
import type { C4BoardElementModel } from '@labre/affine/model';
import type { GfxModel } from '@labre/std/gfx';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock, getSurface } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * The C4 board's title band, in a real editor.
 *
 * The unit suites own the two halves: which strip the model carves out of the
 * border-only hit test (`affine-model`), and which strip the view hands a
 * double-click to (`gfx/c4`). What only a live board can answer is what a user
 * actually notices — that a click on the header selects the SHEET, that a
 * double-click there opens the title editor, and that neither of them steals a
 * click meant for what is drawn under the band.
 *
 * The regression it exists for: since backgrounds stopped being picked by their
 * area (issues #194 / #197), the board's title was reachable only by hitting
 * the few characters of the drawn glyphs, and a single click on it selected
 * nothing at all.
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

  /* ── Renaming ────────────────────────────────────────────────────────── */

  /**
   * The in-place `<input>` the view opens, or null.
   *
   * It is appended to `document.body` itself and positioned `fixed` over the
   * pointer, so a direct child of the body is exactly what it is — and the last
   * one, so a stale editor from an earlier case could never stand in for a new
   * one.
   */
  const titleEditor = () =>
    (Array.from(document.body.children).findLast(
      el => el.tagName === 'INPUT'
    ) as HTMLInputElement | undefined) ?? null;

  /**
   * A double-click at a MODEL-space point, handed to the board's own view.
   *
   * The view is fetched from the gfx registry rather than constructed, which is
   * what makes this an integration case: if `C4BoardView` were not registered
   * for `c4Board`, there would be no handler here to dispatch to.
   */
  const dblclick = async (board: C4BoardElementModel, x: number, y: number) => {
    // A canvas element's view, so it dispatches; `gfx.view.get` is typed over
    // blocks as well, which do not.
    const view = edgeless.gfx.view.get(board.id) as {
      dispatch: (event: 'dblclick', evt: unknown) => boolean;
    } | null;
    expect(view).not.toBeNull();
    const [vx, vy] = edgeless.gfx.viewport.toViewCoord(x, y);
    const handled = view!.dispatch('dblclick', {
      x: vx,
      y: vy,
      raw: { clientX: vx, clientY: vy },
    });
    await wait();
    return handled;
  };

  test('a double-click anywhere in the band opens the title editor', async () => {
    const board = await addBoard();

    // Nowhere near the glyphs: the words end long before the middle of a
    // 1400-unit sheet, and the whole point of the band is that the user does
    // not have to find them.
    await dblclick(board, BOARD_W - 200, BAND / 2);

    const input = titleEditor();
    expect(input).not.toBeNull();
    // Opened on the words currently DRAWN, never on an empty box.
    expect(input!.value).toBe('Internet banking');

    // …and it renames, which is what the whole band is for.
    input!.value = 'System context';
    input!.dispatchEvent(new Event('blur'));
    await wait();
    expect(board.name).toBe('System context');
  });

  test('a double-click under the band opens nothing', async () => {
    const board = await addBoard();

    await dblclick(board, BOARD_W / 2, BOARD_H / 2);
    expect(titleEditor()).toBeNull();

    // …including immediately under the painted edge.
    await dblclick(board, BOARD_W / 2, BAND + 20);
    expect(titleEditor()).toBeNull();
    expect(board.name).toBe('Internet banking');
  });
});
