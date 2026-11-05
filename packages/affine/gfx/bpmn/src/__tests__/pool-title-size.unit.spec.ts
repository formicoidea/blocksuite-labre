import {
  BACKGROUND_TEXT_FIT_PADDING,
  BACKGROUND_WRAP_LINE_HEIGHT,
  backgroundBandWidths,
  backgroundLabelHits,
  EdgelessCRUDIdentifier,
} from '@labre/affine-block-surface';
import { BpmnPoolElementModel } from '@labre/affine-model';
import { describe, expect, it, vi } from 'vitest';

import { BPMN_POOL_BACKGROUND } from '../background';
import {
  POOL_BAND_WIDTH,
  POOL_LANE_BAND_WIDTH,
  POOL_LANE_NAME_FONT_SIZE,
  POOL_LANE_NAME_FONT_SIZES,
  POOL_NAME_FONT_SIZE,
  POOL_NAME_FONT_SIZES,
} from '../consts';
import { bpmnPool } from '../element-renderer';
import { BpmnPoolView } from '../element-view';
import { setBpmnPoolTitleSize } from '../toolbar/config';
import { recordingCtx, stubMatrix } from './canvas-stub';

/**
 * ADR 0049 — the author sizes the pool title and the lane titles.
 *
 * Why this spec exists. It would have caught:
 * - a pool with no size key painted at anything but the declared 15 / 13 (the
 *   two defaults `lanes.unit.spec.ts` pins), or with a malformed stored value
 *   reaching the canvas as a font;
 * - a size painted larger while its band keeps the declared thickness, or a
 *   rename hit box still cut for the declared size;
 * - a view that does not re-measure the bands the model picks by when a size
 *   changes (picking would lag one paint behind);
 * - the toolbar writing on a readonly store, writing an unchanged value (an
 *   empty undo entry), writing the declared size onto a pool that stores none
 *   (a key nobody chose), or taking more than one undo step for one pick.
 *
 * The canvas stub measures 6 units per character, so the widths are arithmetic:
 * one line of size S needs a band of 1.2 S + 2 × 4 (`bandFor`).
 */

const W = 560;
const H = 200;
const LANES = [
  { id: 'a', name: 'Front office', size: 1 },
  { id: 'b', name: 'Back office', size: 1 },
];
/** The largest step of each list: the case that must thicken its band. */
const TITLE_MAX = POOL_NAME_FONT_SIZES[POOL_NAME_FONT_SIZES.length - 1];
const LANE_MAX =
  POOL_LANE_NAME_FONT_SIZES[POOL_LANE_NAME_FONT_SIZES.length - 1];

function pool(over: Record<string, unknown> = {}) {
  return {
    deserializedXYWH: [0, 0, W, H],
    rotate: 0,
    name: 'Customer',
    resizeEnabled: true,
    lanes: LANES,
    ...over,
  };
}

const render = (model: Record<string, unknown>) => {
  const rec = recordingCtx();
  (bpmnPool as unknown as (m: unknown, c: unknown, x: unknown) => void)(
    model,
    rec.ctx,
    stubMatrix()
  );
  return rec;
};

/** The band one line of `size` needs: a line height plus padding each side. */
const bandFor = (size: number) =>
  size * BACKGROUND_WRAP_LINE_HEIGHT + 2 * BACKGROUND_TEXT_FIT_PADDING;
/** A step that is neither a default nor the largest. */
const MIDDLE_STEP = POOL_NAME_FONT_SIZES[2];

const fontOf = (size: number) => `600 ${size}px Inter, sans-serif`;

describe('the steps the toolbar offers', () => {
  it('are the PO’s, each list holding its default', () => {
    expect(POOL_NAME_FONT_SIZES).toEqual([13, 15, 18, 24, 32]);
    expect(POOL_LANE_NAME_FONT_SIZES).toEqual([11, 13, 15, 18, 24]);
    expect(POOL_NAME_FONT_SIZES).toContain(POOL_NAME_FONT_SIZE);
    expect(POOL_LANE_NAME_FONT_SIZES).toContain(POOL_LANE_NAME_FONT_SIZE);
  });

  it('are wired to the two model props by the declaration', () => {
    expect(BPMN_POOL_BACKGROUND.chrome?.sideBands?.[0].label?.sizeProp).toBe(
      'nameFontSize'
    );
    expect(BPMN_POOL_BACKGROUND.instanceZones?.label?.sizeProp).toBe(
      'laneFontSize'
    );
  });
});

describe('a pool painted at the author’s sizes', () => {
  it('paints 15 / 13 when the pool stores no size, as before ADR 0049', () => {
    const rec = render(pool());
    expect(rec.texts.map(t => t.font)).toEqual([
      fontOf(POOL_NAME_FONT_SIZE),
      fontOf(POOL_LANE_NAME_FONT_SIZE),
      fontOf(POOL_LANE_NAME_FONT_SIZE),
    ]);
    expect(rec.rects[0].w).toBe(POOL_BAND_WIDTH);
  });

  it.each([
    ['zero', 0],
    ['a negative', -4],
    ['NaN', Number.NaN],
    ['a string', '24'],
  ])('paints a pool storing %s exactly as one storing nothing', (_, bad) => {
    const plain = render(pool());
    const damaged = render(pool({ nameFontSize: bad, laneFontSize: bad }));
    expect(damaged.ops).toEqual(plain.ops);
    expect(damaged.texts).toEqual(plain.texts);
    expect(damaged.rects).toEqual(plain.rects);
    expect(damaged.segments).toEqual(plain.segments);
  });

  it('paints the title larger and thickens its band to hold it', () => {
    const rec = render(pool({ nameFontSize: TITLE_MAX }));
    const band = bandFor(TITLE_MAX);

    expect(rec.texts[0].font).toBe(fontOf(TITLE_MAX));
    expect(rec.rects[0].w).toBeCloseTo(band);
    // Still in the middle of the grown band.
    expect(rec.texts[0].x).toBeCloseTo(band / 2);
    // The lanes keep their own size.
    expect(rec.texts[1].font).toBe(fontOf(POOL_LANE_NAME_FONT_SIZE));
  });

  it('paints every lane title at the lane size, in one thicker strip', () => {
    const rec = render(pool({ laneFontSize: LANE_MAX }));
    const strip = bandFor(LANE_MAX);

    expect(rec.texts.slice(1).map(t => t.font)).toEqual([
      fontOf(LANE_MAX),
      fontOf(LANE_MAX),
    ]);
    // Centred in a strip that starts after the 28-unit participant band.
    expect(rec.texts[1].x).toBeCloseTo(POOL_BAND_WIDTH + strip / 2);
    expect(rec.texts[0].font).toBe(fontOf(POOL_NAME_FONT_SIZE));

    const layout = backgroundBandWidths(
      BPMN_POOL_BACKGROUND,
      pool({ laneFontSize: LANE_MAX }),
      W,
      H
    );
    expect(layout.zoneBandWidth).toBeGreaterThan(POOL_LANE_BAND_WIDTH);
  });

  it('cuts the rename hit box for the size painted', () => {
    const across = (model: Record<string, unknown>) => {
      const [hit] = backgroundLabelHits(BPMN_POOL_BACKGROUND, model, W, H);
      return hit.maxX - hit.minX;
    };
    expect(across(pool({ nameFontSize: TITLE_MAX }))).toBeGreaterThan(
      across(pool())
    );
  });
});

describe('the view', () => {
  it('re-measures the bands the model picks by when a size changes', () => {
    const listeners: Array<(event: { key: string }) => void> = [];
    const model = {
      id: 'pool',
      deserializedXYWH: [0, 0, W, H],
      x: 0,
      y: 0,
      w: W,
      h: H,
      rotate: 0,
      name: 'Customer',
      nameFontSize: undefined as number | undefined,
      paintedBands: undefined as { margin: number } | undefined,
      propsUpdated: {
        subscribe: (listener: (event: { key: string }) => void) => {
          listeners.push(listener);
          return { unsubscribe: vi.fn() };
        },
      },
      isLocked: () => false,
    };
    const gfx = {
      viewport: { toModelCoord: (x: number, y: number) => [x, y], zoom: 1 },
      selection: {
        set: vi.fn(),
        selectedIds: [] as string[],
        slots: { updated: { subscribe: () => ({ unsubscribe: vi.fn() }) } },
      },
      cursor$: { value: 'default' },
      std: {
        store: { captureSync: vi.fn(), readonly: false },
        get: () => ({ updateElement: vi.fn() }),
        getOptional: () => null,
      },
    };
    new BpmnPoolView(model as never, gfx as never).onCreated();
    expect(model.paintedBands?.margin).toBe(POOL_BAND_WIDTH);

    model.nameFontSize = TITLE_MAX;
    listeners.forEach(listener => listener({ key: 'nameFontSize' }));
    expect(model.paintedBands?.margin).toBeGreaterThan(POOL_BAND_WIDTH);
  });
});

describe('the toolbar write', () => {
  /** Real pools off the prototype, so `model[prop]` reads what we set. */
  function pools(...sizes: Array<number | undefined>) {
    return sizes.map((nameFontSize, i) => {
      const model = Object.create(BpmnPoolElementModel.prototype);
      Object.defineProperties(model, {
        id: { value: `pool-${i}` },
        nameFontSize: { value: nameFontSize },
        laneFontSize: { value: undefined },
      });
      return model as BpmnPoolElementModel;
    });
  }

  function ctx(readonly = false) {
    const updateElement = vi.fn();
    const captureSync = vi.fn();
    const get = vi.fn((id: unknown) => {
      expect(id).toBe(EdgelessCRUDIdentifier);
      return { updateElement };
    });
    return {
      std: { store: { readonly, captureSync }, get } as never,
      updateElement,
      captureSync,
    };
  }

  it('writes every changed pool in ONE undo step', () => {
    const c = ctx();
    setBpmnPoolTitleSize(
      c,
      pools(undefined, MIDDLE_STEP),
      'nameFontSize',
      TITLE_MAX
    );

    expect(c.captureSync).toHaveBeenCalledTimes(1);
    expect(c.updateElement.mock.calls).toEqual([
      ['pool-0', { nameFontSize: TITLE_MAX }],
      ['pool-1', { nameFontSize: TITLE_MAX }],
    ]);
  });

  it('leaves alone a pool already showing the picked size', () => {
    const c = ctx();
    setBpmnPoolTitleSize(
      c,
      pools(TITLE_MAX, MIDDLE_STEP),
      'nameFontSize',
      TITLE_MAX
    );
    expect(c.updateElement.mock.calls).toEqual([
      ['pool-1', { nameFontSize: TITLE_MAX }],
    ]);
  });

  it('writes nothing, not even an undo checkpoint, when nothing changes', () => {
    const c = ctx();
    // A pool that stores no size shows the declared one: picking it writes no
    // key the author did not choose.
    setBpmnPoolTitleSize(
      c,
      pools(undefined),
      'nameFontSize',
      POOL_NAME_FONT_SIZE
    );
    setBpmnPoolTitleSize(
      c,
      pools(undefined),
      'laneFontSize',
      POOL_LANE_NAME_FONT_SIZE
    );
    expect(c.captureSync).not.toHaveBeenCalled();
    expect(c.updateElement).not.toHaveBeenCalled();
  });

  it('writes nothing on a readonly store', () => {
    const c = ctx(true);
    setBpmnPoolTitleSize(c, pools(undefined), 'nameFontSize', TITLE_MAX);
    expect(c.captureSync).not.toHaveBeenCalled();
    expect(c.updateElement).not.toHaveBeenCalled();
  });
});
