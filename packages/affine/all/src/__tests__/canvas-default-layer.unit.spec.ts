/**
 * ADR 0031, amendments — the default layer is always SHOWN, and recorded only
 * when a gesture needs it.
 *
 * The product owner's decision: "Layer 1" exists from the start and a canvas
 * never has fewer than one layer, so the layer feature is visible before the
 * first "New layer". The hard constraint is ADR 0031 §2: nothing is written on
 * load or on opening the pane. So, on a real document with no `layers`:
 *
 * - the headless tree (`selectionPaneTree`, hence the library's panel and a
 *   host's) is ONE layer node, `'@default'`, wrapping every row — the shape a
 *   canvas with layers has — named with the first-layer seed through the
 *   translation seam, and opening the pane produces ZERO Yjs update;
 * - the virtual row behaves like a recorded one wherever no record is needed:
 *   it is the active layer, a local hide hides its members and writes nothing,
 *   a drop onto it clears a dangling `layer`;
 * - the record is written by the gesture that needs it, once: a rename, a
 *   "hide for everyone", or the first "New layer" (which keeps the name the
 *   user sees);
 * - the default layer is the one that cannot be deleted, and with it alone the
 *   delete command is not offered at all — a canvas keeps one layer.
 */
import {
  buildSelectionPaneTree,
  CanvasActiveLayer,
  selectionPaneCommands,
  SelectionPaneModel,
  type SurfaceBlockModel,
  userLayerCommands,
  userLayerName,
} from '@labre/affine-block-surface';
import { StoreExtensionManager } from '@labre/affine-ext-loader';
import {
  CanvasLocalVisibility,
  EditPropsStore,
  SelectionPaneProvider,
  TelemetryProvider,
} from '@labre/affine-shared/services';
import { type BlockStdScope, runCommand } from '@labre/std';
import {
  DEFAULT_LAYER_ID,
  GfxBlockElementModel,
  GfxControllerIdentifier,
  GfxHiddenForEveryone,
  GfxLocalVisibility,
  type GfxModel,
} from '@labre/std/gfx';
import { type Store, Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { Subject } from 'rxjs';
import { afterEach, describe, expect, test } from 'vitest';

import { getInternalStoreExtensions } from '../extensions/store.js';

let seq = 0;

function createBoard(id = `default-layer-${seq++}`) {
  const manager = new StoreExtensionManager(getInternalStoreExtensions({}));
  const collection = new TestWorkspace({ id });
  collection.storeExtensions = manager.get('store');
  collection.meta.initialize();
  const store = collection.createDoc(id).getStore({ id });
  let surfaceId = '';
  store.load(() => {
    const rootId = store.addBlock('affine:page', { title: new Text('d') });
    surfaceId = store.addBlock('affine:surface', {}, rootId);
  });
  const surface = store.getBlock(surfaceId)!.model as SurfaceBlockModel;
  const shape = (index: string, layer?: string) =>
    surface.addElement({
      type: 'shape',
      xywh: '[0,0,10,10]',
      index,
      ...(layer ? { layer } : {}),
    });
  return { store, surface, shape };
}

function mount(store: Store, surface: SurfaceBlockModel) {
  const events: { name: string; props: Record<string, unknown> }[] = [];
  const hiddenForEveryone = new GfxHiddenForEveryone();
  hiddenForEveryone.watch(store, surface);
  const localVisibility = new GfxLocalVisibility();
  localVisibility.register(hiddenForEveryone.ids$);
  localVisibility.registerLayers(hiddenForEveryone.layerIds$);
  const gfx = {
    surface,
    surface$: { value: surface },
    hiddenForEveryone,
    localVisibility,
    layer: { slots: { layerUpdated: new Subject<unknown>() } },
    selection: { selectedIds: [] as string[] },
    get gfxElements(): GfxModel[] {
      const blocks = [...store.getAllModels()].filter(
        (model): model is GfxBlockElementModel =>
          model instanceof GfxBlockElementModel
      );
      return [...blocks, ...surface.elementModels];
    },
    getElementById(id: string) {
      return surface.getElementById(id) ?? store.getModelById(id) ?? null;
    },
    // `GfxController.updateElement`, verbatim in behaviour.
    updateElement(element: GfxModel | string, props: Record<string, unknown>) {
      const id = typeof element === 'string' ? element : element.id;
      if (surface.hasElementById(id)) {
        surface.updateElement(id, props);
      } else {
        const block = store.getBlock(id);
        if (block) store.updateBlock(block.model, props);
      }
    },
  };
  const services = new Map<unknown, unknown>();
  const std = {
    store,
    get: (identifier: unknown) =>
      identifier === GfxControllerIdentifier ? gfx : services.get(identifier),
    getOptional: (identifier: unknown) => services.get(identifier) ?? null,
  } as unknown as BlockStdScope;
  services.set(EditPropsStore, new EditPropsStore(std));
  services.set(TelemetryProvider, {
    track: (name: string, props: Record<string, unknown>) =>
      events.push({ name, props }),
  });
  const opened: string[] = [];
  services.set(SelectionPaneProvider, {
    open: () => opened.push('open'),
    close: () => opened.push('close'),
  });
  const active = new CanvasActiveLayer(std);
  services.set(CanvasActiveLayer, active);
  const visibility = new CanvasLocalVisibility(std);
  services.set(CanvasLocalVisibility, visibility);
  visibility.mounted();
  const pane = new SelectionPaneModel(std);
  services.set(SelectionPaneModel, pane);
  return { std, gfx, active, visibility, pane, events, opened };
}

const command = (id: string) =>
  [...selectionPaneCommands, ...userLayerCommands].find(c => c.id === id)!;
const PANE = {
  surface: 'contextual-toolbar',
  source: 'toolbar:general',
} as const;

/** Every Yjs update the document emits from now on. */
function recordUpdates(store: Store) {
  const updates: Uint8Array[] = [];
  store.doc.spaceDoc.on('update', (update: Uint8Array) => updates.push(update));
  return updates;
}

afterEach(() => {
  localStorage.clear();
});

describe('a canvas with no layer record', () => {
  test('shows one default layer, "Layer 1", holding every row', () => {
    const { store, surface, shape } = createBoard();
    const low = shape('a0');
    const member = shape('a1');
    const group = surface.addElement({
      type: 'group',
      children: { [member]: true },
      index: 'a2',
    });
    const high = shape('a3');
    const { std, gfx, pane, active } = mount(store, surface);
    pane.mounted();

    const tree = pane.tree$.value;

    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({
      id: DEFAULT_LAYER_ID,
      kind: 'layer',
      type: 'layer',
      layerId: DEFAULT_LAYER_ID,
      locked: false,
      hiddenLocal: false,
      hiddenForEveryone: false,
    });
    expect(tree[0].children!.map(node => node.id)).toEqual([high, group, low]);
    // The pure builder answers the same shape a host reads.
    expect(buildSelectionPaneTree(gfx.gfxElements)).toEqual(tree);
    expect(userLayerName(std, DEFAULT_LAYER_ID)).toBe('Layer 1');
    expect(active.resolve()).toBe(DEFAULT_LAYER_ID);
    pane.unmounted();
  });

  test('opening the pane produces zero Yjs update', () => {
    const { store, surface, shape } = createBoard();
    shape('a0');
    shape('a1');
    const { std, pane, opened } = mount(store, surface);
    store.resetHistory();
    const updates = recordUpdates(store);

    pane.mounted();
    runCommand(std, command('canvas.selectionPane.toggle'), PANE);
    pane.tree$.value;
    userLayerName(std, DEFAULT_LAYER_ID);

    expect(opened).toEqual(['open']);
    expect(updates).toHaveLength(0);
    expect(surface.yBlock.has('prop:layers')).toBe(false);
    expect(store.canUndo).toBe(false);
    // So the canvas still sorts on the comparator's fast path — exactly as a
    // document from before layers (pinned in `canvas-layers.unit.spec.ts`).
    expect(surface.userLayers.ranks).toBeNull();
    pane.unmounted();
  });

  test('a local hide of the default layer hides its members and writes nothing', () => {
    const { store, surface, shape } = createBoard();
    const a = shape('a0');
    const { std, gfx, pane } = mount(store, surface);
    pane.mounted();
    const updates = recordUpdates(store);

    runCommand(std, command('canvas.visibility.hideLocal'), PANE, {
      layerIds: [DEFAULT_LAYER_ID],
    });

    expect(gfx.localVisibility.isHidden(surface.getElementById(a)!)).toBe(true);
    expect(pane.tree$.value[0].hiddenLocal).toBe(true);
    expect(updates).toHaveLength(0);
    expect(surface.yBlock.has('prop:layers')).toBe(false);

    // Remembered across a reload: the default layer always exists, so it is
    // not pruned as a layer the document lost.
    const again = mount(store, surface);
    expect([...again.visibility.hiddenLayerIds$.value]).toEqual([
      DEFAULT_LAYER_ID,
    ]);
    pane.unmounted();
  });

  test('a drop onto it clears a dangling layer id', () => {
    const { store, surface, shape } = createBoard();
    const lost = shape('a0', 'from-another-doc');
    const { std } = mount(store, surface);

    runCommand(std, command('canvas.layer.moveElements'), PANE, {
      ids: [lost],
      layerId: DEFAULT_LAYER_ID,
    });

    expect(surface.getElementById(lost)!.yMap.has('layer')).toBe(false);
    expect(surface.yBlock.has('prop:layers')).toBe(false);
  });
});

describe('the default layer is recorded by the gesture that needs it', () => {
  test('a rename writes its record once, in one undo step', () => {
    const { store, surface, shape } = createBoard();
    shape('a0');
    const { std, events } = mount(store, surface);
    store.resetHistory();
    const updates = recordUpdates(store);

    // The seed name, unchanged: nothing to record.
    runCommand(std, command('canvas.layer.rename'), PANE, {
      id: DEFAULT_LAYER_ID,
      name: 'Layer 1',
    });
    expect(updates).toHaveLength(0);

    runCommand(std, command('canvas.layer.rename'), PANE, {
      id: DEFAULT_LAYER_ID,
      name: '  Background  ',
    });

    expect(surface.props.layers).toEqual({
      [DEFAULT_LAYER_ID]: { name: 'Background', index: 'a0' },
    });
    expect(updates).toHaveLength(1);
    expect(userLayerName(std, DEFAULT_LAYER_ID)).toBe('Background');
    expect(events.at(-1)).toEqual({
      name: 'CanvasLayerChanged',
      props: { page: 'whiteboard editor', action: 'rename', layerCount: 1 },
    });

    store.undo();
    expect(surface.props.layers).toBeUndefined();
    expect(store.canUndo).toBe(false);
  });

  test('a second layer keeps the name the user gave the default one', () => {
    const { store, surface } = createBoard();
    const { std } = mount(store, surface);
    runCommand(std, command('canvas.layer.rename'), PANE, {
      id: DEFAULT_LAYER_ID,
      name: 'Background',
    });

    runCommand(std, command('canvas.layer.create'), PANE);

    const layers = surface.props.layers!;
    const created = Object.keys(layers).find(id => id !== DEFAULT_LAYER_ID)!;
    expect(Object.keys(layers)).toHaveLength(2);
    expect(layers[DEFAULT_LAYER_ID].name).toBe('Background');
    expect(layers[created].name).toBe('Layer 2');
    expect(layers[created].index > layers[DEFAULT_LAYER_ID].index).toBe(true);
  });

  test('"hide for everyone" writes the record, hidden, with the seed name', () => {
    const { store, surface, shape } = createBoard();
    const a = shape('a0');
    const { std, gfx } = mount(store, surface);
    store.resetHistory();

    runCommand(std, command('canvas.visibility.hideForEveryone'), PANE, {
      layerIds: [DEFAULT_LAYER_ID],
    });

    expect(surface.props.layers).toEqual({
      [DEFAULT_LAYER_ID]: { name: 'Layer 1', index: 'a0', hidden: true },
    });
    expect(gfx.localVisibility.isHidden(surface.getElementById(a)!)).toBe(true);

    // Showing an unrecorded default layer again has nothing to write.
    store.undo();
    expect(surface.props.layers).toBeUndefined();
    const updates = recordUpdates(store);
    runCommand(std, command('canvas.visibility.hideForEveryone'), PANE, {
      layerIds: [DEFAULT_LAYER_ID],
      hidden: false,
    });
    expect(updates).toHaveLength(0);
  });
});

describe('a canvas keeps one layer', () => {
  test('the default layer cannot be deleted, and alone it offers no delete', () => {
    const { store, surface, shape } = createBoard();
    const a = shape('a0');
    const { std } = mount(store, surface);
    const remove = command('canvas.layer.delete');

    // No record: one layer, nothing to delete.
    expect(remove.when?.(std)).toBe(false);
    runCommand(std, remove, PANE, { id: DEFAULT_LAYER_ID });
    expect(surface.getElementById(a)).toBeTruthy();

    // Recorded alone (renamed): still one layer.
    runCommand(std, command('canvas.layer.rename'), PANE, {
      id: DEFAULT_LAYER_ID,
      name: 'Background',
    });
    expect(remove.when?.(std)).toBe(false);

    // A second layer is deletable; the default one never is.
    runCommand(std, command('canvas.layer.create'), PANE);
    expect(remove.when?.(std)).toBe(true);
    runCommand(std, remove, PANE, { id: DEFAULT_LAYER_ID });
    expect(surface.props.layers![DEFAULT_LAYER_ID]).toBeTruthy();
    expect(surface.getElementById(a)).toBeTruthy();
  });
});
