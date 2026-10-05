/**
 * The paste's z-order is the canvas' z-order: a parity test.
 *
 * `pastedIndexes` decides the order pasted elements are stacked in, and it
 * cannot use the canvas' comparator (`compareLayer`): it runs on the PASTED
 * DATA, before any model exists, so it reads parentage off the data
 * (`pastedParentage`) and keeps its own copy of the ancestor rule. That copy
 * is deliberate, and CLAUDE.md asks deliberate duplication to be held by a
 * parity test: this is it. A drift would re-stack a pasted board — a group's
 * member under a shape it sat over, a frame's member out of its frame's place.
 *
 * The set is generated (seeded, so a failure replays): loose shapes, groups,
 * nested groups, frames holding shapes and groups, and user layers on a third
 * of the top-level models. The paste does not read layers, and does not need
 * to: two models in different layers stack by their layers' rank whatever
 * their indexes say (ADR 0031 §4), so the parity asked is the order of every
 * pair that shares an effective layer. Checked on the whole board and on
 * selections closed under containment — a copied container brings its
 * contents.
 *
 * Not held: a selection that SPLITS a container, a frame's member copied with
 * an element outside the frame (or a group's member picked inside the group).
 * The canvas stacks that member by its container's index, the paste — which
 * did not receive the container — by the member's own, so the two orders
 * differ (measured with this generator: every seed diverges). Whether the
 * paste should stack by the source container is a product decision, reported
 * rather than decided here.
 */
import {
  getSurfaceBlock,
  type SurfaceBlockModel,
  SurfaceBlockSchemaExtension,
} from '@labre/affine-block-surface';
import {
  FrameBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import type { BlockStdScope } from '@labre/std';
import {
  compareLayer,
  DEFAULT_LAYER_ID,
  GfxBlockElementModel,
  type GfxModel,
  GfxPrimitiveElementModel,
  type SerializedElement,
} from '@labre/std/gfx';
import type { BlockSnapshot, Store } from '@labre/store';
import { Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { describe, expect, test } from 'vitest';

import {
  pastedIndexes,
  pastedParentage,
} from '../edgeless/clipboard/paste-order.js';

let seq = 0;

function createBoard() {
  const collection = new TestWorkspace({ id: `paste-order-${seq++}` });
  collection.storeExtensions = [
    RootBlockSchemaExtension,
    SurfaceBlockSchemaExtension,
    FrameBlockSchemaExtension,
  ];
  collection.meta.initialize();
  const store = collection.createDoc().getStore();
  store.load(() => {
    const rootId = store.addBlock('affine:page', { title: new Text('p') });
    store.addBlock('affine:surface', {}, rootId);
  });
  return { store, surface: getSurfaceBlock(store) as SurfaceBlockModel };
}

/** A small deterministic generator (mulberry32), so a failure replays. */
function random(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A board of loose shapes, groups (some nested), frames holding shapes and
 * groups, and three user layers. Every index is unique and drawn at random,
 * so a container sits above some of its members and below others.
 */
function generatedBoard(seed: number) {
  const next = random(seed);
  const pick = <T>(list: readonly T[]) =>
    list[Math.floor(next() * list.length)];
  const { store, surface } = createBoard();

  const pool = Array.from(
    { length: 400 },
    (_, i) => `a${i.toString(36).padStart(3, '0')}`
  );
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const index = () => pool.pop()!;

  surface.props.layers = {
    [DEFAULT_LAYER_ID]: { name: 'Layer 1', index: 'a0' },
    back: { name: 'Back', index: 'Zz' },
    front: { name: 'Front', index: 'a5' },
  };
  const layer = () => pick([undefined, undefined, 'back', 'front']);

  const shape = () =>
    surface.addElement({
      type: 'shape',
      xywh: '[0,0,10,10]',
      index: index(),
      layer: layer(),
    });
  const group = (children: string[]) =>
    surface.addElement({
      type: 'group',
      children: Object.fromEntries(children.map(id => [id, true])),
      index: index(),
      layer: layer(),
    });

  const free: string[] = Array.from({ length: 40 }, shape);
  const take = (n: number) => free.splice(0, n);

  const groups: string[] = [];
  for (let g = 0; g < 8; g++)
    groups.push(group(take(1 + Math.floor(next() * 3))));
  // Nested: a group holding a group and a shape of its own.
  for (let g = 0; g < 3; g++) {
    groups.push(group([groups.shift()!, ...take(1)]));
  }
  for (let f = 0; f < 3; f++) {
    const members = [
      ...take(2),
      ...(groups.length > 2 ? [groups.shift()!] : []),
    ];
    store.addBlock(
      'affine:frame',
      {
        xywh: `[${f * 100},0,100,100]`,
        index: index(),
        layer: layer(),
        title: new Text(`Frame ${f + 1}`),
        childElementIds: Object.fromEntries(members.map(id => [id, true])),
      },
      surface.id
    );
  }

  const models = (): GfxModel[] => [
    ...store
      .getAllModels()
      .filter(
        (model): model is GfxBlockElementModel =>
          model instanceof GfxBlockElementModel
      ),
    ...surface.elementModels,
  ];
  return { store, surface, models };
}

/** What a copy hands the clipboard, as `pastedIndexes` reads it. */
function rawDataOf(models: readonly GfxModel[]) {
  return models.map(model => {
    if (model instanceof GfxPrimitiveElementModel) {
      return model.serialize() as SerializedElement;
    }
    const block = model as GfxBlockElementModel & {
      props: { childElementIds?: Record<string, boolean> };
    };
    return {
      type: 'block',
      id: block.id,
      flavour: block.flavour,
      version: 1,
      props: {
        index: block.index,
        childElementIds: { ...block.props.childElementIds },
      },
      children: [],
    } as unknown as BlockSnapshot;
  });
}

/** The index generator the paste takes from the layer manager. */
function stdStub(store: Store) {
  let n = 0;
  return {
    store,
    get: () => ({
      layer: {
        createIndexGenerator: () => () =>
          `b${(n++).toString(36).padStart(4, '0')}`,
      },
    }),
  } as unknown as BlockStdScope;
}

/** The new indexes the paste would write, by the pasted model's id. */
function pasted(store: Store, models: readonly GfxModel[]) {
  const raw = rawDataOf(models);
  return pastedIndexes(
    stdStub(store),
    raw,
    pastedParentage(raw),
    new Map<string, string>()
  );
}

/** Every same-layer pair the paste orders unlike the canvas, as ids. */
function divergences(
  surface: SurfaceBlockModel,
  models: readonly GfxModel[],
  newIndexes: ReadonlyMap<string, string>
) {
  const layerOf = (model: GfxModel) =>
    surface.userLayers.effectiveLayerOf(model);
  const found: string[] = [];
  for (const a of models) {
    for (const b of models) {
      if (a === b || layerOf(a) !== layerOf(b)) continue;
      const canvas = Math.sign(compareLayer(a, b));
      const ai = newIndexes.get(a.id)!;
      const bi = newIndexes.get(b.id)!;
      const paste = ai === bi ? 0 : ai < bi ? -1 : 1;
      if (canvas !== paste) found.push(`${a.id} vs ${b.id}`);
    }
  }
  return found;
}

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

describe('the paste stacks what it pastes as the canvas stacked it', () => {
  test.each(SEEDS)('the whole board, seed %i', seed => {
    const { store, surface, models } = generatedBoard(seed);
    const all = models();
    expect(all.length).toBeGreaterThan(40);
    expect(divergences(surface, all, pasted(store, all))).toEqual([]);
  });

  test.each(SEEDS)('a selection and its contents, seed %i', seed => {
    const { store, surface, models } = generatedBoard(seed);
    const next = random(seed * 31);
    const all = models();
    const containerOf = new Map<string, string>();
    for (const data of rawDataOf(all)) {
      const children =
        'flavour' in data ? data.props.childElementIds : data.children;
      for (const id of Object.keys((children ?? {}) as object)) {
        containerOf.set(id, data.id);
      }
    }
    const byId = new Map(all.map(model => [model.id, model]));
    const descendants = (id: string): string[] => [
      id,
      ...[...containerOf]
        .filter(([, parent]) => parent === id)
        .flatMap(([child]) => descendants(child)),
    ];
    const topLevel = all.filter(model => !containerOf.has(model.id));
    const chosen = topLevel.filter(() => next() < 0.5);
    const selection = [
      ...new Set(chosen.flatMap(model => descendants(model.id))),
    ].map(id => byId.get(id)!);

    expect(selection.length).toBeGreaterThan(0);
    expect(divergences(surface, selection, pasted(store, selection))).toEqual(
      []
    );
  });
});
