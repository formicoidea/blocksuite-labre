import { describe, expect, it } from 'vitest';

import { numberPropertyModelConfig } from '../property-presets/number/define.js';
import { parseNumber } from '../property-presets/number/utils/formatter.js';

const fromString = (value: string) =>
  numberPropertyModelConfig.config.rawValue.fromString({
    value,
  } as never).value;

describe('number property fromString', () => {
  it('accepts a grouped number pasted from a spreadsheet', () => {
    expect(fromString('11,451.4')).toBe(11451.4);
  });

  it('accepts a number carrying its currency symbol', () => {
    expect(fromString('$1,200')).toBe(1200);
  });

  it('keeps plain decimal parsing', () => {
    expect(fromString('123.45')).toBe(123.45);
    expect(fromString('-7')).toBe(-7);
  });

  it('still refuses text that holds no number', () => {
    expect(fromString('hello')).toBeNull();
    expect(fromString('')).toBeNull();
  });

  it('parses the same way the cell renders and reads back', () => {
    expect(fromString('11,451.4')).toBe(parseNumber('11,451.4'));
  });
});
