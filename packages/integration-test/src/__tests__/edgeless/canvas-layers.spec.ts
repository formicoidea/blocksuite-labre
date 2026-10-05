/**
 * User layers (ADR 0031, stage 6) on a real editor, through the selection
 * pane and a real mouse.
 *
 * The unit suite (`affine/all/.../canvas-layers.unit.spec.ts`) owns the
 * comparator, the creation rule and the writes on a bare document. This one
 * owns what only a mounted editor can answer:
 *
 * - "New layer" in the pane's head creates the first two records, the new
 *   layer becomes active, and what is drawn next lands in it and stacks above
 *   the default layer whatever its `index`;
 * - a new layer opens straight into its rename field, and under a frame
 *   filter it is still listed — layer rows are never filtered, and a layer
 *   whose members the filter hides says how many (the product owner's review:
 *   a second "New layer" under a filter used to show nothing at all);
 * - a click on a layer row makes it the active layer; a double-click renames
 *   it in place; a drag reorders the layers, and the canvas restacks;
 * - a canvas row dragged onto a layer row moves the element into it;
 * - a layer row collapses (UI state, nothing written);
 * - bring-to-front stays inside the element's layer;
 * - grouping across layers puts the group in its highest member's layer, and
 *   ungrouping hands the group's layer to the released children;
 * - a second client sees the layers and the memberships, and a layer it
 *   creates shows up in this pane.
 */
import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import {
  createGroupFromSelectedCommand,
  ungroupCommand,
} from '@labre/affine/gfx/group';
import { type GroupElementModel, ShapeType } from '@labre/affine/model';
import {
  SelectionPaneProvider,
  TelemetryExtension,
} from '@labre/affine/shared/services';
import {
  DEFAULT_LAYER_ID,
  type GfxModel,
  ownLayerOf,
} from '@labre/affine/std/gfx';
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

describe('user layers', () => {
  let edgeless!: EdgelessRootBlockComponent;
  let events: { name: string; props: Record<string, unknown> }[];

  beforeEach(async () => {
    events = [];
    const cleanup = await setupEditor('edgeless', [
      TelemetryExtension({
        track: (name, props) =>
          events.push({ name, props: props as Record<string, unknown> }),
      }),
    ]);
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    edgeless.std.event.active = true;
    return cleanup;
  });

  const gfx = () => edgeless.service.gfx;
  const surface = () => edgeless.service.surface;
  const model = (id: string) => gfx().getElementById(id) as GfxModel;
  const widget = () => edgeless.widgetComponents[PANE_WIDGET];
  const root = () => widget()!.shadowRoot!;
  const layerRow = (id: string) =>
    Array.from(
      root().querySelectorAll<HTMLElement>(
        '[data-testid="selection-pane-layer"]'
      )
    ).find(row => row.dataset.id === id)!;
  const elementRow = (id: string) =>
    Array.from(
      root().querySelectorAll<HTMLElement>('[data-testid="selection-pane-row"]')
    ).find(row => row.dataset.id === id)!;
  const layerRowIds = () =>
    Array.from(
      root().querySelectorAll<HTMLElement>(
        '[data-testid="selection-pane-layer"]'
      )
    ).map(row => row.dataset.id);
  const layers = () => surface().props.layers ?? {};
  const userLayerId = () =>
    Object.keys(layers()).find(id => id !== DEFAULT_LAYER_ID)!;

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

  const newLayer = async () => {
    await userEvent.click(
      page.elementLocator(
        root().querySelector('[data-testid="selection-pane-new-layer"]')!
      )
    );
    await settle();
  };

  test('a new layer is active, and what is drawn next stacks above', async () => {
    const below = shape(0);
    await settle();
    await openPane();

    await newLayer();

    const created = userLayerId();
    expect(layers()[DEFAULT_LAYER_ID].name).toBe('Layer 1');
    expect(layers()[created].name).toBe('Layer 2');
    expect(layerRowIds()).toEqual([created, DEFAULT_LAYER_ID]);
    expect(layerRow(created).hasAttribute('data-active')).toBe(true);
    expect(events.at(-1)).toEqual({
      name: 'CanvasLayerChanged',
      props: { page: 'whiteboard editor', action: 'create', layerCount: 2 },
    });

    const above = shape(50);
    await settle();
    expect(ownLayerOf(model(above))).toBe(created);
    expect(ownLayerOf(model(below))).toBeUndefined();

    // Back to the default layer: a later shape, with a HIGHER index, still
    // stacks under the user layer — rank first.
    await userEvent.click(
      page.elementLocator(
        layerRow(DEFAULT_LAYER_ID).querySelector('.selection-pane-label')!
      )
    );
    await settle();
    const later = shape(60);
    await settle();
    expect(ownLayerOf(model(later))).toBeUndefined();
    expect(model(later).index > model(above).index).toBe(true);
    expect(gfx().getElementByPoint(75, 50)?.id).toBe(above);
  });

  test('rename in place, reorder by drag, collapse', async () => {
    const plain = shape(800);
    await settle();
    await openPane();
    await newLayer();
    const created = userLayerId();
    const top = shape(810);
    await settle();
    expect(gfx().getElementByPoint(850, 50)?.id).toBe(top);

    // A new layer opens straight into its rename field.
    const input = layerRow(created).querySelector<HTMLInputElement>(
      '[data-testid="selection-pane-rename"]'
    )!;
    expect(input, 'the new layer row is a rename field').toBeTruthy();
    await userEvent.fill(page.elementLocator(input), 'Annotations');
    await userEvent.keyboard('{Enter}');
    await settle();
    expect(layers()[created].name).toBe('Annotations');

    // And a double-click renames it again later.
    await userEvent.dblClick(
      page.elementLocator(
        layerRow(created).querySelector('.selection-pane-label')!
      )
    );
    await settle();
    const again = layerRow(created).querySelector<HTMLInputElement>(
      '[data-testid="selection-pane-rename"]'
    )!;
    expect(again, 'the layer row turned into a rename field').toBeTruthy();
    await userEvent.keyboard('{Escape}');
    await settle();
    expect(layers()[created].name).toBe('Annotations');

    // Drop the default layer on the top half of the user layer: above it.
    await userEvent.dragAndDrop(
      page.elementLocator(layerRow(DEFAULT_LAYER_ID)),
      page.elementLocator(layerRow(created)),
      { targetPosition: { x: 60, y: 3 } }
    );
    await settle();
    expect(layerRowIds()).toEqual([DEFAULT_LAYER_ID, created]);
    expect(gfx().getElementByPoint(850, 50)?.id).toBe(plain);

    const updates: Uint8Array[] = [];
    window.doc.doc.spaceDoc.on('update', (update: Uint8Array) =>
      updates.push(update)
    );
    await userEvent.click(
      page.elementLocator(
        layerRow(created).querySelector(
          '[data-testid="selection-pane-collapse"]'
        )!
      )
    );
    await settle();
    expect(elementRow(top)).toBeUndefined();
    expect(updates).toHaveLength(0);
  });

  test('under a frame filter, every layer is listed and a new one is unmistakable', async () => {
    const inside = shape(0);
    const outside = shape(800);
    const frame = edgeless.service.crud.addBlock(
      'affine:frame',
      { xywh: '[-50,-50,300,300]', childElementIds: { [inside]: true } },
      surface().id
    );
    await settle();
    await openPane();
    await newLayer();
    const second = userLayerId();
    // Keep the seeded name: Enter in the open field writes nothing.
    await userEvent.keyboard('{Enter}');
    await settle();
    await userEvent.dragAndDrop(
      page.elementLocator(elementRow(outside)),
      page.elementLocator(layerRow(second)),
      { targetPosition: { x: 60, y: 10 } }
    );
    await settle();
    expect(ownLayerOf(model(outside))).toBe(second);

    await userEvent.click(
      page.elementLocator(
        root().querySelector('[data-testid="selection-pane-filter"]')!
      )
    );
    await wait(100);
    const frameEntry = deepQueryAll(document, 'affine-menu-button').find(
      button => button.textContent?.includes('Frame:')
    );
    expect(frameEntry, 'the filter offers the frame').toBeTruthy();
    await userEvent.click(page.elementLocator(frameEntry!));
    await settle();
    expect(frame).toBeTruthy();

    // Both layers are listed; the one whose only member is off the frame says
    // so, in words, instead of vanishing.
    expect(layerRowIds()).toEqual([second, DEFAULT_LAYER_ID]);
    expect(elementRow(outside)).toBeUndefined();
    expect(elementRow(inside)).toBeTruthy();
    const note = root().querySelector<HTMLElement>(
      '[data-testid="selection-pane-layer-filtered"]'
    );
    expect(note?.dataset.id).toBe(second);
    expect(note?.textContent?.trim()).toBe('1 hidden by the filter');

    // A third layer: listed at the top, its name field open and focused,
    // the filter untouched.
    await newLayer();
    const third = Object.keys(layers()).find(
      id => id !== DEFAULT_LAYER_ID && id !== second
    )!;
    expect(layerRowIds()).toEqual([third, second, DEFAULT_LAYER_ID]);
    const input = layerRow(third).querySelector<HTMLInputElement>(
      '[data-testid="selection-pane-rename"]'
    );
    expect(input, 'the new layer opens in rename').toBeTruthy();
    expect(root().activeElement).toBe(input);
    expect(
      root().querySelector('[data-testid="selection-pane-filter-label"]')
    ).toBeTruthy();
    await userEvent.fill(page.elementLocator(input!), 'Notes');
    await userEvent.keyboard('{Enter}');
    await settle();
    expect(layers()[third].name).toBe('Notes');
  });

  test('a canvas row dropped on a layer row moves into that layer', async () => {
    const a = shape(0);
    await settle();
    await openPane();
    await newLayer();
    const created = userLayerId();

    await userEvent.dragAndDrop(
      page.elementLocator(elementRow(a)),
      page.elementLocator(layerRow(created)),
      { targetPosition: { x: 60, y: 10 } }
    );
    await settle();

    expect(ownLayerOf(model(a))).toBe(created);
    expect(layerRow(created).nextElementSibling?.getAttribute('data-id')).toBe(
      a
    );
    expect(events.at(-1)?.props).toMatchObject({
      action: 'move-elements',
      memberCount: 1,
    });
  });

  test('bring to front stays inside the layer', async () => {
    const low = shape(0);
    await settle();
    await openPane();
    await newLayer();
    const upper = shape(10);
    await userEvent.click(
      page.elementLocator(
        layerRow(DEFAULT_LAYER_ID).querySelector('.selection-pane-label')!
      )
    );
    await settle();
    const other = shape(20);
    await settle();

    const index = gfx().layer.getReorderedIndex(model(low), 'front');
    gfx().updateElement(low, { index });
    await settle();

    // Top of the default layer, still under the user layer.
    expect(model(low).index > model(other).index).toBe(true);
    expect(gfx().getElementByPoint(50, 50)?.id).toBe(upper);
  });

  test('group across layers, then ungroup', async () => {
    await openPane();
    await newLayer();
    const created = userLayerId();
    const inUser = shape(0);
    await userEvent.click(
      page.elementLocator(
        layerRow(DEFAULT_LAYER_ID).querySelector('.selection-pane-label')!
      )
    );
    await settle();
    const inDefault = shape(200);
    await settle();

    gfx().selection.set({ elements: [inUser, inDefault], editing: false });
    // The toolbar's own command.
    const [, result] = edgeless.std.command.exec(
      createGroupFromSelectedCommand
    );
    const groupId = result.groupId!;
    await settle();
    expect(ownLayerOf(model(groupId))).toBe(created);

    // A member keeps its stale own key while grouped; ungrouping rewrites it.
    edgeless.std.command.exec(ungroupCommand, {
      group: model(groupId) as GroupElementModel,
    });
    await settle();
    expect(ownLayerOf(model(inUser))).toBe(created);
    expect(ownLayerOf(model(inDefault))).toBe(created);
  });

  test('a second client sees layers and members; its new layer shows here', async () => {
    const a = shape(0);
    await settle();
    const space = window.doc.doc.spaceDoc;
    const peer = new Y.Doc();
    Y.applyUpdate(peer, Y.encodeStateAsUpdate(space));
    space.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin !== 'peer') Y.applyUpdate(peer, update, 'author');
    });
    const peerSurface = () =>
      peer.getMap<Y.Map<unknown>>('blocks').get(surface().id)!;

    await openPane();
    await newLayer();
    const created = userLayerId();
    await userEvent.dragAndDrop(
      page.elementLocator(elementRow(a)),
      page.elementLocator(layerRow(created)),
      { targetPosition: { x: 60, y: 10 } }
    );
    await settle();

    const peerLayers = peerSurface().get('prop:layers') as Y.Map<
      Y.Map<unknown>
    >;
    expect(peerLayers.get(created)?.get('name')).toBe('Layer 2');
    const peerElements = (
      peerSurface().get('prop:elements') as Y.Map<unknown>
    ).get('value') as Y.Map<Y.Map<unknown>>;
    expect(peerElements.get(a)?.get('layer')).toBe(created);

    // The peer adds a layer of its own, one record, key by key.
    const before = Y.encodeStateVector(peer);
    const record = new Y.Map<unknown>();
    record.set('name', 'From the peer');
    record.set('index', 'b0');
    peerLayers.set('peer-layer', record);
    Y.applyUpdate(space, Y.encodeStateAsUpdate(peer, before), 'peer');
    await settle();

    expect(layerRowIds()).toEqual(['peer-layer', created, DEFAULT_LAYER_ID]);
    expect(
      layerRow('peer-layer').querySelector('.selection-pane-label')?.textContent
    ).toBe('From the peer');
  });
});
