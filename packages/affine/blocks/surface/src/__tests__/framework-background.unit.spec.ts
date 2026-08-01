import { describe, expect, it, vi } from 'vitest';

import type { FrameworkBackgroundDef } from '../framework-background/index.js';
import {
  backgroundColor,
  backgroundLabelHits,
  backgroundResizeAllowed,
  backgroundSize,
  createFrameworkBackgroundRenderer,
} from '../framework-background/index.js';

/**
 * The framework-background primitive (PF2.1): a background declared as DATA.
 *
 * The contract this file pins down is that a declaration saying nothing but
 * its size paints a plain white rectangle — and that everything else on the
 * picture is there because the declaration asked for it, by name.
 */

function stub() {
  const segments: Array<[number, number, number, number]> = [];
  const rects: Array<{ x: number; y: number; w: number; h: number; fill: string }> = [];
  const texts: Array<{ text: string; x: number; y: number; font: string }> = [];
  const dashes: number[][] = [];
  const fills: string[] = [];
  const strokes: string[] = [];
  const gradients: number[] = [];
  const gradientStops: Array<[number, string]> = [];
  let mx = 0;
  let my = 0;

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
    fill: vi.fn(() => {
      if (typeof ctx.fillStyle === 'string') fills.push(ctx.fillStyle);
    }),
    stroke: vi.fn(() => strokes.push(ctx.strokeStyle)),
    fillRect: vi.fn((x: number, y: number, w: number, h: number) => {
      if (typeof ctx.fillStyle === 'string') {
        rects.push({ x, y, w, h, fill: ctx.fillStyle });
      }
    }),
    setLineDash: vi.fn((d: number[]) => {
      if (d.length) dashes.push(d);
    }),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    fillText: vi.fn((text: string, x: number, y: number) =>
      texts.push({ text, x, y, font: ctx.font })
    ),
    createLinearGradient: vi.fn(() => {
      gradients.push(1);
      return {
        addColorStop: (offset: number, css: string) =>
          gradientStops.push([offset, css]),
      };
    }),
  };

  return {
    ctx,
    segments,
    rects,
    texts,
    dashes,
    fills,
    strokes,
    gradients,
    gradientStops,
  };
}

const matrix = () => {
  const m = { translateSelf: () => m, rotateSelf: () => m };
  return m as unknown as DOMMatrix;
};

/** Paint a declaration onto the stub. `host` supplies an optional i18n resolver. */
function paint(
  def: FrameworkBackgroundDef,
  model: Record<string, unknown> = {},
  w = 400,
  h = 200,
  host?: unknown
) {
  const rec = stub();
  const render = createFrameworkBackgroundRenderer(def) as unknown as (
    m: unknown,
    c: unknown,
    x: unknown,
    r?: unknown
  ) => void;
  render(
    { deserializedXYWH: [0, 0, w, h], rotate: 0, ...model },
    rec.ctx,
    matrix(),
    host
  );
  return rec;
}

const BARE: FrameworkBackgroundDef = {
  type: 'bare',
  geometry: {
    width: 400,
    height: 200,
    lockAspectRatio: false,
    resizable: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  },
};

describe('a declaration that says nothing but its size', () => {
  it('paints a plain white rectangle — no axis, no zone, no decoration', () => {
    const rec = paint(BARE);

    expect(rec.fills).toEqual(['#ffffff']);
    // Nothing else is drawn: no border, no line, no tint, no wash, no word.
    expect(rec.strokes).toEqual([]);
    expect(rec.segments).toEqual([]);
    expect(rec.rects).toEqual([]);
    expect(rec.texts).toEqual([]);
    expect(rec.gradients).toEqual([]);
    expect(rec.dashes).toEqual([]);
  });

  it('offers no editable label', () => {
    expect(backgroundLabelHits(BARE, {}, 400, 200)).toEqual([]);
  });

  it('sizes a fresh background at its declared reference, free of any ratio', () => {
    expect(backgroundSize(BARE)).toEqual({ width: 400, height: 200 });
    // Free ratio: each dimension grows on its own.
    expect(backgroundSize(BARE, 900, 0)).toEqual({ width: 900, height: 200 });
  });
});

/**
 * A synthetic framework exercising the whole vocabulary at once: a locked
 * geometry, a graduated axis, a double-headed axis, named zones and a colour
 * code — none of it Wardley, none of it code.
 */
const FULL: FrameworkBackgroundDef = {
  type: 'demo',
  geometry: {
    width: 400,
    height: 200,
    lockAspectRatio: true,
    resizable: false,
    margin: { top: 20, right: 20, bottom: 20, left: 20 },
  },
  chrome: {
    fontFamily: 'Demo, sans-serif',
    palette: { ink: '#111111', wash: '#eeeeee', accent: '#ff0000' },
    surface: { fill: '@wash', border: { color: '@ink', width: 2, radius: 4 } },
  },
  zones: [
    {
      id: 'left',
      rect: { x: 0, y: 0, w: 0.5, h: 1 },
      fill: '@wash',
      label: {
        id: 'leftName',
        labelKey: 'demo.left',
        fallback: 'Left',
        anchor: { x: 0, y: 1 },
        style: { size: 12, color: '@ink' },
      },
    },
    {
      id: 'right',
      rect: { x: 0.5, y: 0, w: 0.5, h: 1 },
      label: {
        id: 'rightName',
        prop: 'rightName',
        labelKey: 'demo.right',
        fallback: 'Right',
        anchor: { x: 0.5, y: 1 },
        style: { size: 12, color: '@ink' },
      },
    },
  ],
  axes: [
    {
      id: 'time',
      orientation: 'horizontal',
      at: 1,
      arrow: 'forward',
      arrowSize: 6,
      stroke: { color: '@ink', width: 2 },
      title: {
        id: 'timeTitle',
        labelKey: 'demo.time',
        fallback: 't',
        anchor: { x: 1, y: 1, dy: 10 },
        style: { size: 14, color: '@ink', italic: true, weight: 700 },
        align: 'right',
      },
      ticks: {
        ticks: [{ at: 0.25 }, { at: 0.75 }],
        stroke: { color: '@ink', width: 1, dash: [2, 2] },
      },
    },
    {
      id: 'energy',
      orientation: 'vertical',
      at: 0,
      arrow: 'both',
      arrowSize: 6,
      stroke: { color: '@accent', width: 3 },
    },
  ],
};

// Plot of a 400 × 200 FULL background: x 20 → 380, y 20 → 180.
describe('the declaration vocabulary', () => {
  it('names its colours once and resolves them everywhere', () => {
    const rec = paint(FULL);
    expect(rec.fills[0]).toBe('#eeeeee');
    expect(rec.strokes[0]).toBe('#111111');
    // The vertical axis names a different palette entry.
    expect(rec.strokes).toContain('#ff0000');
    expect(backgroundColor('@ink', { ink: '#111111' })).toBe('#111111');
    expect(backgroundColor('#abcdef', undefined)).toBe('#abcdef');
  });

  it('paints a broken colour loudly instead of failing quietly', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // A palette entry that does not exist is a typo in the declaration, not a
    // request for transparency.
    expect(backgroundColor('@nope', {})).toBe('#ff00ff');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('no palette entry for "@nope"')
    );

    warn.mockClear();
    // A wash colour that cannot carry an alpha used to reach `parseInt` and
    // emit `rgba(NaN,NaN,NaN,…)`, which paints nothing and explains nothing.
    const broken: FrameworkBackgroundDef = {
      ...BARE,
      chrome: {
        washes: [
          { id: 'w', color: 'rebeccapurple', stops: [[0, 0.5], [1, 0]] },
        ],
      },
    };
    const stops = paint(broken).gradientStops;
    expect(stops[0][1]).toBe('rgba(255,0,255,0.5)');
    expect(stops.some(([, css]) => css.includes('NaN'))).toBe(false);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('cannot take an alpha')
    );

    warn.mockRestore();
  });

  it('draws the declared axes, arrowheads included', () => {
    const { segments } = paint(FULL);
    // Horizontal, one arrow forward: stops 1 unit inside the 6-long head.
    expect(segments).toContainEqual([20, 180, 375, 180]);
    // Vertical, double-headed: both ends are pulled back.
    expect(segments).toContainEqual([20, 175, 20, 25]);
  });

  it('draws graduations as divider lines across the plot', () => {
    const { segments, dashes } = paint(FULL);
    // Ticks at 25 % and 75 % of the 360-wide plot, spanning y 20 → 180.
    expect(segments).toContainEqual([110, 20, 110, 180]);
    expect(segments).toContainEqual([290, 20, 290, 180]);
    expect(dashes).toContainEqual([2, 2]);
  });

  it('graduates an axis whose line is hidden, and vice versa', () => {
    // Two decisions, two gates — the whole reason ticks carry their own.
    const gated: FrameworkBackgroundDef = {
      ...FULL,
      axes: [
        {
          ...FULL.axes![0],
          visibleProp: 'showAxis',
          ticks: { ...FULL.axes![0].ticks!, visibleProp: 'showTicks' },
        },
      ],
    };
    const noAxis = paint(gated, { showAxis: false, showTicks: true });
    expect(noAxis.segments).toContainEqual([110, 20, 110, 180]);
    expect(noAxis.segments).not.toContainEqual([20, 180, 375, 180]);

    const noTicks = paint(gated, { showAxis: true, showTicks: false });
    expect(noTicks.segments).not.toContainEqual([110, 20, 110, 180]);
    expect(noTicks.segments).toContainEqual([20, 180, 375, 180]);
  });

  it('tints only the zones that declare a fill, and names them all', () => {
    const { rects, texts } = paint(FULL, { rightName: 'Droite' });
    expect(rects).toContainEqual({ x: 20, y: 20, w: 180, h: 160, fill: '#eeeeee' });
    expect(rects.filter(r => r.w === 180)).toHaveLength(1);
    // The user's own wording wins over the vocabulary and over the default.
    expect(texts.map(t => t.text)).toContain('Left');
    expect(texts.map(t => t.text)).toContain('Droite');
  });

  it('shows the raw key when nothing resolves it and nothing defaults it', () => {
    // The house rule (see `translateKey`): a dangling key is a bug the host
    // must see, never an excuse to invent somebody else's wording.
    const dangling: FrameworkBackgroundDef = {
      ...BARE,
      zones: [
        {
          id: 'z',
          rect: { x: 0, y: 0, w: 1, h: 1 },
          label: {
            id: 'mute',
            labelKey: 'demo.unknown',
            anchor: { x: 0.5, y: 0.5 },
            style: { size: 10, color: '#000000' },
          },
        },
      ],
    };
    expect(paint(dangling).texts.map(t => t.text)).toEqual(['demo.unknown']);
  });

  it('builds a font string from the declared weight, slant and family', () => {
    const { texts } = paint(FULL);
    expect(texts.find(t => t.text === 't')?.font).toBe(
      'italic 700 14px Demo, sans-serif'
    );
  });

  it('keeps a locked ratio when a fresh background must cover a bigger one', () => {
    expect(backgroundSize(FULL, 800, 0)).toEqual({ width: 800, height: 400 });
  });
});

describe('geometry.resizable decides whether the handles come out', () => {
  it('is the answer for an element that carries no prop of its own', () => {
    // FULL declares `resizable: false`, BARE declares `true`.
    expect(backgroundResizeAllowed(FULL, {})).toBe(false);
    expect(backgroundResizeAllowed(BARE, {})).toBe(true);
  });

  it('yields to the element, which is what the toolbar toggle writes', () => {
    expect(backgroundResizeAllowed(FULL, { resizeEnabled: true })).toBe(true);
    expect(backgroundResizeAllowed(BARE, { resizeEnabled: false })).toBe(false);
  });
});

describe('i18n', () => {
  /** A host with a catalogue bound on the house seam (`TranslationProvider`). */
  const host = (dictionary: Record<string, string>) => ({
    std: { getOptional: () => ({ t: (k: string) => dictionary[k] }) },
  });

  it('resolves label keys through the host, with no prose of its own', () => {
    const { texts } = paint(
      FULL,
      {},
      400,
      200,
      host({ 'demo.left': 'Gauche', 'demo.time': 'temps' })
    );
    const said = texts.map(t => t.text);
    expect(said).toContain('Gauche');
    expect(said).toContain('temps');
  });

  it('falls back to the declared wording for a key the host does not know', () => {
    const { texts } = paint(FULL, {}, 400, 200, host({}));
    expect(texts.map(t => t.text)).toContain('Left');
  });

  it("lets the user's own text win over the vocabulary", () => {
    const { texts } = paint(
      FULL,
      { rightName: 'Mine' },
      400,
      200,
      host({ 'demo.right': 'Droite' })
    );
    const said = texts.map(t => t.text);
    expect(said).toContain('Mine');
    expect(said).not.toContain('Droite');
  });

  it('offers only prop-backed labels for in-place editing', () => {
    // `left` is vocabulary (key only); `right` is the user's text.
    expect(backgroundLabelHits(FULL, {}, 400, 200).map(h => h.prop)).toEqual([
      'rightName',
    ]);
  });

  it('reports the words a label CURRENTLY shows, not its raw prop', () => {
    const catalogue = { t: (k: string) => ({ 'demo.right': 'Droite' })[k] };

    // Never renamed: the editor must open on the vocabulary the user can see,
    // not on the empty prop behind it.
    const [fresh] = backgroundLabelHits(FULL, {}, 400, 200, catalogue);
    expect(fresh.text).toBe('Droite');

    // Renamed: the user's own words.
    const [renamed] = backgroundLabelHits(
      FULL,
      { rightName: 'Mine' },
      400,
      200,
      catalogue
    );
    expect(renamed.text).toBe('Mine');
  });
});
