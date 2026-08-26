import { cssVarV2, darkThemeV2, lightThemeV2 } from '@toeverything/theme/v2';

export type ParsedColor = { r: number; g: number; b: number };

const COLOR_DISTANCE_THRESHOLD = 90;

const supportedTextColorNames = [
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'purple',
  'grey',
] as const;

const supportedTextColors = supportedTextColorNames.map(name => ({
  name,
  cssVar: cssVarV2(`text/highlight/fg/${name}`),
  light: lightThemeV2[`text/highlight/fg/${name}`],
  dark: darkThemeV2[`text/highlight/fg/${name}`],
}));

const hexToRgb = (value: string): ParsedColor | null => {
  const hex = value.replace('#', '');
  if (![3, 4, 6, 8].includes(hex.length)) {
    return null;
  }
  const normalized =
    hex.length === 3 || hex.length === 4
      ? hex
          .slice(0, 3)
          .split('')
          .map(c => c + c)
          .join('')
      : hex.slice(0, 6);
  const intVal = Number.parseInt(normalized, 16);
  if (Number.isNaN(intVal)) {
    return null;
  }
  return {
    r: (intVal >> 16) & 255,
    g: (intVal >> 8) & 255,
    b: intVal & 255,
  };
};

/**
 * Parse the colour syntax that turns up in pasted HTML: hex and
 * `rgb()`/`rgba()`. Anything else is `null`, which leaves the text uncoloured.
 */
export const parseCssColor = (value: string): ParsedColor | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith('#')) {
    return hexToRgb(trimmed);
  }
  const rgb = trimmed.match(/^rgba?\(([^)]*)\)$/i);
  if (!rgb) {
    return null;
  }
  const channels = rgb[1]
    .split('/')[0]
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map(channel => {
      const isPercentage = channel.endsWith('%');
      const parsed = Number.parseFloat(
        isPercentage ? channel.slice(0, -1) : channel
      );
      if (Number.isNaN(parsed)) return null;
      return Math.min(
        255,
        Math.max(0, Math.round(isPercentage ? (parsed / 100) * 255 : parsed))
      );
    });
  if (channels.length !== 3 || channels.some(c => c === null)) {
    return null;
  }
  const [r, g, b] = channels as number[];
  return { r, g, b };
};

const colorDistance = (a: ParsedColor, b: ParsedColor) =>
  Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);

/**
 * Map a CSS colour onto the nearest supported text highlight, or `null` when
 * nothing is near enough. Both themes are candidates: a document is pasted in
 * one theme and read in the other, so whichever reference is nearer decides.
 */
export const resolveNearestSupportedColor = (color: string): string | null => {
  const target = parseCssColor(color);
  if (!target) {
    return null;
  }
  let nearest: { cssVar: string; distance: number } | undefined;

  for (const supported of supportedTextColors) {
    for (const reference of [supported.light, supported.dark]) {
      const parsed = parseCssColor(reference);
      if (!parsed) continue;
      const distance = colorDistance(target, parsed);
      if (!nearest || distance < nearest.distance) {
        nearest = { cssVar: supported.cssVar, distance };
      }
    }
  }

  if (nearest && nearest.distance <= COLOR_DISTANCE_THRESHOLD) {
    return nearest.cssVar;
  }
  return null;
};

/**
 * Read the `color` declaration out of an inline `style` attribute, leaving
 * `background-color` and friends alone.
 */
export const extractColorFromStyle = (
  style: string | undefined
): string | null => {
  if (typeof style !== 'string') {
    return null;
  }
  for (const declaration of style.split(';')) {
    const [rawKey, rawValue] = declaration.split(':');
    if (!rawKey || !rawValue) continue;
    if (rawKey.trim().toLowerCase() === 'color') {
      return rawValue.trim();
    }
  }
  return null;
};
