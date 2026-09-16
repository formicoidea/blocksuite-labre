/**
 * `resolvePaletteLabel` (L7-s2): the framework-agnostic mechanism a colour
 * panel resolves a swatch's visible name / aria-label through — see
 * `color-picker/utils.ts` for the three-tier design (a swatch's own
 * `labelWording`, then the default theme's `PALETTE_NAME_WORDINGS`, then the
 * raw `key`).
 */
import type { Palette } from '@labre/affine-model';
import type { BlockStdScope } from '@labre/std';
import { describe, expect, test } from 'vitest';

import { resolvePaletteLabel } from '../color-picker/utils.js';

/** No host: every `translateKey` call falls through to its own fallback. */
const NO_HOST_STD = {
  getOptional: () => undefined,
} as unknown as BlockStdScope;

/** A host whose catalogue answers `entries` and nothing else. */
const stdWith = (entries: Record<string, string>): BlockStdScope =>
  ({
    getOptional: () => ({ t: (key: string) => entries[key] }),
  }) as unknown as BlockStdScope;

describe('resolvePaletteLabel', () => {
  test('a default-theme key resolves through PALETTE_NAME_WORDINGS, unresolved fallback is the key itself', () => {
    const red: Palette = { key: 'Red', value: '#ff0000' };
    expect(resolvePaletteLabel(NO_HOST_STD, red)).toBe('Red');
    expect(resolvePaletteLabel(undefined, red)).toBe('Red');
  });

  test('a default-theme key translates when the host has an entry', () => {
    const red: Palette = { key: 'Red', value: '#ff0000' };
    const std = stdWith({ 'com.labre.palette-name.red': 'Rouge' });
    expect(resolvePaletteLabel(std, red)).toBe('Rouge');
  });

  test("a swatch's own `labelWording` wins over PALETTE_NAME_WORDINGS", () => {
    const wonder = {
      key: 'Wonder',
      value: '#3ec9f2',
      labelWording: ['com.labre.wardley.palette.wonder', 'Wonder'] as const,
    };
    expect(resolvePaletteLabel(NO_HOST_STD, wonder)).toBe('Wonder');

    const std = stdWith({
      'com.labre.wardley.palette.wonder': 'Émerveillement',
    });
    expect(resolvePaletteLabel(std, wonder)).toBe('Émerveillement');
  });

  test('a swatch this function has never heard of falls back to its raw key — unchanged behaviour', () => {
    const custom: Palette = { key: 'A Host Custom Swatch', value: '#123456' };
    expect(resolvePaletteLabel(NO_HOST_STD, custom)).toBe(
      'A Host Custom Swatch'
    );
    expect(resolvePaletteLabel(undefined, custom)).toBe('A Host Custom Swatch');
  });
});
