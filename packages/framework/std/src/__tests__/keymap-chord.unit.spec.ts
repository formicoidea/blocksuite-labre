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

  test('an unmatched second keystroke falls through to single bindings', () => {
    const chord = vi.fn(() => true);
    const single = vi.fn(() => true);
    const h = harness();
    h.bind({ 'w c': chord, x: single });

    h.press('w');
    expect(h.press('x')).toBe(true);
    expect(chord).not.toHaveBeenCalled();
    expect(single).toHaveBeenCalledOnce();
    // The prefix was forgotten: 'c' alone does nothing.
    expect(h.press('c')).toBe(false);
    expect(chord).not.toHaveBeenCalled();
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
