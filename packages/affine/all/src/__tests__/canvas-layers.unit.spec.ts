/**
 * ADR 0031, stage 6 — user layers, on a real document.
 *
 * A layer is a record on the surface (`layers`), membership is one optional
 * `layer` id on each element and gfx block, and stacking is layer rank first,
 * then today's comparator. What this spec pins:
 *
 * - the schemas: `layers` on the surface and `layer` on the fifteen gfx block
 *   schemas, each with an `undefined` default (loading writes nothing);
 * - the comparator: rank first; a group's members follow the outermost
 *   group's layer; frames are not counted; a dangling id is the default layer
 *   and is never rewritten; and, with no `layers`, the FAST PATH sorts exactly
 *   as the comparator did before layers existed (a verbatim copy of it below);
 * - the budget: 500 elements over three layers sort inside one frame;
 * - creation: an id of this surface is kept, anything else lands in the
 *   viewer's active layer, `'@default'` is explicit, no layer writes nothing;
 * - the writes: the first creation writes two seeded records at once, later
 *   ones one record; rename / reorder write one field; a move writes the
 *   outermost group; read-only refuses; each reports `CanvasLayerChanged`;
 * - concurrency: two peers creating two layers keep both, and a rename racing
 *   a reorder of one layer merges — key-by-key writes. The first-layer race
 *   (open point 6, accepted for v1) is documented as it behaves: one record
 *   set wins, the loser's members read as the default layer, nothing dropped.
 */
import {
  buildSelectionPaneTree,
  CanvasActiveLayer,
  paneLayersOf,
  resolveCreationLayer,
  type SurfaceBlockModel,
  userLayerCommands,
} from '@labre/affine-block-surface';
import { StoreExtensionManager } from '@labre/affine-ext-loader';
import { TelemetryProvider } from '@labre/affine-shared/services';
import { type BlockStdScope, runCommand } from '@labre/std';
import {
  compareLayer,
  DEFAULT_LAYER_ID,
  GfxBlockElementModel,
  GfxControllerIdentifier,
  type GfxGroupCompatibleInterface,
  GfxLocalElementModel,
  type GfxModel,
  isGfxGroupCompatibleModel,
} from '@labre/std/gfx';
import { internalPrimitives, type Store, Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { describe, expect, test } from 'vitest';
import * as Y from 'yjs';

import { getInternalStoreExtensions } from '../extensions/store.js';

/** One 60 fps frame — the budget the Wardley bench holds the engine to. */
const FRAME_BUDGET_MS = 16;
const SAMPLES = 10;

let seq = 0;

function createBoard(id = `layers-${seq++}`) {
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
  const gfx = {
    surface,
    surface$: { value: surface },
    selection: { selectedIds: [] as string[] },
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
  services.set(TelemetryProvider, {
    track: (name: string, props: Record<string, unknown>) =>
      events.push({ name, props }),
  });
  const active = new CanvasActiveLayer(std);
  services.set(CanvasActiveLayer, active);
  return { std, gfx, active, events };
}

const command = (id: string) =>
  userLayerCommands.find(candidate => candidate.id === id)!;
const PALETTE = { surface: 'palette', source: 'shortcut' } as const;

const sorted = (models: GfxModel[]) => [...models].sort(compareLayer);
const ids = (models: GfxModel[]) => models.map(model => model.id);

describe('the schemas', () => {
  test('layers on the surface, layer on every gfx block, undefined defaults', () => {
    const { store, surface } = createBoard();
    const schemas = [...store.schema.flavourSchemaMap.values()].map(schema => ({
      flavour: schema.model.flavour,
      props: (schema.model.props?.(internalPrimitives) ?? {}) as Record<
        string,
        unknown
      >,
    }));
    const gfxSchemas = schemas.filter(
      ({ props }) => 'xywh' in props && 'index' in props
    );
    expect(gfxSchemas).toHaveLength(15);
    for (const { flavour, props } of gfxSchemas) {
      expect('layer' in props, flavour).toBe(true);
      expect(props.layer, flavour).toBeUndefined();
    }
    const surfaceProps = schemas.find(s => s.flavour === 'affine:surface')!;
    expect('layers' in surfaceProps.props).toBe(true);
    expect(surfaceProps.props.layers).toBeUndefined();
    expect(surface.yBlock.has('prop:layers')).toBe(false);
  });
});

/**
 * `compare` as it was before ADR 0031 stage 6, VERBATIM (packages/framework/
 * std/src/utils/layer.ts at the stage-5 commit), local-element branch
 * included. The fast-path test sorts with both and expects the same order.
 */
function todaysCompareLocal(
  a: GfxModel | GfxLocalElementModel,
  b: GfxModel | GfxLocalElementModel
) {
  const compareIndex = (x: string, y: string) => (x === y ? 0 : x < y ? -1 : 1);
  const isALocal = a instanceof GfxLocalElementModel;
  const isBLocal = b instanceof GfxLocalElementModel;
  if (isALocal && a.creator && a.creator === b) return 1;
  if (isBLocal && b.creator && b.creator === a) return -1;
  if (isALocal && isBLocal && a.creator && a.creator === b.creator) {
    return compareIndex(a.index, b.index);
  }
  return {
    a: isALocal && a.creator ? a.creator : a,
    b: isBLocal && b.creator ? b.creator : b,
  };
}

function todaysCompare(
  a: GfxModel | GfxLocalElementModel,
  b: GfxModel | GfxLocalElementModel
): number {
  const compareIndex = (x: string, y: string) => (x === y ? 0 : x < y ? -1 : 1);
  const result = todaysCompareLocal(a, b);
  if (typeof result === 'number') return result;
  a = result.a;
  b = result.b;
  if (isGfxGroupCompatibleModel(a) && b.groups.includes(a)) return -1;
  if (isGfxGroupCompatibleModel(b) && a.groups.includes(b)) return 1;
  const aGroups = a.groups as GfxGroupCompatibleInterface[];
  const bGroups = b.groups as GfxGroupCompatibleInterface[];
  let i = 1;
  let aGroup: { index: string } | undefined = aGroups.at(-i);
  let bGroup: { index: string } | undefined = bGroups.at(-i);
  while (aGroup === bGroup && aGroup) {
    ++i;
    aGroup = aGroups.at(-i);
    bGroup = bGroups.at(-i);
  }
  aGroup = aGroup ?? a;
  bGroup = bGroup ?? b;
  return compareIndex(aGroup.index, bGroup.index);
}

/** A board with loose shapes, a nested group, notes and a frame. */
function mixedBoard(count: number) {
  const board = createBoard();
  const { store, surface, rootId, shape } = board;
  const loose: string[] = [];
  for (let i = 0; i < count; i++) {
    loose.push(shape(`a${String(i).padStart(4, '0')}`));
  }
  const inner = surface.addElement({
    type: 'group',
    children: { [loose[1]]: true, [loose[2]]: true },
    index: 'a0005',
  });
  surface.addElement({
    type: 'group',
    children: { [inner]: true, [loose[3]]: true },
    index: 'a0002',
  });
  const notes = [0, 1, 2].map(i =>
    store.addBlock(
      'affine:note',
      { xywh: `[0,${i * 100},100,50]`, index: `a00${i}5` },
      rootId
    )
  );
  store.addBlock(
    'affine:frame',
    {
      xywh: '[0,0,500,500]',
      index: 'a0001',
      childElementIds: { [loose[4]]: true, [notes[0]]: true },
    },
    surface.id
  );
  const models = (): GfxModel[] => [
    ...surface.elementModels,
    ...[...store.getAllModels()].filter(
      (model): model is GfxBlockElementModel =>
        model instanceof GfxBlockElementModel
    ),
  ];
  return { ...board, loose, notes, models };
}

describe('the comparator', () => {
  test('no layers: the fast path sorts exactly as before layers existed', () => {
    const { models } = mixedBoard(60);
    const all = models();
    // A deterministic shuffle, so both sorts start from the same disorder.
    const shuffled = all
      .map((model, i) => ({ model, key: (i * 7919) % all.length }))
      .sort((x, y) => x.key - y.key)
      .map(({ model }) => model);

    expect(ids([...shuffled].sort(compareLayer))).toEqual(
      ids([...shuffled].sort(todaysCompare))
    );
  });

  test('rank first; a group’s members follow the group; frames do not count', () => {
    const { surface, shape, store, rootId } = createBoard();
    surface.props.layers = {
      [DEFAULT_LAYER_ID]: { name: 'Layer 1', index: 'a0' },
      back: { name: 'Back', index: 'Zz' },
      front: { name: 'Front', index: 'a5' },
    };
    const high = shape('a9', 'back');
    const low = shape('a1', 'front');
    const middle = shape('a5');
    const member = shape('a0', 'back');
    const group = surface.addElement({
      type: 'group',
      children: { [member]: true },
      index: 'a2',
      layer: 'front',
    });
    const note = store.addBlock(
      'affine:note',
      { xywh: '[0,0,10,10]', index: 'a3', layer: 'back' },
      rootId
    );
    const el = (id: string) =>
      (surface.getElementById(id) ?? store.getModelById(id)) as GfxModel;

    // back (rank Zz): note a3, high a9 — then the default layer (a0):
    // middle — then front (a5): low a1, the group a2 and, right above it,
    // its member, whose own `back` is ignored inside the group.
    expect(
      ids(sorted([low, high, middle, group, member, note].map(el)))
    ).toEqual([note, high, middle, low, group, member]);
  });

  test('a frame does not carry its children into its layer', () => {
    const { surface, shape, store } = createBoard();
    surface.props.layers = {
      [DEFAULT_LAYER_ID]: { name: 'Layer 1', index: 'a0' },
      back: { name: 'Back', index: 'Zz' },
      front: { name: 'Front', index: 'a5' },
    };
    const inside = shape('a9', 'back');
    const frame = store.addBlock(
      'affine:frame',
      {
        xywh: '[0,0,500,500]',
        index: 'a1',
        layer: 'front',
        childElementIds: { [inside]: true },
      },
      surface.id
    );
    const child = surface.getElementById(inside) as GfxModel;
    const frameModel = store.getModelById(frame) as GfxModel;

    expect(surface.userLayers.effectiveLayerOf(child)).toBe('back');
    // A background layer under a content layer inside one frame.
    expect(ids(sorted([frameModel, child]))).toEqual([inside, frame]);
  });

  test('a dangling layer id reads as the default layer and is kept', () => {
    const { surface, shape } = createBoard();
    surface.props.layers = {
      [DEFAULT_LAYER_ID]: { name: 'Layer 1', index: 'a0' },
      top: { name: 'Top', index: 'a1' },
    };
    const lost = shape('a9', 'deleted-elsewhere');
    const plain = shape('a5');
    const onTop = shape('a1', 'top');
    const el = (id: string) => surface.getElementById(id)!;

    expect(ids(sorted([onTop, lost, plain].map(el)))).toEqual([
      plain,
      lost,
      onTop,
    ]);
    expect(surface.userLayers.effectiveLayerOf(el(lost))).toBe(
      DEFAULT_LAYER_ID
    );
    expect(el(lost).layer).toBe('deleted-elsewhere');
  });

  test('budget: 500 elements over three layers sort inside one frame', () => {
    const { surface, shape } = createBoard();
    const layerIds = [DEFAULT_LAYER_ID, 'middle', 'top'];
    const elements: GfxModel[] = [];
    for (let i = 0; i < 500; i++) {
      const layer = layerIds[i % 3];
      const id = shape(
        `a${String(i).padStart(4, '0')}`,
        layer === DEFAULT_LAYER_ID ? undefined : layer
      );
      elements.push(surface.getElementById(id) as GfxModel);
    }
    const measure = () => {
      let best = Infinity;
      for (let s = 0; s < SAMPLES; s++) {
        const copy = [...elements].reverse();
        const start = performance.now();
        copy.sort(compareLayer);
        best = Math.min(best, performance.now() - start);
      }
      return best;
    };
    const noLayers = measure();
    surface.props.layers = {
      [DEFAULT_LAYER_ID]: { name: 'Layer 1', index: 'a0' },
      middle: { name: 'Layer 2', index: 'a1' },
      top: { name: 'Layer 3', index: 'a2' },
    };
    const threeLayers = measure();

    console.info(
      `layers budget: 500 elements, no layer ${noLayers.toFixed(2)} ms, three layers ${threeLayers.toFixed(2)} ms (best of ${SAMPLES})`
    );
    expect(noLayers).toBeLessThan(FRAME_BUDGET_MS);
    expect(threeLayers).toBeLessThan(FRAME_BUDGET_MS);
  });
});

describe('creation lands in the right layer', () => {
  test('kept, active, explicit default, or nothing at all', () => {
    const { store, surface } = createBoard();
    const { std, active } = mount(store, surface);
    expect(resolveCreationLayer(std, 'anything')).toBeUndefined();

    surface.props.layers = {
      [DEFAULT_LAYER_ID]: { name: 'Layer 1', index: 'a0' },
      mine: { name: 'Mine', index: 'a1' },
      other: { name: 'Other', index: 'a2' },
    };
    expect(resolveCreationLayer(std, 'other')).toBe('other');
    expect(resolveCreationLayer(std, undefined)).toBeUndefined();
    active.choose('mine');
    expect(resolveCreationLayer(std, undefined)).toBe('mine');
    expect(resolveCreationLayer(std, 'from-another-doc')).toBe('mine');
    expect(resolveCreationLayer(std, DEFAULT_LAYER_ID)).toBeUndefined();
    // A chosen layer that is gone sends nothing to a dangling id.
    active.choose('gone');
    expect(resolveCreationLayer(std, undefined)).toBeUndefined();
  });
});

describe('the layer writes', () => {
  test('the first creation writes two seeded records; the next writes one', () => {
    const { store, surface } = createBoard();
    const { std, active, events } = mount(store, surface);

    runCommand(std, command('canvas.layer.create'), PALETTE);
    const first = surface.props.layers!;
    expect(Object.keys(first)).toHaveLength(2);
    expect(first[DEFAULT_LAYER_ID].name).toBe('Layer 1');
    const created = Object.keys(first).find(id => id !== DEFAULT_LAYER_ID)!;
    expect(first[created].name).toBe('Layer 2');
    expect(first[created].index > first[DEFAULT_LAYER_ID].index).toBe(true);
    expect(active.resolve()).toBe(created);

    const updates: Uint8Array[] = [];
    store.doc.spaceDoc.on('update', update => updates.push(update));
    runCommand(std, command('canvas.layer.create'), PALETTE, { name: 'Notes' });
    expect(Object.keys(surface.props.layers!)).toHaveLength(3);
    expect(
      Object.values(surface.props.layers!).map(record => record.name)
    ).toContain('Notes');
    expect(updates).toHaveLength(1);

    expect(events.map(event => event.props)).toEqual([
      { page: 'whiteboard editor', action: 'create', layerCount: 2 },
      { page: 'whiteboard editor', action: 'create', layerCount: 3 },
    ]);
  });

  test('rename and reorder write one field; one undo step each', () => {
    const { store, surface } = createBoard();
    const { std } = mount(store, surface);
    runCommand(std, command('canvas.layer.create'), PALETTE);
    const created = Object.keys(surface.props.layers!).find(
      id => id !== DEFAULT_LAYER_ID
    )!;
    store.resetHistory();

    runCommand(std, command('canvas.layer.rename'), PALETTE, {
      id: created,
      name: 'Annotations',
    });
    expect(surface.props.layers![created].name).toBe('Annotations');

    runCommand(std, command('canvas.layer.reorder'), PALETTE, {
      id: created,
      above: null,
    });
    const layers = surface.props.layers!;
    expect(layers[created].index < layers[DEFAULT_LAYER_ID].index).toBe(true);

    store.undo();
    expect(
      surface.props.layers![created].index >
        surface.props.layers![DEFAULT_LAYER_ID].index
    ).toBe(true);
    expect(surface.props.layers![created].name).toBe('Annotations');
    store.undo();
    expect(surface.props.layers![created].name).toBe('Layer 2');
  });

  test('a move writes the outermost group; default clears the key', () => {
    const { store, surface, shape } = createBoard();
    const { std, events } = mount(store, surface);
    runCommand(std, command('canvas.layer.create'), PALETTE);
    const created = Object.keys(surface.props.layers!).find(
      id => id !== DEFAULT_LAYER_ID
    )!;
    const member = shape('a1');
    const group = surface.addElement({
      type: 'group',
      children: { [member]: true },
    });
    const loose = shape('a3');
    events.length = 0;

    runCommand(std, command('canvas.layer.moveElements'), PALETTE, {
      ids: [member, loose],
      layerId: created,
    });

    expect(surface.getElementById(group)!.layer).toBe(created);
    expect(surface.getElementById(member)!.yMap.has('layer')).toBe(false);
    expect(surface.getElementById(loose)!.layer).toBe(created);
    expect(events.at(-1)?.props).toMatchObject({
      action: 'move-elements',
      memberCount: 2,
    });

    runCommand(std, command('canvas.layer.moveElements'), PALETTE, {
      ids: [loose],
      layerId: DEFAULT_LAYER_ID,
    });
    expect(surface.getElementById(loose)!.yMap.has('layer')).toBe(false);
  });

  test('a read-only document refuses every layer write', () => {
    const { store, surface, shape } = createBoard();
    const { std, events } = mount(store, surface);
    runCommand(std, command('canvas.layer.create'), PALETTE);
    const created = Object.keys(surface.props.layers!).find(
      id => id !== DEFAULT_LAYER_ID
    )!;
    const a = shape('a1');
    events.length = 0;
    store.readonly = true;

    for (const descriptor of userLayerCommands) {
      expect(descriptor.availability, descriptor.id).toBe('editable');
    }
    command('canvas.layer.create').run(std, PALETTE, {});
    command('canvas.layer.rename').run(std, PALETTE, {
      id: created,
      name: 'X',
    });
    command('canvas.layer.reorder').run(std, PALETTE, {
      id: created,
      above: null,
    });
    command('canvas.layer.moveElements').run(std, PALETTE, {
      ids: [a],
      layerId: created,
    });

    expect(Object.keys(surface.props.layers!)).toHaveLength(2);
    expect(surface.props.layers![created].name).toBe('Layer 2');
    expect(surface.getElementById(a)!.layer).toBeUndefined();
    expect(events).toEqual([]);
  });
});

describe('two peers', () => {
  /** Two documents exchanging updates, as two clients do. */
  function pair() {
    const a = createBoard('layers-peer-a');
    const b = createBoard('layers-peer-b');
    Y.applyUpdate(
      b.store.doc.spaceDoc,
      Y.encodeStateAsUpdate(a.store.doc.spaceDoc)
    );
    const surfaceB = [...b.store.getAllModels()].find(
      model => model.id === a.surface.id
    ) as SurfaceBlockModel;
    const sync = () => {
      const docA = a.store.doc.spaceDoc;
      const docB = b.store.doc.spaceDoc;
      const toB = Y.encodeStateAsUpdate(docA, Y.encodeStateVector(docB));
      const toA = Y.encodeStateAsUpdate(docB, Y.encodeStateVector(docA));
      Y.applyUpdate(docB, toB, 'remote');
      Y.applyUpdate(docA, toA, 'remote');
    };
    return {
      a: { ...a, ...mount(a.store, a.surface) },
      b: { ...b, surface: surfaceB, ...mount(b.store, surfaceB) },
      sync,
    };
  }

  test('creating two different layers at once keeps both', () => {
    const { a, b, sync } = pair();
    runCommand(a.std, command('canvas.layer.create'), PALETTE);
    sync();

    runCommand(a.std, command('canvas.layer.create'), PALETTE, { name: 'A' });
    runCommand(b.std, command('canvas.layer.create'), PALETTE, { name: 'B' });
    sync();

    const names = (surface: SurfaceBlockModel) =>
      Object.values(surface.props.layers!)
        .map(record => record.name)
        .sort();
    expect(names(a.surface)).toEqual(['A', 'B', 'Layer 1', 'Layer 2']);
    expect(names(b.surface)).toEqual(names(a.surface));
  });

  test('a rename racing a reorder of one layer merges', () => {
    const { a, b, sync } = pair();
    runCommand(a.std, command('canvas.layer.create'), PALETTE);
    sync();
    const created = Object.keys(a.surface.props.layers!).find(
      id => id !== DEFAULT_LAYER_ID
    )!;

    runCommand(a.std, command('canvas.layer.rename'), PALETTE, {
      id: created,
      name: 'Renamed',
    });
    runCommand(b.std, command('canvas.layer.reorder'), PALETTE, {
      id: created,
      above: null,
    });
    sync();

    for (const surface of [a.surface, b.surface]) {
      const record = surface.props.layers![created];
      expect(record.name).toBe('Renamed');
      expect(record.index < surface.props.layers![DEFAULT_LAYER_ID].index).toBe(
        true
      );
    }
  });

  /**
   * ADR 0031 open point 6, accepted for v1: the FIRST layer is created by
   * writing the whole `layers` prop, so two peers doing it at once keep ONE
   * record set. The loser's members then name a layer with no record: they
   * read as the default layer — dangling, never dropped. This test documents
   * that behaviour; if the race is ever closed, it is the one to change.
   */
  test('the first-layer race: one record set wins, nothing is dropped', () => {
    const { a, b, sync } = pair();
    const shapeOnB = b.surface.addElement({
      type: 'shape',
      xywh: '[0,0,10,10]',
      index: 'a1',
    });
    sync();

    runCommand(a.std, command('canvas.layer.create'), PALETTE, { name: 'A' });
    runCommand(b.std, command('canvas.layer.create'), PALETTE, { name: 'B' });
    runCommand(b.std, command('canvas.layer.moveElements'), PALETTE, {
      ids: [shapeOnB],
      layerId: b.active.resolve(),
    });
    sync();

    const namesA = Object.values(a.surface.props.layers!).map(r => r.name);
    const namesB = Object.values(b.surface.props.layers!).map(r => r.name);
    expect(namesA.sort()).toEqual(namesB.sort());
    expect(namesA).toHaveLength(2);
    const winner = namesA.includes('A') ? 'A' : 'B';
    const element = a.surface.getElementById(shapeOnB)!;
    expect(element).toBeTruthy();
    expect(element.layer).toBeTruthy();
    if (winner === 'A') {
      expect(a.surface.userLayers.effectiveLayerOf(element)).toBe(
        DEFAULT_LAYER_ID
      );
    }
  });
});

describe('the pane tree with layers', () => {
  test('layers are the top-level rows, top first, members under each', () => {
    const { surface, shape } = createBoard();
    surface.props.layers = {
      [DEFAULT_LAYER_ID]: { name: 'Layer 1', index: 'a0' },
      top: { name: 'Top', index: 'a1' },
      empty: { name: 'Empty', index: 'a2' },
    };
    const a = shape('a5');
    const b = shape('a1', 'top');
    const models = [...surface.elementModels] as GfxModel[];
    const tree = buildSelectionPaneTree(
      models,
      undefined,
      paneLayersOf(surface)
    );

    expect(tree.map(node => [node.kind, node.id])).toEqual([
      ['layer', 'empty'],
      ['layer', 'top'],
      ['layer', DEFAULT_LAYER_ID],
    ]);
    expect(tree[0].children).toEqual([]);
    expect(tree[1].children!.map(node => node.id)).toEqual([b]);
    expect(tree[2].children!.map(node => [node.id, node.layerId])).toEqual([
      [a, DEFAULT_LAYER_ID],
    ]);
  });

  test('no layers: the tree is exactly the pre-layer tree', () => {
    const { surface, shape } = createBoard();
    shape('a1');
    shape('a2');
    expect(paneLayersOf(surface)).toBeNull();
    const tree = buildSelectionPaneTree([
      ...surface.elementModels,
    ] as GfxModel[]);
    expect(tree.every(node => node.kind === 'element')).toBe(true);
  });
});
