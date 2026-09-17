import { backgroundIncludesPoint } from '@labre/affine-model';
import { describe, expect, it, vi } from 'vitest';

import { CoreDomainView } from '../core-domain/element-view';

/**
 * A Core Domain Chart is SELECTED by its border (issue #194) — and since #355
 * its labels receive the double-click that renames them.
 *
 * Those two areas are not the same rectangle, and this file is about the seam
 * that lets them differ: pointer events reach a view through
 * `GfxViewEventManager`, which asks the VIEW's `includesPoint`, while picking
 * asks the MODEL's. The chart claims nothing here that it did not claim before
 * except the boxes of the words it writes on itself.
 */

const W = 900;
const H = 820;

/**
 * Inside the `differentiationTitle` box: the axis title is centred at (450,
 * 800) and "Business differentiation" is ~202 wide, so 343 → 557 horizontally
 * and 780 → 810 vertically. Twenty units clear of the bottom edge, so the
 * border band cannot be the one answering.
 */
const ON_X_AXIS_TITLE = { x: 450, y: 795 };

/** Well inside the plot, on no label and nowhere near an edge. */
const ON_OPEN_SPACE = { x: 700, y: 600 };

/** What the picking path passes. */
const PICK = { hitThreshold: 10, zoom: 1 };

function setup(props: Record<string, unknown> = {}) {
  const stored: Record<string, unknown> = {
    variant: 'classic',
    showZones: true,
    showLabels: true,
    ...props,
  };

  const model = new Proxy(
    {
      id: 'chart',
      deserializedXYWH: [0, 0, W, H],
      rotate: 0,
      isLocked: () => false,
      includesPoint: (x: number, y: number, options: object) =>
        backgroundIncludesPoint(
          { x: 0, y: 0, w: W, h: H, rotate: 0 },
          x,
          y,
          options
        ),
    },
    {
      get(target: Record<string, unknown>, prop: string) {
        if (prop in target) return target[prop];
        return stored[prop];
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

  const view = new CoreDomainView(model as never, gfx as never);
  view.onCreated();

  return (at: { x: number; y: number }) =>
    view.includesPoint(at.x, at.y, PICK as never, null as never);
}

describe('where a Core Domain Chart answers the pointer', () => {
  it('routes the pointer to the view over an editable axis title', () => {
    // The picking layer says "nobody" there — which is exactly why the view has
    // to say "me", or the double-click lands on bare canvas.
    expect(
      backgroundIncludesPoint(
        { x: 0, y: 0, w: W, h: H, rotate: 0 },
        ON_X_AXIS_TITLE.x,
        ON_X_AXIS_TITLE.y,
        PICK
      )
    ).toBe(false);

    expect(setup()(ON_X_AXIS_TITLE)).toBe(true);
  });

  it('lets the plot go, so a dot under the pointer gets the click', () => {
    expect(setup()(ON_OPEN_SPACE)).toBe(false);
  });

  it('claims no label zone while the words are hidden', () => {
    // Nothing is painted there, so nothing may be aimed at there.
    expect(setup({ showLabels: false })(ON_X_AXIS_TITLE)).toBe(false);
  });
});
