import { svgFrameOf } from '@labre/affine-block-surface';

import type { OwmPlot } from './export.js';
import {
  type DrawnWardleyMap,
  type DrawnWardleyNode,
  finiteAttr,
  textOf,
} from './svg-read.js';

/**
 * An SVG no producer marked, read by shape (ADR 0032 §4.4, §5) — the last
 * step of detection, and the most cautious.
 *
 * **The plot first, or nothing.** Two straight lines meeting at their
 * bottom-left — a horizontal one and a vertical one, each longer than half the
 * drawing's extent — are the map's axes, and the rectangle they span is the
 * plot. Without them nothing is promoted and this answers `undefined`: a plot
 * guessed for a picture whose producer is unknown is the invented axis ADR
 * 0012 forbids.
 *
 * **Then two things, and only two.** Inside the plot, a circle (radius 20 or
 * less) with a `<text>` beside it — within four radii or 40 units, closest
 * pairs first — is a component named by that text; a straight segment whose
 * two ends sit on two such components is a dependency, its consumer the
 * higher of the two (needs descend the value chain). Nothing else is promoted:
 * no anchor, pipeline, inertia bar, evolve arrow or note is guessed from bare
 * geometry, so a dashed red arrow, a thick bar or a rect stays a sketch.
 *
 * **Known failure modes.** A curved link is not straight and stays a sketch.
 * A `matrix`, `scale` or `rotate` transform is ignored, as the sketch walk
 * ignores it, so a map drawn under one is read where it would be without it.
 * A name drawn far from its circle, or a circle with no name, leaves that
 * circle a sketch; and one link to it then stays a sketch too.
 */

const MAX_NODE_RADIUS = 20;
const NAME_REACH = 40;
const END_SLACK = 3;

interface Segment {
  element: Element;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * A path that is ONE straight segment — `M` then a single `L`, `H` or `V`,
 * absolute or relative, or the implicit line-to of a second coordinate pair —
 * as its two ends in the path's own units; anything else is `undefined`.
 */
function straightPath(d: string): [number, number, number, number] | undefined {
  const commands = [...d.matchAll(/([MmLlHhVv])([^MmLlHhVvCcSsQqTtAaZz]*)/g)];
  const rest = d.replace(/([MmLlHhVv])([^MmLlHhVvCcSsQqTtAaZz]*)/g, '').trim();
  if (commands.length === 0 || rest.length > 0) return undefined;
  const points: [number, number][] = [];
  let x = 0;
  let y = 0;
  for (const [index, [, letter, raw]] of commands.entries()) {
    const args = (
      raw.match(/-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? []
    ).map(Number);
    const relative = letter === letter.toLowerCase();
    const kind = letter.toLowerCase();
    // A second move-to starts a second subpath: not one segment.
    if (kind === 'm' && index > 0) return undefined;
    if (kind === 'h' || kind === 'v') {
      for (const value of args) {
        if (kind === 'h') x = relative ? x + value : value;
        else y = relative ? y + value : value;
        points.push([x, y]);
      }
      continue;
    }
    for (let at = 0; at + 1 < args.length; at += 2) {
      // A leading `m` is absolute (SVG 1.1 §8.3.2); every other relative pair
      // — an `l`, or the implicit line-to after an `m` — is an offset.
      const offset = relative && !(kind === 'm' && points.length === 0);
      x = offset ? x + args[at] : args[at];
      y = offset ? y + args[at + 1] : args[at + 1];
      points.push([x, y]);
    }
  }
  if (points.length !== 2) return undefined;
  if (!points.flat().every(Number.isFinite)) return undefined;
  return [points[0][0], points[0][1], points[1][0], points[1][1]];
}

function segmentsOf(root: Element): Segment[] {
  const found: Segment[] = [];
  for (const element of Array.from(
    root.querySelectorAll('line, polyline, path')
  )) {
    let ends: [number, number, number, number] | undefined;
    if (element.localName === 'line') {
      const values = ['x1', 'y1', 'x2', 'y2'].map(name =>
        finiteAttr(element, name)
      );
      if (values.every(value => value !== undefined)) {
        ends = values as [number, number, number, number];
      }
    } else if (element.localName === 'polyline') {
      const values = (element.getAttribute('points') ?? '')
        .match(/-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g)
        ?.map(Number);
      if (values?.length === 4)
        ends = values as [number, number, number, number];
    } else {
      ends = straightPath(element.getAttribute('d') ?? '');
    }
    if (!ends) continue;
    const frame = svgFrameOf(element);
    found.push({
      element,
      x1: frame.ox + ends[0] * frame.s,
      y1: frame.oy + ends[1] * frame.s,
      x2: frame.ox + ends[2] * frame.s,
      y2: frame.oy + ends[3] * frame.s,
    });
  }
  return found;
}

/** The two axes meeting bottom-left, and the plot they span — or nothing. */
function axesOf(
  segments: Segment[],
  extent: { w: number; h: number }
): { plot: OwmPlot; axes: Segment[] } | undefined {
  const slack = Math.max(2, 0.02 * Math.max(extent.w, extent.h));
  const horizontals = segments
    .filter(s => Math.abs(s.y1 - s.y2) < 1)
    .filter(s => Math.abs(s.x2 - s.x1) > extent.w / 2)
    .sort((a, b) => Math.abs(b.x2 - b.x1) - Math.abs(a.x2 - a.x1));
  const verticals = segments
    .filter(s => Math.abs(s.x1 - s.x2) < 1)
    .filter(s => Math.abs(s.y2 - s.y1) > extent.h / 2);
  for (const h of horizontals) {
    const left = Math.min(h.x1, h.x2);
    const right = Math.max(h.x1, h.x2);
    const bottom = h.y1;
    const v = verticals.find(
      candidate =>
        Math.abs(candidate.x1 - left) <= slack &&
        Math.abs(Math.max(candidate.y1, candidate.y2) - bottom) <= slack
    );
    if (!v) continue;
    const top = Math.min(v.y1, v.y2);
    if (right - left <= 0 || bottom - top <= 0) continue;
    return {
      plot: { x0: left, y0: top, width: right - left, height: bottom - top },
      axes: [h, v],
    };
  }
  return undefined;
}

export function recogniseByShape(root: Element): DrawnWardleyMap | undefined {
  const segments = segmentsOf(root);
  const circles = Array.from(root.querySelectorAll('circle')).flatMap(
    element => {
      const [cx, cy, r] = ['cx', 'cy', 'r'].map(name =>
        finiteAttr(element, name)
      );
      if (cx === undefined || cy === undefined || r === undefined) return [];
      const frame = svgFrameOf(element);
      return [
        {
          element,
          x: frame.ox + cx * frame.s,
          y: frame.oy + cy * frame.s,
          r: r * frame.s,
        },
      ];
    }
  );
  const texts = Array.from(root.querySelectorAll('text')).flatMap(element => {
    const span = element.querySelector('tspan');
    const x =
      finiteAttr(element, 'x') ?? (span ? finiteAttr(span, 'x') : undefined);
    const y =
      finiteAttr(element, 'y') ?? (span ? finiteAttr(span, 'y') : undefined);
    const name = textOf(element);
    if (x === undefined || y === undefined || name.length === 0) return [];
    const frame = svgFrameOf(element);
    return [
      { element, x: frame.ox + x * frame.s, y: frame.oy + y * frame.s, name },
    ];
  });

  const xs = [
    ...segments.flatMap(s => [s.x1, s.x2]),
    ...circles.map(c => c.x),
    ...texts.map(t => t.x),
  ];
  const ys = [
    ...segments.flatMap(s => [s.y1, s.y2]),
    ...circles.map(c => c.y),
    ...texts.map(t => t.y),
  ];
  if (xs.length === 0) return undefined;
  const extent = {
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys),
  };
  const found = axesOf(segments, extent);
  if (!found) return undefined;
  const { plot, axes } = found;

  const drawn: DrawnWardleyMap = {
    producer: 'SVG (recognised by shape)',
    plot,
    nodes: [],
    pipelines: [],
    evolutions: [],
    links: [],
    notes: [],
    inertias: [],
    consumed: new Set(axes.map(axis => axis.element)),
    remarks: [],
  };

  /* Components: a small circle inside the plot, named by the text beside it. */
  const inside = circles.filter(
    c =>
      c.r <= MAX_NODE_RADIUS &&
      c.x > plot.x0 &&
      c.x < plot.x0 + plot.width &&
      c.y > plot.y0 &&
      c.y < plot.y0 + plot.height
  );
  const pairs = inside
    .flatMap(circle =>
      texts.map(text => ({
        circle,
        text,
        distance: Math.hypot(text.x - circle.x, text.y - circle.y),
      }))
    )
    .filter(
      ({ circle, distance }) => distance <= Math.max(4 * circle.r, NAME_REACH)
    )
    .sort((a, b) => a.distance - b.distance);
  const named = new Map<Element, DrawnWardleyNode>();
  const reach = new Map<DrawnWardleyNode, number>();
  const usedTexts = new Set<Element>();
  for (const { circle, text } of pairs) {
    if (named.has(circle.element) || usedTexts.has(text.element)) continue;
    usedTexts.add(text.element);
    const node: DrawnWardleyNode = {
      id: `shape ${named.size + 1}`,
      kind: 'component',
      name: text.name,
      x: circle.x,
      y: circle.y,
    };
    named.set(circle.element, node);
    reach.set(node, circle.r + END_SLACK);
    drawn.nodes.push(node);
    drawn.consumed.add(circle.element);
    drawn.consumed.add(text.element);
  }

  /* Dependencies: a straight segment from one component to another. */
  const nodeAt = (x: number, y: number) =>
    drawn.nodes.find(
      node => Math.hypot(node.x - x, node.y - y) <= (reach.get(node) ?? 0)
    );
  for (const segment of segments) {
    if (axes.includes(segment)) continue;
    const a = nodeAt(segment.x1, segment.y1);
    const b = nodeAt(segment.x2, segment.y2);
    if (!a || !b || a === b) continue;
    // The consumer is the higher one: needs descend the value chain.
    const [from, to] = a.y <= b.y ? [a, b] : [b, a];
    drawn.links.push({ from: from.id, to: to.id });
    drawn.consumed.add(segment.element);
  }

  return drawn;
}
