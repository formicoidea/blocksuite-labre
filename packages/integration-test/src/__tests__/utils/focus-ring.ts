/**
 * The geometry of a keyboard focus ring, read from what draws it (ADR 0054,
 * amendment of 2026-11-21): a ring of the canvas toolbar and its menus is an
 * `outline` on the focused control or on an element of its shadow tree
 * (`:focus-visible` rules), or — on a tool button, whose artwork an outline
 * paints under — the bordered `::after` of its `.icon-container`, or for a
 * senior tool drawn as one button the `.cell-ring` of its cell. A chosen
 * colour swatch draws its selection ring as a bordered `::after`. Boxes are
 * in client pixels.
 */

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Ring {
  /** The element whose outline, or whose `::after`, is the ring. */
  element: Element;
  /** Whether it is the element's `::after` (positioned in it). */
  pseudo: boolean;
  /** The ring's outer edge. */
  outer: Box;
  /** The ring's inner edge. */
  inner: Box;
  /** Its thickness. */
  width: number;
}

/** A tool button's ring: the bordered, positioned `::after` of its icon box. */
function pseudoRing(element: Element): Ring | null {
  if (!element.classList.contains('icon-container')) return null;
  const style = getComputedStyle(element, '::after');
  const width = parseFloat(style.borderTopWidth);
  if (style.content === 'none' || style.display === 'none') return null;
  if (style.position !== 'absolute') return null;
  if (style.borderTopStyle === 'none' || !(width > 0)) return null;
  const outer = afterBox(element, style);
  return { element, pseudo: true, outer, inner: grow(outer, -width), width };
}

/** The border box of `element`'s positioned `::after`, whose computed `style` is given. */
function afterBox(element: Element, style: CSSStyleDeclaration): Box {
  const box = element.getBoundingClientRect();
  const left = box.left + parseFloat(style.left);
  const top = box.top + parseFloat(style.top);
  // The computed width is the content box's unless the box says otherwise.
  const edges =
    style.boxSizing === 'border-box' ? 0 : 2 * parseFloat(style.borderTopWidth);
  return {
    left,
    top,
    right: left + parseFloat(style.width) + edges,
    bottom: top + parseFloat(style.height) + edges,
  };
}

/** A focus ring drawn as the outline of `element`'s positioned `::after` (a colour swatch's). */
function afterOutline(element: Element): Ring | null {
  const style = getComputedStyle(element, '::after');
  const width = parseFloat(style.outlineWidth);
  if (style.content === 'none' || style.display === 'none') return null;
  if (style.position !== 'absolute') return null;
  if (style.outlineStyle === 'none' || !(width > 0)) return null;
  const offset = parseFloat(style.outlineOffset);
  const box = afterBox(element, style);
  return {
    element,
    pseudo: true,
    outer: grow(box, width + offset),
    inner: grow(box, offset),
    width,
  };
}

const grow = (box: Box, by: number): Box => ({
  left: box.left - by,
  top: box.top - by,
  right: box.right + by,
  bottom: box.bottom + by,
});

export const centre = (box: Box) => ({
  x: (box.left + box.right) / 2,
  y: (box.top + box.bottom) / 2,
});

export const describeBox = (box: Box) =>
  `[${box.left},${box.top} → ${box.right},${box.bottom}]`;

/** The parent in the flat tree: the slot a node is assigned to, the host of a shadow root. */
function flatParent(node: Node): Node | null {
  if (node instanceof Element && node.assignedSlot) return node.assignedSlot;
  const parent = node.parentNode;
  return parent instanceof ShadowRoot ? parent.host : parent;
}

/** The focus ring `control` draws now, or `null` when none shows. */
export function focusRing(control: Element): Ring | null {
  const inside = control.shadowRoot
    ? Array.from(control.shadowRoot.querySelectorAll('*'))
    : [];
  for (const element of [control, ...inside]) {
    const pseudo = pseudoRing(element) ?? afterOutline(element);
    if (pseudo) return pseudo;
    const style = getComputedStyle(element);
    const width = parseFloat(style.outlineWidth);
    if (style.outlineStyle === 'none' || !(width > 0)) continue;
    const offset = parseFloat(style.outlineOffset);
    const box = element.getBoundingClientRect();
    return {
      element,
      pseudo: false,
      outer: grow(box, width + offset),
      inner: grow(box, offset),
      width,
    };
  }
  // A senior tool drawn as one button: the ring is its cell's `.cell-ring`.
  const cell = seniorCellOf(control);
  const drawn = cell?.querySelector(':scope > .cell-ring');
  if (!drawn) return null;
  const style = getComputedStyle(drawn);
  const width = parseFloat(style.borderTopWidth);
  if (style.display === 'none' || !(width > 0)) return null;
  const outer = drawn.getBoundingClientRect();
  return {
    element: drawn,
    pseudo: false,
    outer,
    inner: grow(outer, -width),
    width,
  };
}

/** The toolbar's senior cell that holds `control`, if any. */
export function seniorCellOf(control: Element): Element | null {
  for (let node = flatParent(control); node; node = flatParent(node)) {
    if (node instanceof Element && node.classList.contains('senior-tool-item'))
      return node;
  }
  return null;
}

/** Whether a computed colour paints nothing (`rgba(…, 0)`, `transparent`). */
const invisible = (colour: string) =>
  colour === 'transparent' || /rgba\(.*,\s*0\)$/.test(colour);

/**
 * The selection ring a chosen swatch draws (the border of its positioned
 * `::after`, which only a chosen swatch has), or `null`.
 */
export function selectionRing(control: Element): Box | null {
  const style = getComputedStyle(control, '::after');
  if (style.content === 'none' || style.position !== 'absolute') return null;
  if (!(parseFloat(style.borderTopWidth) > 0)) return null;
  if (invisible(style.borderTopColor)) return null;
  return afterBox(control, style);
}

/**
 * Whether a ring is a positioned box stacked above the artwork of what it
 * marks (`z-index` ≥ 1). A proxy for paint order, read from computed style:
 * the real check would sample the ring's pixels in a screenshot over the
 * artwork. An `outline` fails it: it paints under positioned children.
 */
export function ringPaintsAbove(ring: Ring): boolean {
  const style = ring.pseudo
    ? getComputedStyle(ring.element, '::after')
    : getComputedStyle(ring.element);
  return style.position === 'absolute' && Number(style.zIndex) >= 1;
}

/** Whether a space-separated CSS value names one of `tokens`. */
const names = (value: string, tokens: string[]) =>
  value.split(/[\s,]+/).some(token => tokens.includes(token));

const clips = (style: CSSStyleDeclaration) =>
  style.overflowX !== 'visible' ||
  style.overflowY !== 'visible' ||
  names(style.contain, ['paint', 'strict', 'content']);

/** Whether `style` makes its element the containing block of a fixed box. */
const holdsFixed = (style: CSSStyleDeclaration) =>
  style.transform !== 'none' ||
  style.filter !== 'none' ||
  style.perspective !== 'none' ||
  names(style.willChange, ['transform', 'filter', 'perspective']) ||
  names(style.contain, ['paint', 'layout', 'strict', 'content']);

/** Whether an element of `style` is on the containing-block chain of a box positioned `position`. */
const containsPositioned = (position: string, style: CSSStyleDeclaration) => {
  if (position === 'fixed') return holdsFixed(style);
  if (position === 'absolute') {
    return style.position !== 'static' || holdsFixed(style);
  }
  return true;
};

/**
 * The ancestors that clip `element` — those whose `overflow` (or `contain`)
 * clips, crossing shadow roots and slots, and skipping those an absolutely
 * or fixed positioned box escapes (they are not on its containing-block
 * chain) — each with its padding box, the edge it clips at. For a ring drawn
 * as `element`'s positioned `::after`, `element` itself is the first.
 */
export function clippingAncestors(element: Element, pseudo = false) {
  const found: { element: Element; box: Box }[] = [];
  let position = pseudo ? 'absolute' : getComputedStyle(element).position;
  const first = pseudo ? element : flatParent(element);
  for (let node = first; node; node = flatParent(node)) {
    if (!(node instanceof Element)) continue;
    const style = getComputedStyle(node);
    if (style.display === 'contents') continue;
    if (!containsPositioned(position, style)) continue;
    if (clips(style)) {
      const box = node.getBoundingClientRect();
      const left = box.left + node.clientLeft;
      const top = box.top + node.clientTop;
      found.push({
        element: node,
        box: {
          left,
          top,
          right: left + node.clientWidth,
          bottom: top + node.clientHeight,
        },
      });
    }
    position = style.position;
  }
  return found;
}

/** Layout rounding: a hundredth of a pixel. */
const EPSILON = 0.01;

/** Whether `inner` lies inside `outer`, to within layout rounding. */
export const inside = (inner: Box, outer: Box) =>
  inner.left >= outer.left - EPSILON &&
  inner.top >= outer.top - EPSILON &&
  inner.right <= outer.right + EPSILON &&
  inner.bottom <= outer.bottom + EPSILON;

/** What clips `ring`: every clipping ancestor of its element it overflows. */
export const ringClippedBy = (ring: Ring) =>
  clippingAncestors(ring.element, ring.pseudo)
    .filter(({ box }) => !inside(ring.outer, box))
    .map(({ element, box }) => {
      const name = [element.localName, ...element.classList].join('.');
      const range = element.scrollWidth - element.clientWidth;
      const scroll =
        range > 0 ? ` scrolled ${element.scrollLeft} of ${range}` : '';
      return `${name} ${describeBox(box)}${scroll}`;
    });
