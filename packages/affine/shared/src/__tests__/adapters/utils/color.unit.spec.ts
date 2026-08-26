import { describe, expect, test } from 'vitest';

import {
  extractColorFromStyle,
  parseCssColor,
  resolveNearestSupportedColor,
} from '../../../adapters/utils/color.js';

describe('parseCssColor', () => {
  test.each([
    ['#00afde', { r: 0, g: 175, b: 222, alpha: 1 }],
    ['#0AF', { r: 0, g: 170, b: 255, alpha: 1 }],
    ['#0AF8', { r: 0, g: 170, b: 255, alpha: 136 / 255 }],
    ['#00afde80', { r: 0, g: 175, b: 222, alpha: 128 / 255 }],
    ['rgb(0, 175, 222)', { r: 0, g: 175, b: 222, alpha: 1 }],
    ['rgba(0, 175, 222, 0.5)', { r: 0, g: 175, b: 222, alpha: 0.5 }],
    ['rgb(0 175 222 / 100%)', { r: 0, g: 175, b: 222, alpha: 1 }],
    ['rgb(0% 50% 100%)', { r: 0, g: 128, b: 255, alpha: 1 }],
    ['hsl(0, 100%, 50%)', { r: 255, g: 0, b: 0, alpha: 1 }],
    ['hsla(120, 100%, 25%, 0.5)', { r: 0, g: 128, b: 0, alpha: 0.5 }],
    ['RED', { r: 255, g: 0, b: 0, alpha: 1 }],
    ['transparent', { r: 0, g: 0, b: 0, alpha: 0 }],
  ])('parses %s', (input, expected) => {
    expect(parseCssColor(input)).toEqual(expected);
  });

  test.each([
    [''],
    ['#12345'],
    ['#gggggg'],
    ['var(--affine-v2-text-highlight-fg-blue)'],
    ['color-mix(in srgb, red, blue)'],
    ['rebeccapurple'],
    ['rgb(0, 175)'],
  ])('rejects %s', input => {
    expect(parseCssColor(input)).toBeNull();
  });
});

describe('resolveNearestSupportedColor', () => {
  // Upstream's table: a colour close to a supported highlight is mapped to it,
  // anything else stays uncoloured so it follows the reader's theme.
  test.each([
    ['#00afde', 'blue'],
    ['rgb(0 175 222 / 100%)', 'blue'],
    ['#c83030', 'red'],
    ['red', 'red'],
    ['hsl(0, 100%, 50%)', 'red'],
    ['#db7123', 'orange'],
    ['#ac7400', 'yellow'],
    ['#9bda91', 'green'],
    ['#0e4841', 'teal'],
    ['#7c3aed', 'purple'],
    ['#7a7a7a', 'grey'],
    // Default body text and background: never repainted.
    ['rgb(26, 26, 26)', null],
    ['#333', null],
    ['#fff', null],
    // Translucent colours were picked against the source background.
    ['rgba(0, 175, 222, 0.5)', null],
    // Unparseable.
    ['var(--some-var)', null],
  ])('maps %s to %s', (color, expected) => {
    expect(resolveNearestSupportedColor(color)).toBe(
      expected ? `var(--affine-v2-text-highlight-fg-${expected})` : null
    );
  });
});

describe('extractColorFromStyle', () => {
  test('reads the color declaration', () => {
    expect(extractColorFromStyle('color: #00afde;')).toBe('#00afde');
  });

  test('ignores background-color', () => {
    expect(extractColorFromStyle('background-color: #00afde;')).toBeNull();
  });

  test('keeps a value that contains further colons', () => {
    expect(
      extractColorFromStyle('font-family: a; color: rgb(0 0 0 / 50%);')
    ).toBe('rgb(0 0 0 / 50%)');
  });

  test('returns null without a style', () => {
    expect(extractColorFromStyle(undefined)).toBeNull();
  });
});
