import { backgroundIncludesPoint } from '@labre/affine-model';
import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import { WardleyView } from '../element-view';

/**
 * A Wardley map is SELECTED by its border (issue #194) — and its axis labels
 * still receive the double-click that renames them.
 *
 * Those two areas are not the same rectangle, and this file is about the seam
 * that lets them differ. Pointer events reach a view through
 * `GfxViewEventManager`, which asks the VIEW's `includesPoint`; picking asks the
 * MODEL's. `GfxElementModelView.includesPoint` delegates to the model by
 * default, so a framework that needs more than the model offers overrides it —
 * next to the code that draws the zones, rather than in `affine-model`, which
 * cannot reach the declaration those zones come from.
 *
 * What breaks without the override: the map stops answering anywhere but its
 * border, the dblclick never reaches the view, and renaming an axis becomes
 * impossible. What breaks without the model change: the map swallows every
 * click meant for the nodes drawn on it.
 */

const W = 1600;
const H = 900;

/** Inside the `xAxisTitle` box — the same point the label-editor spec aims at. */
const ON_X_AXIS_TITLE = { x: 1500, y: 880 };

/** Well inside the plot, on no label and nowhere near an edge. */
const ON_OPEN_SPACE = { x: 800, y: 400 };

/** Five units inside the left edge: the border band, and nothing else. */
const ON_BORDER = { x: 5, y: 450 };

/** What the picking path passes. */
const PICK = { hitThreshold: 10, zoom: 1 };

function setup(props: Record<string, unknown> = { showXAxis: true }) {
  const yMap = new Y.Map<unknown>();
  new Y.Doc().getMap<Y.Map<unknown>>('elements').set('bg', yMap);
  for (const [key, value] of Object.entries(props)) yMap.set(key, value);

  const model = new Proxy(
    {
      id: 'bg',
      deserializedXYWH: [0, 0, W, H],
      x: 0,
      y: 0,
      w: W,
      h: H,
      rotate: 0,
      isLocked: () => false,
      // The real model's answer: `WardleyBackgroundElementModel.includesPoint`
      // is this call and nothing else.
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
        return yMap.get(prop);
      },
    }
  );

  const gfx = {
    viewport: { toModelCoord: (x: number, y: number) => [x, y] },
    selection: { set: vi.fn() },
    std: {
      store: { captureSync: vi.fn() },
      get: () => ({ updateElement: vi.fn() }),
      getOptional: () => null,
    },
  };

  const view = new WardleyView(model as never, gfx as never);
  view.onCreated();
  return view;
}

describe('where a Wardley map answers the pointer', () => {
  it('routes the pointer to the view over an editable axis label', () => {
    const view = setup();

    expect(
      view.includesPoint(
        ON_X_AXIS_TITLE.x,
        ON_X_AXIS_TITLE.y,
        PICK as never,
        null as never
      )
    ).toBe(true);
  });

  it('lets the plot go, so a node under the pointer gets the click', () => {
    const view = setup();

    // The bug, at the view layer: the map used to answer here too, which is
    // what made a map dropped over a node swallow every click on it.
    expect(
      view.includesPoint(
        ON_OPEN_SPACE.x,
        ON_OPEN_SPACE.y,
        PICK as never,
        null as never
      )
    ).toBe(false);
  });

  it('still answers on its border, straight from the model', () => {
    const view = setup();

    expect(
      view.includesPoint(ON_BORDER.x, ON_BORDER.y, PICK as never, null as never)
    ).toBe(true);
  });

  it('claims no label zone for an axis that is not drawn', () => {
    // Nothing is painted there, so nothing may be aimed at there.
    const view = setup({ showXAxis: false });

    expect(
      view.includesPoint(
        ON_X_AXIS_TITLE.x,
        ON_X_AXIS_TITLE.y,
        PICK as never,
        null as never
      )
    ).toBe(false);
  });
});
