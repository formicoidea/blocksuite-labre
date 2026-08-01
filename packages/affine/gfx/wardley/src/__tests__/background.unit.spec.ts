import {
  backgroundLabelHits,
  backgroundSize,
  hitTestBackgroundLabel,
} from '@labre/affine-block-surface';
import { describe, expect, it } from 'vitest';

import { WARDLEY_BACKGROUND, WARDLEY_LABEL_PROPS } from '../background';
import { wardley } from '../element-renderer';
import { recordingCtx, stubMatrix } from './canvas-stub';

/**
 * PF2.12 — the Wardley background reimplemented on the framework-background
 * primitive, with NO regression.
 *
 * The old renderer is gone, so it cannot be diffed against. What proves the
 * absence of regression is this file: every coordinate below is written out as
 * a LITERAL, computed by hand from the map's published constants (margins
 * 40/30/30/38, arrow 11, phase boundaries .175/.4/.7, label offsets), never
 * recomputed from the declaration under test. Change the declaration and these
 * fail; change both and the review sees a deliberate visual change.
 *
 * Reference geometry, for a 1600 × 900 map:
 *   plot  x 40 → 1570, y 30 → 862   (width 1530, height 832)
 *   dividers at x 307.75, 652, 1111
 */

const W = 1600;
const H = 900;

/** A default Wardley map: every part on, classic variant, no band tint. */
function map(over: Record<string, unknown> = {}) {
  return {
    deserializedXYWH: [0, 0, W, H],
    rotate: 0,
    variant: 'classic',
    showGradient: true,
    banded: false,
    resizeEnabled: false,
    xAxisTitle: 'Evolution',
    yAxisTitle: 'Value Chain',
    evolutionStart: 'Uncharted',
    evolutionEnd: 'Industrialized',
    visibilityHigh: 'Visible',
    visibilityLow: 'Invisible',
    phase0: 'Genesis',
    phase1: 'Custom-Built',
    phase2: 'Product (+Rental)',
    phase3: 'Commodity (+Utility)',
    showXAxis: true,
    showYAxis: true,
    showColumnDividers: true,
    showColumnLabels: true,
    showCornerLabels: true,
    showVisibilityLabels: true,
    ...over,
  };
}

const render = (model: Record<string, unknown>) => {
  const rec = recordingCtx();
  (wardley as unknown as (m: unknown, c: unknown, x: unknown) => void)(
    model,
    rec.ctx,
    stubMatrix()
  );
  return rec;
};

describe('the Wardley declaration', () => {
  it('declares the four evolution zones, named and ordered', () => {
    const zones = WARDLEY_BACKGROUND.zones ?? [];
    expect(zones.map(z => z.id)).toEqual([
      'genesis',
      'custom-built',
      'product',
      'commodity',
    ]);
    // The zones tile the plot end to end, with no gap and no overlap.
    expect(zones.map(z => z.rect.x)).toEqual([0, 0.175, 0.4, 0.7]);
    expect(zones.map(z => z.rect.x + z.rect.w)).toEqual([0.175, 0.4, 0.7, 1]);
    // Each zone is named by an editable prop AND by an i18n key: no prose is
    // hard-coded into a position.
    for (const zone of zones) {
      expect(zone.label?.prop).toMatch(/^phase[0-3]$/);
      expect(zone.label?.labelKey).toMatch(/^com\.labre\.wardley\./);
      expect(zone.label?.visibleProp).toBe('showColumnLabels');
    }
  });

  it('declares two named, oriented axes with i18n titles', () => {
    const axes = WARDLEY_BACKGROUND.axes ?? [];
    expect(axes.map(a => a.id)).toEqual(['evolution', 'value-chain']);
    expect(axes.map(a => a.orientation)).toEqual(['horizontal', 'vertical']);
    // Both point towards "more": right, and up.
    expect(axes.map(a => a.arrow)).toEqual(['forward', 'forward']);
    for (const axis of axes) {
      expect(axis.title?.labelKey).toMatch(/^com\.labre\.wardley\./);
      expect(axis.visibleProp).toBeDefined();
    }
    // Naming where an axis leads is its own toggle, not the axis'.
    const ends = axes.flatMap(a => a.endLabels ?? []);
    expect(ends.map(e => e.id)).toEqual([
      'evolutionStart',
      'evolutionEnd',
      'visibilityHigh',
      'visibilityLow',
    ]);
    expect(ends.map(e => e.visibleProp)).toEqual([
      'showCornerLabels',
      'showCornerLabels',
      'showVisibilityLabels',
      'showVisibilityLabels',
    ]);
  });

  it('declares the evolution graduations, gated independently of the axis', () => {
    const evolution = (WARDLEY_BACKGROUND.axes ?? [])[0];
    expect(evolution.ticks?.ticks.map(t => t.at)).toEqual([0.175, 0.4, 0.7]);
    expect(evolution.ticks?.stroke.dash).toEqual([5, 5]);
    // Dividers come and go with their own toggle, never with the axis line.
    expect(evolution.ticks?.visibleProp).toBe('showColumnDividers');
    expect(evolution.ticks?.visibleProp).not.toBe(evolution.visibleProp);
  });

  it('declares the geometry a fresh map is created at', () => {
    expect(WARDLEY_BACKGROUND.geometry).toMatchObject({
      width: 1600,
      height: 900,
      lockAspectRatio: true,
      resizable: false,
      margin: { top: 30, right: 30, bottom: 38, left: 40 },
    });
    // A fresh map: the reference size. A map beside a stretched one: 16:9 wide
    // enough to cover it — the behaviour the toolbox has always had.
    expect(backgroundSize(WARDLEY_BACKGROUND)).toEqual({
      width: 1600,
      height: 900,
    });
    expect(backgroundSize(WARDLEY_BACKGROUND, 3200, 0)).toEqual({
      width: 3200,
      height: 1800,
    });
    expect(backgroundSize(WARDLEY_BACKGROUND, 0, 1800)).toEqual({
      width: 3200,
      height: 1800,
    });
  });

  it('stamps the map role, so rules keep framing against it', () => {
    expect(WARDLEY_BACKGROUND.role).toBe('wardley:map');
    expect(WARDLEY_BACKGROUND.type).toBe('wardley');
  });
});

describe('the Wardley background paints what it always painted', () => {
  it('draws the card at the published inset, fill and border', () => {
    const { paths, fills, strokes } = render(map());
    // 1.5-wide border => a 0.75 inset, radius 10.
    expect(paths[0]).toMatchObject({ x: 0.75, y: 0.75, w: 1598.5, h: 898.5, r: 10 });
    expect(fills[0]).toBe('#ffffff');
    expect(strokes).toContain('#e3e2e4');
  });

  it('draws the L-shaped axes, each stopping at the base of its arrowhead', () => {
    const { segments } = render(map());
    // X: along the plot bottom, stopping 1 unit inside the 11-long arrow.
    expect(segments).toContainEqual({ x1: 40, y1: 862, x2: 1560, y2: 862 });
    // Y: up the left edge, same rule.
    expect(segments).toContainEqual({ x1: 40, y1: 862, x2: 40, y2: 40 });
  });

  it('draws the three dashed evolution dividers across the plot', () => {
    const { segments, dashes } = render(map());
    for (const x of [307.75, 652, 1111]) {
      expect(segments).toContainEqual({ x1: x, y1: 30, x2: x, y2: 862 });
    }
    expect(dashes).toContainEqual([5, 5]);
  });

  it('tints the four evolution bands only when `banded` is on', () => {
    expect(render(map()).rects).toEqual([]);
    expect(render(map({ banded: true })).rects).toEqual([
      { x: 40, y: 30, w: 267.75, h: 832, fill: '#f7faff' },
      { x: 307.75, y: 30, w: 344.25, h: 832, fill: '#eef4fb' },
      { x: 652, y: 30, w: 459, h: 832, fill: '#e6eef8' },
      { x: 1111, y: 30, w: 459, h: 832, fill: '#dde8f4' },
    ]);
  });

  it('writes every label where it has always been written', () => {
    const { texts } = render(map());
    expect(texts).toEqual([
      // Phase labels, left-aligned at each zone start, below the X axis.
      t('Genesis', 46, 884, '18px Inter, sans-serif', 'left', '#6b7280'),
      t('Custom-Built', 313.75, 884, '18px Inter, sans-serif', 'left', '#6b7280'),
      t('Product (+Rental)', 658, 884, '18px Inter, sans-serif', 'left', '#6b7280'),
      t('Commodity (+Utility)', 1117, 884, '18px Inter, sans-serif', 'left', '#6b7280'),
      // "Evolution", right-aligned near the X arrow, on the same baseline.
      t('Evolution', 1554, 884, '18px Inter, sans-serif', 'right', '#3b3d42'),
      // Direction indicators in the top corners.
      t('Uncharted', 54, 50, '13px Inter, sans-serif', 'left', '#6b7280'),
      t('Industrialized', 1564, 50, '13px Inter, sans-serif', 'right', '#6b7280'),
      // Rotated Y labels, hugging the axis.
      t('Value Chain', 31, 446, '18px Inter, sans-serif', 'center', '#3b3d42', true),
      t('Visible', 31, 86, '16px Inter, sans-serif', 'center', '#6b7280', true),
      t('Invisible', 31, 818, '16px Inter, sans-serif', 'center', '#6b7280', true),
    ]);
  });

  it('honours every per-part toggle, one by one', () => {
    const off = (prop: string) => render(map({ [prop]: false }));

    // The X axis takes its title with it; the corner labels stay.
    const noX = off('showXAxis');
    expect(noX.segments).not.toContainEqual({ x1: 40, y1: 862, x2: 1560, y2: 862 });
    expect(noX.texts.map(x => x.text)).not.toContain('Evolution');
    expect(noX.texts.map(x => x.text)).toContain('Uncharted');

    const noY = off('showYAxis');
    expect(noY.segments).not.toContainEqual({ x1: 40, y1: 862, x2: 40, y2: 40 });
    expect(noY.texts.map(x => x.text)).not.toContain('Value Chain');
    // The Visible / Invisible pair is a separate decision from the axis.
    expect(noY.texts.map(x => x.text)).toContain('Visible');

    expect(off('showColumnDividers').segments).not.toContainEqual({
      x1: 652,
      y1: 30,
      x2: 652,
      y2: 862,
    });
    expect(off('showColumnLabels').texts.map(x => x.text)).not.toContain('Genesis');
    expect(off('showCornerLabels').texts.map(x => x.text)).not.toContain('Uncharted');
    expect(off('showVisibilityLabels').texts.map(x => x.text)).not.toContain('Visible');
  });

  it('paints a gradient variant as two washes, and nothing for classic', () => {
    expect(render(map()).gradients).toHaveLength(0);
    // opportunity: differential value (green) then operational value (red).
    expect(render(map({ variant: 'opportunity' })).gradients).toHaveLength(2);
    expect(render(map({ variant: 'benefit' })).gradients).toHaveLength(2);
    // The classic grey evolution wash is a single layer.
    expect(render(map({ variant: 'evolution-gradient' })).gradients).toHaveLength(1);
    // Hiding the gradient brings the plain white frame back.
    expect(
      render(map({ variant: 'opportunity', showGradient: false })).gradients
    ).toHaveLength(0);
  });

  it('keeps the gradient stops as data, spanning the plot', () => {
    const { gradients } = render(map({ variant: 'evolution-gradient' }));
    expect(gradients[0].from).toEqual([40, 0]);
    expect(gradients[0].to).toEqual([1570, 0]);
    expect(gradients[0].stops).toHaveLength(49);
    expect(gradients[0].stops[0][1]).toMatch(/^rgba\(124,131,137,/);
  });

  it('rotates about the element centre, as every surface element does', () => {
    const rec = recordingCtx();
    (wardley as unknown as (m: unknown, c: unknown, x: unknown) => void)(
      map({ rotate: 45 }),
      rec.ctx,
      stubMatrix()
    );
    expect(rec.transform).toEqual([
      ['translate', 800, 450],
      ['rotate', 45],
      ['translate', -800, -450],
    ]);
  });
});

describe('a map nobody has renamed', () => {
  /** The ten label props absent — a map created after PF2, never edited. */
  const virgin = () => {
    const model = map();
    for (const prop of WARDLEY_LABEL_PROPS) delete model[prop];
    return model;
  };

  it('reads exactly as before, with no catalogue registered', () => {
    // THE i18n non-regression: the label props no longer carry a default, so
    // every word below now comes from the declaration's `fallback` via the
    // vocabulary path. Same words, same places, same fonts as the literals in
    // "writes every label where it has always been written".
    expect(render(virgin()).texts).toEqual(render(map()).texts);
  });

  it('speaks the host language once a catalogue is registered', () => {
    const host = {
      std: {
        getOptional: () => ({
          t: (key: string) =>
            ({
              'com.labre.wardley.background.axis.evolution': 'Évolution',
              'com.labre.wardley.background.phase.genesis': 'Genèse',
            })[key],
        }),
      },
    };
    const rec = recordingCtx();
    (
      wardley as unknown as (m: unknown, c: unknown, x: unknown, r: unknown) => void
    )(virgin(), rec.ctx, stubMatrix(), host);

    const said = rec.texts.map(t => t.text);
    expect(said).toContain('Évolution');
    expect(said).toContain('Genèse');
    // Keys the catalogue does not carry keep the shipped default.
    expect(said).toContain('Value Chain');
  });

  it("still lets the user's own wording win", () => {
    const renamed = { ...virgin(), phase0: 'Amorçage' };
    const said = render(renamed).texts.map(t => t.text);
    expect(said).toContain('Amorçage');
    expect(said).not.toContain('Genesis');
  });

  it('opens its in-place editor on the words on screen, not on an empty prop', () => {
    const hit = backgroundLabelHits(WARDLEY_BACKGROUND, virgin(), W, H).find(
      h => h.prop === 'xAxisTitle'
    );
    expect(hit?.text).toBe('Evolution');
  });
});

describe('the editable labels stay clickable where they are drawn', () => {
  const hits = (over: Record<string, unknown> = {}) =>
    backgroundLabelHits(WARDLEY_BACKGROUND, map(over), W, H);

  it('offers exactly the ten editable labels, in painting order', () => {
    expect(hits().map(h => h.prop)).toEqual([
      'phase0',
      'phase1',
      'phase2',
      'phase3',
      'xAxisTitle',
      'evolutionStart',
      'evolutionEnd',
      'yAxisTitle',
      'visibilityHigh',
      'visibilityLow',
    ]);
  });

  it('boxes a horizontal label around its baseline', () => {
    // "Genesis": 7 chars at 18px => ~75.6 wide, anchored at (46, 884), padded 6.
    expect(hits()[0]).toEqual({
      id: 'phase0',
      prop: 'phase0',
      text: 'Genesis',
      minX: 40,
      maxX: 46 + 7 * 18 * 0.6 + 6,
      minY: 884 - 18 - 6,
      maxY: 884 + 18 * 0.3 + 6,
    });
  });

  it('boxes a rotated label along the axis it hugs', () => {
    const yTitle = hits().find(h => h.prop === 'yAxisTitle');
    // "Value Chain": 11 chars at 18px => ~118.8 tall once rotated.
    expect(yTitle).toEqual({
      id: 'yAxisTitle',
      prop: 'yAxisTitle',
      text: 'Value Chain',
      minX: 31 - 18 - 6,
      maxX: 31 + 18 * 0.4 + 6,
      minY: 446 - (11 * 18 * 0.6) / 2 - 6,
      maxY: 446 + (11 * 18 * 0.6) / 2 - 0 + 6,
    });
  });

  it('finds the label under a double-click, and nothing in open space', () => {
    expect(hitTestBackgroundLabel(hits(), 60, 880)?.prop).toBe('phase0');
    expect(hitTestBackgroundLabel(hits(), 800, 400)).toBeNull();
  });

  it('never offers a hidden label for editing', () => {
    expect(hits({ showColumnLabels: false }).map(h => h.prop)).not.toContain(
      'phase0'
    );
    expect(hits({ showYAxis: false }).map(h => h.prop)).not.toContain(
      'yAxisTitle'
    );
  });
});

/** Expected `fillText` record. */
function t(
  text: string,
  x: number,
  y: number,
  font: string,
  align: string,
  color: string,
  vertical = false
) {
  return { text, x, y, font, align, color, vertical };
}
