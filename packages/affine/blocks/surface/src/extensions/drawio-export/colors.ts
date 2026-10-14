import { type Color, ColorScheme, resolveColor } from '@labre/affine-model';
import { combinedLightCssVariables } from '@toeverything/theme';

/**
 * A stored colour as draw.io can paint it: `#RRGGBB`, or `none`.
 *
 * draw.io has none of our variables, so every colour is RESOLVED to a value
 * here, the way `ThemeProvider.getColorValue(color, fallback, true)` resolves
 * one for a canvas painter — without its DOM, which a pure writer has none of:
 * a `{ light, dark }` pair takes its LIGHT side (a file is printed on white), a
 * legacy `--affine-*` name is looked up in the same static table the theme
 * service reads, and a `var(--…)` inside that table is followed, a bounded
 * number of hops.
 *
 * `opacity` is the alpha a value carried (`rgba(…, .5)`, `#rrggbbaa`), in
 * draw.io's percent, and only when it is below 100: the style keys draw.io
 * takes it under differ per use (`fillOpacity`, `strokeOpacity`), so the
 * caller names the key.
 */
export interface DrawioColor {
  value: string;
  opacity?: number;
}

const NONE: DrawioColor = { value: 'none' };

/** How many `var(--…)` hops a value may take before it is given up on. */
const MAX_VAR_HOPS = 4;

const VAR = /^var\(\s*(--[\w-]+)\s*(?:,[^)]*)?\)$/;
const HEX = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i;
const RGB = /^rgba?\(([^)]*)\)$/i;

const hex2 = (channel: number) =>
  Math.round(Math.min(255, Math.max(0, channel)))
    .toString(16)
    .padStart(2, '0');

function withAlpha(rgb: [number, number, number], alpha: number): DrawioColor {
  if (alpha <= 0) return NONE;
  const value = `#${rgb.map(hex2).join('')}`.toUpperCase();
  return alpha < 1 ? { value, opacity: Math.round(alpha * 100) } : { value };
}

function parseValue(raw: string): DrawioColor | undefined {
  const value = raw.trim();
  if (!value) return undefined;
  if (value.toLowerCase() === 'transparent' || value.toLowerCase() === 'none') {
    return NONE;
  }

  const hex = HEX.exec(value)?.[1];
  if (hex) {
    const full =
      hex.length <= 4
        ? [...hex].map(digit => digit + digit).join('')
        : hex.toLowerCase();
    const channel = (at: number) => Number.parseInt(full.slice(at, at + 2), 16);
    return withAlpha(
      [channel(0), channel(2), channel(4)],
      full.length === 8 ? channel(6) / 255 : 1
    );
  }

  const rgb = RGB.exec(value)?.[1];
  if (rgb) {
    const parts = rgb
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map(part =>
        part.endsWith('%')
          ? (Number.parseFloat(part) / 100) * 255
          : Number.parseFloat(part)
      );
    const [r, g, b] = parts;
    if (
      r === undefined ||
      g === undefined ||
      b === undefined ||
      ![r, g, b].every(Number.isFinite)
    ) {
      return undefined;
    }
    // The alpha of `rgba(…, 50%)` was scaled as a channel above; undo that.
    const rawAlpha = rgb.split(/[\s,/]+/).filter(Boolean)[3];
    const alpha =
      rawAlpha === undefined
        ? 1
        : rawAlpha.endsWith('%')
          ? Number.parseFloat(rawAlpha) / 100
          : Number.parseFloat(rawAlpha);
    return withAlpha([r, g, b], Number.isFinite(alpha) ? alpha : 1);
  }
  return undefined;
}

/**
 * Resolve a stored {@link Color} for the file. `undefined` when there is
 * nothing to say (no colour stored, or one this writer cannot read), so the
 * caller leaves draw.io's own default in place rather than writing a guess.
 */
export function drawioColor(color: unknown): DrawioColor | undefined {
  if (color === undefined || color === null || color === '') return undefined;
  if (typeof color !== 'string' && typeof color !== 'object') return undefined;

  let value = resolveColor(color as Color, ColorScheme.Light, '');
  for (let hop = 0; hop <= MAX_VAR_HOPS; hop++) {
    const name = value.startsWith('--') ? value : VAR.exec(value)?.[1];
    if (!name) return parseValue(value);
    if (name.endsWith('transparent')) return NONE;
    const next = (combinedLightCssVariables as Record<string, string>)[name];
    if (!next) return undefined;
    value = next;
  }
  return undefined;
}
