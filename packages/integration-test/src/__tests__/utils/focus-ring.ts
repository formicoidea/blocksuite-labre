/**
 * The geometry of a keyboard focus ring, read from what draws it (ADR 0054,
 * amendment of 2026-11-21): a ring of the canvas toolbar and its menus is an
 * `outline` on the focused control or on an element of its shadow tree
 * (`:focus-visible` rules), or — on a tool button, whose artwork an outline
 * paints under — the bordered `::after` of its `.icon-container`. A chosen
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

/** A tool button's ring: its icon box's bordered, positioned `::after`. */
function pseudoRing(element: Element): Ring | null {
  if (!element.classList.contains('icon-container')) return null;
  const style = getComputedStyle(element, '::after');
  const width = parseFloat(style.borderTopWidth);
  if (style.content === 'none' || style.position !== 'absolute') return null;
  if (style.borderTopStyle === 'none' || !(width > 0)) return null;
  const box = element.getBoundingClientRect();
  const left = box.left + parseFloat(style.left);
  const top = box.top + parseFloat(style.top);
  // The computed width is the content box's unless the box says otherwise.
  const edges = style.boxSizing === 'border-box' ? 0 : 2 * width;
  const outer = {
    left,
    top,
    right: left + parseFloat(style.width) + edges,
    bottom: top + parseFloat(style.height) + edges,
  };
  return { element, pseudo: true, outer, inner: grow(outer, -width), width };
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
    const pseudo = pseudoRing(element);
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
  return null;
}

/**
 * The selection ring a chosen swatch draws (`:host([active])::after`, a
 * bordered circle positioned on the swatch), or `null`.
 */
export function selectionRing(control: Element): Box | null {
  const style = getComputedStyle(control, '::after');
  if (style.content === 'none' || style.position !== 'absolute') return null;
  if (!(parseFloat(style.borderTopWidth) > 0)) return null;
  const box = control.getBoundingClientRect();
  const left = box.left + parseFloat(style.left);
  const top = box.top + parseFloat(style.top);
  return {
    left,
    top,
    right: left + parseFloat(style.width),
    bottom: top + parseFloat(style.height),
  };
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
