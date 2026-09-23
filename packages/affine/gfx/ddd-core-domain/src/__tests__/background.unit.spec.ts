import {
  backgroundPlot,
  backgroundSize,
  backgroundTexts,
} from '@labre/affine-block-surface';
import { CoreDomainChartElementModel } from '@labre/affine-model';
import { NOTATION_NEUTRALS } from '@labre/affine-shared/consts';
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
 * Reference geometry, at the birth size 842 × 787:
 *   plot  x 48 → 834, y 4 → 750   (786 × 746)
 *
 * The plot is the 786 × 746 it has always been; only the margins around it were
 * cut back to the ink they host, so every literal below is the deleted
 * `consts.ts` value translated by the ONE offset that changed: `(-12, -20)`.
 *
 * ## The two knowing differences, both invisible
 *
 * 1. the translucent bands carried their 0.6 alpha in `ctx.globalAlpha`; the
 *    declaration bakes it into the hex (`…99` = 153/255 = 0.6), because a zone
 *    fill is handed to `fillStyle` verbatim;
 * 2. the arrowheads were 9 long and 10 wide; the primitive draws a triangle as
 *    long as it is wide, so they are 9 × 9. Half a unit either side of a
 *    nine-unit head, at the tip of a 786-unit axis.
 *
 * And one deliberate, visible change since: the frame's neutrals are the shared
 * notation scale's. The axes and their titles were `#000000` and are now
 * `frameInk`; the Low/High ticks were `#777777` and are now `label`. Render-time
 * colours, so every existing chart repaints in them; every coordinate below is
 * still the old renderer's literal.
 */

const FRAME_INK = NOTATION_NEUTRALS.frameInk;
const TICK = NOTATION_NEUTRALS.label;

const W = 842;
const H = 787;

/** The plot, unchanged since the chart was authored. */
const PLOT_W = 786;
const PLOT_H = 746;

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
      width: W,
      height: H,
      lockAspectRatio: true,
      resizable: true,
      margin: { top: 4, right: 8, bottom: 37, left: 48 },
    });
    expect(backgroundSize(CORE_DOMAIN_BACKGROUND)).toEqual({
      width: W,
      height: H,
    });
    // The point of the birth size: a NEW chart's plot is the one the chart was
    // drawn in, so tightening the margins took room off the element, never off
    // the drawing.
    const plot = backgroundPlot(CORE_DOMAIN_BACKGROUND, W, H);
    expect([plot.width, plot.height]).toEqual([PLOT_W, PLOT_H]);
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
      { x: 58, y: 10, w: 150, h: 720, fill: '#b3b3b399' },
      { x: 208, y: 10, w: 220, h: 720, fill: '#9933ff99' },
      { x: 428, y: 10, w: 400, h: 360, fill: '#4d990099' },
      { x: 428, y: 370, w: 400, h: 360, fill: '#9933ff99' },
    ]);
  });

  it('writes every word where it has always been written', () => {
    expect(render(chart()).texts).toEqual([
      // ZONE_LABELS: white, bold, centred.
      t('Generic', 138, 454, '700 20px Inter, sans-serif', '#ffffff'),
      t('Supporting', 328, 454, '700 20px Inter, sans-serif', '#ffffff'),
      t('Core', 628, 194, '700 26px Inter, sans-serif', '#ffffff'),
      // The rotated Y title, hugging the axis.
      t('Complexity', 16, 380, '600 14px Inter, sans-serif', FRAME_INK, true),
      // The Y ticks, at their two (different) hand-placed insets.
      t('Low', 36, 738, '12px Inter, sans-serif', TICK, true),
      t('High', 26, 24, '12px Inter, sans-serif', TICK, true),
      // The X title and its ticks, below the axis.
      t(
        'Business differentiation',
        438,
        780,
        '600 14px Inter, sans-serif',
        FRAME_INK
      ),
      t('Low', 72, 772, '12px Inter, sans-serif', TICK),
      t('High', 826, 772, '12px Inter, sans-serif', TICK),
    ]);
  });

  it('draws the L-shaped axes from the origin to the published tips', () => {
    const { segments, strokes, fills } = render(chart());
    // AXIS.ox / AXIS.oy is the origin; the line stops one unit inside the base
    // of its 9-long arrowhead, which the filled triangle then covers.
    expect(segments).toContainEqual({ x1: 48, y1: 750, x2: 48, y2: 12 });
    expect(segments).toContainEqual({ x1: 48, y1: 750, x2: 826, y2: 750 });
    // AXIS.top and AXIS.right: the two tips, to the unit.
    expect(segments).toContainEqual({ x1: 48, y1: 4, x2: 43.5, y2: 13 });
    expect(segments).toContainEqual({ x1: 834, y1: 750, x2: 825, y2: 745.5 });
    // Both axes, and both heads, in the scale's frame ink.
    expect(strokes).toEqual([FRAME_INK, FRAME_INK]);
    expect(fills).toEqual([FRAME_INK, FRAME_INK]);
  });

  it('rotates about the element centre, as every surface element does', () => {
    expect(render(chart({ rotate: 45 })).transform).toEqual([
      ['translate', 421, 393.5],
      ['rotate', 45],
      ['translate', -421, -393.5],
    ]);
  });

  it('scales its ratios with the element, furniture excepted', () => {
    // Twice the plot: the Core band's left edge moves from 428 to
    // 48 + 380 × 2 = 808 (the margin is FIXED model units).
    const { rects } = render(
      chart({ deserializedXYWH: [0, 0, 2 * PLOT_W + 56, 2 * PLOT_H + 41] })
    );
    expect(rects[2]).toEqual({
      x: 808,
      y: 16,
      w: 800,
      h: 720,
      fill: '#4d990099',
    });
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
    expect(off.segments).toContainEqual({ x1: 48, y1: 750, x2: 826, y2: 750 });
  });
});

describe('the migration reading', () => {
  const migration = () => render(chart({ variant: 'migration' }));

  it('replaces the three bands with the four migration quadrants', () => {
    expect(migration().rects).toEqual([
      { x: 48, y: 4, w: 393, h: 373, fill: '#ff333326' },
      { x: 441, y: 4, w: 393, h: 373, fill: '#9933ff26' },
      { x: 48, y: 377, w: 393, h: 373, fill: '#b3b3b326' },
      { x: 441, y: 377, w: 393, h: 373, fill: '#4d990026' },
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
    expect(title).toMatchObject({ x: 16, y: 380, vertical: true });
  });

  it('leaves the frame of reference exactly where it was', () => {
    expect(migration().segments).toContainEqual({
      x1: 48,
      y1: 750,
      x2: 826,
      y2: 750,
    });
  });
});

/**
 * The frame sits ON the drawing (Notion "Ajuster les bordures des fonds de
 * cartes au plus proche des bords").
 *
 * What this would have caught: the margins the chart was authored with left
 * 24 / 54 / 50 / 60 model units of nothing between the ink and the element
 * border — and a background is caught by that border and by nothing else
 * (`framework-background/hit-test.ts`), so the chart was grabbed at a line
 * drawn a tenth of its width away from anything visible.
 *
 * The measure is the INK BOX: everything the renderer actually put on the
 * canvas — every segment, every tint, and a deliberately MEAN box round every
 * word (0.26 em per character, an ascent of 0.72 em and no descender, all of
 * them under what Inter really paints). Understating the ink can only make the
 * dead margin this test computes LARGER than the one a screenshot shows, so a
 * margin it calls tight really is tight.
 */
describe('the frame sits on the drawing', () => {
  /** Mean text metrics — see the docstring: they understate on purpose. */
  const ADVANCE_PER_CHAR = 0.26;
  const ASCENT = 0.72;

  const sizeOf = (font: string) => Number(/(\d+(?:\.\d+)?)px/.exec(font)![1]);

  /** The box the ink of one chart occupies, in element-local units. */
  function inkBox(w: number, h: number) {
    const { rects, texts, segments } = render(
      chart({ deserializedXYWH: [0, 0, w, h] })
    );
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const eat = (x: number, y: number) => {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    };

    for (const s of segments) {
      eat(s.x1, s.y1);
      eat(s.x2, s.y2);
    }
    for (const r of rects) {
      eat(r.x, r.y);
      eat(r.x + r.w, r.y + r.h);
    }
    for (const text of texts) {
      const size = sizeOf(text.font);
      const advance = text.text.length * ADVANCE_PER_CHAR * size;
      const ascent = ASCENT * size;
      if (text.vertical) {
        // Rotated a quarter turn: the word runs along the element's Y, and it
        // is its ASCENT — never its length — that reaches into the margin.
        eat(text.x - ascent, text.y - advance / 2);
        eat(text.x, text.y + advance / 2);
        continue;
      }
      const half = text.align === 'center' ? advance / 2 : 0;
      eat(text.x - half, text.y - ascent);
      eat(text.x - half + advance, text.y);
    }
    return { left: minX, top: minY, right: w - maxX, bottom: h - maxY };
  }

  // Birth size, then a wide chart and a tall one: the margins are FIXED model
  // units, so a ratio must not be able to reopen the gap.
  it.each([
    ['at birth', 842, 787],
    ['stretched wide', 1600, 787],
    ['stretched tall', 500, 1200],
  ])('leaves at most 8 units of nothing on any side, %s', (_what, w, h) => {
    const dead = inkBox(w, h);
    expect(dead.left).toBeLessThanOrEqual(8);
    expect(dead.top).toBeLessThanOrEqual(8);
    expect(dead.right).toBeLessThanOrEqual(8);
    expect(dead.bottom).toBeLessThanOrEqual(8);
  });

  it('never gives a side away: the ink reaches every edge it is measured on', () => {
    const dead = inkBox(842, 787);
    // The top and right edges ARE the arrowhead tips, so they are the margin
    // itself; the left and bottom are the two words that reach furthest.
    expect(dead.top).toBe(4);
    expect(dead.right).toBe(8);
    expect(dead.left).toBeGreaterThan(0);
    expect(dead.bottom).toBeGreaterThan(0);
  });
});

/**
 * Renaming a label in place (issue #355).
 *
 * The chart had no such gesture: its words were i18n keys and nothing else, so
 * a team whose axis is not called "Complexity" had nowhere to say so. Binding
 * each drawn word to a prop is the whole fix — the renderer, the reading panel
 * and the SVG export all read it through `backgroundLabelText`, so what is
 * pinned here is that the chart PAINTS the user's word, and that every prop the
 * declaration names is a real field of the persisted element.
 */
describe('the labels the user may rewrite', () => {
  it("paints the user's own word in place of the vocabulary", () => {
    const words = render(
      chart({ differentiationTitle: 'Valeur métier', zoneCore: 'Cœur' })
    ).texts.map(x => x.text);

    expect(words).toContain('Valeur métier');
    expect(words).not.toContain('Business differentiation');
    expect(words).toContain('Cœur');
    expect(words).not.toContain('Core');
    // Untouched labels keep the vocabulary: one prop per drawn word.
    expect(words).toContain('Complexity');
  });

  it('binds every drawn word to a real field of the chart', () => {
    const props = backgroundTexts(CORE_DOMAIN_BACKGROUND).map(
      text => text.prop
    );

    // Every word, no exception: three axis titles (two readings of the
    // vertical one), the four Low/High ticks and the seven named zones.
    expect(props.filter(prop => prop === undefined)).toEqual([]);
    expect(new Set(props).size).toBe(props.length);
    for (const prop of props) {
      expect(prop! in CoreDomainChartElementModel.prototype).toBe(true);
    }
  });
});
