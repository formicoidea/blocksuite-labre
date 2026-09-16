import { backgroundIncludesPoint } from '@labre/affine-model';
import { describe, expect, it, vi } from 'vitest';

import { EventStormingView } from '../element-view';

/**
 * An Event Storming board is SELECTED by its border (issue #194) — and since
 * #355 the one word it writes on itself receives the double-click that renames
 * it.
 *
 * Those two areas are not the same rectangle, and this file is about the seam
 * that lets them differ: pointer events reach a view through
 * `GfxViewEventManager`, which asks the VIEW's `includesPoint`, while picking
 * asks the MODEL's.
 */

const W = 3200;
const H = 1400;

/**
 * Inside the `timeAxisTitle` box: the title is right-aligned at (3160, 1368) in
 * 64-unit type and "Time" is ~154 wide, so 3000 → 3166 horizontally and 1298 →
 * 1393 vertically. Fifty units clear of the bottom edge, so the border band
 * cannot be the one answering.
 */
const ON_TIME_AXIS_TITLE = { x: 3100, y: 1350 };

/** Well inside the roll, on no label and nowhere near an edge. */
const ON_OPEN_SPACE = { x: 1600, y: 700 };

/** What the picking path passes. */
const PICK = { hitThreshold: 10, zoom: 1 };

function setup(props: Record<string, unknown> = {}) {
  const stored: Record<string, unknown> = { ...props };

  const model = new Proxy(
    {
      id: 'board',
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

  const view = new EventStormingView(model as never, gfx as never);
  view.onCreated();

  return (at: { x: number; y: number }) =>
    view.includesPoint(at.x, at.y, PICK as never, null as never);
}

describe('where an Event Storming board answers the pointer', () => {
  it('routes the pointer to the view over the time axis title', () => {
    // The picking layer says "nobody" there — which is exactly why the view has
    // to say "me", or the double-click lands on bare canvas.
    expect(
      backgroundIncludesPoint(
        { x: 0, y: 0, w: W, h: H, rotate: 0 },
        ON_TIME_AXIS_TITLE.x,
        ON_TIME_AXIS_TITLE.y,
        PICK
      )
    ).toBe(false);

    expect(setup()(ON_TIME_AXIS_TITLE)).toBe(true);
  });

  it('lets the roll go, so a sticky under the pointer gets the click', () => {
    expect(setup()(ON_OPEN_SPACE)).toBe(false);
  });

  it('reads the title the user has renamed it to', () => {
    // A shorter word is a smaller target, and the box follows it: "Go" is ~77
    // wide against "Time"'s ~154, so the left half of the old box is free again.
    expect(setup({ timeAxisTitle: 'Go' })({ x: 3010, y: 1350 })).toBe(false);
    expect(setup({ timeAxisTitle: 'Go' })(ON_TIME_AXIS_TITLE)).toBe(true);
  });
});
