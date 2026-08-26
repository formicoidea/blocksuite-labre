import type { SurfaceBlockModel } from '@labre/affine-block-surface';
import {
  type ElementRenderer,
  ElementRendererIdentifier,
} from '@labre/affine-block-surface';
import {
  StoreExtensionManager,
  ViewExtensionManager,
} from '@labre/affine-ext-loader';
import { Container } from '@labre/global/di';
import type { DocSnapshot, Store } from '@labre/store';
import { Schema, Text, Transformer } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { describe, expect, test, vi } from 'vitest';

import { getInternalStoreExtensions } from '../extensions/store.js';
import { getInternalViewExtensions } from '../extensions/view.js';
import { getAffineSchemas } from '../schemas.js';

/**
 * A BPMN pool authored BEFORE the pool became an instance of the
 * framework-background primitive still opens, round-trips and paints
 * identically.
 *
 * This is the document-format guarantee of the slice — the red-zone half of it,
 * asserted end to end against the real assembly points: the persisted element
 * type is still `bpmnPool`, its props are still exactly the four it always had,
 * the model still behaves like the passive canvas it always was, and the
 * renderer the canvas looks up still draws the same frame, the same band and
 * the same name at the same coordinates.
 *
 * Every expectation is a LITERAL. Nothing here is recomputed from the
 * declaration under test, so a change to the declaration fails this file.
 *
 * Mirrors `legacy-wardley-background.unit.spec.ts`, which made the same promise
 * for the Wardley map.
 */

/**
 * The element a pre-primitive document carries, prop for prop. A renamed
 * participant and the resize handles switched off, on purpose — a pool that
 * only ever accepted the defaults would prove nothing about the props being
 * preserved.
 */
const LEGACY_ELEMENT = {
  type: 'bpmnPool',
  name: 'Customer',
  resizeEnabled: false,
  rotate: 0,
  xywh: '[0,0,560,200]',
} as const;

/** Keys the framework owns on every surface element, whatever its type. */
const FRAMEWORK_KEYS = ['id', 'index', 'seed'];

/** The renderer the canvas itself would look up, from the real assembly points. */
function rendererFor(type: string) {
  const manager = new ViewExtensionManager(getInternalViewExtensions({}));
  const container = new Container();
  manager.get('edgeless').forEach(ext => ext.setup(container));
  return container
    .provider()
    .getOptional(ElementRendererIdentifier(type)) as ElementRenderer | null;
}

function createEditor() {
  const manager = new StoreExtensionManager(getInternalStoreExtensions({}));
  const collection = new TestWorkspace({ id: 'legacy-bpmn-pool' });
  collection.storeExtensions = manager.get('store');
  collection.meta.initialize();

  const transformer = new Transformer({
    schema: new Schema().register(getAffineSchemas({})),
    blobCRUD: collection.blobSync,
    middlewares: [],
    docCRUD: {
      create: (id: string) => collection.createDoc(id).getStore({ id }),
      get: (id: string) => collection.getDoc(id)?.getStore({ id }) ?? null,
      delete: (id: string) => collection.removeDoc(id),
    },
  });

  return { collection, transformer };
}

function authorLegacyDocument(collection: TestWorkspace, id: string) {
  const store = collection.createDoc(id).getStore({ id });
  let surfaceId = '';
  store.load(() => {
    const rootId = store.addBlock('affine:page', { title: new Text('BPMN') });
    surfaceId = store.addBlock('affine:surface', {}, rootId);
  });
  const surface = store.getBlock(surfaceId)?.model as SurfaceBlockModel;
  surface.addElement({ ...LEGACY_ELEMENT });
  return store;
}

const surfaceOf = (store: Store) =>
  [...store.getAllModels()].find(m => m.flavour === 'affine:surface')
    ?.id as string;

const poolOf = (store: Store) => {
  const surface = store.getBlock(surfaceOf(store))?.model as SurfaceBlockModel;
  return surface.getElementsByType('bpmnPool')[0];
};

describe('a BPMN pool written before the primitive', () => {
  test('persists exactly the props it always did', () => {
    const { collection } = createEditor();
    const store = authorLegacyDocument(collection, 'doc:legacy');

    const persisted = poolOf(store).yMap.toJSON();
    expect(Object.keys(persisted).sort()).toEqual(
      [...Object.keys(LEGACY_ELEMENT), ...FRAMEWORK_KEYS].sort()
    );
    for (const [key, value] of Object.entries(LEGACY_ELEMENT)) {
      expect([key, persisted[key]]).toEqual([key, value]);
    }
  });

  test('survives a snapshot round-trip unchanged', async () => {
    const { collection, transformer } = createEditor();
    const store = authorLegacyDocument(collection, 'doc:legacy-rt');
    const before = poolOf(store).yMap.toJSON();

    const snapshot = transformer.docToSnapshot(store) as DocSnapshot;
    const reloaded = await transformer.snapshotToDoc({
      ...snapshot,
      meta: { ...snapshot.meta, id: 'doc:legacy-rt-reloaded' },
    });
    expect(reloaded).toBeDefined();

    expect(poolOf(reloaded!).yMap.toJSON()).toEqual(before);
  });

  test('is byte-identical to what a pool created TODAY writes', () => {
    const { collection } = createEditor();
    const store = collection.createDoc('doc:fresh').getStore({ id: 'doc:fresh' });
    let surfaceId = '';
    store.load(() => {
      const rootId = store.addBlock('affine:page', { title: new Text('BPMN') });
      surfaceId = store.addBlock('affine:surface', {}, rootId);
    });
    const surface = store.getBlock(surfaceId)?.model as SurfaceBlockModel;
    // The bare element, with nothing but its type and its box — so what is
    // counted below is what the MODEL writes, not what a creation site adds on
    // top of it (the toolbox also stamps a `role`, which is a base-class field
    // and no business of this class).
    surface.addElement({ type: 'bpmnPool', xywh: '[0,0,560,200]' });

    const persisted = poolOf(store).yMap.toJSON();
    // The class moved under `FrameworkBackgroundElementModel`, which declares no
    // field of its own: the four keys below are the four a pool has always
    // written, with the same defaults, and no fifth has appeared.
    expect(Object.keys(persisted).sort()).toEqual(
      ['type', 'name', 'resizeEnabled', 'rotate', 'xywh', ...FRAMEWORK_KEYS].sort()
    );
    expect(persisted.name).toBe('Pool');
    expect(persisted.resizeEnabled).toBe(true);
    expect(persisted.xywh).toBe('[0,0,560,200]');
  });

  test('keeps the model behaviour a pool has always had', () => {
    const { collection } = createEditor();
    const store = authorLegacyDocument(collection, 'doc:legacy-model');
    const pool = poolOf(store);

    // A passive canvas: an arrow connects flow objects, never the lane they sit
    // in. The five geometry answers below are the five the class used to
    // restate verbatim and now inherits.
    expect(pool.connectable).toBe(false);
    expect(pool.includesPoint(280, 100)).toBe(true);
    expect(pool.includesPoint(-10, 100)).toBe(false);
    expect(pool.getNearestPoint([-40, 100])).toEqual([0, 100]);
    // A line straight through the lane crosses both of its vertical edges.
    expect(
      pool.getLineIntersections([-40, 100], [600, 100])?.map(p => [p[0], p[1]])
    ).toEqual([
      [560, 100],
      [0, 100],
    ]);
  });

  test('paints the same pool the old renderer painted', async () => {
    const { collection, transformer } = createEditor();
    const store = authorLegacyDocument(collection, 'doc:legacy-paint');
    const snapshot = transformer.docToSnapshot(store) as DocSnapshot;
    const reloaded = await transformer.snapshotToDoc({
      ...snapshot,
      meta: { ...snapshot.meta, id: 'doc:legacy-paint-reloaded' },
    });

    // The very lookup `CanvasRenderer` performs to paint an element.
    const render = rendererFor('bpmnPool');
    expect(render).toBeDefined();

    const rec = stub();
    (render as unknown as (m: unknown, c: unknown, x: unknown) => void)(
      poolOf(reloaded!),
      rec.ctx,
      identityMatrix()
    );

    // The filled name band, over the whole 28-unit left margin.
    expect(rec.rects).toEqual([[0, 0, 28, 200]]);
    // The divider between the band and the flow area.
    expect(rec.segments).toEqual([[28, 0, 28, 200]]);
    // The participant name, rotated up the middle of the band, at weight 600.
    expect(rec.texts).toEqual([['Customer', 14, 100]]);
    expect(rec.fonts).toEqual(['600 15px Inter, sans-serif']);
    // Frame and divider, both in the pool's ink.
    expect(rec.strokes).toEqual(['#262626', '#262626']);
  });
});

/** Records what was drawn: straight segments, filled rects, positioned text. */
function stub() {
  const segments: number[][] = [];
  const rects: number[][] = [];
  const texts: Array<[string, number, number]> = [];
  const fonts: string[] = [];
  const strokes: string[] = [];
  let mx = 0;
  let my = 0;
  let frame: [number, number] | null = null;
  let rotated = false;

  const ctx = {
    fillStyle: '' as unknown,
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: '',
    textBaseline: '',
    setTransform: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn((x: number, y: number) => {
      mx = x;
      my = y;
    }),
    lineTo: vi.fn((x: number, y: number) => {
      segments.push([mx, my, x, y]);
      mx = x;
      my = y;
    }),
    arcTo: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(() => strokes.push(ctx.strokeStyle)),
    fillRect: vi.fn((x: number, y: number, w: number, h: number) => {
      rects.push([x, y, w, h]);
    }),
    setLineDash: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(() => {
      frame = null;
      rotated = false;
    }),
    translate: vi.fn((x: number, y: number) => {
      frame = [x, y];
    }),
    rotate: vi.fn(() => {
      rotated = true;
    }),
    fillText: vi.fn((text: string, x: number, y: number) => {
      fonts.push(ctx.font);
      texts.push(rotated && frame ? [text, frame[0], frame[1]] : [text, x, y]);
    }),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  };

  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    segments,
    rects,
    texts,
    fonts,
    strokes,
  };
}

const identityMatrix = () => {
  const m = { translateSelf: () => m, rotateSelf: () => m };
  return m as unknown as DOMMatrix;
};
