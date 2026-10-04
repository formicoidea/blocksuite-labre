/**
 * Local hide (ADR 0031, stage 3) on a real editor, through the pane's eye and
 * a real mouse.
 *
 * Hide is per viewer: nothing reaches the document. What only a mounted
 * editor can answer, and this spec checks:
 *
 * - the eye hides the element for this viewer — it is no longer picked by the
 *   pointer — and the click produced ZERO Yjs update;
 * - the row stays listed, marked, and a click on it still selects the element;
 * - the hide is remembered per document in `localStorage`;
 * - a gfx BLOCK (a note) is hidden by its own view, not only canvas elements;
 * - what you see is what you export: the SVG board export leaves out what the
 *   viewer hid, while the rules' view (`getElementsByBound`) keeps it;
 * - a read-only document may still be hidden locally — it is a way of looking.
 */
import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { renderBoardSvg } from '@labre/affine/blocks/surface';
import {
  FrameworkBackgroundElementModel,
  ShapeType,
} from '@labre/affine/model';
import { SelectionPaneProvider } from '@labre/affine/shared/services';
import type { GfxModel } from '@labre/affine/std/gfx';
import { WARDLEY_BACKGROUND, WARDLEY_ROLE } from '@labre/affine-gfx-wardley';
import { Bound } from '@labre/global/gfx';
import { page, userEvent } from '@vitest/browser/context';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { addNote, getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

const PANE_WIDGET = 'edgeless-selection-pane-widget';
const ROW = '[data-testid="selection-pane-row"]';

describe('local hide', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    localStorage.clear();
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    edgeless.std.event.active = true;
    return cleanup;
  });

  const gfx = () => edgeless.service.gfx;
  const model = (id: string) => gfx().getElementById(id) as GfxModel;
  const widget = () => edgeless.widgetComponents[PANE_WIDGET];
  const rowOf = (id: string) =>
    Array.from(
      widget()?.shadowRoot?.querySelectorAll<HTMLElement>(ROW) ?? []
    ).find(row => row.dataset.id === id)!;
  const eyeOf = (id: string) =>
    rowOf(id).querySelector<HTMLElement>('[data-testid="selection-pane-eye"]')!;

  const settle = async () => {
    await edgeless.updateComplete;
    await widget()?.updateComplete;
    await wait(50);
  };

  const shape = (x: number) =>
    edgeless.service.crud.addElement('shape', {
      shapeType: ShapeType.Rect,
      xywh: `[${x},0,100,100]`,
    })!;

  const openPane = async () => {
    edgeless.std.get(SelectionPaneProvider).open();
    await settle();
  };

  /** Every Yjs update the document emits from now on. */
  const recordUpdates = () => {
    const updates: Uint8Array[] = [];
    window.doc.doc.spaceDoc.on('update', (update: Uint8Array) =>
      updates.push(update)
    );
    return updates;
  };

  test('the eye hides for this viewer, and writes nothing', async () => {
    const a = shape(0);
    const b = shape(200);
    await settle();
    await openPane();
    const updates = recordUpdates();

    await userEvent.hover(page.elementLocator(rowOf(a)));
    await userEvent.click(page.elementLocator(eyeOf(a)));
    await settle();

    expect(gfx().localVisibility.isHidden(model(a))).toBe(true);
    expect(rowOf(a).hasAttribute('data-hidden-local')).toBe(true);
    // Not under the pointer any more; its neighbour still is.
    expect(gfx().getElementByPoint(50, 50)).toBeNull();
    expect(gfx().getElementByPoint(250, 50)?.id).toBe(b);
    // Listed, and still selectable from the pane.
    await userEvent.click(page.elementLocator(rowOf(a)));
    await settle();
    expect(gfx().selection.selectedIds).toEqual([a]);
    // Remembered for this document, by this viewer.
    expect(
      localStorage.getItem(`blocksuite:${window.doc.id}:localHiddenElements`)
    ).toContain(a);
    // The eye again shows it.
    await userEvent.click(page.elementLocator(eyeOf(a)));
    await settle();
    expect(gfx().localVisibility.isHidden(model(a))).toBe(false);

    expect(updates).toHaveLength(0);
  });

  test('a hidden note is hidden by its own view', async () => {
    const noteId = addNote(window.doc, { xywh: '[0,300,400,100]' });
    await settle();
    await openPane();

    await userEvent.hover(page.elementLocator(rowOf(noteId)));
    await userEvent.click(page.elementLocator(eyeOf(noteId)));
    await settle();

    const view = edgeless.std.view.getBlock(noteId)!;
    expect(view.style.visibility).toBe('hidden');
    expect(view.style.pointerEvents).toBe('none');
  });

  test('the SVG export leaves out what the viewer hid; the rules do not', async () => {
    const surface = edgeless.service.surface;
    const map = surface.addElement({
      type: WARDLEY_BACKGROUND.type,
      role: WARDLEY_BACKGROUND.role,
      xywh: new Bound(0, 0, 1600, 900).serialize(),
    });
    const label = surface.addElement({
      type: 'text',
      text: 'Alpha',
      role: WARDLEY_ROLE.label,
      xywh: new Bound(400, 400, 120, 26).serialize(),
    });
    await settle();
    const board = surface.getElementById(map);
    expect(board).toBeInstanceOf(FrameworkBackgroundElementModel);

    const texts = () =>
      [
        ...new DOMParser()
          .parseFromString(
            renderBoardSvg(
              edgeless.std,
              board as FrameworkBackgroundElementModel
            ).svg,
            'image/svg+xml'
          )
          .querySelectorAll('text'),
      ].map(node => node.textContent ?? '');

    expect(texts().some(text => text.includes('Alpha'))).toBe(true);

    await openPane();
    await userEvent.hover(page.elementLocator(rowOf(label)));
    await userEvent.click(page.elementLocator(eyeOf(label)));
    await settle();

    expect(texts().some(text => text.includes('Alpha'))).toBe(false);
    // What rules and legends read still holds it: hiding is not deleting.
    expect(
      gfx()
        .getElementsByBound(Bound.deserialize(model(map).xywh))
        .map(m => m.id)
    ).toContain(label);
  });

  test('a read-only document may still be hidden locally', async () => {
    const a = shape(0);
    await settle();
    edgeless.std.store.readonly = true;
    await openPane();

    await userEvent.hover(page.elementLocator(rowOf(a)));
    await userEvent.click(page.elementLocator(eyeOf(a)));
    await settle();

    expect(gfx().localVisibility.isHidden(model(a))).toBe(true);
  });
});
