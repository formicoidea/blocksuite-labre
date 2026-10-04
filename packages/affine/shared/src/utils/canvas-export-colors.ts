/**
 * Turns one colour the browser understands into `rgb()` / `rgba()`.
 */
export type ResolveLegacyColor = (color: string) => string;

/**
 * The colour functions html2canvas 1.4.1 cannot parse. Its parser knows hex,
 * `rgb[a]()`, `hsl[a]()` and keywords and THROWS on anything else, aborting
 * the whole export. `color(` is what Chrome computes `color-mix(in srgb, …)`
 * to; `color-mix` and `light-dark` are here for a computed value that keeps
 * them. `color-mix` precedes `color` so the longer name wins.
 */
const MODERN_COLOR_FUNCTION =
  /\b(?:oklch|oklab|lch|lab|hwb|color-mix|color|light-dark)\(/gi;

/**
 * Every computed property html2canvas reads a colour from. Shorthands are
 * absent on purpose: html2canvas reads the longhands.
 */
const COLOR_PROPERTIES = [
  'color',
  'background-color',
  'background-image',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  'text-decoration-color',
  '-webkit-text-stroke-color',
  'text-shadow',
  'box-shadow',
  'caret-color',
  'fill',
  'stroke',
] as const;

let probe: CanvasRenderingContext2D | null | undefined;
const resolved = new Map<string, string>();

/**
 * The browser's own reading of a colour, through a 1×1 canvas: paint it, read
 * the pixel back. Reading `fillStyle` back is not enough — recent engines keep
 * the modern syntax there. Cached per string, since a theme repeats a handful
 * of colours across every node. Where no 2D context exists the colour comes
 * back unchanged: there is nothing to rasterise with either.
 */
const resolveColorThroughCanvas: ResolveLegacyColor = color => {
  const cached = resolved.get(color);
  if (cached !== undefined) return cached;

  probe ??= Object.assign(document.createElement('canvas'), {
    width: 1,
    height: 1,
  }).getContext('2d', { willReadFrequently: true });
  if (!probe) return color;

  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = color;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
  const legacy =
    a === 255
      ? `rgb(${r}, ${g}, ${b})`
      : `rgba(${r}, ${g}, ${b}, ${Number((a / 255).toFixed(3))})`;
  resolved.set(color, legacy);
  return legacy;
};

/**
 * `value` with every modern colour function in it replaced by what `resolve`
 * makes of it — the whole of `oklch(0.7 0.1 200)`, or each colour of a
 * `box-shadow` list. A value with none comes back as the same string. Also
 * what the `backgroundColor` option of html2canvas goes through.
 */
export function toLegacyColors(
  value: string,
  resolve: ResolveLegacyColor = resolveColorThroughCanvas
): string {
  MODERN_COLOR_FUNCTION.lastIndex = 0;
  let match = MODERN_COLOR_FUNCTION.exec(value);
  if (!match) return value;

  let out = '';
  let from = 0;
  while (match) {
    // Balanced parentheses: `color-mix()` nests whole colours.
    let end = match.index + match[0].length;
    for (let depth = 1; end < value.length && depth > 0; end++) {
      if (value[end] === '(') depth++;
      else if (value[end] === ')') depth--;
    }
    out +=
      value.slice(from, match.index) + resolve(value.slice(match.index, end));
    from = end;
    MODERN_COLOR_FUNCTION.lastIndex = end;
    match = MODERN_COLOR_FUNCTION.exec(value);
  }
  return out + value.slice(from);
}

/**
 * Rewrites, inline on the html2canvas CLONE, every computed colour html2canvas
 * would choke on, so a host theme in `oklch()` (or the library's own
 * `color-mix()`) cannot abort a PNG/PDF export or a "copy as image". Call it
 * first in every `onclone`.
 *
 * html2canvas parses the computed style of the captured subtree AND of the
 * clone's `<html>` and `<body>` (their background), so those two are covered
 * too; shadow roots are already flattened into the clone by then. The resolved
 * value is written over whatever produced it — a CSS variable, a stylesheet
 * rule — as an `!important` inline declaration, which is what the computed
 * style then reports. Every value is read before any is written, so the
 * cascade is recomputed once rather than once per node.
 */
export function normalizeCanvasExportColors(
  documentClone: Document,
  subtree: Element,
  resolve: ResolveLegacyColor = resolveColorThroughCanvas
): void {
  const view = documentClone.defaultView ?? window;
  const nodes = new Set<Element | null>([
    documentClone.documentElement,
    documentClone.body,
    subtree,
    ...subtree.querySelectorAll('*'),
  ]);

  const writes: [CSSStyleDeclaration, string, string][] = [];
  for (const node of nodes) {
    const style = (node as Partial<ElementCSSInlineStyle> | null)?.style;
    if (!node || !style) continue;
    const computed = view.getComputedStyle(node);
    for (const property of COLOR_PROPERTIES) {
      const value = computed.getPropertyValue(property);
      const legacy = toLegacyColors(value, resolve);
      if (legacy !== value) writes.push([style, property, legacy]);
    }
  }

  for (const [style, property, legacy] of writes) {
    style.setProperty(property, legacy, 'important');
  }
}
