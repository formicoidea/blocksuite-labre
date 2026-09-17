import { backgroundIncludesPoint } from '@labre/affine-model';
import { describe, expect, it, vi } from 'vitest';

import { CynefinView } from '../cynefin/element-view';
import { EstuarineView } from '../estuarine/element-view';

/**
 * The two Cynefin-Estuarine frames are SELECTED by their border (issue #194) —
 * and since #355 the words they write on themselves receive the double-click
 * that renames them.
 *
 * Neither is a declared background: both are reproductions of an official
 * drawing, with a fit of their own, so each says where its labels are in its own
 * reference space while the gesture itself comes from the shared
 * `FrameworkBackgroundView`. What is pinned here is that the view answers over
 * a label where the MODEL answers nobody, and nowhere else.
 */

/** What the picking path passes. */
const PICK = { hitThreshold: 10, zoom: 1 };

function setup(
  View: typeof CynefinView | typeof EstuarineView,
  w: number,
  h: number,
  props: Record<string, unknown>
) {
  const model = new Proxy(
    {
      id: 'bg',
      deserializedXYWH: [0, 0, w, h],
      rotate: 0,
      isLocked: () => false,
      includesPoint: (x: number, y: number, options: object) =>
        backgroundIncludesPoint({ x: 0, y: 0, w, h, rotate: 0 }, x, y, options),
    },
    {
      get(target: Record<string, unknown>, prop: string) {
        if (prop in target) return target[prop];
        return props[prop];
      },
    }
  );

  const gfx = {
    viewport: { toModelCoord: (x: number, y: number) => [x, y] },
    selection: { set: vi.fn() },
    std: {
      store: { captureSync: vi.fn(), readonly: false },
      get: () => ({ updateElement: vi.fn() }),
      getOptional: () => null,
    },
  };

  const view = new View(model as never, gfx as never);
  view.onCreated();

  return (at: { x: number; y: number }) =>
    view.includesPoint(at.x, at.y, PICK as never, null as never);
}

describe('where a Cynefin diagram answers the pointer', () => {
  const W = 1080;
  const H = 777;

  /**
   * Inside the "Complex" heading: drawn left-aligned at (37, 31) in 30-unit
   * type at the authored size, so ~31 → 169 horizontally and down to 46
   * vertically. Fifteen units clear of the top edge.
   */
  const ON_COMPLEX_HEADING = { x: 100, y: 25 };

  /**
   * In the middle of the drawing, on no word at all — the four headings live
   * in the top and bottom corners, none of them within reach of here.
   */
  const ON_OPEN_SPACE = { x: 700, y: 400 };

  const cynefin = (props: Record<string, unknown> = { showTitles: true }) =>
    setup(CynefinView, W, H, props);

  it('routes the pointer to the view over a domain heading', () => {
    expect(
      backgroundIncludesPoint(
        { x: 0, y: 0, w: W, h: H, rotate: 0 },
        ON_COMPLEX_HEADING.x,
        ON_COMPLEX_HEADING.y,
        PICK
      )
    ).toBe(false);

    expect(cynefin()(ON_COMPLEX_HEADING)).toBe(true);
  });

  it('lets the drawing go, so an element on it gets the click', () => {
    expect(cynefin()(ON_OPEN_SPACE)).toBe(false);
  });

  it('claims no heading while the titles are hidden', () => {
    expect(cynefin({ showTitles: false })(ON_COMPLEX_HEADING)).toBe(false);
  });
});

describe('where an Estuarine map answers the pointer', () => {
  const W = 690;
  const H = 801;

  /**
   * Inside the LIMINAL legend: centred at (316, 192) in 18-unit letter-spaced
   * type at the authored size, so ~260 → 372 horizontally and 168 → 203
   * vertically.
   */
  const ON_LIMINAL_LEGEND = { x: 316, y: 185 };

  /** In the middle of the plane, on no word at all. */
  const ON_OPEN_SPACE = { x: 400, y: 450 };

  const estuarine = (props: Record<string, unknown> = { showLiminal: true }) =>
    setup(EstuarineView, W, H, props);

  it('routes the pointer to the view over a curve legend', () => {
    expect(
      backgroundIncludesPoint(
        { x: 0, y: 0, w: W, h: H, rotate: 0 },
        ON_LIMINAL_LEGEND.x,
        ON_LIMINAL_LEGEND.y,
        PICK
      )
    ).toBe(false);

    expect(estuarine()(ON_LIMINAL_LEGEND)).toBe(true);
  });

  it('lets the plane go, so a constraint under the pointer gets the click', () => {
    expect(estuarine()(ON_OPEN_SPACE)).toBe(false);
  });

  it('claims no legend whose curve is switched off', () => {
    // The legend is painted with its curve and hidden with it: a name that is
    // not on screen is not a target either.
    expect(estuarine({ showLiminal: false })(ON_LIMINAL_LEGEND)).toBe(false);
  });
});
