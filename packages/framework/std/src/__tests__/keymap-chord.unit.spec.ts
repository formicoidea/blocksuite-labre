import { afterEach, describe, expect, test, vi } from 'vitest';

import type { UIEventStateContext } from '../event/base.js';
import { bindKeymap } from '../event/keymap.js';

/** Minimal context around a raw KeyboardEvent, as the dispatcher provides. */
const ctxFor = (event: KeyboardEvent) =>
  ({
    get: (type: string) => {
      if (type === 'keyboardState') return { raw: event };
      return { event };
    },
  }) as unknown as UIEventStateContext;

const press = (
  handler: ReturnType<typeof bindKeymap>,
  key: string,
  init: KeyboardEventInit = {}
) => handler(ctxFor(new KeyboardEvent('keydown', { key, ...init })));

describe('bindKeymap chords', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('single keystroke bindings still fire', () => {
    const undo = vi.fn(() => true);
    const handler = bindKeymap({ 'Mod-z': undo });
    expect(press(handler, 'z', { ctrlKey: true })).toBe(true);
    expect(undo).toHaveBeenCalledOnce();
  });

  test('a two-keystroke chord fires on the second keystroke', () => {
    const addComponent = vi.fn(() => true);
    const handler = bindKeymap({ 'w c': addComponent });

    expect(press(handler, 'w')).toBe(true); // armed, swallowed
    expect(addComponent).not.toHaveBeenCalled();

    expect(press(handler, 'c')).toBe(true);
    expect(addComponent).toHaveBeenCalledOnce();
  });

  test('chords with the same prefix resolve by their second keystroke', () => {
    const link = vi.fn(() => true);
    const pipeline = vi.fn(() => true);
    const handler = bindKeymap({ 'w l': link, 'w p': pipeline });

    press(handler, 'w');
    press(handler, 'p');
    expect(pipeline).toHaveBeenCalledOnce();
    expect(link).not.toHaveBeenCalled();
  });

  test('an unmatched second keystroke falls through to single bindings', () => {
    const chord = vi.fn(() => true);
    const single = vi.fn(() => true);
    const handler = bindKeymap({ 'w c': chord, x: single });

    press(handler, 'w');
    expect(press(handler, 'x')).toBe(true);
    expect(chord).not.toHaveBeenCalled();
    expect(single).toHaveBeenCalledOnce();
    // The prefix was forgotten: 'c' alone does nothing.
    expect(press(handler, 'c')).toBe(false);
    expect(chord).not.toHaveBeenCalled();
  });

  test('an armed prefix expires after the timeout', () => {
    vi.useFakeTimers();
    const chord = vi.fn(() => true);
    const handler = bindKeymap({ 'w c': chord });

    press(handler, 'w');
    vi.advanceTimersByTime(2000);
    expect(press(handler, 'c')).toBe(false);
    expect(chord).not.toHaveBeenCalled();
  });

  test('a lone modifier press does not break an armed chord', () => {
    const chord = vi.fn(() => true);
    const handler = bindKeymap({ 'w Shift-C': chord });

    press(handler, 'w');
    expect(press(handler, 'Shift', { shiftKey: true })).toBe(false);
    press(handler, 'C', { shiftKey: true });
    expect(chord).toHaveBeenCalledOnce();
  });

  test('a single binding on the prefix key wins over the chord', () => {
    const single = vi.fn(() => true);
    const chord = vi.fn(() => true);
    const handler = bindKeymap({ w: single, 'w c': chord });

    expect(press(handler, 'w')).toBe(true);
    expect(single).toHaveBeenCalledOnce();
    press(handler, 'c');
    expect(chord).not.toHaveBeenCalled();
  });

  test('chords are not armed while typing in an editable target', () => {
    const chord = vi.fn(() => true);
    const handler = bindKeymap({ 'w c': chord });

    const input = document.createElement('input');
    document.body.append(input);
    try {
      const results: (boolean | null | undefined | void)[] = [];
      input.addEventListener('keydown', e => {
        results.push(handler(ctxFor(e)));
      });
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'w', bubbles: true })
      );
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'c', bubbles: true })
      );
      expect(results).toEqual([false, false]);
      expect(chord).not.toHaveBeenCalled();
    } finally {
      input.remove();
    }
  });
});
