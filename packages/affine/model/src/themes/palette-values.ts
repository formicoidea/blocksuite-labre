import type { Color } from './color';

/**
 * The palette the library's theme is built from (`default.ts`), by AFFiNE
 * theme key, valued as `@toeverything/theme/v2` values them: one colour when
 * the dark and light themes agree, `{ dark, light }` when they do not.
 *
 * A copy, on purpose (ADR 0045, amendment of 2026-11-12): `default.ts` is in
 * the graph of every editor-free entry (`@labre/affine-model/headless`, the
 * `./interchange` builders), and those entries load `zod` and
 * `@labre/global` only. These values are written into documents (a shape's
 * fill, a note's background), so they must not move when the theme package
 * does: `palette-values.unit.spec.ts` holds every entry to the package, and a
 * bump that changes one fails there before it changes a stored colour.
 *
 * Only the keys the theme reads; add one here, and its value, when
 * `default.ts` starts reading it (the spec checks both lists agree).
 */
export const PALETTE_VALUES = {
  'edgeless/palette/white': { dark: '#000000', light: '#ffffff' },
  'edgeless/palette/black': { dark: '#ffffff', light: '#000000' },
  'edgeless/palette/light/redLight': '#fce5e6',
  'edgeless/palette/light/orangeLight': '#ffebd5',
  'edgeless/palette/light/yellowLight': '#fffbd5',
  'edgeless/palette/light/greenLight': '#f1fdf4',
  'edgeless/palette/light/blueLight': '#e6f5ff',
  'edgeless/palette/light/purpleLight': { dark: '#d7cdff', light: '#ede9ff' },
  'edgeless/palette/light/magentaLight': '#ffecf6',
  'edgeless/palette/light/greyLight': '#e6e6e6',
  'edgeless/palette/medium/redMedium': '#fb7081',
  'edgeless/palette/medium/orangeMedium': '#ff8c38',
  'edgeless/palette/medium/yellowMedium': '#fcd34d',
  'edgeless/palette/medium/greenMedium': '#3cbc36',
  'edgeless/palette/medium/blueMedium': '#84cfff',
  'edgeless/palette/medium/purpleMedium': '#6e52df',
  'edgeless/palette/medium/magentaMedium': '#e96cab',
  'edgeless/palette/medium/greyMedium': '#929292',
  'edgeless/palette/heavy/red': '#761717',
  'edgeless/palette/heavy/orange': '#b55309',
  'edgeless/palette/heavy/yellow': '#ac7400',
  'edgeless/palette/heavy/green': '#447756',
  'edgeless/palette/heavy/blue': '#1c70a5',
  'edgeless/palette/heavy/purple': '#5a21b6',
  'edgeless/palette/heavy/magenta': '#941555',
  'edgeless/note/red': { dark: '#460606', light: '#fbb7b7' },
  'edgeless/note/orange': { dark: '#843b06', light: '#ffc58f' },
  'edgeless/note/yellow': { dark: '#704200', light: '#fde68a' },
  'edgeless/note/green': { dark: '#3b5315', light: '#c9f8c1' },
  'edgeless/note/blue': { dark: '#004b7b', light: '#ceecff' },
  'edgeless/note/purple': { dark: '#312e81', light: '#ddd6fe' },
  'edgeless/note/magenta': { dark: '#5f0a35', light: '#ffdaed' },
  'edgeless/note/white': { dark: '#252525', light: '#ffffff' },
} as const satisfies Record<string, Color>;

export type PaletteKey = keyof typeof PALETTE_VALUES;
