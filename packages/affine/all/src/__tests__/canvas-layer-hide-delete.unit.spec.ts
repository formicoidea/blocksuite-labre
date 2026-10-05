/**
 * ADR 0031, stage 7 — hiding and deleting a whole user layer, on a real
 * document.
 *
 * - A LOCAL layer hide is this viewer's: a set of layer ids beside the hidden
 *   elements, persisted per document in `localStorage`, pruned of layers the
 *   document lost, ZERO Yjs update — and every model whose effective layer is
 *   hidden is hidden by the shared predicate (`gfx.localVisibility`).
 * - "Hide for everyone" on a layer writes `hidden: true` on its RECORD — one
 *   write, never one per member — removes the key on show, is one undo step,
 *   refuses a read-only store, and reaches a peer through the update
 *   (`GfxHiddenForEveryone.layerIds$`).
 * - Deleting a layer deletes its members with it in ONE undo step, refuses the
 *   default layer and a read-only store, and leaves a connector of another
 *   layer whose ends were in it (loose, as any deleted end leaves it).
 */
import {
  CanvasActiveLayer,
  selectionPaneCommands,
  type SurfaceBlockModel,
  userLayerCommands,
} from '@labre/affine-block-surface';
import { StoreExtensionManager } from '@labre/affine-ext-loader';
import {
  CanvasLocalVisibility,
  EditPropsStore,
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
import { afterEach, describe, expect, test } from 'vitest';
import * as Y from 'yjs';

import { getInternalStoreExtensions } from '../extensions/store.js';

let seq = 0;

function createBoard(id = `layer-hide-${seq++}`) {
  const manager = new StoreExtensionManager(getInternalStoreExtensions({}));
  const collection = new TestWorkspace({ id });
  collection.storeExtensions = manager.get('store');
  collection.meta.initialize();
  const store = collection.createDoc(id).getStore({ id });
  let surfaceId = '';
  let rootId = '';
  store.load(() => {
    rootId = store.addBlock('affine:page', { title: new Text('l') });
    surfaceId = store.addBlock('affine:surface', {}, rootId);
  });
  const surface = store.getBlock(surfaceId)!.model as SurfaceBlockModel;
  surface.props.layers = {
    [DEFAULT_LAYER_ID]: { name: 'Layer 1', index: 'a0' },
    top: { name: 'Layer 2', index: 'a1' },
  };
  const shape = (index: string, layer?: string) =>
    surface.addElement({
      type: 'shape',
      xywh: '[0,0,10,10]',
      index,
      ...(layer ? { layer } : {}),
    });
  store.resetHistory();
  return { store, surface, rootId, shape };
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
    // `GfxController.updateElement` / `deleteElement`, verbatim in behaviour.
    updateElement(element: GfxModel | string, props: Record<string, unknown>) {
      const id = typeof element === 'string' ? element : element.id;
      if (surface.hasElementById(id)) {
        surface.updateElement(id, props);
      } else {
        const block = store.getBlock(id);
        if (block) store.updateBlock(block.model, props);
      }
    },
    deleteElement(element: GfxModel | string) {
      const id = typeof element === 'string' ? element : element.id;
      if (surface.hasElementById(id)) {
        surface.deleteElement(id);
      } else {
        const block = store.getBlock(id)?.model;
        if (block) store.deleteBlock(block);
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
  services.set(CanvasActiveLayer, new CanvasActiveLayer(std));
  const visibility = new CanvasLocalVisibility(std);
  services.set(CanvasLocalVisibility, visibility);
  visibility.mounted();
  return { std, gfx, visibility, events };
}

const command = (id: string) =>
  [...selectionPaneCommands, ...userLayerCommands].find(c => c.id === id)!;
const PANE = {
  surface: 'contextual-toolbar',
  source: 'toolbar:general',
} as const;

afterEach(() => {
  localStorage.clear();
});

describe('a local layer hide', () => {
  test('hides every member for this viewer, and writes nothing', () => {
    const { store, surface, shape } = createBoard();
    const a = shape('a1', 'top');
    const member = shape('a2');
    const group = surface.addElement({
      type: 'group',
      children: { [member]: true },
      layer: 'top',
    });
    const other = shape('a3');
    const { std, gfx, events } = mount(store, surface);
    store.resetHistory();
    const updates: Uint8Array[] = [];
    store.doc.spaceDoc.on('update', update => updates.push(update));
    const el = (id: string) => surface.getElementById(id)!;

    runCommand(std, command('canvas.visibility.hideLocal'), PANE, {
      layerIds: ['top'],
    });

    expect(gfx.localVisibility.isHidden(el(a))).toBe(true);
    expect(gfx.localVisibility.isHidden(el(group))).toBe(true);
    // Inside a group of the hidden layer, whatever its own key says.
    expect(gfx.localVisibility.isHidden(el(member))).toBe(true);
    expect(gfx.localVisibility.isHidden(el(other))).toBe(false);
    expect(updates).toHaveLength(0);
    expect(store.canUndo).toBe(false);
    expect(events.at(-1)?.props).toEqual({
      page: 'whiteboard editor',
      target: 'layer',
      scope: 'local',
      hidden: true,
      count: 1,
    });

    runCommand(std, command('canvas.visibility.showAll'), PANE);
    expect(gfx.localVisibility.isHidden(el(a))).toBe(false);
  });

  test('is remembered per document and pruned of a deleted layer', () => {
    const { store, surface } = createBoard();
    surface.props.layers!.gone = { name: 'Gone', index: 'a2' };
    const first = mount(store, surface);
    first.visibility.hideLayers(['top', 'gone']);
    first.visibility.unmounted();

    delete surface.props.layers!.gone;
    const second = mount(store, surface);
    expect([...second.visibility.hiddenLayerIds$.value]).toEqual(['top']);
    const third = mount(store, surface);
    expect([...third.visibility.hiddenLayerIds$.value]).toEqual(['top']);
  });
});

describe('a layer hidden for everyone', () => {
  test('one write on the record, the key removed on show, one undo each', () => {
    const { store, surface, shape } = createBoard();
    const a = shape('a1', 'top');
    const { std, gfx, events } = mount(store, surface);
    store.resetHistory();

    runCommand(std, command('canvas.visibility.hideForEveryone'), PANE, {
      layerIds: ['top'],
    });

    const record = () =>
      (surface.yBlock.get('prop:layers') as Y.Map<Y.Map<unknown>>).get('top')!;
    expect(record().get('hidden')).toBe(true);
    expect(gfx.hiddenForEveryone.layerIds$.value.has('top')).toBe(true);
    expect(gfx.localVisibility.isHidden(surface.getElementById(a)!)).toBe(true);
    // The member itself carries nothing.
    expect(surface.getElementById(a)!.yMap.has('hiddenForEveryone')).toBe(
      false
    );
    expect(events.at(-1)?.props).toMatchObject({
      target: 'layer',
      scope: 'everyone',
      hidden: true,
      count: 1,
    });

    runCommand(std, command('canvas.visibility.hideForEveryone'), PANE, {
      layerIds: ['top'],
      hidden: false,
    });
    expect(record().has('hidden')).toBe(false);
    expect(gfx.localVisibility.isHidden(surface.getElementById(a)!)).toBe(
      false
    );

    store.undo();
    expect(record().get('hidden')).toBe(true);
    store.undo();
    expect(record().has('hidden')).toBe(false);
    expect(store.canUndo).toBe(false);
  });

  test('a read-only store refuses', () => {
    const { store, surface } = createBoard();
    const { std } = mount(store, surface);
    store.readonly = true;
    command('canvas.visibility.hideForEveryone').run(std, PANE, {
      layerIds: ['top'],
    });
    expect(surface.props.layers!.top.hidden).toBeUndefined();
  });

  test('a peer receiving the update hides the layer too', () => {
    const author = createBoard('layer-hide-author');
    const a = author.shape('a1', 'top');
    const peer = createBoard('layer-hide-peer');
    const peerSpace = peer.store.doc.spaceDoc;
    Y.applyUpdate(peerSpace, Y.encodeStateAsUpdate(author.store.doc.spaceDoc));
    const peerSurface = [...peer.store.getAllModels()].find(
      model => model.id === author.surface.id
    ) as SurfaceBlockModel;
    const theirs = mount(peer.store, peerSurface);

    const { std } = mount(author.store, author.surface);
    runCommand(std, command('canvas.visibility.hideForEveryone'), PANE, {
      layerIds: ['top'],
    });
    Y.applyUpdate(
      peerSpace,
      Y.encodeStateAsUpdate(
        author.store.doc.spaceDoc,
        Y.encodeStateVector(peerSpace)
      ),
      'remote'
    );

    expect(theirs.gfx.hiddenForEveryone.layerIds$.value.has('top')).toBe(true);
    expect(
      theirs.gfx.localVisibility.isHidden(peerSurface.getElementById(a)!)
    ).toBe(true);
  });
});

describe('deleting a layer', () => {
  test('takes its members with it, in one undo step', () => {
    const { store, surface, shape, rootId } = createBoard();
    const a = shape('a1', 'top');
    const member = shape('a2');
    const group = surface.addElement({
      type: 'group',
      children: { [member]: true },
      layer: 'top',
    });
    const note = store.addBlock(
      'affine:note',
      { xywh: '[0,0,100,50]', layer: 'top' },
      rootId
    );
    const kept = shape('a3');
    // A connector of the default layer whose two ends are in `top`.
    const connector = surface.addElement({
      type: 'connector',
      source: { id: a },
      target: { id: member },
    });
    const { std, events } = mount(store, surface);
    store.resetHistory();

    runCommand(std, command('canvas.layer.delete'), PANE, { id: 'top' });

    for (const id of [a, member, group]) {
      expect(surface.getElementById(id), id).toBeNull();
    }
    expect(store.getBlock(note)).toBeFalsy();
    expect(surface.getElementById(kept)).toBeTruthy();
    expect(surface.getElementById(connector)).toBeTruthy();
    expect(Object.keys(surface.props.layers!)).toEqual([DEFAULT_LAYER_ID]);
    expect(events.at(-1)?.props).toEqual({
      page: 'whiteboard editor',
      action: 'delete',
      layerCount: 1,
      memberCount: 4,
    });

    store.undo();
    for (const id of [a, member, group]) {
      expect(surface.getElementById(id), id).toBeTruthy();
    }
    expect(store.getBlock(note)).toBeTruthy();
    expect(surface.props.layers!.top.name).toBe('Layer 2');
    expect(store.canUndo).toBe(false);
  });

  test('the default layer and a read-only store are refused', () => {
    const { store, surface, shape } = createBoard();
    const a = shape('a1');
    const b = shape('a2', 'top');
    const { std, events } = mount(store, surface);

    runCommand(std, command('canvas.layer.delete'), PANE, {
      id: DEFAULT_LAYER_ID,
    });
    expect(surface.getElementById(a)).toBeTruthy();

    store.readonly = true;
    command('canvas.layer.delete').run(std, PANE, { id: 'top' });
    expect(surface.getElementById(b)).toBeTruthy();
    expect(surface.props.layers!.top).toBeTruthy();
    expect(events).toEqual([]);
  });
});
