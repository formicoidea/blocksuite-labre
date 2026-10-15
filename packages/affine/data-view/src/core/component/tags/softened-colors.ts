import type { Color } from '@labre/affine-model';

/**
 * A framework colour SOFTENED into a chip colour (ADR 0036 amendment of
 * 2026-10-14, "framework pages"): one theme-adaptive CSS string,
 *
 *     color-mix(in srgb, #rrggbb NN%, var(--affine-v2-layer-background-primary))
 *
 * which reads as a pastel tint on the light page background and as a deep
 * one on the dark, so the chip's primary text stays readable in both, the
 * way the ten `selectOptionColors` do through their own light/dark tokens.
 *
 * The token is spelled LITERALLY, never through `cssVarV2`: a host may
 * rename the theme's variables (the Labre app's `@labre/theme` answers
 * `cssVarV2` with `--labre-v2-*`) and keeps the `--affine-v2-*` names as
 * aliases in every theme scope, so the literal spelling is the one that
 * paints under every host and the one a stored value can rely on forever.
 */
export const SOFTENED_BACKGROUND_TOKEN = '--affine-v2-layer-background-primary';

/**
 * The colour's share of a softened swatch, in percent. 30% keeps the light
 * tint pale enough for the light theme's primary text (worst case, black:
 * 8.8:1) and the dark one deep enough for the dark theme's (worst case,
 * white: 5.4:1), measured with the theme's own tokens by
 * `softened-chip-colors.unit.spec.ts` in `@labre/affine`.
 */
export const SOFTENED_SHARE = 30;

/**
 * A colour is ALREADY pastel when it is a mix of at most this share of some
 * colour with white. It then keeps its light look exactly: the stored source
 * is that more saturated colour, mixed back at the share that reproduces the
 * pastel on white, so only the dark theme sees it change. 35% is the largest
 * share at which even a white source stays dark enough for the dark theme's
 * primary text (4.6:1; 36% would give 4.4:1).
 */
export const PASTEL_MAX_SHARE = 35;

const LIGHT_BACKGROUND = 255;

const HEX6 = /^#([0-9a-f]{6})$/i;

const channels = (hex: string): [number, number, number] | undefined => {
  const match = HEX6.exec(hex);
  if (!match?.[1]) return undefined;
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
};

const toHex = (rgb: readonly number[]) =>
  `#${rgb.map(value => value.toString(16).padStart(2, '0')).join('')}`;

const lightValue = (color: Color): string =>
  typeof color === 'string'
    ? color
    : 'light' in color
      ? color.light
      : color.normal;

/**
 * The softened chip colour of a framework colour, from its LIGHT value, or
 * `undefined` for a value that is not a plain `#rrggbb` (transparent, a CSS
 * variable, an alpha colour): those offer no swatch.
 */
export function softenedChipColor(color: Color): string | undefined {
  const rgb = channels(lightValue(color));
  if (!rgb) return undefined;
  // The smallest share at which this colour is a mix with white.
  const needed = Math.ceil(100 * (1 - Math.min(...rgb) / LIGHT_BACKGROUND));
  const pastel = needed <= PASTEL_MAX_SHARE;
  const share = pastel ? Math.max(needed, SOFTENED_SHARE) : SOFTENED_SHARE;
  const ratio = share / 100;
  const source = pastel
    ? rgb.map(value =>
        Math.min(
          255,
          Math.max(
            0,
            Math.round((value - (1 - ratio) * LIGHT_BACKGROUND) / ratio)
          )
        )
      )
    : rgb;
  return `color-mix(in srgb, ${toHex(source)} ${share}%, var(${SOFTENED_BACKGROUND_TOKEN}))`;
}

/**
 * Exactly the shape {@link softenedChipColor} writes, and nothing else: one
 * lowercase `#rrggbb`, an integer share from 1 to 100, the one background
 * token. A stored string goes into a style only through this check or the
 * palette list (ADR 0036 §4), so a crafted value (a second declaration, a
 * `url(`, another variable) is refused, not painted.
 */
const SOFTENED_CHIP_COLOR = new RegExp(
  `^color-mix\\(in srgb, #[0-9a-f]{6} (?:100|[1-9][0-9]?)%, var\\(${SOFTENED_BACKGROUND_TOKEN}\\)\\)$`
);

export function isSoftenedChipColor(value: unknown): value is string {
  return typeof value === 'string' && SOFTENED_CHIP_COLOR.test(value);
}
