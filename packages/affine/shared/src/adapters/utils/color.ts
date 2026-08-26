import { cssVarV2, darkThemeV2, lightThemeV2 } from '@toeverything/theme/v2';

export type ParsedColor = { r: number; g: number; b: number; alpha: number };

type Oklab = { l: number; a: number; b: number; chroma: number; hue: number };

/**
 * A colour is treated as a shade of grey below this chroma, and is then only
 * ever mapped onto the grey highlight — never onto a hue.
 */
const ACHROMATIC_CHROMA_THRESHOLD = 0.02;
/**
 * Greys this dark or this light are the reader's own text and background
 * colours: leaving them unmapped is what keeps a pasted document legible in
 * both themes.
 */
const DEFAULT_TEXT_LIGHTNESS_MIN = 0.4;
const DEFAULT_TEXT_LIGHTNESS_MAX = 0.9;
const MAX_COLOR_DISTANCE = 0.18;
const MAX_CHROMA_DISTANCE = 0.12;
const MAX_HUE_DISTANCE = 45;

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

/**
 * The basic CSS colour keywords. Anything outside this set parses as `null`,
 * which means "leave the text alone" — the conservative outcome.
 */
const NAMED_COLORS: Record<string, string> = {
  aqua: '#00ffff',
  black: '#000000',
  blue: '#0000ff',
  cyan: '#00ffff',
  fuchsia: '#ff00ff',
  gray: '#808080',
  green: '#008000',
  grey: '#808080',
  lime: '#00ff00',
  magenta: '#ff00ff',
  maroon: '#800000',
  navy: '#000080',
  olive: '#808000',
  orange: '#ffa500',
  purple: '#800080',
  red: '#ff0000',
  silver: '#c0c0c0',
  teal: '#008080',
  transparent: '#00000000',
  white: '#ffffff',
  yellow: '#ffff00',
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const parseHex = (value: string): ParsedColor | null => {
  const hex = value.slice(1);
  if (!/^[0-9a-f]+$/i.test(hex)) return null;
  const expand = (part: string) =>
    part.length === 1
      ? Number.parseInt(part + part, 16)
      : Number.parseInt(part, 16);
  const size = hex.length === 3 || hex.length === 4 ? 1 : 2;
  if (hex.length !== size * 3 && hex.length !== size * 4) return null;
  return {
    r: expand(hex.slice(0, size)),
    g: expand(hex.slice(size, size * 2)),
    b: expand(hex.slice(size * 2, size * 3)),
    alpha:
      hex.length === size * 4 ? expand(hex.slice(size * 3, size * 4)) / 255 : 1,
  };
};

/** A colour channel: `0-255`, or a percentage of 255. */
const parseChannel = (token: string): number | null => {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const isPercentage = trimmed.endsWith('%');
  const value = Number.parseFloat(
    isPercentage ? trimmed.slice(0, -1) : trimmed
  );
  if (Number.isNaN(value)) return null;
  return clamp(Math.round(isPercentage ? (value / 100) * 255 : value), 0, 255);
};

/** An alpha value: `0-1`, or a percentage. */
const parseAlpha = (token: string | null): number | null => {
  if (token === null) return 1;
  const trimmed = token.trim();
  if (!trimmed) return null;
  const isPercentage = trimmed.endsWith('%');
  const value = Number.parseFloat(
    isPercentage ? trimmed.slice(0, -1) : trimmed
  );
  if (Number.isNaN(value)) return null;
  return clamp(isPercentage ? value / 100 : value, 0, 1);
};

/**
 * Split the body of a colour function into its arguments and its alpha,
 * accepting both the legacy comma syntax (`rgb(1, 2, 3, 0.5)`) and the modern
 * space syntax (`rgb(1 2 3 / 50%)`).
 */
const splitFunctionArgs = (
  body: string
): { args: string[]; alpha: string | null } => {
  const [main, alphaPart] = body.split('/');
  const args = main.split(/[\s,]+/).filter(Boolean);
  let alpha = alphaPart?.trim() ? alphaPart.trim() : null;
  if (alpha === null && args.length === 4) {
    alpha = args.pop() ?? null;
  }
  return { args, alpha };
};

const parseHue = (token: string): number | null => {
  const trimmed = token.trim().toLowerCase();
  const value = Number.parseFloat(trimmed);
  if (Number.isNaN(value)) return null;
  if (trimmed.endsWith('turn')) return value * 360;
  if (trimmed.endsWith('rad')) return (value * 180) / Math.PI;
  if (trimmed.endsWith('grad')) return value * 0.9;
  return value;
};

const hslToRgb = (h: number, s: number, l: number) => {
  const hue = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = (
    [
      [c, x, 0],
      [x, c, 0],
      [0, c, x],
      [0, x, c],
      [x, 0, c],
      [c, 0, x],
    ] as const
  )[Math.floor(hue / 60) % 6];
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
};

/**
 * Parse the subset of CSS colour syntax that turns up in pasted HTML: hex,
 * `rgb()`/`rgba()`, `hsl()`/`hsla()` and the basic colour keywords. Anything
 * else — `color-mix()`, a custom property, an unknown keyword — is `null`.
 */
export const parseCssColor = (value: string): ParsedColor | null => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;

  const named = NAMED_COLORS[trimmed];
  if (named) return parseHex(named);

  if (trimmed.startsWith('#')) return parseHex(trimmed);

  const fn = trimmed.match(/^(rgba?|hsla?)\(([^)]*)\)$/);
  if (!fn) return null;
  const { args, alpha: rawAlpha } = splitFunctionArgs(fn[2]);
  if (args.length !== 3) return null;
  const alpha = parseAlpha(rawAlpha);
  if (alpha === null) return null;

  if (fn[1].startsWith('rgb')) {
    const [r, g, b] = args.map(parseChannel);
    if (r === null || g === null || b === null) return null;
    return { r, g, b, alpha };
  }

  const hue = parseHue(args[0]);
  const saturation = parseAlpha(args[1]);
  const lightness = parseAlpha(args[2]);
  if (hue === null || saturation === null || lightness === null) return null;
  return { ...hslToRgb(hue, saturation, lightness), alpha };
};

const srgbToLinear = (channel: number) => {
  const value = channel / 255;
  return value <= 0.04045
    ? value / 12.92
    : Math.pow((value + 0.055) / 1.055, 2.4);
};

/**
 * Oklab is perceptually uniform, so "near enough to count as the same colour"
 * is a plain distance here, which it is not in sRGB.
 */
const rgbToOklab = ({ r, g, b }: ParsedColor): Oklab => {
  const red = srgbToLinear(r);
  const green = srgbToLinear(g);
  const blue = srgbToLinear(b);
  const l = Math.cbrt(
    0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue
  );
  const m = Math.cbrt(
    0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue
  );
  const s = Math.cbrt(
    0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue
  );
  const result = {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
  return {
    ...result,
    chroma: Math.hypot(result.a, result.b),
    hue: (Math.atan2(result.b, result.a) * 180) / Math.PI,
  };
};

const supportedTextColors = supportedTextColorNames.map(name => ({
  name,
  cssVar: cssVarV2(`text/highlight/fg/${name}`),
  // Both themes are candidates: a document is pasted in one theme and read in
  // the other, so whichever reference is nearer decides the highlight.
  references: [
    lightThemeV2[`text/highlight/fg/${name}`],
    darkThemeV2[`text/highlight/fg/${name}`],
  ].flatMap(color => {
    const parsed = parseCssColor(color);
    return parsed ? [rgbToOklab(parsed)] : [];
  }),
}));

const colorDistance = (a: Oklab, b: Oklab) =>
  Math.hypot(a.l - b.l, a.a - b.a, a.b - b.b);

const hueDistance = (a: number, b: number) => {
  const distance = Math.abs(a - b) % 360;
  return Math.min(distance, 360 - distance);
};

/**
 * Map a CSS colour onto the nearest supported text highlight, or `null` when
 * nothing is near enough. `null` is the good outcome for the reader: text with
 * no colour follows the theme, whereas a wrong colour can leave it unreadable
 * in one of the two themes.
 */
export const resolveNearestSupportedColor = (color: string): string | null => {
  const parsed = parseCssColor(color);
  // A translucent colour was picked to sit on the source background, not ours.
  if (!parsed || parsed.alpha < 1) {
    return null;
  }

  const target = rgbToOklab(parsed);
  const achromatic = target.chroma < ACHROMATIC_CHROMA_THRESHOLD;
  if (
    achromatic &&
    (target.l < DEFAULT_TEXT_LIGHTNESS_MIN ||
      target.l > DEFAULT_TEXT_LIGHTNESS_MAX)
  ) {
    return null;
  }

  let nearest: { cssVar: string; distance: number } | undefined;

  for (const supported of supportedTextColors) {
    // A grey never becomes a hue, and a hue never becomes the grey.
    if (achromatic !== (supported.name === 'grey')) {
      continue;
    }
    for (const reference of supported.references) {
      const distance = colorDistance(target, reference);
      if (
        distance > MAX_COLOR_DISTANCE ||
        (!achromatic &&
          (Math.abs(target.chroma - reference.chroma) > MAX_CHROMA_DISTANCE ||
            hueDistance(target.hue, reference.hue) > MAX_HUE_DISTANCE))
      ) {
        continue;
      }
      if (!nearest || distance < nearest.distance) {
        nearest = { cssVar: supported.cssVar, distance };
      }
    }
  }

  return nearest?.cssVar ?? null;
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
    const colon = declaration.indexOf(':');
    if (colon === -1) continue;
    // Split on the first colon only: `rgb(0 0 0 / 50%)` has none, but a
    // `url()` or a future colour syntax may.
    if (declaration.slice(0, colon).trim().toLowerCase() === 'color') {
      return declaration.slice(colon + 1).trim();
    }
  }
  return null;
};
