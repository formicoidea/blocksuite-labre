import type { InterchangeNote } from '@labre/affine-block-surface';
import { svgFrameOf } from '@labre/affine-block-surface';

import type { OwmPlot } from './export.js';
import type { WardleyNodeKeyword } from './import.js';

/**
 * What a recogniser reads off a picture, before anything is laid out — the
 * shared shape every producer's recogniser answers in (ADR 0032 §2.2).
 *
 * Everything is in the FILE's coordinates, exactly as the shared sketch walk
 * would place it (`svgFrameOf`), so `svg-import.ts` can turn a point into
 * `[visibility, evolution]` against the plot the recogniser found, and place
 * the remainder with the same arithmetic.
 */
export interface DrawnWardleyNode {
  /** The producer's own id, used as a provisional local name and nothing else. */
  id: string;
  kind: WardleyNodeKeyword;
  /** What the producer drew beside it, verbatim (truncated stays truncated). */
  name: string;
  x: number;
  y: number;
}

export interface DrawnWardleyMap {
  /** `sourceVersion`: the producer, and the marker version it read. */
  producer: string;
  /** The plot, read off the file; absent when the producer is certain but the file lost it. */
  plot?: OwmPlot;
  title?: string;
  nodes: DrawnWardleyNode[];
  /**
   * A pipeline body: either hung under a component (`of`, OnlineWardleyMaps'
   * reading), or standing alone with its own id, name and top edge (`top`,
   * the renderer's).
   */
  pipelines: (
    | { of: string; x1: number; x2: number }
    | { id: string; name: string; top: number; x1: number; x2: number }
  )[];
  /** An evolved twin: which node moves, what the twin is called, where it lands. */
  evolutions: { of: string; name: string; x: number }[];
  /** Consumer, then what it needs (ADR 0010), by producer id. */
  links: { from: string; to: string }[];
  notes: { text: string; x: number; y: number }[];
  inertias: { x: number; y: number }[];
  /** Every node the recogniser turned into the above; the sketch skips them. */
  consumed: Set<Element>;
  /** What the recogniser has to say about the file (dangling ends, bad numbers). */
  remarks: InterchangeNote[];
}

/**
 * Every element carrying an `id`, first wins — the index a producer's markers
 * are looked up in.
 *
 * A `Map`, never an object: a hostile file's `__proto__` or `constructor` is a
 * key like any other here, and can never reach a prototype (ADR 0032 §7).
 */
export function idIndex(root: Element): Map<string, Element> {
  const index = new Map<string, Element>();
  for (const element of Array.from(root.querySelectorAll('[id]'))) {
    const id = element.getAttribute('id');
    if (id !== null && !index.has(id)) index.set(id, element);
  }
  return index;
}

/**
 * A text's words, collapsed the way the sketch collapses a label — one span
 * per line joined by a space, so a name a producer wrapped over two `<tspan>`s
 * reads as the name and not as two words glued together.
 */
export function textOf(element: Element | undefined): string {
  if (!element) return '';
  const spans = Array.from(element.children).filter(
    child => child.localName === 'tspan'
  );
  const raw =
    spans.length > 0
      ? spans.map(span => span.textContent ?? '').join(' ')
      : (element.textContent ?? '');
  return raw.replace(/\s+/g, ' ').trim();
}

/**
 * Where an element's own user-space origin lands, or `undefined` when the
 * file does not give it as numbers.
 *
 * The shared frame reader is lenient — it reads the numbers out of a
 * transform and skips what is not one — which is right for a sketch and wrong
 * for a coordinate this import is about to present as READ. So an element
 * whose own `transform` is anything but a translate of finite numbers is
 * refused here, and the caller sends it to the sketch with a remark.
 */
export function originOf(element: Element): [number, number] | undefined {
  const raw = element.getAttribute('transform');
  if (raw !== null && raw.trim().length > 0) {
    const match =
      /^\s*translate\(\s*([^,\s)]+)(?:[\s,]+([^,\s)]+))?\s*\)\s*$/.exec(raw);
    if (!match) return undefined;
    for (const value of [match[1], match[2] ?? '0']) {
      if (!Number.isFinite(Number(value))) return undefined;
    }
  }
  const frame = svgFrameOf(element);
  return [frame.ox, frame.oy];
}

/** A finite number off an attribute, or `undefined`. */
export function finiteAttr(element: Element, name: string): number | undefined {
  const raw = element.getAttribute(name);
  if (raw === null || raw.trim().length === 0) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}
