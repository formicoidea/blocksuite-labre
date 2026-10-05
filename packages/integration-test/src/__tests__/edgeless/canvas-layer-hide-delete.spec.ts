/**
 * Hiding and deleting a whole user layer (ADR 0031, stage 7) on a real
 * editor, through the selection pane's layer rows and a real mouse.
 *
 * - the layer row's eye hides every member for this viewer: not picked, the
 *   row marked, and ZERO Yjs update;
 * - its menu's "Hide for everyone" (theme warning token) writes `hidden` on
 *   the record, a second client receives it, and the members are no longer
 *   picked;
 * - its menu's "Delete layer" removes the members with the record, one undo
 *   brings everything back, and the default layer offers no such entry;
 * - a read-only document still lets a viewer hide a layer for themselves,
 *   and offers no menu.
 */
import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { ShapeType } from '@labre/affine/model';
import { SelectionPaneProvider } from '@labre/affine/shared/services';
import { DEFAULT_LAYER_ID, type GfxModel } from '@labre/affine/std/gfx';
import { Bound } from '@labre/global/gfx';
import { page, userEvent } from '@vitest/browser/context';
import { beforeEach, describe, expect, test } from 'vitest';
import * as Y from 'yjs';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

const PANE_WIDGET = 'edgeless-selection-pane-widget';

/** Every element matching `selector`, through every open shadow root. */
function deepQueryAll(root: ParentNode, selector: string): HTMLElement[] {
  const found = Array.from(root.querySelectorAll<HTMLElement>(selector));
  for (const element of root.querySelectorAll('*')) {
    if (element.shadowRoot)
      found.push(...deepQueryAll(element.shadowRoot, selector));
  }
  return found;
}

describe('hide and delete a layer', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    localStorage.clear();
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    edgeless.std.event.active = true;
    return cleanup;
  });

  const gfx = () => edgeless.service.gfx;
  const surface = () => edgeless.service.surface;
  const widget = () => edgeless.widgetComponents[PANE_WIDGET];
  const root = () => widget()!.shadowRoot!;
  const layerRow = (id: string) =>
    Array.from(
      root().querySelectorAll<HTMLElement>(
        '[data-testid="selection-pane-layer"]'
      )
    ).find(row => row.dataset.id === id)!;
  const inLayerRow = (id: string, selector: string) =>
    layerRow(id).querySelector<HTMLElement>(selector)!;
  const userLayerId = () =>
    Object.keys(surface().props.layers ?? {}).find(
      id => id !== DEFAULT_LAYER_ID
    )!;

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

  /** A pane with two layers; `a` in the user layer, `b` in the default one. */
  const twoLayers = async () => {
    edgeless.std.get(SelectionPaneProvider).open();
    await settle();
    await userEvent.click(
      page.elementLocator(
        root().querySelector('[data-testid="selection-pane-new-layer"]')!
      )
    );
    await settle();
    const created = userLayerId();
    const a = shape(800);
    await userEvent.click(
      page.elementLocator(inLayerRow(DEFAULT_LAYER_ID, '.selection-pane-label'))
    );
    await settle();
    const b = shape(1000);
    await settle();
    return { created, a, b };
  };

  const openLayerMenu = async (id: string) => {
    await userEvent.hover(page.elementLocator(layerRow(id)));
    await userEvent.click(
      page.elementLocator(inLayerRow(id, '[data-testid="selection-pane-more"]'))
    );
    await wait(100);
  };

  test('the eye hides the whole layer for this viewer, and writes nothing', async () => {
    const { created, a, b } = await twoLayers();
    const updates: Uint8Array[] = [];
    window.doc.doc.spaceDoc.on('update', (update: Uint8Array) =>
      updates.push(update)
    );

    await userEvent.hover(page.elementLocator(layerRow(created)));
    await userEvent.click(
      page.elementLocator(
        inLayerRow(created, '[data-testid="selection-pane-eye"]')
      )
    );
    await settle();

    expect(gfx().getElementByPoint(850, 50)).toBeNull();
    expect(gfx().getElementByPoint(1050, 50)?.id).toBe(b);
    expect(layerRow(created).hasAttribute('data-hidden-local')).toBe(true);
    expect(
      localStorage.getItem(`blocksuite:${window.doc.id}:localHiddenLayers`)
    ).toContain(created);
    expect(updates).toHaveLength(0);
    expect(gfx().getElementById(a)).toBeTruthy();
  });

  // A frame is a row of its layer (ADR 0031, amendments): hiding the layer
  // hides the frame too, and the pane lists the frame under that layer, which
  // is what makes the hide coherent — what disappears is what the layer shows.
  test('hiding the layer hides the frame, listed under that hidden layer', async () => {
    const { created } = await twoLayers();
    await userEvent.click(
      page.elementLocator(inLayerRow(created, '.selection-pane-label'))
    );
    await settle();
    // Through the CRUD path, which lands a block in the active layer (ADR 0031
    // §6) — the user layer clicked above.
    const frameId = edgeless.service.crud.addBlock(
      'affine:frame',
      { xywh: new Bound(2000, 0, 300, 200).serialize() },
      surface().id
    );
    await settle();
    const frame = gfx().getElementById(frameId) as GfxModel;

    const frameRow = () =>
      root().querySelector<HTMLElement>(
        `[data-testid="selection-pane-row"][data-id="${frameId}"]`
      );
    expect(frameRow(), 'the frame is a row').toBeTruthy();
    // Listed in the layer it belongs to: after that layer's header, before
    // the next one.
    const rows = Array.from(
      root().querySelectorAll<HTMLElement>(
        '[data-testid="selection-pane-row"], [data-testid="selection-pane-layer"]'
      )
    ).map(row => row.dataset.id);
    const at = rows.indexOf(frameId);
    expect(at).toBeGreaterThan(rows.indexOf(created));
    expect(at).toBeLessThan(rows.indexOf(DEFAULT_LAYER_ID));

    await userEvent.hover(page.elementLocator(layerRow(created)));
    await userEvent.click(
      page.elementLocator(
        inLayerRow(created, '[data-testid="selection-pane-eye"]')
      )
    );
    await settle();

    expect(gfx().localVisibility.isHidden(frame)).toBe(true);
    expect(layerRow(created).hasAttribute('data-hidden-local')).toBe(true);
    expect(frameRow(), 'still listed, under the hidden layer').toBeTruthy();
  });

  test('hide for everyone writes the record and reaches a second client', async () => {
    const { created, b } = await twoLayers();
    const space = window.doc.doc.spaceDoc;
    const peer = new Y.Doc();
    Y.applyUpdate(peer, Y.encodeStateAsUpdate(space));
    space.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin !== 'peer') Y.applyUpdate(peer, update, 'author');
    });

    await openLayerMenu(created);
    const entry = deepQueryAll(
      document,
      '[data-testid="selection-pane-hide-for-everyone"]'
    )[0];
    expect(entry, 'the layer menu offers it').toBeTruthy();
    // Painted with the theme warning tokens, like the element entry.
    expect(entry.classList.contains('warning-item')).toBe(true);
    await userEvent.click(page.elementLocator(entry));
    await settle();

    expect(surface().props.layers![created].hidden).toBe(true);
    const peerLayers = peer
      .getMap<Y.Map<unknown>>('blocks')
      .get(surface().id)!
      .get('prop:layers') as Y.Map<Y.Map<unknown>>;
    expect(peerLayers.get(created)?.get('hidden')).toBe(true);
    expect(gfx().getElementByPoint(850, 50)).toBeNull();
    expect(gfx().getElementByPoint(1050, 50)?.id).toBe(b);
    expect(layerRow(created).hasAttribute('data-hidden-everyone')).toBe(true);
  });

  test('delete takes the members along; one undo brings them back', async () => {
    const { created, a, b } = await twoLayers();
    edgeless.std.store.captureSync();

    await openLayerMenu(created);
    const entry = deepQueryAll(
      document,
      '[data-testid="selection-pane-delete-layer"]'
    )[0];
    expect(entry).toBeTruthy();
    await userEvent.click(page.elementLocator(entry));
    await settle();

    expect(gfx().getElementById(a)).toBeNull();
    expect(gfx().getElementById(b)).toBeTruthy();
    expect(surface().props.layers![created]).toBeUndefined();
    expect(layerRow(created)).toBeUndefined();

    edgeless.std.store.undo();
    await settle();
    expect(gfx().getElementById(a)).toBeTruthy();
    expect(surface().props.layers![created]).toBeTruthy();

    // The default layer's menu has no delete entry.
    await openLayerMenu(DEFAULT_LAYER_ID);
    expect(
      deepQueryAll(document, '[data-testid="selection-pane-delete-layer"]')
    ).toHaveLength(0);
    await userEvent.keyboard('{Escape}');
  });

  test('read-only: a viewer may still hide a layer, and gets no menu', async () => {
    const { created } = await twoLayers();
    edgeless.std.store.readonly = true;
    await settle();

    expect(
      inLayerRow(created, '[data-testid="selection-pane-more"]')
    ).toBeNull();
    await userEvent.hover(page.elementLocator(layerRow(created)));
    await userEvent.click(
      page.elementLocator(
        inLayerRow(created, '[data-testid="selection-pane-eye"]')
      )
    );
    await settle();
    expect(gfx().getElementByPoint(850, 50)).toBeNull();
  });
});
