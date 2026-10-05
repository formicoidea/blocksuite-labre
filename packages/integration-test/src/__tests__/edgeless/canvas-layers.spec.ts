/**
 * User layers (ADR 0031, stage 6) on a real editor, through the selection
 * pane and a real mouse.
 *
 * The unit suite (`affine/all/.../canvas-layers.unit.spec.ts`) owns the
 * comparator, the creation rule and the writes on a bare document. This one
 * owns what only a mounted editor can answer:
 *
 * - a fresh canvas shows "Layer 1" holding every row, and opening the pane
 *   writes nothing; renaming it records it; a second layer leaves it its
 *   name; its row menu has no delete (ADR 0031 amendments: one layer at
 *   least, visible from the start);
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
 *   creates shows up in this pane;
 * - a frame drawn with the frame tool (`f`, then a real drag) or made from the
 *   selection (`f` with a selection) lands in the active layer, one undo
 *   removes it, and with only the default layer it writes no `layer` key. Both
 *   paths used to write through `store.addBlock` unstamped: the frame always
 *   fell in "Layer 1" whatever layer was active;
 * - what ADR 0031 §6 says arrives in the active layer does: a paste from
 *   another document, a template insertion, an interchange import, and an
 *   image or attachment put on the canvas. Templates and files bypassed the
 *   stamp the same way frames did, and landed in the default layer;
 * - what §6 says stays beside its source does: `mod+d` and a real copy then
 *   paste in the same document leave every copy — element or block — in its
 *   source's layer, and a copy of what is hidden for everyone stays hidden.
 *   Frames, images and most other blocks were rebuilt from a few snapshot
 *   props, so their copies fell in the active layer, visible;
 * - the clone gestures (mod+d, a real alt-drag) keep a copy of a
 *   default-layer element or block in the default layer, with no `layer` key,
 *   while a paste of the same model lands in the active layer — the
 *   difference the ADR 0031 amendment makes on purpose.
 */
import { addAttachments } from '@labre/affine/blocks/attachment';
import { addImages } from '@labre/affine/blocks/image';
import {
  createElementsFromClipboardDataCommand,
  type EdgelessRootBlockComponent,
} from '@labre/affine/blocks/root';
import { importInterchangeFile } from '@labre/affine/blocks/surface';
import {
  createGroupFromSelectedCommand,
  ungroupCommand,
} from '@labre/affine/gfx/group';
import {
  createTemplateJob,
  templateManagerFor,
} from '@labre/affine/gfx/template';
import { type GroupElementModel, ShapeType } from '@labre/affine/model';
import {
  SelectionPaneProvider,
  TelemetryExtension,
} from '@labre/affine/shared/services';
import {
  DEFAULT_LAYER_ID,
  type GfxModel,
  isStoredHiddenForEveryone,
  ownLayerOf,
  type SerializedElement,
} from '@labre/affine/std/gfx';
import { decodeDrawio, UML_DRAWIO_IMPORT } from '@labre/affine-gfx-uml';
import { IS_MAC } from '@labre/global/env';
import { commands, page, userEvent } from '@vitest/browser/context';
import { beforeEach, describe, expect, test } from 'vitest';
import * as Y from 'yjs';

// The corpus as a string, as `uml-import.spec.ts` reads it.
import DRAWIO_COMPRESSED from '../../../../affine/gfx/uml/src/__tests__/corpus/drawio-class-iwlayer.drawio.xml?raw';

import { dragModel } from '../utils/canvas-gesture.js';
import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { pointerDown, pointerMoveTo, pointerUp } from '../utils/pointer.js';
import { setupEditor } from '../utils/setup.js';

declare module '@vitest/browser/context' {
  interface BrowserCommands {
    /** Grant or take back the clipboard permissions (`vitest.config.ts`). */
    systemClipboard: (granted: boolean) => Promise<void>;
  }
}

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

  test('a fresh canvas shows "Layer 1"; renaming records it, a second layer keeps it', async () => {
    // The product owner's decision (ADR 0031 amendments): the default layer
    // is visible from the start, and recorded only by a gesture needing it.
    const a = shape(0);
    const b = shape(200);
    await settle();
    const updates: Uint8Array[] = [];
    window.doc.doc.spaceDoc.on('update', (update: Uint8Array) =>
      updates.push(update)
    );

    await openPane();

    expect(layerRowIds()).toEqual([DEFAULT_LAYER_ID]);
    const label = () =>
      layerRow(DEFAULT_LAYER_ID).querySelector('.selection-pane-label')
        ?.textContent;
    expect(label()).toBe('Layer 1');
    expect(layerRow(DEFAULT_LAYER_ID).hasAttribute('data-active')).toBe(true);
    const rows = Array.from(
      root().querySelectorAll<HTMLElement>(
        '[data-testid="selection-pane-layer"], [data-testid="selection-pane-row"]'
      )
    );
    expect(
      rows.map(row => [row.dataset.id, row.getAttribute('aria-level')])
    ).toEqual([
      [DEFAULT_LAYER_ID, '1'],
      [b, '2'],
      [a, '2'],
    ]);
    expect(updates, 'opening the pane writes nothing').toHaveLength(0);
    expect(surface().props.layers).toBeUndefined();

    // The default layer offers no delete: it is the one that keeps a canvas
    // at one layer.
    await userEvent.click(
      page.elementLocator(
        layerRow(DEFAULT_LAYER_ID).querySelector(
          '[data-testid="selection-pane-more"]'
        )!
      )
    );
    await wait(100);
    expect(
      deepQueryAll(document, '[data-testid="selection-pane-hide-for-everyone"]')
        .length,
      'the row menu opened'
    ).toBeGreaterThan(0);
    expect(
      deepQueryAll(document, '[data-testid="selection-pane-delete-layer"]')
    ).toHaveLength(0);
    await userEvent.keyboard('{Escape}');
    await settle();

    // Rename it in place: that records it, once.
    await userEvent.dblClick(
      page.elementLocator(
        layerRow(DEFAULT_LAYER_ID).querySelector('.selection-pane-label')!
      )
    );
    await settle();
    const input = layerRow(DEFAULT_LAYER_ID).querySelector<HTMLInputElement>(
      '[data-testid="selection-pane-rename"]'
    )!;
    expect(input, 'the default layer row is a rename field').toBeTruthy();
    expect(input.value).toBe('Layer 1');
    await userEvent.fill(page.elementLocator(input), 'Background');
    await userEvent.keyboard('{Enter}');
    await settle();
    expect(Object.keys(layers())).toEqual([DEFAULT_LAYER_ID]);
    expect(layers()[DEFAULT_LAYER_ID].name).toBe('Background');
    expect(label()).toBe('Background');

    // A second layer: two rows, the first kept its name.
    await newLayer();
    await userEvent.keyboard('{Enter}');
    await settle();
    const created = userLayerId();
    expect(layerRowIds()).toEqual([created, DEFAULT_LAYER_ID]);
    expect(layers()[DEFAULT_LAYER_ID].name).toBe('Background');
    expect(label()).toBe('Background');
    expect(layers()[created].name).toBe('Layer 2');
  });

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

  describe('a new frame lands in the active layer', () => {
    const CANVAS = 'affine-edgeless-root';
    const frameIds = () =>
      gfx()
        .layer.blocks.filter(block => block.flavour === 'affine:frame')
        .map(block => block.id);
    const ownLayerKey = (id: string) =>
      window.doc.getBlock(id)!.model.yBlock.has('prop:layer');

    /** `f` with nothing selected arms the frame tool; then a real drag. */
    const drawFrame = async () => {
      gfx().selection.clear();
      edgeless.std.host.focus();
      await userEvent.keyboard('f');
      await settle();
      expect(gfx().tool.currentToolName$.peek()).toBe('frame');
      const before = new Set(frameIds());
      // Right half: the open selection pane is a column down the left edge.
      await pointerMoveTo(CANVAS, 0.6, 0.3, 1);
      await pointerDown();
      await pointerMoveTo(CANVAS, 0.75, 0.55, 8);
      await pointerUp();
      await settle();
      const drawn = frameIds().filter(id => !before.has(id));
      expect(drawn, 'the drag drew one frame').toHaveLength(1);
      return drawn[0];
    };

    test('drawn with the frame tool: listed under the active layer, one undo removes it', async () => {
      await openPane();
      await newLayer();
      await userEvent.keyboard('{Enter}');
      await settle();
      const created = userLayerId();
      expect(layerRow(created).hasAttribute('data-active')).toBe(true);

      const frame = await drawFrame();

      expect(ownLayerOf(model(frame))).toBe(created);
      expect(
        layerRow(created).nextElementSibling?.getAttribute('data-id'),
        'the frame row sits under the active layer'
      ).toBe(frame);

      window.doc.undo();
      await settle();
      expect(frameIds()).not.toContain(frame);
    });

    test('made from the selection: lands in the active layer too', async () => {
      await openPane();
      await newLayer();
      await userEvent.keyboard('{Enter}');
      await settle();
      const created = userLayerId();
      const inside = shape(100);
      await settle();
      gfx().selection.set({ elements: [inside], editing: false });
      await settle();

      const before = new Set(frameIds());
      // Focus without a click, which would clear the selection.
      edgeless.std.host.focus();
      await userEvent.keyboard('f');
      await settle();
      const made = frameIds().filter(id => !before.has(id));

      expect(made).toHaveLength(1);
      expect(ownLayerOf(model(made[0]))).toBe(created);
    });

    test('only the default layer: the drawn frame writes no layer key', async () => {
      const frame = await drawFrame();
      expect(surface().props.layers).toBeUndefined();
      expect(ownLayerKey(frame)).toBe(false);
    });
  });

  // ADR 0031 §6 names three arrivals that land in the active layer whatever
  // they carried: a paste from another document, a template, an import.
  describe('what arrives lands in the active layer', () => {
    const activeUserLayer = async () => {
      await openPane();
      await newLayer();
      await userEvent.keyboard('{Enter}');
      await settle();
      return userLayerId();
    };
    const newIds = (before: Set<string>) =>
      [
        ...surface().elementModels.map(element => element.id),
        ...gfx().layer.blocks.map(block => block.id),
      ].filter(id => !before.has(id));
    const allIds = () =>
      new Set([
        ...surface().elementModels.map(element => element.id),
        ...gfx().layer.blocks.map(block => block.id),
      ]);

    test('a paste from another document: an element and a frame', async () => {
      const created = await activeUserLayer();
      const before = allIds();
      const foreign = 'a-layer-of-another-document';

      const [, { createdElementsPromise }] = edgeless.std.command.exec(
        createElementsFromClipboardDataCommand,
        {
          elementsRawData: [
            {
              type: 'shape',
              id: 'pasted-shape',
              index: 'a0',
              xywh: '[0,0,100,100]',
              shapeType: ShapeType.Rect,
              layer: foreign,
            } as unknown as SerializedElement,
            {
              type: 'block',
              id: 'pasted-frame',
              flavour: 'affine:frame',
              version: 1,
              props: {
                xywh: '[-20,-20,200,200]',
                index: 'a1',
                title: {
                  '$blocksuite:internal:text$': true,
                  delta: [{ insert: 'Pasted' }],
                },
                childElementIds: {},
                layer: foreign,
              },
              children: [],
            },
          ],
          pasteCenter: [400, 300],
        }
      );
      await createdElementsPromise;
      await settle();

      const pasted = newIds(before);
      expect(pasted).toHaveLength(2);
      for (const id of pasted) expect(ownLayerOf(model(id)), id).toBe(created);
    });

    test('a template insertion', async () => {
      const created = await activeUserLayer();
      const before = allIds();
      const swot = (await templateManagerFor(edgeless.std).list('Other')).find(
        template => template.name === 'SWOT'
      )!;
      await createTemplateJob(edgeless.std, swot.type).insertTemplate(
        swot.content
      );
      await settle();

      const inserted = newIds(before);
      expect(inserted.length).toBeGreaterThan(0);
      expect(
        inserted.filter(id => ownLayerOf(model(id)) !== created),
        'every inserted model is in the active layer'
      ).toEqual([]);
    });

    // Files dropped or uploaded onto the canvas: several blocks at once, through
    // `store.addBlocks` rather than the stamped CRUD path.
    test('an image and an attachment put on the canvas', async () => {
      const created = await activeUserLayer();
      const canvas = document.createElement('canvas');
      canvas.width = 8;
      canvas.height = 8;
      canvas.getContext('2d')!.fillRect(0, 0, 8, 8);
      const png = await new Promise<Blob>(resolve =>
        canvas.toBlob(blob => resolve(blob!), 'image/png')
      );

      const images = await addImages(
        edgeless.std,
        [new File([png], 'dot.png', { type: 'image/png' })],
        {}
      );
      const attachments = await addAttachments(edgeless.std, [
        new File(['hello'], 'hello.txt', { type: 'text/plain' }),
      ]);
      await settle();

      expect(images).toHaveLength(1);
      expect(attachments).toHaveLength(1);
      for (const id of [...images, ...attachments]) {
        expect(ownLayerOf(model(id)), id).toBe(created);
      }
    });

    test('an interchange import', async () => {
      const created = await activeUserLayer();
      const before = allIds();
      await importInterchangeFile(
        edgeless.std,
        UML_DRAWIO_IMPORT,
        {
          name: 'iwlayer.drawio',
          text: () => Promise.resolve(DRAWIO_COMPRESSED),
        } as unknown as File,
        { decode: decodeDrawio }
      );
      await settle();

      const imported = newIds(before);
      expect(imported.length).toBeGreaterThan(0);
      expect(
        imported.filter(id => ownLayerOf(model(id)) !== created),
        'every imported model is in the active layer'
      ).toEqual([]);
    });
  });

  // ADR 0031 §6: a duplicate, an alt-drag clone and a paste within the same
  // document keep the source's layer. Gfx blocks used to lose it: most
  // `EdgelessClipboardConfig.createBlock` rebuild the block from a handful of
  // the snapshot's props, so the copy fell in the active layer instead.
  describe('a duplicate stays beside its source', () => {
    const MOD = IS_MAC ? 'Meta' : 'Control';
    const chord = (key: string) => `{${MOD}>}${key}{/${MOD}}`;
    const allIds = () =>
      new Set([
        ...surface().elementModels.map(element => element.id),
        ...gfx().layer.blocks.map(block => block.id),
      ]);
    const newIds = (before: Set<string>) =>
      [...allIds()].filter(id => !before.has(id));
    const flavourOf = (id: string) =>
      (model(id) as { flavour?: string }).flavour ??
      (model(id) as { type?: string }).type;

    /**
     * A shape (the elements' rule, already right) and one block of each kind
     * the report names, all drawn in a second layer; then the default layer
     * is made active, so "the active layer" and "the source's layer" differ.
     */
    const sourcesInASecondLayer = async () => {
      await openPane();
      await newLayer();
      await userEvent.keyboard('{Enter}');
      await settle();
      const created = userLayerId();

      const crud = edgeless.service.crud;
      const note = crud.addBlock(
        'affine:note',
        { xywh: '[0,400,300,100]' },
        window.doc.root!.id
      );
      window.doc.addBlock('affine:paragraph', {}, note);
      const text = crud.addBlock(
        'affine:edgeless-text',
        { xywh: '[400,400,200,50]' },
        surface().id
      );
      window.doc.addBlock('affine:paragraph', {}, text);
      const frame = crud.addBlock(
        'affine:frame',
        { xywh: '[0,800,300,300]', childElementIds: {} },
        surface().id
      );
      const canvas = document.createElement('canvas');
      canvas.width = 8;
      canvas.height = 8;
      canvas.getContext('2d')!.fillRect(0, 0, 8, 8);
      const png = await new Promise<Blob>(resolve =>
        canvas.toBlob(blob => resolve(blob!), 'image/png')
      );
      const [image] = await addImages(
        edgeless.std,
        [new File([png], 'dot.png', { type: 'image/png' })],
        { point: [800, 400], shouldTransformPoint: false }
      );
      const element = shape(1200);
      await settle();
      const sources = [element, note, text, frame, image];
      for (const id of sources) expect(ownLayerOf(model(id)), id).toBe(created);

      await userEvent.click(
        page.elementLocator(
          layerRow(DEFAULT_LAYER_ID).querySelector('.selection-pane-label')!
        )
      );
      await settle();
      expect(layerRow(DEFAULT_LAYER_ID).hasAttribute('data-active')).toBe(true);
      return { created, sources };
    };

    const expectCopiesIn = (
      layer: string,
      sources: string[],
      copies: string[]
    ) => {
      expect(copies.map(flavourOf).sort()).toEqual(
        sources.map(flavourOf).sort()
      );
      expect(
        copies
          .filter(id => ownLayerOf(model(id)) !== layer)
          .map(id => [flavourOf(id), ownLayerOf(model(id))]),
        'every copy is in its source layer'
      ).toEqual([]);
    };

    const selectAndFocus = async (ids: string[]) => {
      gfx().selection.set({ elements: ids, editing: false });
      // Focus without a click, which would change the selection.
      edgeless.std.host.focus();
      await settle();
    };

    test('mod+d on a shape, a note, an edgeless text, a frame and an image', async () => {
      const { created, sources } = await sourcesInASecondLayer();
      const before = allIds();

      await selectAndFocus(sources);
      await userEvent.keyboard(chord('d'));
      await settle();

      expectCopiesIn(created, sources, newIds(before));

      // The layer is written after the block is created: still one gesture.
      window.doc.undo();
      await settle();
      expect(newIds(before)).toEqual([]);
    });

    test('copy then paste in the same document', async () => {
      const { created, sources } = await sourcesInASecondLayer();
      const before = allIds();

      await selectAndFocus(sources);
      await commands.systemClipboard(true);
      try {
        await userEvent.keyboard(chord('c'));
        await settle();
        await userEvent.keyboard(chord('v'));
        await settle();
      } finally {
        await commands.systemClipboard(false);
      }

      expectCopiesIn(created, sources, newIds(before));
    });

    // An element's duplicate carries every prop it serialized, `hiddenForEveryone`
    // included; a block's duplicate behaves the same (ADR 0031, "What stays
    // loadable": kept through copy).
    test('a duplicate of what is hidden for everyone stays hidden, block or element', async () => {
      const { sources } = await sourcesInASecondLayer();
      for (const id of sources) {
        edgeless.service.crud.updateElement(id, { hiddenForEveryone: true });
      }
      await settle();
      const before = allIds();

      await selectAndFocus(sources);
      await userEvent.keyboard(chord('d'));
      await settle();

      const copies = newIds(before);
      expect(copies).toHaveLength(sources.length);
      expect(
        copies
          .filter(id => !isStoredHiddenForEveryone(model(id)))
          .map(flavourOf),
        'every copy is hidden like its source'
      ).toEqual([]);
    });

    // ADR 0031, amendment "A duplicate stays in its source's layer, the
    // default one included": the clone gestures (mod+d, alt-drag) know their
    // source and ask for its layer explicitly; a paste cannot tell "the default
    // layer" from "another document", so it keeps the §6 rule.
    describe('the clone gestures, the default layer included', () => {
      const hasLayerKey = (id: string) => {
        const target = model(id) as unknown as {
          yMap?: Y.Map<unknown>;
          yBlock?: Y.Map<unknown>;
        };
        return target.yMap
          ? target.yMap.has('layer')
          : target.yBlock!.has('prop:layer');
      };
      const addNote = (xywh: string) => {
        const note = edgeless.service.crud.addBlock(
          'affine:note',
          { xywh },
          window.doc.root!.id
        );
        window.doc.addBlock('affine:paragraph', {}, note);
        return note;
      };

      /** A shape, a note and a frame drawn while only the default exists. */
      const sourcesInTheDefaultLayer = async () => {
        const sources = [
          shape(500),
          addNote('[500,300,300,100]'),
          edgeless.service.crud.addBlock(
            'affine:frame',
            { xywh: '[500,600,300,300]', childElementIds: {} },
            surface().id
          ),
        ];
        await settle();
        await openPane();
        await newLayer();
        await userEvent.keyboard('{Enter}');
        await settle();
        const created = userLayerId();
        expect(layerRow(created).hasAttribute('data-active')).toBe(true);
        for (const id of sources) {
          expect(ownLayerOf(model(id)), id).toBeUndefined();
        }
        return { created, sources };
      };

      /**
       * Hold Alt and drag `id` by a real mouse. `dragModel` sets its own
       * camera, presses a point derived from the model (clear of the pane down
       * the left edge and of the auto-pan edge zone) and checks the canvas
       * answers that model there first, so a missed press fails loudly.
       */
      const altDrag = async (id: string) => {
        await dragModel(edgeless, model(id), { alt: true });
        await settle();
      };

      test('mod+d: a shape, a note and a frame of the default layer stay in it', async () => {
        const { sources } = await sourcesInTheDefaultLayer();
        const before = allIds();

        await selectAndFocus(sources);
        await userEvent.keyboard(chord('d'));
        await settle();

        const copies = newIds(before);
        expect(copies.map(flavourOf).sort()).toEqual(
          sources.map(flavourOf).sort()
        );
        expect(
          copies
            .filter(id => ownLayerOf(model(id)) !== undefined)
            .map(flavourOf),
          'every copy is in the default layer'
        ).toEqual([]);
        expect(
          copies.filter(hasLayerKey).map(flavourOf),
          'and writes no layer key'
        ).toEqual([]);

        window.doc.undo();
        await settle();
        expect(newIds(before)).toEqual([]);
      });

      test('alt-drag: a shape and a note of the default layer stay in it', async () => {
        const { sources } = await sourcesInTheDefaultLayer();
        const [element, note] = sources;

        for (const id of [element, note]) {
          const before = allIds();
          await altDrag(id);
          const copies = newIds(before);
          expect(copies.map(flavourOf), flavourOf(id)).toEqual([flavourOf(id)]);
          expect(ownLayerOf(model(copies[0])), flavourOf(id)).toBeUndefined();
          expect(hasLayerKey(copies[0]), flavourOf(id)).toBe(false);

          window.doc.undo();
          await settle();
          expect(
            newIds(before),
            `one undo removes the ${flavourOf(id)} clone`
          ).toEqual([]);
        }
      });

      test('alt-drag: a shape and a note of a user layer stay in it', async () => {
        const { created, sources } = await sourcesInASecondLayer();
        const [element, note] = sources;

        for (const id of [element, note]) {
          const before = allIds();
          await altDrag(id);
          const copies = newIds(before);
          expect(copies.map(flavourOf), flavourOf(id)).toEqual([flavourOf(id)]);
          expect(ownLayerOf(model(copies[0])), flavourOf(id)).toBe(created);
        }
      });

      test('a paste of a default-layer shape still lands in the active layer', async () => {
        const { created, sources } = await sourcesInTheDefaultLayer();
        const [element] = sources;
        const before = allIds();

        await selectAndFocus([element]);
        await commands.systemClipboard(true);
        try {
          await userEvent.keyboard(chord('c'));
          await settle();
          await userEvent.keyboard(chord('v'));
          await settle();
        } finally {
          await commands.systemClipboard(false);
        }

        const copies = newIds(before);
        expect(copies).toHaveLength(1);
        expect(ownLayerOf(model(copies[0]))).toBe(created);
      });
    });
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
