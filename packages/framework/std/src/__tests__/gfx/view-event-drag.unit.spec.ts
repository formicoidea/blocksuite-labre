import { describe, expect, it } from 'vitest';

import type { PointerEventState } from '../../event/index.js';
import { GfxViewEventManager } from '../../gfx/interactivity/index.js';
import type { GfxElementModelView } from '../../gfx/view/view.js';

/**
 * Which view a DRAG belongs to.
 *
 * The hovered stack is only ever rebuilt by `pointermove`, so a pointer that
 * arrives somewhere without one leaves it empty or stale — and a drag was then
 * handed to whatever the pointer was last over, or to nobody. Clicks and
 * double-clicks already re-pick by point for exactly that reason (the C4 title
 * band); this file is the same claim for `dragstart`, which is what a morph
 * launched from the toolbar runs into: the artefact under the pointer is
 * rewritten and no `pointermove` ever says so.
 */

/** A view that answers the pointer inside one box, and records what it gets. */
function viewAt(box: [number, number, number, number]) {
  const [bx, by, bw, bh] = box;
  const received: string[] = [];

  const view = {
    model: { id: 'model' },
    includesPoint: (x: number, y: number) =>
      x >= bx && x <= bx + bw && y >= by && y <= by + bh,
    dispatch: (event: string) => {
      received.push(event);
      return true;
    },
  };

  return { view: view as unknown as GfxElementModelView, received };
}

function managerOver(view: GfxElementModelView) {
  const gfx = {
    viewport: { toModelCoord: (x: number, y: number) => [x, y] },
    grid: { search: () => [view.model] },
    view: { get: () => view },
    std: { host: document.createElement('div') },
  };

  return new GfxViewEventManager(gfx as never);
}

const at = (x: number, y: number) => ({ x, y }) as unknown as PointerEventState;

describe('a drag with no pointermove behind it', () => {
  it('starts on the view actually under the pointer', () => {
    const { view, received } = viewAt([0, 0, 100, 50]);
    const manager = managerOver(view);

    // No `pointermove` at all: the hovered stack is empty, exactly as it is
    // after a toolbar action rewrote what stands under a stationary pointer.
    expect(manager.dispatch('dragstart', at(50, 25))).toBe(true);
    expect(received).toEqual(['dragstart']);

    // …and the rest of the gesture stays with it, wherever it travels.
    manager.dispatch('dragmove', at(400, 400));
    manager.dispatch('dragend', at(400, 400));
    expect(received).toEqual(['dragstart', 'dragmove', 'dragend']);
  });

  it('leaves a drag on open canvas to the tool that owns it', () => {
    const { view, received } = viewAt([0, 0, 100, 50]);
    const manager = managerOver(view);

    // Nothing answers there, so nothing is handled — a box selection or a pan
    // would be swallowed by a view claiming a drag it is not under.
    expect(manager.dispatch('dragstart', at(500, 500))).toBe(false);
    expect(received).toEqual([]);
  });

  it('ends a gesture still running before it starts the next one', () => {
    const { view, received } = viewAt([0, 0, 100, 50]);
    const manager = managerOver(view);

    manager.dispatch('dragstart', at(10, 10));
    manager.dispatch('dragstart', at(10, 10));

    expect(received).toEqual(['dragstart', 'dragend', 'dragstart']);
  });
});
