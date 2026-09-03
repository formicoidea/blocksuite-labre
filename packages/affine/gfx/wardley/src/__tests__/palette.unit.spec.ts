import { DefaultTheme } from '@labre/affine-model';
import { describe, expect, it } from 'vitest';

import { INERTIA_COLOR, METHOD_FILL, WARDLEY_RED } from '../node/consts';
import { WARDLEY_PALETTE_LIST } from '../toolbar/node-config';

/**
 * The colour picker of a selected Wardley node offers the evolution cycle as
 * ready-made swatches. This spec pins WHAT is offered and in WHICH order,
 * because the list is the only place the cycle is said in colour: a silent
 * reordering, or a historical editor colour creeping back in, would leave the
 * author picking a hue that means nothing on a map.
 *
 * Nothing here constrains what an author may paint — the custom picker is
 * untouched, and no rule reads a node's colour.
 */

/** Greys, white, black, transparent — the only default entries we keep. */
const NEUTRAL_KEY = /grey|gray|white|black|transparent/i;

const WARDLEY_SWATCHES = [
  { key: 'Wonder', value: '#3ec9f2' },
  { key: 'Peace', value: '#5b9cf6' },
  { key: 'War', value: '#9d6df0' },
  { key: 'Wonder light', value: '#b9e9fa' },
  { key: 'Peace light', value: '#c6dbfc' },
  { key: 'War light', value: '#d9c9fa' },
  { key: 'Wardley red', value: WARDLEY_RED },
  { key: 'Inertia', value: INERTIA_COLOR },
  { key: 'Method grey', value: METHOD_FILL },
];

describe('the wardley node palette', () => {
  it('leads with the cycle swatches, in order', () => {
    expect(WARDLEY_PALETTE_LIST.slice(0, WARDLEY_SWATCHES.length)).toEqual(
      WARDLEY_SWATCHES
    );
  });

  it('says the notation colours the map already uses', () => {
    expect(WARDLEY_RED).toBe('#d6455d');
    expect(INERTIA_COLOR).toBe('#1f2328');
    expect(METHOD_FILL).toBe('#d9d9d9');
  });

  it('keeps only the neutrals of the default palette after them', () => {
    const rest = WARDLEY_PALETTE_LIST.slice(WARDLEY_SWATCHES.length);

    expect(rest.length).toBeGreaterThan(0);
    for (const palette of rest) {
      expect(palette.key, palette.key).toMatch(NEUTRAL_KEY);
    }
  });

  it('drops every legacy colour of the default palette', () => {
    const legacy = DefaultTheme.Palettes.filter(p => !NEUTRAL_KEY.test(p.key));

    expect(legacy.length).toBeGreaterThan(0);
    for (const palette of legacy) {
      expect(WARDLEY_PALETTE_LIST.some(p => p.key === palette.key)).toBe(false);
    }
  });
});
