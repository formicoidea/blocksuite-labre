import type { Color } from './color';
import { PALETTE_VALUES, type PaletteKey } from './palette-values';
import type { Palette } from './types';

// Converts a color map to color list.
export function buildPalettes(
  obj: Record<string, Color>,
  prefix = ''
): Palette[] {
  return Object.entries<Color>(obj).map(([key, value]) => ({
    key: `${prefix}${key}`,
    value,
  }));
}

// Read from the library's own copy of the palette, not from
// `@toeverything/theme`: this file is in every editor-free graph (ADR 0045,
// amendment of 2026-11-12). A fresh object per call, as before the copy.
export function getColorByKey(key: PaletteKey): Color {
  const value: Color = PALETTE_VALUES[key];
  return typeof value === 'string' ? value : { ...value };
}

export const pureBlack = PALETTE_VALUES['edgeless/palette/black'].light;
export const pureWhite = PALETTE_VALUES['edgeless/palette/white'].light;
