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
  panelEdgeScrollDelta,
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

/*
 * The edge scroll (ADR 0034, amendment of 2026-11-04). Why it is pinned here:
 * before it, a list taller than its panel only took a drop on the rows on
 * screen — the controller never scrolled, and a scroll under a still pointer
 * (a wheel) left the drop line on the gap it was drawn for, so a release
 * landed the row elsewhere than the line said. These cases would have caught
 * a scroll that never starts, one that never stops (out of the band, at the
 * end of the list, after Escape), a line that does not follow the rows, and a
 * panel without `scroller` that suddenly scrolls.
 */
describe('panelEdgeScrollDelta', () => {
  // 100 → 300.
  const box = rect(100, 200);

  test('zero between the two bands', () => {
    expect(panelEdgeScrollDelta(box, 200)).toBe(0);
    expect(panelEdgeScrollDelta(box, 120)).toBe(0);
    expect(panelEdgeScrollDelta(box, 280)).toBe(0);
  });

  test('proportional to the depth in the band, signed by the edge', () => {
    expect(panelEdgeScrollDelta(box, 285)).toBe(5);
    expect(panelEdgeScrollDelta(box, 299)).toBe(19);
    expect(panelEdgeScrollDelta(box, 110)).toBe(-10);
    expect(panelEdgeScrollDelta(box, 101)).toBe(-19);
  });

  test('capped at 30 past the edge, and at the cap given', () => {
    expect(panelEdgeScrollDelta(box, 400)).toBe(30);
    expect(panelEdgeScrollDelta(box, 0)).toBe(-30);
    expect(panelEdgeScrollDelta(box, 299, 20, 10)).toBe(10);
    expect(panelEdgeScrollDelta(box, 270, 40)).toBe(10);
  });
});

describe('createPanelReorderDrag with a scroller', () => {
  let frames: Map<number, FrameRequestCallback>;
  let nextFrame: number;

  /** Runs the frames pending now, as the browser does before a paint. */
  const flush = () => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach(callback => callback(0));
  };

  beforeEach(() => {
    frames = new Map();
    nextFrame = 1;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      const id = nextFrame++;
      frames.set(id, cb);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  /** The panel (0 → 100) scrolls 400 px of content; the rows move with it. */
  function scrolling(withScroller = true) {
    let scrollTop = 0;
    let panel: HTMLElement | null = null;
    const ctx = setup(withScroller ? { scroller: () => panel } : {});
    panel = ctx.panel;
    Object.defineProperty(panel, 'scrollHeight', { value: 400 });
    Object.defineProperty(panel, 'clientHeight', { value: 100 });
    Object.defineProperty(panel, 'scrollTop', {
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    });
    Array.from(panel.children).forEach((row, i) => {
      (row as HTMLElement).getBoundingClientRect = () =>
        rect(i * ROW_HEIGHT - scrollTop, ROW_HEIGHT);
    });
    return { ...ctx, scrollTop: () => scrollTop };
  }

  test('held in the bottom band, the list scrolls a frame at a time', () => {
    const { press, move, up, scrollTop } = scrolling();
    press(10, 10);
    // 15 px deep in the 80 → 100 band.
    move(10, 95);
    expect(scrollTop()).toBe(0);
    flush();
    expect(scrollTop()).toBe(15);
    flush();
    expect(scrollTop()).toBe(30);
    up(10, 95);
  });

  test('each step resolves the gap again and hands it to the panel', () => {
    const { press, move, up, calls } = scrolling();
    press(10, 10);
    move(10, 95);
    // The rows end at 60: the pointer is past the last one.
    expect(calls.move).toHaveBeenLastCalledWith(3, {
      clientX: 10,
      clientY: 95,
    });
    const before = calls.move.mock.calls.length;
    flush();
    expect(calls.move.mock.calls.length).toBe(before + 1);
    flush();
    expect(calls.move.mock.calls.length).toBe(before + 2);
    up(10, 95);
  });

  test('a scroll of the box (a wheel) moves the line under a still pointer', () => {
    const { press, move, up, panel, calls } = scrolling();
    press(10, 10);
    // Over row 1's lower half: gap 2.
    move(10, 35);
    expect(calls.move).toHaveBeenLastCalledWith(2, {
      clientX: 10,
      clientY: 35,
    });
    // Row 1 now spans 0 → 20: the pointer is past every middle.
    panel.scrollTop = 20;
    panel.dispatchEvent(new Event('scroll'));
    expect(calls.move).toHaveBeenLastCalledWith(3, {
      clientX: 10,
      clientY: 35,
    });
    up(10, 35);
  });

  test('leaving the band stops the scroll', () => {
    const { press, move, up, scrollTop } = scrolling();
    press(10, 10);
    move(10, 95);
    flush();
    move(10, 50);
    flush();
    flush();
    expect(scrollTop()).toBe(15);
    expect(frames.size).toBe(0);
    up(10, 50);
  });

  test('the end of the list stops the scroll', () => {
    const { press, move, up, scrollTop } = scrolling();
    press(10, 10);
    // Past the edge: the cap, 30 px a frame, up to 400 - 100.
    move(10, 500);
    Array.from({ length: 20 }).forEach(flush);
    expect(scrollTop()).toBe(300);
    expect(frames.size).toBe(0);
    up(10, 500);
  });

  test('Escape stops the scroll', () => {
    const { press, move, key, scrollTop } = scrolling();
    press(10, 10);
    move(10, 95);
    flush();
    key('Escape');
    expect(frames.size).toBe(0);
    flush();
    expect(scrollTop()).toBe(15);
  });

  test('beside the list, nothing scrolls', () => {
    const { press, move, up, scrollTop } = scrolling();
    press(10, 10);
    move(300, 95);
    expect(frames.size).toBe(0);
    up(300, 95);
    expect(scrollTop()).toBe(0);
  });

  test('without a scroller, the list never scrolls by itself', () => {
    const { press, move, up, scrollTop } = scrolling(false);
    press(10, 10);
    move(10, 95);
    expect(frames.size).toBe(0);
    up(10, 95);
    expect(scrollTop()).toBe(0);
  });
});
