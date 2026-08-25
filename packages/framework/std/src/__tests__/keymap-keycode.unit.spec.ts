import { describe, expect, test } from 'vitest';

import type { UIEventStateContext } from '../event/base.js';
import { bindKeymap } from '../event/keymap.js';

/**
 * A keyboard event whose produced character (`key`) and physical key
 * (`keyCode`) disagree — the situation on every non-US layout.
 */
const createKeyboardEvent = (options: {
  key: string;
  keyCode: number;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', {
    key: options.key,
    altKey: options.altKey ?? false,
    ctrlKey: options.ctrlKey ?? false,
    metaKey: options.metaKey ?? false,
    shiftKey: options.shiftKey ?? false,
  });

  Object.defineProperty(event, 'keyCode', {
    configurable: true,
    get: () => options.keyCode,
  });
  Object.defineProperty(event, 'which', {
    configurable: true,
    get: () => options.keyCode,
  });

  return event;
};

const createCtx = (event: KeyboardEvent) =>
  ({
    get(name: string) {
      if (name === 'keyboardState') {
        return { raw: event };
      }
      return undefined;
    },
  }) as unknown as UIEventStateContext;

describe('bindKeymap keyCode fallback', () => {
  test('falls back to the physical key for ctrl shortcuts on non-US layouts', () => {
    let handled = false;
    const handler = bindKeymap({
      'Ctrl-f': () => {
        handled = true;
        return true;
      },
    });

    // Russian layout: Ctrl pressed over the physical `f` key.
    const event = createKeyboardEvent({
      key: 'а',
      keyCode: 70,
      ctrlKey: true,
    });

    expect(handler(createCtx(event))).toBe(true);
    expect(handled).toBe(true);
  });

  test('does not fall back for Alt+locale-character letter input', () => {
    let handled = false;
    const handler = bindKeymap({
      'Alt-s': () => {
        handled = true;
        return true;
      },
    });

    // Polish layout: Alt-s produces `ś`, which the user means to type.
    const event = createKeyboardEvent({
      key: 'ś',
      keyCode: 83,
      altKey: true,
    });

    expect(handler(createCtx(event))).toBe(false);
    expect(handled).toBe(false);
  });

  test('keeps the Alt+digit fallback for non-ASCII key outputs', () => {
    let handled = false;
    const handler = bindKeymap({
      // Edgeless binds Alt-0/1/2 for zoom; those must survive.
      'Alt-0': () => {
        handled = true;
        return true;
      },
    });

    const event = createKeyboardEvent({
      key: 'º',
      keyCode: 48,
      altKey: true,
    });

    expect(handler(createCtx(event))).toBe(true);
    expect(handled).toBe(true);
  });

  test('does not fall back on non-ASCII input without modifiers', () => {
    let handled = false;
    const handler = bindKeymap({
      '[': () => {
        handled = true;
        return true;
      },
    });

    // Typing Cyrillic `х` must insert the character, not fire the `[` shortcut.
    const event = createKeyboardEvent({
      key: 'х',
      keyCode: 219,
    });

    expect(handler(createCtx(event))).toBe(false);
    expect(handled).toBe(false);
  });
});
