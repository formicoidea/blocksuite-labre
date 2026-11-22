/**
 * The keyboard's placement of what a click picks up (ADR 0054, amendment of
 * 2026-11-22): Enter on a mind map style or a template card sets it down at
 * once, at the centre of the view, through `dropAt`. It must hand the menu's
 * `onDrop` the bound a mouse drop there would give — centred on the point,
 * `standardWidth` wide, the picked element's proportions — and leave nothing
 * carried. Would have caught a placement off-centre, a template drawn at the
 * toolbar's size, or a ghost left following the next mouse move.
 * The keyboard path itself is held by `edgeless-toolbar-keyboard-gaps.spec.ts`.
 */
import type { Bound } from '@labre/global/gfx';
import { describe, expect, test, vi } from 'vitest';

import { EdgelessDraggableElementController } from '../draggable/draggable-element.controller.js';

type Controller = EdgelessDraggableElementController<{ name: string }>;

/** A controller in the state a click-to-drag pick-up leaves it. */
const pickedUp = ({
  standardWidth,
  elementWidth = 100,
}: {
  standardWidth?: number;
  elementWidth?: number;
} = {}) => {
  const onDrop = vi.fn<(element: unknown, bound: Bound) => void>();
  const mask = document.createElement('div');
  document.body.append(mask);
  const controller = Object.create(
    EdgelessDraggableElementController.prototype
  ) as Controller;
  Object.assign(controller, {
    host: { requestUpdate: () => {} },
    options: {
      edgeless: { host: document.createElement('div') },
      standardWidth: 560,
      onDrop,
    },
    events: {},
    overlay: { mask },
    clearTimeout: null,
    info: {
      elementInfo: { data: { name: 'card' }, preview: null, standardWidth },
      elementRectOriginal: { width: elementWidth, height: 50 },
    },
    states: {
      cancelled: false,
      draggingElement: { data: { name: 'card' } },
      dragOut: false,
    },
  });
  return { controller, onDrop, mask };
};

describe('EdgelessDraggableElementController.dropAt', () => {
  test('drops what was picked up, centred on the point, standardWidth wide', () => {
    const { controller, onDrop, mask } = pickedUp({ standardWidth: 350 });
    expect(controller.dropAt([1000, 500])).toBe(true);
    expect(onDrop).toHaveBeenCalledTimes(1);
    const bound = onDrop.mock.calls[0][1];
    expect([bound.x, bound.y, bound.w, bound.h]).toEqual([
      1000 - 175,
      500 - 87.5,
      350,
      175,
    ]);
    // Nothing is left carried: the ghost is gone.
    expect(controller.states.draggingElement).toBeNull();
    expect(controller.overlay).toBeNull();
    expect(mask.isConnected).toBe(false);
  });

  test("without the element's own width, the controller's", () => {
    const { controller, onDrop } = pickedUp({ elementWidth: 200 });
    controller.dropAt([0, 0]);
    const bound = onDrop.mock.calls[0][1];
    expect([bound.w, bound.h]).toEqual([560, 140]);
  });

  test('does nothing when nothing is picked up, or the pick-up was cancelled', () => {
    const idle = pickedUp();
    idle.controller.states.draggingElement = null;
    expect(idle.controller.dropAt([0, 0])).toBe(false);
    expect(idle.onDrop).not.toHaveBeenCalled();

    const cancelled = pickedUp();
    cancelled.controller.states.cancelled = true;
    expect(cancelled.controller.dropAt([0, 0])).toBe(false);
    expect(cancelled.onDrop).not.toHaveBeenCalled();
  });
});
