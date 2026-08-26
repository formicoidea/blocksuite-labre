import { describe, expect, test } from 'vitest';

import {
  extractColorFromStyle,
  parseCssColor,
  resolveNearestSupportedColor,
} from '../../../adapters/utils/color.js';

describe('parseCssColor', () => {
  test.each([
    ['#00afde', { r: 0, g: 175, b: 222 }],
    ['#0AF', { r: 0, g: 170, b: 255 }],
    ['rgb(0, 175, 222)', { r: 0, g: 175, b: 222 }],
    ['rgba(0, 175, 222, 0.5)', { r: 0, g: 175, b: 222 }],
    ['rgb(0 175 222 / 100%)', { r: 0, g: 175, b: 222 }],
  ])('parses %s', (input, expected) => {
    expect(parseCssColor(input)).toEqual(expected);
  });

  test.each([
    [''],
    ['#12345'],
    ['var(--affine-v2-text-highlight-fg-blue)'],
    ['rgb(0, 175)'],
  ])('rejects %s', input => {
    expect(parseCssColor(input)).toBeNull();
  });
});

describe('resolveNearestSupportedColor', () => {
  test.each([
    ['#00afde', 'blue'],
    ['#c83030', 'red'],
    ['#db7123', 'orange'],
    ['#ac7400', 'yellow'],
    ['#9bda91', 'green'],
    ['#0e4841', 'teal'],
    ['#7c3aed', 'purple'],
    ['#7a7a7a', 'grey'],
  ])('maps %s to the %s highlight', (color, expected) => {
    expect(resolveNearestSupportedColor(color)).toBe(
      `var(--affine-v2-text-highlight-fg-${expected})`
    );
  });

  test('leaves an unparseable colour alone', () => {
    expect(resolveNearestSupportedColor('var(--some-var)')).toBeNull();
  });
});

describe('extractColorFromStyle', () => {
  test('reads the color declaration', () => {
    expect(extractColorFromStyle('color: #00afde;')).toBe('#00afde');
  });

  test('ignores background-color', () => {
    expect(extractColorFromStyle('background-color: #00afde;')).toBeNull();
  });

  test('returns null without a style', () => {
    expect(extractColorFromStyle(undefined)).toBeNull();
  });
});
