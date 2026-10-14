import {
  type XmlAttribute,
  type XmlElement,
  xmlElementOf,
  XML_NAMESPACE,
  XmlNamespaceScope,
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
 *   `data:` anywhere, no `url(…)` that is not a same-document `#ref`, no
 *   `image-set(…)` (whose bare strings are URLs), no CSS expression, binding
 *   or import, and no backslash (a CSS escape is how the first three hide).
 * - `href` / `xlink:href` keep only a same-document `#ref`, except on
 *   `<image>`, which also keeps an inline PNG, JPEG, GIF or WebP. No external
 *   resource survives, so nothing a file names is ever fetched.
 * - A `<style>` sheet that fails the value check is removed whole.
 * - Nothing nested deeper than {@link MAX_SVG_DEPTH} comes through, because
 *   the walks after this one recurse. The cut happens during the walk: what
 *   lies below it, or below a removed element, is never resolved or copied.
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
    /javascript:|vbscript:|data:|expression\(|@import|-moz-binding|behavior:|image-set\(/.test(
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

function isAllowedAttribute(attr: XmlAttribute, element: string): boolean {
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

/** A sheet's own character data, which is all of it a sanitized `<style>` keeps. */
function styleEntriesOf(node: XmlNode): XmlContent[] {
  if (!node.content) {
    return node.text === undefined ? [] : [{ kind: 'text', value: node.text }];
  }
  return node.content.filter(entry => 'kind' in entry && entry.kind === 'text');
}

function styleTextOf(node: XmlNode): string {
  return styleEntriesOf(node)
    .map(entry => ('kind' in entry && entry.kind === 'text' ? entry.value : ''))
    .join('');
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

  const scope = new XmlNamespaceScope();

  /** Entered in `scope` by the caller; exited by the caller too. */
  const allowed = (node: XmlNode) => {
    const name = node.local.toLowerCase();
    const namespaceURI = scope.resolve(node.prefix);
    if (namespaceURI !== SVG_NAMESPACE && namespaceURI !== null) return false;
    if (namespaceURI === null && node.prefix !== '') return false;
    if (!ALLOWED_ELEMENTS.has(name)) return false;
    return name !== 'style' || isSafeSvgValue(styleTextOf(node));
  };

  const copy = (node: XmlNode): XmlNode => {
    const name = node.local.toLowerCase();
    const attrs: Record<string, string> = Object.create(null);
    for (const attr of scope.attributesOf(node)) {
      if (isAllowedAttribute(attr, name)) attrs[attr.name] = attr.value;
      else report.removed.push({ attribute: attr.name });
    }
    return {
      name: node.name,
      prefix: node.prefix,
      local: node.local,
      attrs,
      children: [],
      content: [],
      range: node.range,
    };
  };

  scope.enter(source);
  if (!allowed(source) || source.local.toLowerCase() !== 'svg') {
    return { root: undefined, report };
  }

  // Depth-first with an exit step, so the namespace scope and the depth are
  // those of the element being read, and the report is in document order.
  const frameOf = (from: XmlNode, to: XmlNode) => {
    const name = from.local.toLowerCase();
    // `<metadata>` is RDF and vendor bookkeeping the walk drops in silence;
    // its content is not read, so it is not reported either. A `<style>`
    // keeps its own character data and nothing else: that is the text the
    // value check read, and checking a subtree per nested sheet was quadratic.
    const entries: XmlContent[] =
      name === 'metadata'
        ? []
        : name === 'style'
          ? styleEntriesOf(from)
          : (from.content ?? from.children);
    return { from, to, entries, index: 0 };
  };
  const clean = copy(source);
  const stack = [frameOf(source, clean)];
  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (frame.index >= frame.entries.length) {
      scope.exit(frame.from);
      stack.pop();
      continue;
    }
    const entry = frame.entries[frame.index];
    frame.index += 1;
    if ('kind' in entry) {
      // Character data stays (it is what a `<text>` says); a comment or an
      // instruction renders nothing and is not carried.
      if (entry.kind === 'text') {
        const text: XmlContent = { kind: 'text', value: entry.value };
        frame.to.content!.push(text);
      }
      continue;
    }
    // `stack.length` is the depth of the element about to be entered.
    if (stack.length > MAX_SVG_DEPTH) {
      report.tooDeep = true;
      continue;
    }
    scope.enter(entry);
    if (!allowed(entry)) {
      scope.exit(entry);
      report.removed.push({ element: entry.name });
      continue;
    }
    const child = copy(entry);
    frame.to.children.push(child);
    frame.to.content!.push(child);
    stack.push(frameOf(entry, child));
  }
  return { root: xmlElementOf(clean), report };
}
