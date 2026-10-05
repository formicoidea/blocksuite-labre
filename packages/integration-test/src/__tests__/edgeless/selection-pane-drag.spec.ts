/**
 * Drag and drop in the selection pane, with a real pointer pressed, moved in
 * steps and released (`../utils/pointer.ts`), so the gesture can be watched
 * while it happens.
 *
 * Why it exists: the product owner's review found the pane's drag unreliable
 * and silent — a row dropped under the last one went nowhere, nothing showed
 * where a row would land, and a drop the stack could not honour (a loose row
 * onto a frame's members) wrote nothing and said nothing. The pane now follows
 * the frame panel's model: a ghost of the row under the pointer, a line at the
 * hovered gap (before the first row, between any two, after the last), no line
 * and a `not-allowed` cursor over a gap the row cannot go to. A drop writes one
 * `index` in one undo step, and nothing when the gap is where the row already
 * is or is refused.
 */
import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { ShapeType } from '@labre/affine/model';
import { SelectionPaneProvider } from '@labre/affine/shared/services';
import type { GfxModel } from '@labre/affine/std/gfx';
import { page, userEvent } from '@vitest/browser/context';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { pointerDown, pointerMoveTo, pointerUp } from '../utils/pointer.js';
import { setupEditor } from '../utils/setup.js';

const PANE_WIDGET = 'edgeless-selection-pane-widget';
const BODY = '[data-testid="selection-pane-body"]';
const rowSelector = (id: string) =>
  `[data-testid="selection-pane-row"][data-id="${id}"]`;

describe('selection pane drag and drop', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    edgeless.std.event.active = true;
    return cleanup;
  });

  const gfx = () => edgeless.service.gfx;
  const model = (id: string) => gfx().getElementById(id) as GfxModel;
  const root = () => edgeless.widgetComponents[PANE_WIDGET]!.shadowRoot!;
  const panel = () =>
    root().querySelector<HTMLElement>('[data-testid="selection-pane-panel"]')!;
  const rowIds = () =>
    Array.from(
      root().querySelectorAll<HTMLElement>('[data-testid="selection-pane-row"]')
    ).map(row => row.dataset.id);
  const rowOf = (id: string) =>
    root().querySelector<HTMLElement>(rowSelector(id))!;
  const ghost = () =>
    root().querySelector<HTMLElement>(
      '[data-testid="selection-pane-drag-ghost"]'
    );
  const indicator = () =>
    root().querySelector<HTMLElement>(
      '[data-testid="selection-pane-drop-indicator"]'
    );

  const settle = async () => {
    await edgeless.updateComplete;
    await edgeless.widgetComponents[PANE_WIDGET]?.updateComplete;
    await wait(50);
  };

  const shape = (x: number, index?: string) =>
    edgeless.service.crud.addElement('shape', {
      shapeType: ShapeType.Rect,
      xywh: `[${x},0,100,100]`,
      ...(index ? { index } : {}),
    })!;

  const openPane = async () => {
    edgeless.std.get(SelectionPaneProvider).open();
    await settle();
  };

  /** Press on a row's middle, then move off it far enough to start a drag. */
  const grab = async (id: string) => {
    await pointerMoveTo(rowSelector(id), 0.3, 0.5, 1);
    await pointerDown();
    await pointerMoveTo(rowSelector(id), 0.3, 0.9, 3);
    await settle();
  };

  const moveTo = async (selector: string, fy: number) => {
    await pointerMoveTo(selector, 0.4, fy, 6);
    await settle();
  };

  const release = async () => {
    await pointerUp();
    await settle();
  };

  /** Yjs updates written from now on. */
  const recordUpdates = () => {
    const updates: Uint8Array[] = [];
    window.doc.doc.spaceDoc.on('update', (update: Uint8Array) =>
      updates.push(update)
    );
    return updates;
  };

  const near = (a: number, b: number) => Math.abs(a - b) <= 3;

  test('a ghost follows the pointer, a line marks the gap, the drop lands there', async () => {
    const a = shape(0);
    const b = shape(200);
    const c = shape(400);
    await settle();
    await openPane();
    expect(rowIds()).toEqual([c, b, a]);

    await grab(a);
    await moveTo(rowSelector(c), 0.75);

    expect(ghost(), 'the dragged row is shown under the pointer').toBeTruthy();
    expect(rowOf(a).hasAttribute('data-dragging')).toBe(true);
    const line = indicator();
    expect(line, 'a line marks the gap under the pointer').toBeTruthy();
    expect(
      near(
        line!.getBoundingClientRect().top,
        rowOf(c).getBoundingClientRect().bottom
      )
    ).toBe(true);
    expect(panel().dataset.drag).toBe('valid');

    await release();

    expect(ghost()).toBeNull();
    expect(indicator()).toBeNull();
    expect(rowIds()).toEqual([c, a, b]);
    expect(model(c).index > model(a).index).toBe(true);
    expect(model(a).index > model(b).index).toBe(true);

    edgeless.std.store.undo();
    await settle();
    expect(rowIds()).toEqual([c, b, a]);
  });

  test('released under the last row, a row goes to the bottom', async () => {
    const a = shape(0);
    const b = shape(200);
    const c = shape(400);
    await settle();
    await openPane();

    await grab(c);
    // The blank space under the list: the gap after the last row.
    await moveTo(BODY, 0.95);
    const line = indicator();
    expect(line, 'the gap after the last row is a drop target').toBeTruthy();
    expect(
      near(
        line!.getBoundingClientRect().top,
        rowOf(a).getBoundingClientRect().bottom
      )
    ).toBe(true);
    await release();

    expect(rowIds()).toEqual([b, a, c]);
    expect(model(c).index < model(a).index).toBe(true);

    edgeless.std.store.undo();
    await settle();
    expect(rowIds()).toEqual([c, b, a]);
  });

  test('on the top half of the first row, a row goes to the top', async () => {
    const a = shape(0);
    const b = shape(200);
    const c = shape(400);
    await settle();
    await openPane();

    await grab(a);
    await moveTo(rowSelector(c), 0.2);
    expect(
      near(
        indicator()!.getBoundingClientRect().top,
        rowOf(c).getBoundingClientRect().top
      )
    ).toBe(true);
    await release();

    expect(rowIds()).toEqual([a, c, b]);
    expect(model(a).index > model(c).index).toBe(true);
  });

  test('a drop on the row’s own place writes nothing', async () => {
    shape(0);
    const b = shape(200);
    const c = shape(400);
    await settle();
    await openPane();
    edgeless.std.store.resetHistory();
    const updates = recordUpdates();

    await grab(b);
    // The gap right above `b` is where it already is.
    await moveTo(rowSelector(c), 0.75);
    await release();

    expect(updates).toHaveLength(0);
    expect(edgeless.std.store.canUndo).toBe(false);
  });

  test('a gap the row cannot go to shows no line, a not-allowed cursor, and writes nothing', async () => {
    const a = shape(0);
    const b = shape(200);
    edgeless.service.crud.addElement('group', {
      children: { [a]: true, [b]: true },
    });
    const loose = shape(400);
    await settle();
    await openPane();
    expect(rowIds()[0]).toBe(loose);
    const updates = recordUpdates();

    await grab(loose);
    // Between the group's two members: a loose row does not enter a group by
    // a drag.
    await moveTo(rowSelector(b), 0.75);

    expect(indicator()).toBeNull();
    expect(panel().dataset.drag).toBe('invalid');
    expect(getComputedStyle(panel()).cursor).toBe('not-allowed');

    await release();
    expect(updates).toHaveLength(0);
    expect(rowIds()[0]).toBe(loose);
  });

  test('a loose row dropped above a frame’s members lands above the frame', async () => {
    // Frame members stack right above their frame, whatever their own index:
    // the gap above them is the frame's place in the stack.
    const loose = shape(600, 'a1');
    const middle = shape(800, 'a3');
    const inside = shape(0, 'a2');
    edgeless.service.crud.addBlock(
      'affine:frame',
      {
        xywh: '[-50,-50,300,300]',
        index: 'a5',
        childElementIds: { [inside]: true },
      },
      edgeless.service.surface.id
    );
    await settle();
    await openPane();
    expect(rowIds()).toEqual([inside, middle, loose]);

    await grab(loose);
    await moveTo(rowSelector(inside), 0.2);
    expect
      .soft(indicator(), 'the gap above the frame is a drop target')
      .toBeTruthy();
    await release();

    expect(rowIds()).toEqual([loose, inside, middle]);
  });

  test('on the lower half of a collapsed group, a row lands after the group', async () => {
    const bottom = shape(800);
    const a = shape(0);
    const b = shape(200);
    const group = edgeless.service.crud.addElement('group', {
      children: { [a]: true, [b]: true },
    })!;
    const top = shape(400);
    await settle();
    await openPane();
    rowOf(group)
      .querySelector<HTMLElement>('[data-testid="selection-pane-collapse"]')!
      .click();
    await settle();
    expect(rowIds()).toEqual([top, group, bottom]);

    await grab(top);
    await moveTo(rowSelector(group), 0.8);
    expect(indicator()).toBeTruthy();
    await release();

    expect(rowIds()).toEqual([group, top, bottom]);
  });

  test('under a layer’s last row, a row goes to the bottom of its layer', async () => {
    const lower = shape(800);
    await settle();
    await openPane();
    await userEvent.click(
      page.elementLocator(
        root().querySelector('[data-testid="selection-pane-new-layer"]')!
      )
    );
    await settle();
    await userEvent.keyboard('{Enter}');
    const first = shape(0);
    const second = shape(200);
    await settle();
    expect(rowIds()).toEqual([second, first, lower]);
    edgeless.std.store.resetHistory();

    await grab(second);
    // The last row of the user layer: its lower half is the gap before the
    // default layer's header, i.e. the bottom of the user layer.
    await moveTo(rowSelector(first), 0.75);
    expect(panel().dataset.drag).toBe('valid');
    await release();

    expect(rowIds()).toEqual([first, second, lower]);
    expect(model(second).index < model(first).index).toBe(true);
    expect(edgeless.std.store.canUndo).toBe(true);
    edgeless.std.store.undo();
    await settle();
    expect(rowIds()).toEqual([second, first, lower]);
    expect(edgeless.std.store.canUndo).toBe(false);
  });

  /*
   * The frame panel's drag, behaviour by behaviour (its card: `frame-card.ts`,
   * its drag: `utils/drag.ts`). Each test below pins one behaviour the pane
   * now shares with it.
   */

  test('a nudge under five pixels is a click, not a drag', async () => {
    const a = shape(0);
    shape(200);
    await settle();
    await openPane();

    // The frame panel's threshold: 5px on either axis, not 4px of travel. A
    // diagonal of 3.5px each way is ~5px of travel and under 5px on both axes.
    const { width, height } = rowOf(a).getBoundingClientRect();
    await pointerMoveTo(rowSelector(a), 0.3, 0.3, 1);
    await pointerDown();
    await pointerMoveTo(
      rowSelector(a),
      0.3 + 3.5 / width,
      0.3 + 3.5 / height,
      2
    );
    await settle();
    expect(
      ghost(),
      'under five pixels a side does not start a drag'
    ).toBeNull();

    await pointerMoveTo(rowSelector(a), 0.3, 0.3 + 6 / height, 2);
    await settle();
    expect(ghost(), 'six pixels do').toBeTruthy();
    await pointerMoveTo(rowSelector(a), 0.3, 0.3, 2);
    await release();
  });

  test('picking a row up selects it, as the frame panel selects a card', async () => {
    const a = shape(0);
    shape(200);
    await settle();
    await openPane();
    expect(gfx().selection.selectedIds).toEqual([]);

    await grab(a);
    expect(gfx().selection.selectedIds).toEqual([a]);
    await release();
  });

  test('the ghost is the row itself, at the row’s width', async () => {
    const a = shape(0);
    const b = shape(200);
    await settle();
    await openPane();

    await grab(a);
    await moveTo(rowSelector(b), 0.25);
    const width = rowOf(a).getBoundingClientRect().width;
    expect(near(ghost()!.getBoundingClientRect().width, width)).toBe(true);
    expect(ghost()!.textContent).toContain(rowOf(a).textContent?.trim());
    await release();
  });

  test('while dragging, the cursor speaks over the whole editor, canvas included', async () => {
    const a = shape(0);
    const b = shape(200);
    await settle();
    await openPane();

    await grab(a);
    // Out over the canvas: nowhere to drop, and the canvas does not react.
    await pointerMoveTo('affine-edgeless-root', 0.8, 0.5, 4);
    await settle();
    const canvas = edgeless.getBoundingClientRect();
    const x = canvas.left + canvas.width * 0.8;
    const y = canvas.top + canvas.height * 0.5;
    const over = root().elementFromPoint(x, y) as HTMLElement | null;
    expect(over?.dataset.testid).toBe('selection-pane-drag-mask');
    expect(getComputedStyle(over!).cursor).toBe('not-allowed');

    await moveTo(rowSelector(b), 0.25);
    expect(getComputedStyle(over!).cursor).toBe('grabbing');
    await release();
    expect(
      root().querySelector('[data-testid="selection-pane-drag-mask"]')
    ).toBeNull();
  });

  test('Escape during a drag neither closes the pane nor drops the row', async () => {
    const a = shape(0);
    const b = shape(200);
    await settle();
    await openPane();
    panel().focus();

    await grab(a);
    await moveTo(rowSelector(b), 0.25);
    await userEvent.keyboard('{Escape}');
    await settle();
    expect(
      edgeless.widgetComponents[PANE_WIDGET]!.shadowRoot!.querySelector(
        '[data-testid="selection-pane-panel"]'
      ),
      'the pane is still open'
    ).toBeTruthy();
    expect(ghost()).toBeTruthy();
    await release();
    expect(rowIds()).toEqual([a, b]);
  });

  test('a read-only document offers no drag', async () => {
    const a = shape(0);
    const b = shape(200);
    await settle();
    edgeless.std.store.readonly = true;
    await openPane();
    const updates = recordUpdates();

    await grab(a);
    await moveTo(rowSelector(b), 0.2);
    expect(ghost()).toBeNull();
    expect(indicator()).toBeNull();
    await release();

    expect(updates).toHaveLength(0);
    expect(rowIds()).toEqual([b, a]);
  });
});
