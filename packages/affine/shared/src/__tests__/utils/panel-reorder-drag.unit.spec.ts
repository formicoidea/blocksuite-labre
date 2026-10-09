/**
 * The side panels' one reorder drag (`createPanelReorderDrag`, ADR 0034).
 *
 * Why it exists: the frame panel and the selection pane each wrote their own
 * drag, and the two drifted — mouse events against pointer events, a
 * read-only document refused by one only, Escape swallowed by one and ignored
 * by the other. The gesture now lives in one controller; this spec pins the
 * gesture itself, panel-free, so neither panel can bring a difference back:
 * the gap rule, the read-only refusal at the press, the threshold, Escape and
 * `pointercancel` as cancels that write nothing, the click swallowed after a
 * release, and the mask's cursor. The panels' own drop rules are driven with
 * a real pointer in the integration suite.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  createPanelReorderDrag,
  panelReorderGap,
  type PanelReorderDragOptions,
} from '../../utils/panel-reorder-drag.js';

function rect(top: number, height: number): DOMRect {
  return {
    top,
    height,
    bottom: top + height,
    left: 0,
    right: 100,
    width: 100,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

/** A pointer event; happy-dom's `PointerEvent` may be missing. */
function pointer(type: string, clientX: number, clientY: number, button = 0) {
  const Ctor = (globalThis.PointerEvent ?? MouseEvent) as typeof MouseEvent;
  return new Ctor(type, {
    clientX,
    clientY,
    button,
    bubbles: true,
    cancelable: true,
  }) as PointerEvent;
}

const ROW_HEIGHT = 20;

function setup(overrides: Partial<PanelReorderDragOptions<number>> = {}) {
  const host = document.createElement('div');
  const panel = document.createElement('div');
  const rows = [0, 1, 2].map(() => document.createElement('div'));
  document.body.append(host, panel);
  rows.forEach((row, i) => {
    panel.append(row);
    row.getBoundingClientRect = () => rect(i * ROW_HEIGHT, ROW_HEIGHT);
  });
  panel.getBoundingClientRect = () => rect(0, ROW_HEIGHT * 3 + 40);

  const calls = {
    pickUp: vi.fn(),
    move: vi.fn(),
    drop: vi.fn(),
    end: vi.fn(),
  };
  const drag = createPanelReorderDrag<number>({
    readonly: () => false,
    rows: () => rows,
    bounds: () => panel,
    onPickUp: calls.pickUp,
    // Gap 1 is refused, as a panel refuses a gap its row cannot go to.
    dropAt: gap => (gap === 1 ? null : gap),
    onMove: calls.move,
    onDrop: calls.drop,
    onEnd: calls.end,
    mask: {
      host: () => host,
      className: 'test-drag-mask',
      testId: 'test-drag-mask',
    },
    stateHost: () => panel,
    ...overrides,
  });

  const press = (x = 10, y = 10) => drag.press(pointer('pointerdown', x, y));
  const move = (x: number, y: number) =>
    document.dispatchEvent(pointer('pointermove', x, y));
  const up = (x: number, y: number) =>
    document.dispatchEvent(pointer('pointerup', x, y));
  const key = (k: string) => {
    const event = new KeyboardEvent('keydown', {
      key: k,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);
    return event;
  };
  const maskEl = () => host.querySelector<HTMLElement>('.test-drag-mask');

  return { drag, calls, panel, press, move, up, key, maskEl };
}

describe('panelReorderGap', () => {
  const rects = [rect(0, 20), rect(20, 20), rect(40, 20)];

  test('before the first row', () => {
    expect(panelReorderGap(rects, -5)).toBe(0);
    expect(panelReorderGap(rects, 9)).toBe(0);
  });

  test('between two rows: past a row’s middle is below it', () => {
    expect(panelReorderGap(rects, 11)).toBe(1);
    expect(panelReorderGap(rects, 29)).toBe(1);
    expect(panelReorderGap(rects, 31)).toBe(2);
  });

  test('after the last row', () => {
    expect(panelReorderGap(rects, 51)).toBe(3);
    expect(panelReorderGap(rects, 500)).toBe(3);
  });
});

describe('createPanelReorderDrag', () => {
  let added: string[];
  let removed: string[];

  beforeEach(() => {
    added = [];
    removed = [];
    const add = document.addEventListener.bind(document);
    const remove = document.removeEventListener.bind(document);
    vi.spyOn(document, 'addEventListener').mockImplementation(
      (type: string, ...rest: unknown[]) => {
        added.push(type);
        return (add as (...args: unknown[]) => void)(type, ...rest);
      }
    );
    vi.spyOn(document, 'removeEventListener').mockImplementation(
      (type: string, ...rest: unknown[]) => {
        removed.push(type);
        return (remove as (...args: unknown[]) => void)(type, ...rest);
      }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  test('a read-only document: the press adds no listener', () => {
    const { press, move, calls } = setup({ readonly: () => true });
    press();
    expect(added).toEqual([]);
    move(10, 50);
    expect(calls.pickUp).not.toHaveBeenCalled();
  });

  test('a nudge under the threshold on both axes picks nothing up', () => {
    const { press, move, up, calls, maskEl } = setup();
    press(10, 10);
    move(14, 14);
    expect(calls.pickUp).not.toHaveBeenCalled();
    expect(maskEl()).toBeNull();
    up(14, 14);
    expect(calls.end).not.toHaveBeenCalled();
    expect(removed.sort()).toEqual(
      ['keydown', 'pointercancel', 'pointermove', 'pointerup'].sort()
    );
  });

  test('the threshold on one axis picks the row up', () => {
    const { press, move, up, calls } = setup();
    press(10, 10);
    move(10, 15);
    expect(calls.pickUp).toHaveBeenCalledOnce();
    expect(calls.pickUp).toHaveBeenCalledWith({ clientX: 10, clientY: 10 });
    up(10, 15);
  });

  test('a release over a gap that takes it drops, then ends', () => {
    const { drag, press, move, up, calls } = setup();
    press(10, 10);
    move(10, 55);
    expect(drag.dragging).toBe(true);
    up(10, 55);
    expect(calls.drop).toHaveBeenCalledWith(3);
    expect(calls.end).toHaveBeenCalledOnce();
    expect(calls.drop.mock.invocationCallOrder[0]).toBeLessThan(
      calls.end.mock.invocationCallOrder[0]
    );
    expect(drag.dragging).toBe(false);
  });

  test('Escape cancels: no drop, onEnd once, the listeners gone', () => {
    const { drag, press, move, up, key, calls, maskEl } = setup();
    press(10, 10);
    move(10, 55);
    const escape = key('Escape');
    expect(escape.defaultPrevented).toBe(true);
    expect(calls.end).toHaveBeenCalledOnce();
    expect(drag.dragging).toBe(false);
    expect(maskEl()).toBeNull();
    expect(removed.sort()).toEqual(
      ['keydown', 'pointercancel', 'pointermove', 'pointerup'].sort()
    );

    // The release that follows writes nothing.
    move(10, 30);
    up(10, 55);
    expect(calls.drop).not.toHaveBeenCalled();
    expect(calls.end).toHaveBeenCalledOnce();
  });

  test('Escape during a drag does not reach the panel', () => {
    const { press, move, panel } = setup();
    const seen = vi.fn();
    panel.addEventListener('keydown', seen);
    press(10, 10);
    move(10, 55);
    panel.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    expect(seen).not.toHaveBeenCalled();
  });

  test('pointercancel cancels like Escape', () => {
    const { press, move, up, calls } = setup();
    press(10, 10);
    move(10, 55);
    document.dispatchEvent(pointer('pointercancel', 10, 55));
    expect(calls.end).toHaveBeenCalledOnce();
    up(10, 55);
    expect(calls.drop).not.toHaveBeenCalled();
    expect(removed).toContain('pointermove');
  });

  test('dispose during a drag ends it and removes the listeners', () => {
    const { drag, press, move, up, calls, maskEl } = setup();
    press(10, 10);
    move(10, 55);
    drag.dispose();
    expect(calls.end).toHaveBeenCalledOnce();
    expect(maskEl()).toBeNull();
    expect(removed.sort()).toEqual(
      ['keydown', 'pointercancel', 'pointermove', 'pointerup'].sort()
    );
    up(10, 55);
    expect(calls.drop).not.toHaveBeenCalled();
  });

  test('the click after a release is swallowed exactly once', () => {
    const { drag, press, move, up } = setup();
    expect(drag.consumeSwallowedClick()).toBe(false);
    press(10, 10);
    move(10, 55);
    up(10, 55);
    expect(drag.consumeSwallowedClick()).toBe(true);
    expect(drag.consumeSwallowedClick()).toBe(false);
  });

  test('the click after a cancel is swallowed too; a plain click is not', () => {
    const { drag, press, move, up, key } = setup();
    press(10, 10);
    move(10, 55);
    key('Escape');
    up(10, 55);
    expect(drag.consumeSwallowedClick()).toBe(true);
    expect(drag.consumeSwallowedClick()).toBe(false);

    press(10, 10);
    up(10, 10);
    expect(drag.consumeSwallowedClick()).toBe(false);
  });

  test('the mask carries the class, the test id and the drop’s cursor', () => {
    const { press, move, up, maskEl, panel, calls } = setup();
    press(10, 10);
    move(10, 55);
    const mask = maskEl()!;
    expect(mask.dataset.testid).toBe('test-drag-mask');
    expect(mask.style.cursor).toBe('grabbing');
    expect(panel.dataset.drag).toBe('valid');
    expect(calls.move).toHaveBeenLastCalledWith(3, {
      clientX: 10,
      clientY: 55,
    });

    // Gap 1 is refused.
    move(10, 15);
    expect(mask.style.cursor).toBe('not-allowed');
    expect(panel.dataset.drag).toBe('invalid');
    expect(calls.move).toHaveBeenLastCalledWith(null, {
      clientX: 10,
      clientY: 15,
    });

    // Outside the bounds: refused.
    move(10, 500);
    expect(mask.style.cursor).toBe('not-allowed');

    up(10, 500);
    expect(calls.drop).not.toHaveBeenCalled();
    expect(maskEl()).toBeNull();
    expect(panel.dataset.drag).toBeUndefined();
  });
});
