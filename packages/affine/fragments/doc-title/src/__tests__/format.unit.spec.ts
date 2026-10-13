import type { TitleBandProperty } from '@labre/affine-shared/services';
import { describe, expect, it } from 'vitest';

import {
  chipEditorKind,
  chipValueView,
  formatPropertyValue,
  isPropertyValueEmpty,
  parseChipNumber,
} from '../title-band/format';

/**
 * What a chip of the title band reads, from the JSON a data-view cell holds
 * (ADR 0035 §9d). A host's own properties panel reuses `formatPropertyValue`
 * through `@labre/affine/host-panels`, so the panel and the chips must read
 * the same; and a value the band cannot make sense of is drawn empty, never a
 * throw, since it comes from the host's store.
 */

function prop(over: Partial<TitleBandProperty>): TitleBandProperty {
  return {
    id: 'p',
    namespace: 'workspace',
    name: 'P',
    type: 'text',
    data: {},
    value: null,
    readonly: false,
    ...over,
  };
}

const OPTIONS = {
  options: [
    { id: 'a', value: 'Doing', color: 'var(--affine-tag-blue)' },
    { id: 'b', value: 'Done' },
  ],
};

describe('the title band formatter', () => {
  it('reads option ids as their labels, in the value order', () => {
    expect(
      formatPropertyValue(prop({ type: 'select', data: OPTIONS, value: 'b' }))
    ).toBe('Done');
    expect(
      formatPropertyValue(
        prop({ type: 'multi-select', data: OPTIONS, value: ['b', 'a', 'z'] })
      )
    ).toBe('Done, Doing');
    expect(
      chipValueView(prop({ type: 'select', data: OPTIONS, value: 'z' }), 'en')
    ).toEqual({ kind: 'empty' });
  });

  it('formats numbers with the number preset and dates with the locale', () => {
    expect(
      formatPropertyValue(
        prop({
          type: 'number',
          data: { format: 'numberWithCommas', decimal: 0 },
          value: 1234,
        })
      )
    ).toMatch(/1.234/);
    const date = Date.UTC(2026, 9, 13, 12);
    expect(
      formatPropertyValue(prop({ type: 'date', value: date }), 'fr-FR')
    ).toMatch(/oct/);
    expect(formatPropertyValue(prop({ type: 'progress', value: 40 }))).toBe(
      '40%'
    );
  });

  it('calls nullish, blank and empty lists empty, and false a value', () => {
    expect(isPropertyValueEmpty(prop({ value: null }))).toBe(true);
    expect(isPropertyValueEmpty(prop({ value: '  ' }))).toBe(true);
    expect(isPropertyValueEmpty(prop({ value: [] }))).toBe(true);
    expect(isPropertyValueEmpty(prop({ type: 'checkbox', value: false }))).toBe(
      false
    );
    expect(
      chipValueView(prop({ type: 'checkbox', value: false }), 'en')
    ).toEqual({ kind: 'checkbox', checked: false });
  });

  it('never throws on a value of the wrong shape', () => {
    for (const value of [{}, [{}], Symbol.for('x'), NaN, 'x']) {
      for (const type of ['select', 'date', 'number', 'unknown-type']) {
        expect(() =>
          formatPropertyValue(prop({ type, value, data: { options: 'no' } }))
        ).not.toThrow();
      }
    }
  });

  it('opens an editor by type, and none on a read-only or unknown one', () => {
    expect(chipEditorKind(prop({ type: 'checkbox' }))).toBe('toggle');
    expect(chipEditorKind(prop({ type: 'select' }))).toBe('select');
    expect(chipEditorKind(prop({ type: 'multi-select' }))).toBe('multi-select');
    expect(chipEditorKind(prop({ type: 'date' }))).toBe('date');
    expect(chipEditorKind(prop({ type: 'number' }))).toBe('number');
    expect(chipEditorKind(prop({ type: 'rich-text' }))).toBe('text');
    expect(chipEditorKind(prop({ type: 'created-time' }))).toBe('none');
    expect(chipEditorKind(prop({ type: 'text', readonly: true }))).toBe('none');
  });
});

describe('the title band formatter, against a hostile locale', () => {
  it('falls back instead of throwing when Intl refuses the locale', () => {
    // A headless Chromium reports `en-US@posix`; `Intl` throws on it.
    const bad = 'en-US@posix';
    expect(chipValueView(prop({ type: 'number', value: 12 }), bad)).toEqual({
      kind: 'text',
      text: '12',
    });
    expect(
      chipValueView(prop({ type: 'date', value: Date.UTC(2026, 9, 13) }), bad)
    ).toEqual({ kind: 'text', text: '2026-10-13' });
  });

  it('reads a typed number with a decimal comma or a point', () => {
    expect(parseChipNumber('1 234,5')).toBe(1234.5);
    expect(parseChipNumber('12.5')).toBe(12.5);
    expect(parseChipNumber('  ')).toBeNaN();
    expect(parseChipNumber('abc')).toBeNaN();
  });
});
