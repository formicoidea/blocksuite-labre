/**
 * The slash menu used to die on the first key that followed an empty result —
 * upstream #14141. Typing `/eeee`, deleting back to `/` and typing `h` closed
 * the menu instead of showing the headings, because `_queryState` is refreshed
 * asynchronously and still read `no_result` when the `h` arrived.
 *
 * `isTextInputKey` is the judgement that fixes it: a key that adds a character
 * to the query keeps the menu alive, anything else still closes it. These tests
 * pin both halves — the second one is the behaviour users rely on to dismiss a
 * dead menu.
 */
import { describe, expect, it } from 'vitest';

import { isTextInputKey } from '../utils.js';

/** A keydown as the browser delivers it, with only what the predicate reads. */
function keydown(init: KeyboardEventInit) {
  return new KeyboardEvent('keydown', init);
}

describe('isTextInputKey', () => {
  it('accepts a plain character, which narrows the query', () => {
    expect(isTextInputKey(keydown({ key: 'h' }))).toBe(true);
    expect(isTextInputKey(keydown({ key: '1' }))).toBe(true);
    expect(isTextInputKey(keydown({ key: 'É' }))).toBe(true);
  });

  it('accepts a character typed with Shift', () => {
    expect(isTextInputKey(keydown({ key: 'H', shiftKey: true }))).toBe(true);
  });

  it('rejects space, which still closes the menu', () => {
    expect(isTextInputKey(keydown({ key: ' ' }))).toBe(false);
  });

  it('rejects named keys, which are commands rather than text', () => {
    for (const key of ['Enter', 'Tab', 'Escape', 'ArrowDown', 'F2']) {
      expect(isTextInputKey(keydown({ key }))).toBe(false);
    }
  });

  it('rejects a character combined with a modifier', () => {
    expect(isTextInputKey(keydown({ key: 'a', ctrlKey: true }))).toBe(false);
    expect(isTextInputKey(keydown({ key: 'a', metaKey: true }))).toBe(false);
    expect(isTextInputKey(keydown({ key: 'a', altKey: true }))).toBe(false);
  });

  it('rejects a keydown emitted mid IME composition', () => {
    // The query is updated by the input / composition hooks in that case, so
    // the keydown must not be read as text.
    const composing = keydown({ key: 'a' });
    Object.defineProperty(composing, 'isComposing', { value: true });
    expect(isTextInputKey(composing)).toBe(false);
  });
});
