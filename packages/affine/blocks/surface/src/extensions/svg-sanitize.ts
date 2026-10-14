import {
  XML_NAMESPACE,
  type XmlElement,
  xmlElementOf,
  XMLNS_NAMESPACE,
} from './xml-element.js';
import type { XmlContent, XmlNode } from './xml-reader.js';

/**
 * The SVG sanitizer: an ALLOW-LIST applied to the tree `readXml` read, which
 * replaced DOMPurify on a DOM (ADR 0012, P3 as amended 2026-10-14).
 *
 * Security code, written to be read in one sitting. An `.svg` is an executable
 * document handed over by whoever sent the file, and this is the only gate
 * between it and every reader that walks it (the sketch, Wardley's
 * recognisers). The rule is one sentence: **what is not on a list below does
 * not come through.** No deny-list, no repair, no attempt to keep the harmless
 * half of something suspicious.
 *
 * - An element survives only in the SVG namespace (or none, for a file that
 *   forgot its `xmlns`) and only if its local name is in
 *   {@link ALLOWED_ELEMENTS}. Anything else goes WITH its subtree: `<script>`,
 *   `<foreignObject>` and its XHTML, `<use>` (which can pull in another
 *   document), the animation elements (which can rewrite an attribute after
 *   this gate), every vendor namespace.
 * - An attribute survives only if it is unprefixed and in
 *   {@link ALLOWED_ATTRIBUTES} (or `data-*` / `aria-*`), or one of the two
 *   namespaced ones a drawing needs (`xml:space`, the `xmlns` declarations).
 *   So no `on*` handler is ever on a list.
 * - A surviving value is then checked: no `javascript:`, `vbscript:` or
 *   `data:` anywhere, no `url(…)` that is not a same-document `#ref`, no CSS
 *   expression, binding or import, and no backslash (a CSS escape is how the
 *   first three hide).
 * - `href` / `xlink:href` keep only a same-document `#ref`, except on
 *   `<image>`, which also keeps an inline PNG, JPEG, GIF or WebP. No external
 *   resource survives, so nothing a file names is ever fetched.
 * - A `<style>` sheet that fails the value check is removed whole.
 * - Nothing nested deeper than {@link MAX_SVG_DEPTH} comes through, because
 *   the walks after this one recurse.
 *
 * It reports what it took, by kind, and the sketch turns that into its notes.
 */

export const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink';

/** Deeper than this is cut: no drawing nests 256 groups, and walks recurse. */
export const MAX_SVG_DEPTH = 256;

/** Lower-cased local names, as the sketch compares them. */
const ALLOWED_ELEMENTS: ReadonlySet<string> = new Set([
  'svg', 'g', 'defs', 'symbol', 'switch', 'a', 'view',
  'title', 'desc', 'metadata', 'style',
  'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path',
  'text', 'tspan', 'textpath', 'image',
  'clippath', 'mask', 'marker', 'pattern',
  'lineargradient', 'radialgradient', 'stop',
  'filter', 'feblend', 'fecolormatrix', 'fecomponenttransfer', 'fecomposite',
  'feconvolvematrix', 'fediffuselighting', 'fedisplacementmap',
  'fedistantlight', 'fedropshadow', 'feflood', 'fefunca', 'fefuncb',
  'fefuncg', 'fefuncr', 'fegaussianblur', 'femerge', 'femergenode',
  'femorphology', 'feoffset', 'fepointlight', 'fespecularlighting',
  'fespotlight', 'fetile', 'feturbulence',
]); // prettier-ignore

/** Lower-cased, unprefixed. `href` is not here: it has its own rule. */
const ALLOWED_ATTRIBUTES: ReadonlySet<string> = new Set([
  'id', 'class', 'style', 'lang', 'version', 'type', 'media',
  'x', 'y', 'z', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry',
  'fx', 'fy', 'fr', 'dx', 'dy', 'width', 'height', 'd', 'points',
  'pathlength', 'viewbox', 'preserveaspectratio', 'transform',
  'transform-origin', 'rotate', 'textlength', 'lengthadjust',
  'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width',
  'stroke-opacity', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap',
  'stroke-linejoin', 'stroke-miterlimit', 'opacity', 'color', 'display',
  'visibility', 'overflow', 'clip', 'clip-path', 'clip-rule', 'mask',
  'mask-type', 'filter', 'paint-order', 'vector-effect', 'pointer-events',
  'shape-rendering', 'text-rendering', 'image-rendering', 'color-rendering',
  'color-interpolation', 'color-interpolation-filters',
  'font-family', 'font-size', 'font-size-adjust', 'font-stretch',
  'font-style', 'font-variant', 'font-weight', 'letter-spacing',
  'word-spacing', 'text-anchor', 'text-decoration', 'dominant-baseline',
  'alignment-baseline', 'baseline-shift', 'writing-mode', 'direction',
  'unicode-bidi', 'systemlanguage',
  'marker-start', 'marker-mid', 'marker-end', 'markerwidth', 'markerheight',
  'markerunits', 'refx', 'refy', 'orient',
  'clippathunits', 'maskunits', 'maskcontentunits', 'patternunits',
  'patterncontentunits', 'patterntransform', 'gradientunits',
  'gradienttransform', 'spreadmethod', 'offset', 'stop-color', 'stop-opacity',
  'filterunits', 'primitiveunits', 'in', 'in2', 'result', 'mode', 'operator',
  'values', 'k1', 'k2', 'k3', 'k4', 'stddeviation', 'flood-color',
  'flood-opacity', 'lighting-color', 'edgemode', 'kernelmatrix', 'order',
  'scale', 'xchannelselector', 'ychannelselector', 'basefrequency',
  'numoctaves', 'seed', 'stitchtiles', 'surfacescale', 'specularconstant',
  'specularexponent', 'diffuseconstant', 'azimuth', 'elevation',
  'limitingconeangle', 'pointsatx', 'pointsaty', 'pointsatz', 'tablevalues',
  'slope', 'intercept', 'amplitude', 'exponent', 'bias', 'divisor',
  'targetx', 'targety', 'preservealpha', 'radius', 'kernelunitlength',
]); // prettier-ignore

/** An inline raster, the only `data:` that survives, and only on `<image>`. */
const SAFE_IMAGE_DATA =
  /^data:image\/(?:png|jpeg|jpg|gif|webp);base64,[a-z0-9+/=\s]*$/i;

/**
 * Is this value inert? Read with every whitespace and control character
 * removed and lower-cased, because `java\tscript:` and `JaVaScRiPt:` are the
 * same scheme to a browser.
 */
export function isSafeSvgValue(value: string): boolean {
  const folded = value.replaceAll(/[\u0000- \u007f-\u009f]/g, '').toLowerCase();
  if (folded.includes('\\')) return false;
  if (
    /javascript:|vbscript:|data:|expression\(|@import|-moz-binding|behavior:/.test(
      folded
    )
  ) {
    return false;
  }
  for (const match of folded.matchAll(/url\(/g)) {
    const rest = folded.slice(match.index + 4).replace(/^['"]/, '');
    if (!rest.startsWith('#')) return false;
  }
  return true;
}

function isAllowedAttribute(
  attr: XmlElement['attributes'][number],
  element: string
): boolean {
  if (attr.namespaceURI === XMLNS_NAMESPACE) return true;
  if (attr.namespaceURI === XML_NAMESPACE) return attr.localName === 'space';
  const isHref =
    attr.localName === 'href' &&
    (attr.prefix === null || attr.namespaceURI === XLINK_NAMESPACE);
  if (isHref) {
    const value = attr.value.trim();
    return (
      (value.startsWith('#') && isSafeSvgValue(value)) ||
      (element === 'image' && SAFE_IMAGE_DATA.test(value))
    );
  }
  if (attr.prefix !== null) return false;
  const name = attr.localName.toLowerCase();
  const listed =
    ALLOWED_ATTRIBUTES.has(name) || /^(?:data|aria)-[\w.-]+$/.test(name);
  return listed && isSafeSvgValue(attr.value);
}

/** One thing the sanitizer took: an element (and its subtree) or an attribute. */
export type SvgRemoval = { element: string } | { attribute: string };

/** What the sanitizer took, for the sketch to say. */
export interface SvgSanitizeReport {
  /** In document order, names as written, repeats included. */
  removed: SvgRemoval[];
  /** Something sat deeper than {@link MAX_SVG_DEPTH} and was cut. */
  tooDeep: boolean;
}

/**
 * The root, sanitized: a NEW tree holding only what the lists allow, or
 * `undefined` when the root itself is not an allowed `<svg>`.
 */
export function sanitizeSvgNode(source: XmlNode): {
  root: XmlElement | undefined;
  report: SvgSanitizeReport;
} {
  const report: SvgSanitizeReport = { removed: [], tooDeep: false };

  const allowed = (element: XmlElement) => {
    const name = element.localName.toLowerCase();
    if (
      element.namespaceURI !== SVG_NAMESPACE &&
      element.namespaceURI !== null
    ) {
      return false;
    }
    if (element.namespaceURI === null && element.prefix !== null) return false;
    if (!ALLOWED_ELEMENTS.has(name)) return false;
    return name !== 'style' || isSafeSvgValue(element.textContent);
  };

  const copy = (element: XmlElement): XmlNode => {
    const name = element.localName.toLowerCase();
    const attrs: Record<string, string> = Object.create(null);
    for (const attr of element.attributes) {
      if (isAllowedAttribute(attr, name)) attrs[attr.name] = attr.value;
      else report.removed.push({ attribute: attr.name });
    }
    return {
      name: element.nodeName,
      prefix: element.node.prefix,
      local: element.localName,
      attrs,
      children: [],
      content: [],
      range: element.node.range,
    };
  };

  const raw = xmlElementOf(source);
  if (!allowed(raw) || raw.localName.toLowerCase() !== 'svg') {
    return { root: undefined, report };
  }

  const clean = copy(raw);
  const stack: { from: XmlElement; to: XmlNode; depth: number }[] = [
    { from: raw, to: clean, depth: 0 },
  ];
  while (stack.length > 0) {
    const { from, to, depth } = stack.pop()!;
    // `<metadata>` is RDF and vendor bookkeeping the walk drops in silence;
    // its content is not read, so it is not reported either.
    if (from.localName.toLowerCase() === 'metadata') continue;
    const pending: { from: XmlElement; to: XmlNode; depth: number }[] = [];
    for (const entry of from.childNodes) {
      if (!('localName' in entry)) {
        // Character data stays (it is what a `<text>` says); a comment or an
        // instruction renders nothing and is not carried.
        if (entry.nodeType === 3) {
          const text: XmlContent = { kind: 'text', value: entry.nodeValue };
          to.content!.push(text);
        }
        continue;
      }
      if (depth + 1 > MAX_SVG_DEPTH) {
        report.tooDeep = true;
        continue;
      }
      if (!allowed(entry)) {
        report.removed.push({ element: entry.nodeName });
        continue;
      }
      const child = copy(entry);
      to.children.push(child);
      to.content!.push(child);
      pending.push({ from: entry, to: child, depth: depth + 1 });
    }
    stack.push(...pending.reverse());
  }
  return { root: xmlElementOf(clean), report };
}
