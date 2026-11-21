import { afterEach, describe, expect, test, vi } from 'vitest';

import type { UIEventHandler, UIEventStateContext } from '../event/base.js';
import { bindKeymap } from '../event/keymap.js';

/** Minimal context around a raw KeyboardEvent, as the dispatcher provides. */
const ctxFor = (event: KeyboardEvent) =>
  ({
    get: (type: string) => {
      if (type === 'keyboardState') return { raw: event };
      return { event };
    },
  }) as unknown as UIEventStateContext;

/**
 * Mini dispatcher: handlers run most-recently-registered first (like
 * `UIEventDispatcher.add`, which unshifts); the first truthy return stops the
 * chain. `harness.bind(keymap)` appends a keymap binding wired with the
 * interceptor registry, exactly like `KeyboardControl.bindHotkey`.
 */
function harness() {
  const runners: UIEventHandler[] = [];
  return {
    addFirst(handler: UIEventHandler) {
      runners.unshift(handler);
      return () => {
        const idx = runners.indexOf(handler);
        if (idx !== -1) runners.splice(idx, 1);
      };
    },
    bind(keymap: Record<string, UIEventHandler>) {
      const binding = bindKeymap(keymap, {
        register: handler => this.addFirst(handler),
      });
      this.addFirst(binding);
      return binding;
    },
    dispatch(event: KeyboardEvent) {
      const ctx = ctxFor(event);
      for (const runner of [...runners]) {
        if (runner(ctx)) return true;
      }
      return false;
    },
    press(key: string, init: KeyboardEventInit = {}) {
      return this.dispatch(new KeyboardEvent('keydown', { key, ...init }));
    },
  };
}

describe('bindKeymap chords', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('single keystroke bindings still fire', () => {
    const undo = vi.fn(() => true);
    const h = harness();
    h.bind({ 'Mod-z': undo });
    expect(h.press('z', { ctrlKey: true })).toBe(true);
    expect(undo).toHaveBeenCalledOnce();
  });

  test('a two-keystroke chord fires on the second keystroke', () => {
    const addComponent = vi.fn(() => true);
    const h = harness();
    h.bind({ 'w c': addComponent });

    expect(h.press('w')).toBe(true); // armed, swallowed
    expect(addComponent).not.toHaveBeenCalled();

    expect(h.press('c')).toBe(true);
    expect(addComponent).toHaveBeenCalledOnce();
  });

  test('an armed chord preempts an earlier single binding on the same key', () => {
    const connectorTool = vi.fn(() => true);
    const chord = vi.fn(() => true);
    const h = harness();
    // Bound first = runs LAST in the chain... but the dispatcher unshifts, so
    // the binding registered LATER runs FIRST. Model the real app: the
    // edgeless keyboard ('c' = connector tool) registers AFTER the shortcut
    // keymap, so it normally sees 'c' first.
    h.bind({ 'w c': chord });
    h.bind({ c: connectorTool });

    // 'c' alone: connector tool wins.
    expect(h.press('c')).toBe(true);
    expect(connectorTool).toHaveBeenCalledOnce();

    // 'w' then 'c': the armed chord intercepts 'c' before the connector tool.
    h.press('w');
    expect(h.press('c')).toBe(true);
    expect(chord).toHaveBeenCalledOnce();
    expect(connectorTool).toHaveBeenCalledOnce(); // unchanged
  });

  test('chords with the same prefix resolve by their second keystroke', () => {
    const link = vi.fn(() => true);
    const pipeline = vi.fn(() => true);
    const h = harness();
    h.bind({ 'w l': link, 'w p': pipeline });

    h.press('w');
    h.press('p');
    expect(pipeline).toHaveBeenCalledOnce();
    expect(link).not.toHaveBeenCalled();
  });

  test('an unmatched second keystroke is swallowed, not handed to single bindings', () => {
    const chord = vi.fn(() => true);
    const single = vi.fn(() => true);
    const h = harness();
    h.bind({ 'w c': chord, x: single });

    h.press('w');
    // 'x' has no meaning in the armed namespace: nothing happens.
    expect(h.press('x')).toBe(true);
    expect(chord).not.toHaveBeenCalled();
    expect(single).not.toHaveBeenCalled();
    // The prefix was forgotten: 'c' alone does nothing, 'x' alone works again.
    expect(h.press('c')).toBe(false);
    expect(chord).not.toHaveBeenCalled();
    expect(h.press('x')).toBe(true);
    expect(single).toHaveBeenCalledOnce();
  });

  /**
   * What an armed prefix does with a keystroke that cannot continue a chord:
   * a named key, a modified key, Space. Pinned first as SWALLOWED (the
   * behaviour of ADR 0008), then changed deliberately by ADR 0055: it disarms
   * and reaches the canvas's own binding, so a stray `w` followed by Delete
   * still deletes. Before 0055 every case below returned true and `canvasKey`
   * was never called.
   */
  test.each([
    ['Delete', {}],
    ['Backspace', {}],
    ['Escape', {}],
    ['ArrowRight', {}],
    [' ', {}],
    ['z', { ctrlKey: true }],
    ['d', { ctrlKey: true }],
  ] as const)('an armed prefix hands %s %o on to the canvas', (key, init) => {
    const chord = vi.fn(() => true);
    const canvasKey = vi.fn(() => true);
    const h = harness();
    h.bind({ 'w c': chord });
    h.bind({
      Delete: canvasKey,
      Backspace: canvasKey,
      Escape: canvasKey,
      ArrowRight: canvasKey,
      Space: canvasKey,
      'Mod-z': canvasKey,
      'Control-d': canvasKey,
    });

    h.press('w');
    expect(h.press(key, init)).toBe(true);
    expect(canvasKey).toHaveBeenCalledOnce();
    expect(chord).not.toHaveBeenCalled();
    // …and the prefix is forgotten: `c` alone is no chord any more.
    expect(h.press('c')).toBe(false);
    expect(chord).not.toHaveBeenCalled();
  });

  /**
   * A key held after it completed a chord auto-repeats (`repeat: true`): those
   * repeats used to arrive disarmed and reach the key's own single binding, so
   * `b` then `p` held placed the pool AND switched to the Pen tool.
   */
  test('a held second key does not repeat into its single binding', () => {
    const chord = vi.fn(() => true);
    const pen = vi.fn(() => true);
    const h = harness();
    h.bind({ 'b p': chord });
    h.bind({ p: pen });

    h.press('b');
    h.press('p');
    for (let i = 0; i < 3; i++) {
      expect(h.press('p', { repeat: true })).toBe(true);
    }
    expect(chord).toHaveBeenCalledOnce();
    expect(pen).not.toHaveBeenCalled();

    // Released and pressed again: an ordinary `p`.
    expect(h.press('p')).toBe(true);
    expect(pen).toHaveBeenCalledOnce();
  });

  test('another key ends the held-key guard', () => {
    const chord = vi.fn(() => true);
    const pen = vi.fn(() => true);
    const hand = vi.fn(() => true);
    const h = harness();
    h.bind({ 'b p': chord });
    h.bind({ p: pen, h: hand });

    h.press('b');
    h.press('p');
    h.press('h');
    expect(hand).toHaveBeenCalledOnce();
    // The guard is gone: even a repeat of `p` is an ordinary `p` now.
    h.press('p', { repeat: true });
    expect(pen).toHaveBeenCalledOnce();
  });

  test('a held prefix stays armed, without arming again in a loop', () => {
    const chord = vi.fn(() => true);
    const hand = vi.fn(() => true);
    const h = harness();
    h.bind({ 'b p': chord });
    h.bind({ h: hand });

    h.press('b');
    for (let i = 0; i < 4; i++) {
      expect(h.press('b', { repeat: true })).toBe(true);
    }
    // Still armed on the first press, whatever the number of repeats.
    h.press('p');
    expect(chord).toHaveBeenCalledOnce();
    expect(hand).not.toHaveBeenCalled();
  });

  test('a prefix held past the timeout does not arm again', () => {
    vi.useFakeTimers();
    const chord = vi.fn(() => true);
    const hand = vi.fn(() => true);
    const h = harness();
    h.bind({ 'b p': chord });
    h.bind({ h: hand });

    h.press('b');
    vi.advanceTimersByTime(2000);
    // A repeat of the held `b` arrives after the prefix expired: inert.
    expect(h.press('b', { repeat: true })).toBe(false);
    expect(h.press('h')).toBe(true);
    expect(hand).toHaveBeenCalledOnce();
  });

  test('a chord whose second key is modified still completes', () => {
    const chord = vi.fn(() => true);
    const h = harness();
    h.bind({ 'w Alt-x': chord });

    // A modified keystroke is handed on only when it completes no chord.
    h.press('w');
    expect(h.press('x', { altKey: true })).toBe(true);
    expect(chord).toHaveBeenCalledOnce();
  });

  test('a prefix whose chords cannot run does not arm', () => {
    let runnable = false;
    const chord = Object.assign(
      vi.fn(() => true),
      { canRun: () => runnable }
    );
    const handTool = vi.fn(() => true);
    const h = harness();
    h.bind({ 'w c': chord });
    h.bind({ h: handTool });

    // Not runnable (a read-only document, say): `w` is left alone and `h`
    // reaches the hand tool.
    expect(h.press('w')).toBe(false);
    expect(h.press('h')).toBe(true);
    expect(handTool).toHaveBeenCalledOnce();

    // Runnable again: the prefix arms and the namespace swallows `h`.
    runnable = true;
    expect(h.press('w')).toBe(true);
    expect(h.press('h')).toBe(true);
    expect(handTool).toHaveBeenCalledOnce();
  });

  test('a prefix arms when ONE of its chords can run', () => {
    const blocked = Object.assign(
      vi.fn(() => true),
      { canRun: () => false }
    );
    const open = vi.fn(() => true);
    const h = harness();
    h.bind({ 'w c': blocked, 'w p': open });

    expect(h.press('w')).toBe(true);
    h.press('p');
    expect(open).toHaveBeenCalledOnce();
    // The blocked chord is not even armed: `w c` is an unmatched letter.
    h.press('w');
    h.press('c');
    expect(blocked).not.toHaveBeenCalled();
  });

  test('an armed prefix expires after the timeout', () => {
    vi.useFakeTimers();
    const chord = vi.fn(() => true);
    const h = harness();
    h.bind({ 'w c': chord });

    h.press('w');
    vi.advanceTimersByTime(2000);
    expect(h.press('c')).toBe(false);
    expect(chord).not.toHaveBeenCalled();
  });

  test('a lone modifier press does not break an armed chord', () => {
    const chord = vi.fn(() => true);
    const h = harness();
    h.bind({ 'w Shift-C': chord });

    h.press('w');
    expect(h.press('Shift', { shiftKey: true })).toBe(false);
    h.press('C', { shiftKey: true });
    expect(chord).toHaveBeenCalledOnce();
  });

  test('a single binding on the prefix key wins over the chord', () => {
    const single = vi.fn(() => true);
    const chord = vi.fn(() => true);
    const h = harness();
    h.bind({ w: single, 'w c': chord });

    expect(h.press('w')).toBe(true);
    expect(single).toHaveBeenCalledOnce();
    h.press('c');
    expect(chord).not.toHaveBeenCalled();
  });

  test('disposing the binding disarms the chord and drops its interceptor', () => {
    const chord = vi.fn(() => true);
    const single = vi.fn(() => true);
    const h = harness();
    const binding = h.bind({ 'w c': chord });
    h.bind({ c: single });

    h.press('w'); // armed, interceptor registered
    binding.dispose(); // the binding's owner tears it down mid-chord

    // The continuation must reach the normal chain, not the dead chord.
    expect(h.press('c')).toBe(true);
    expect(chord).not.toHaveBeenCalled();
    expect(single).toHaveBeenCalledOnce();
  });

  test('chords are not armed while typing in an editable target', () => {
    const chord = vi.fn(() => true);
    const h = harness();
    h.bind({ 'w c': chord });

    const input = document.createElement('input');
    document.body.append(input);
    try {
      // Pipe real dispatched events (composedPath()[0] = the input) through
      // the chain, like the document-level KeyboardControl listener does.
      const results: boolean[] = [];
      const listener = (e: Event) => {
        results.push(h.dispatch(e as KeyboardEvent));
      };
      document.addEventListener('keydown', listener);
      try {
        input.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'w', bubbles: true })
        );
        input.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'c', bubbles: true })
        );
      } finally {
        document.removeEventListener('keydown', listener);
      }
      expect(results).toEqual([false, false]);
      expect(chord).not.toHaveBeenCalled();
    } finally {
      input.remove();
    }
  });
});
