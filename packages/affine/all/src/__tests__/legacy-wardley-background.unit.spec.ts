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
 * PF2.12 — a Wardley map authored BEFORE the background became an instance of
 * the framework-background primitive still opens, round-trips and paints
 * identically.
 *
 * This is the document-format guarantee of the slice, asserted end to end
 * against the real assembly points: the persisted element type is still
 * `wardley`, its props are still exactly the twenty-two it always had, and the
 * renderer the canvas looks up still draws the same axes, the same dividers,
 * the same bands and the same words at the same coordinates.
 *
 * Every expectation is a LITERAL. Nothing here is recomputed from the
 * declaration under test, so a change to the declaration fails this file.
 */

/**
 * The element a pre-PF2 document carries, prop for prop. Non-default values on
 * purpose — a legacy map that only ever accepted the defaults would prove
 * nothing about the props being preserved.
 */
const LEGACY_ELEMENT = {
  type: 'wardley',
  role: 'wardley:map',
  banded: true,
  variant: 'opportunity',
  showGradient: true,
  resizeEnabled: false,
  xAxisTitle: 'Évolution',
  yAxisTitle: 'Chaîne de valeur',
  evolutionStart: 'Inexploré',
  evolutionEnd: 'Industrialisé',
  visibilityHigh: 'Visible',
  visibilityLow: 'Invisible',
  phase0: 'Genèse',
  phase1: 'Sur mesure',
  phase2: 'Produit',
  phase3: 'Commodité',
  showXAxis: true,
  showYAxis: true,
  showColumnDividers: true,
  showColumnLabels: true,
  showCornerLabels: false,
  showVisibilityLabels: true,
  rotate: 0,
  xywh: '[0,0,1600,900]',
} as const;

/** Keys the framework owns on every surface element, whatever its type. */
const FRAMEWORK_KEYS = ['id', 'index', 'seed'];

/** The ten editable label texts, which now default to `undefined`. */
const LABEL_PROPS = [
  'xAxisTitle',
  'yAxisTitle',
  'evolutionStart',
  'evolutionEnd',
  'visibilityHigh',
  'visibilityLow',
  'phase0',
  'phase1',
  'phase2',
  'phase3',
];

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
  const collection = new TestWorkspace({ id: 'pf2-legacy-wardley' });
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
    const rootId = store.addBlock('affine:page', { title: new Text('PF2') });
    surfaceId = store.addBlock('affine:surface', {}, rootId);
  });
  const surface = store.getBlock(surfaceId)?.model as SurfaceBlockModel;
  surface.addElement({ ...LEGACY_ELEMENT });
  return store;
}

const surfaceOf = (store: Store) =>
  [...store.getAllModels()].find(m => m.flavour === 'affine:surface')
    ?.id as string;

const backgroundOf = (store: Store) => {
  const surface = store.getBlock(surfaceOf(store))?.model as SurfaceBlockModel;
  return surface.getElementsByType('wardley')[0];
};

describe('a Wardley map written before the primitive', () => {
  test('persists exactly the props it always did', () => {
    const { collection } = createEditor();
    const store = authorLegacyDocument(collection, 'doc:legacy');

    const persisted = backgroundOf(store).yMap.toJSON();
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
    const before = backgroundOf(store).yMap.toJSON();

    const snapshot = transformer.docToSnapshot(store) as DocSnapshot;
    const reloaded = await transformer.snapshotToDoc({
      ...snapshot,
      meta: { ...snapshot.meta, id: 'doc:legacy-rt-reloaded' },
    });
    expect(reloaded).toBeDefined();

    expect(backgroundOf(reloaded!).yMap.toJSON()).toEqual(before);
  });

  test('is not what a map created TODAY writes — and reads the same', () => {
    const { collection } = createEditor();
    const store = collection.createDoc('doc:fresh').getStore({ id: 'doc:fresh' });
    let surfaceId = '';
    store.load(() => {
      const rootId = store.addBlock('affine:page', { title: new Text('PF2') });
      surfaceId = store.addBlock('affine:surface', {}, rootId);
    });
    const surface = store.getBlock(surfaceId)?.model as SurfaceBlockModel;
    // Exactly what the toolbox writes: no label text at all.
    surface.addElement({ type: 'wardley', xywh: '[0,0,1600,900]' });

    const persisted = backgroundOf(store).yMap.toJSON();
    // The ten label props default to `undefined` now, so they are written
    // NOWHERE — which is what makes the declaration's i18n keys reachable.
    for (const label of LABEL_PROPS) {
      expect([label, label in persisted]).toEqual([label, false]);
    }
    // And the getters still answer, because the declaration carries the words.
    const rec = stub();
    const render = rendererFor('wardley');
    (render as unknown as (m: unknown, c: unknown, x: unknown) => void)(
      backgroundOf(store),
      rec.ctx,
      identityMatrix()
    );
    expect(rec.texts).toEqual([
      ['Genesis', 46, 884],
      ['Custom-Built', 313.75, 884],
      ['Product (+Rental)', 658, 884],
      ['Commodity (+Utility)', 1117, 884],
      ['Evolution', 1554, 884],
      ['Uncharted', 54, 50],
      ['Industrialized', 1564, 50],
      ['Value Chain', 31, 446],
      ['Visible', 31, 86],
      ['Invisible', 31, 818],
    ]);
  });

  test('keeps the model behaviour a background has always had', () => {
    const { collection } = createEditor();
    const store = authorLegacyDocument(collection, 'doc:legacy-model');
    const background = backgroundOf(store);

    // A passive canvas: an arrow connects nodes, never the map under them.
    expect(background.connectable).toBe(false);
    expect(background.includesPoint(800, 450)).toBe(true);
    expect(background.includesPoint(-10, 450)).toBe(false);
    expect(background.getNearestPoint([-40, 450])).toEqual([0, 450]);
  });

  test('paints the same map the old renderer painted', async () => {
    const { collection, transformer } = createEditor();
    const store = authorLegacyDocument(collection, 'doc:legacy-paint');
    const snapshot = transformer.docToSnapshot(store) as DocSnapshot;
    const reloaded = await transformer.snapshotToDoc({
      ...snapshot,
      meta: { ...snapshot.meta, id: 'doc:legacy-paint-reloaded' },
    });

    // The very lookup `CanvasRenderer` performs to paint an element.
    const render = rendererFor('wardley');
    expect(render).toBeDefined();

    const rec = stub();
    (render as unknown as (m: unknown, c: unknown, x: unknown) => void)(
      backgroundOf(reloaded!),
      rec.ctx,
      identityMatrix()
    );

    // Plot of a 1600 × 900 map: x 40 → 1570, y 30 → 862.
    // The L-shaped axes, each stopping at the base of its 11-long arrowhead.
    expect(rec.segments).toContainEqual([40, 862, 1560, 862]);
    expect(rec.segments).toContainEqual([40, 862, 40, 40]);
    // The three dashed evolution dividers.
    for (const x of [307.75, 652, 1111]) {
      expect(rec.segments).toContainEqual([x, 30, x, 862]);
    }
    // The four banded zones (`banded: true` on this legacy map).
    expect(rec.rects).toEqual([
      [40, 30, 267.75, 832],
      [307.75, 30, 344.25, 832],
      [652, 30, 459, 832],
      [1111, 30, 459, 832],
    ]);
    // The words the legacy document carries, where they have always been
    // written. `showCornerLabels` is off on this map, so the two direction
    // indicators are absent — and only those.
    expect(rec.texts).toEqual([
      ['Genèse', 46, 884],
      ['Sur mesure', 313.75, 884],
      ['Produit', 658, 884],
      ['Commodité', 1117, 884],
      ['Évolution', 1554, 884],
      ['Chaîne de valeur', 31, 446],
      ['Visible', 31, 86],
      ['Invisible', 31, 818],
    ]);
    // `variant: 'opportunity'` still paints its two washes.
    expect(rec.gradients).toBe(2);
  });
});

/** Records what was drawn: straight segments, filled rects, positioned text. */
function stub() {
  const segments: number[][] = [];
  const rects: number[][] = [];
  const texts: Array<[string, number, number]> = [];
  let mx = 0;
  let my = 0;
  let frame: [number, number] | null = null;
  let rotated = false;
  let gradients = 0;

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
    stroke: vi.fn(),
    fillRect: vi.fn((x: number, y: number, w: number, h: number) => {
      // Gradient washes cover the whole plot; only the zone tints are strings.
      if (typeof ctx.fillStyle === 'string') rects.push([x, y, w, h]);
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
    fillText: vi.fn((text: string, x: number, y: number) =>
      texts.push(rotated && frame ? [text, frame[0], frame[1]] : [text, x, y])
    ),
    createLinearGradient: vi.fn(() => {
      gradients++;
      return { addColorStop: vi.fn() };
    }),
  };

  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    segments,
    rects,
    texts,
    get gradients() {
      return gradients;
    },
  };
}

const identityMatrix = () => {
  const m = { translateSelf: () => m, rotateSelf: () => m };
  return m as unknown as DOMMatrix;
};
