import { backgroundSize } from '@labre/affine-block-surface';
import { describe, expect, it } from 'vitest';

import { CORE_DOMAIN_BACKGROUND } from '../core-domain/background';
import { coreDomain } from '../core-domain/element-renderer';
import { recordingCtx, stubMatrix } from './canvas-stub';

/**
 * The Core Domain Chart, reimplemented on the framework-background primitive,
 * with NO regression.
 *
 * The old imperative renderer is gone, so it cannot be diffed against. What
 * proves the absence of regression is this file: every coordinate below is the
 * LITERAL the deleted `core-domain/consts.ts` shipped — the four `ZONES` rects,
 * the three `ZONE_LABELS`, the `AXIS` frame `{ ox: 60, oy: 770, top: 24,
 * right: 846 }` and the hand-placed axis titles and Low/High ticks — never
 * recomputed from the declaration under test. Change the declaration and these
 * fail; change both and the review sees a deliberate visual change.
 *
 * Reference geometry, at the authoring size 900 × 820:
 *   plot  x 60 → 846, y 24 → 770   (786 × 746)
 *
 * ## The two knowing differences, both invisible
 *
 * 1. the translucent bands carried their 0.6 alpha in `ctx.globalAlpha`; the
 *    declaration bakes it into the hex (`…99` = 153/255 = 0.6), because a zone
 *    fill is handed to `fillStyle` verbatim;
 * 2. the arrowheads were 9 long and 10 wide; the primitive draws a triangle as
 *    long as it is wide, so they are 9 × 9. Half a unit either side of a
 *    nine-unit head, at the tip of a 786-unit axis.
 */

const W = 900;
const H = 820;

/** Float noise from `(absolute - origin) / span * span`; nothing else. */
const round = (n: number) => Math.round(n * 1e6) / 1e6;

/** A default chart: both toggles on, classic reading. */
function chart(over: Record<string, unknown> = {}) {
  return {
    deserializedXYWH: [0, 0, W, H],
    rotate: 0,
    variant: 'classic',
    showZones: true,
    showLabels: true,
    resizeEnabled: true,
    ...over,
  };
}

const render = (model: Record<string, unknown>) => {
  const rec = recordingCtx();
  (coreDomain as unknown as (m: unknown, c: unknown, x: unknown) => void)(
    model,
    rec.ctx,
    stubMatrix()
  );
  return {
    rects: rec.rects.map(r => ({
      x: round(r.x),
      y: round(r.y),
      w: round(r.w),
      h: round(r.h),
      fill: r.fill,
    })),
    texts: rec.texts.map(t => ({ ...t, x: round(t.x), y: round(t.y) })),
    segments: rec.segments.map(s => ({
      x1: round(s.x1),
      y1: round(s.y1),
      x2: round(s.x2),
      y2: round(s.y2),
    })),
    transform: rec.transform,
    fills: rec.fills,
    strokes: rec.strokes,
  };
};

const t = (
  text: string,
  x: number,
  y: number,
  font: string,
  color: string,
  vertical = false
) => ({ text, x, y, font, align: 'center', color, vertical });

describe('the Core Domain Chart declaration', () => {
  it('declares the geometry a fresh chart is created at', () => {
    expect(CORE_DOMAIN_BACKGROUND.geometry).toEqual({
      width: 900,
      height: 820,
      lockAspectRatio: true,
      resizable: true,
      margin: { top: 24, right: 54, bottom: 50, left: 60 },
    });
    expect(backgroundSize(CORE_DOMAIN_BACKGROUND)).toEqual({
      width: 900,
      height: 820,
    });
  });

  it('stamps the chart role, so rules keep framing against it', () => {
    expect(CORE_DOMAIN_BACKGROUND.type).toBe('coreDomain');
    expect(CORE_DOMAIN_BACKGROUND.role).toBe('core-domain:chart');
    expect(CORE_DOMAIN_BACKGROUND.variantProp).toBe('variant');
  });

  it('splits its zones into two readings of one frame', () => {
    const zones = CORE_DOMAIN_BACKGROUND.zones ?? [];
    const classic = zones.filter(z => z.variants?.includes('classic'));
    const migration = zones.filter(z => z.variants?.includes('migration'));

    expect(classic.map(z => z.id)).toEqual([
      'generic',
      'supporting-low-diff',
      'core',
      'supporting-low-complexity',
    ]);
    expect(migration.map(z => z.id)).toEqual([
      'last-toothpaste',
      'risk-seeking',
      'risk-averse',
      'lhf',
    ]);
    // Every zone belongs to exactly one reading: a region with no `variants`
    // would be painted on both charts and quietly break the other one.
    expect(classic.length + migration.length).toBe(zones.length);
    // The tint is a decoration and says so; the zone stays semantic.
    for (const zone of zones) expect(zone.fillVisibleProp).toBe('showZones');
  });

  it('declares two named, oriented axes', () => {
    const axes = CORE_DOMAIN_BACKGROUND.axes ?? [];
    expect(axes.map(a => a.id)).toEqual(['complexity', 'differentiation']);
    expect(axes.map(a => a.orientation)).toEqual(['vertical', 'horizontal']);
    // Both point towards "more": up, and right.
    expect(axes.map(a => a.arrow)).toEqual(['forward', 'forward']);
    // The frame of reference is the chart: it is never hidden. `showLabels`
    // gates the words alone.
    for (const axis of axes) {
      expect(axis.visibleProp).toBeUndefined();
      expect(axis.title?.visibleProp).toBe('showLabels');
    }
  });
});

describe('the Core Domain Chart paints what it always painted', () => {
  it('tints the four bands at the published rects and alphas', () => {
    // `ZONES` of the deleted consts.ts, in the order it declared them.
    expect(render(chart()).rects).toEqual([
      { x: 70, y: 30, w: 150, h: 720, fill: '#b3b3b399' },
      { x: 220, y: 30, w: 220, h: 720, fill: '#9933ff99' },
      { x: 440, y: 30, w: 400, h: 360, fill: '#4d990099' },
      { x: 440, y: 390, w: 400, h: 360, fill: '#9933ff99' },
    ]);
  });

  it('writes every word where it has always been written', () => {
    expect(render(chart()).texts).toEqual([
      // ZONE_LABELS: white, bold, centred.
      t('Generic', 150, 474, '700 20px Inter, sans-serif', '#ffffff'),
      t('Supporting', 340, 474, '700 20px Inter, sans-serif', '#ffffff'),
      t('Core', 640, 214, '700 26px Inter, sans-serif', '#ffffff'),
      // The rotated Y title, hugging the axis.
      t('Complexity', 28, 400, '600 14px Inter, sans-serif', '#000000', true),
      // The Y ticks, at their two (different) hand-placed insets.
      t('Low', 48, 758, '12px Inter, sans-serif', '#777777', true),
      t('High', 38, 44, '12px Inter, sans-serif', '#777777', true),
      // The X title and its ticks, below the axis.
      t(
        'Business differentiation',
        450,
        800,
        '600 14px Inter, sans-serif',
        '#000000'
      ),
      t('Low', 84, 792, '12px Inter, sans-serif', '#777777'),
      t('High', 838, 792, '12px Inter, sans-serif', '#777777'),
    ]);
  });

  it('draws the L-shaped axes from the origin to the published tips', () => {
    const { segments, strokes, fills } = render(chart());
    // AXIS.ox / AXIS.oy is the origin; the line stops one unit inside the base
    // of its 9-long arrowhead, which the filled triangle then covers.
    expect(segments).toContainEqual({ x1: 60, y1: 770, x2: 60, y2: 32 });
    expect(segments).toContainEqual({ x1: 60, y1: 770, x2: 838, y2: 770 });
    // AXIS.top and AXIS.right: the two tips, to the unit.
    expect(segments).toContainEqual({ x1: 60, y1: 24, x2: 55.5, y2: 33 });
    expect(segments).toContainEqual({ x1: 846, y1: 770, x2: 837, y2: 765.5 });
    // Both axes, and both heads, in black.
    expect(strokes).toEqual(['#000000', '#000000']);
    expect(fills).toEqual(['#000000', '#000000']);
  });

  it('rotates about the element centre, as every surface element does', () => {
    expect(render(chart({ rotate: 45 })).transform).toEqual([
      ['translate', 450, 410],
      ['rotate', 45],
      ['translate', -450, -410],
    ]);
  });

  it('scales its ratios with the element, furniture excepted', () => {
    // Twice the size: the plot doubles, so the Core band's left edge moves from
    // 440 to 60 + 380 × 2 = 820 (the margin is FIXED model units).
    const { rects } = render(
      chart({ deserializedXYWH: [0, 0, 2 * W - 114, 2 * H - 74] })
    );
    expect(rects[2]).toEqual({ x: 820, y: 36, w: 800, h: 720, fill: '#4d990099' });
  });
});

describe('the two toggles the chart has always had', () => {
  it('hides the bands when showZones is off, and keeps the words', () => {
    const off = render(chart({ showZones: false }));
    expect(off.rects).toEqual([]);
    expect(off.texts.map(x => x.text)).toContain('Core');
  });

  it('hides every word when showLabels is off, and keeps the bands', () => {
    const off = render(chart({ showLabels: false }));
    expect(off.texts).toEqual([]);
    expect(off.rects).toHaveLength(4);
    // The frame itself is never hidden: the axes are the chart.
    expect(off.segments).toContainEqual({ x1: 60, y1: 770, x2: 838, y2: 770 });
  });
});

describe('the migration reading', () => {
  const migration = () => render(chart({ variant: 'migration' }));

  it('replaces the three bands with the four migration quadrants', () => {
    expect(migration().rects).toEqual([
      { x: 60, y: 24, w: 393, h: 373, fill: '#ff333326' },
      { x: 453, y: 24, w: 393, h: 373, fill: '#9933ff26' },
      { x: 60, y: 397, w: 393, h: 373, fill: '#b3b3b326' },
      { x: 453, y: 397, w: 393, h: 373, fill: '#4d990026' },
    ]);
  });

  it('names the quadrants and relabels the vertical axis', () => {
    const words = migration().texts.map(x => x.text);
    expect(words).toEqual([
      'Last toothpaste',
      'Risk-seeking',
      'Risk-averse',
      'Low-hanging fruit',
      // The relabelled Y title rides in the axis' `endLabels` (see the
      // declaration), so it is written after the two ticks rather than before.
      'Low',
      'High',
      'Cost of migration',
      'Business differentiation',
      'Low',
      'High',
    ]);
    // One title at a time, at the very place the other one occupied.
    expect(words).not.toContain('Complexity');
    const title = migration().texts.find(x => x.text === 'Cost of migration');
    expect(title).toMatchObject({ x: 28, y: 400, vertical: true });
  });

  it('leaves the frame of reference exactly where it was', () => {
    expect(migration().segments).toContainEqual({
      x1: 60,
      y1: 770,
      x2: 838,
      y2: 770,
    });
  });
});
