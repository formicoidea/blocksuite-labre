import type { IVec } from '@labre/global/gfx';
import { signal } from '@preact/signals-core';
import { Subject } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { InteractivityManager } from '../../gfx/interactivity/index.js';
import type { GfxModel } from '../../gfx/model/model.js';

/**
 * An element move re-applies itself when the viewport moves under a pointer
 * that stays still (`viewportMoved`: wheel pan, and the edge auto-pan of an
 * element drag). The replay used the drag START event, never refreshed by the
 * moves that followed, so the first pan snapped the dragged elements back to
 * where the gesture began. It must replay the LATEST pointer position.
 */

function moveHarness() {
  const host = document.createElement('div');
  const viewportMoved = new Subject<IVec>();
  // Model x of the viewport's left edge: what a pan changes.
  let panX = 0;
  const dxs: number[] = [];

  const view = {
    onDragStart: () => {},
    onDragMove: ({ dx }: { dx: number }) => dxs.push(dx),
    onDragEnd: () => {},
  };

  const gfx = {
    viewport: {
      viewportMoved,
      toModelCoordFromClientCoord: ([x, y]: IVec) => [x + panX, y],
    },
    keyboard: { shiftKey$: signal(false) },
    view: { get: () => view },
    std: {
      host,
      store: { readonly: false, transact: (fn: () => void) => fn() },
      provider: { getAll: () => new Map() },
    },
  };

  const manager = new InteractivityManager(gfx as never);
  const model = { xywh: '[0,0,10,10]' } as unknown as GfxModel;

  manager.handleElementMove({
    movingElements: [model],
    event: new PointerEvent('pointerdown', { clientX: 0, clientY: 0 }),
  });

  return {
    move: (clientX: number) =>
      host.dispatchEvent(new PointerEvent('pointermove', { clientX })),
    pan: (dx: number) => {
      panX += dx;
      viewportMoved.next([dx, 0]);
    },
    lastDx: () => dxs.at(-1),
  };
}

describe('an element move under a panning viewport', () => {
  it('replays the latest pointer position, not the drag start', () => {
    const drag = moveHarness();

    drag.move(100);
    expect(drag.lastDx()).toBe(100);

    // The pointer stays at client x 100; the board slides 50 under it.
    drag.pan(50);
    expect(drag.lastDx()).toBe(150);
  });
});
