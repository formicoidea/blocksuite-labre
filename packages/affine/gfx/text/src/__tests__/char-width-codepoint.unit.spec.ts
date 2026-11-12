/**
 * `charWidth` caches the width of a character, and two characters must never
 * share an entry.
 *
 * What it would have caught: the cache was indexed by `charCodeAt(0)`, the
 * first UTF-16 unit. A character outside the BMP is two units, and every
 * emoji from U+1F300 to U+1F64F starts with the same one (`\uD83D`): the
 * first emoji measured in a font gave its width to all the others, and
 * `wrapText`, which cuts a word too wide for its line one character at a
 * time, broke the line in the wrong place. The cache is now keyed by the
 * whole character beyond a single unit; a single-unit character keeps the
 * indexed cache it always had, so a text without emoji measures and wraps
 * exactly as before. Nothing stored changes: a size already written is not
 * recomputed on open.
 */
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';

import { charWidth, wrapText } from '../element-renderer/utils.js';

/** Widths by code point; anything else is 5px. */
const WIDTHS: Record<string, number> = {
  '\u{1F600}': 40, // 😀, a wide glyph in this fake font
  '\u{1F603}': 10, // 😃, same first UTF-16 unit, narrow
};

const widthOf = (text: string) =>
  Array.from(text).reduce((total, char) => total + (WIDTHS[char] ?? 5), 0);

/** Every string the measuring canvas was asked about. */
const measured: string[] = [];

beforeAll(() => {
  // happy-dom has no 2D canvas: `getLineWidth` gets this one.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    font: '',
    measureText: (text: string) => {
      measured.push(text);
      return { width: widthOf(text) };
    },
  } as unknown as CanvasRenderingContext2D);
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe('charWidth', () => {
  test('two emojis sharing their first UTF-16 unit keep their own width', () => {
    const font = '16px "first"';
    expect('\u{1F600}'.charCodeAt(0)).toBe('\u{1F603}'.charCodeAt(0));
    expect(charWidth.calculate('\u{1F600}', font)).toBe(40);
    expect(charWidth.calculate('\u{1F603}', font)).toBe(10);
    // And a lone half of one is not the whole character either.
    expect(charWidth.calculate('\uD83D', font)).toBe(5);
    expect(charWidth.calculate('\u{1F600}', font)).toBe(40);
  });

  test('wrapText cuts a word of emojis where their own widths say', () => {
    const font = '16px "second"';
    // The wide emoji is measured first, alone on its line.
    expect(
      wrapText('\u{1F600}\n' + '\u{1F603}'.repeat(5), font, 35).split('\n')
    ).toEqual(['\u{1F600}', '\u{1F603}'.repeat(3), '\u{1F603}'.repeat(2)]);
  });

  test('a text without emoji wraps the same, from the same cache', () => {
    const font = '16px "third"';
    expect(wrapText('abcdefghijkl', font, 40)).toBe('abcdefg\nhijkl');
    expect(wrapText('éèêëàâçùûü', font, 40)).toBe('éèêëàâç\nùûü');
    // A second pass measures no character again, the space aside.
    measured.length = 0;
    wrapText('abcdefghijkl', font, 40);
    wrapText('éèêëàâçùûü', font, 40);
    expect(measured.filter(text => text.length === 1)).toEqual([' ', ' ']);
  });
});
