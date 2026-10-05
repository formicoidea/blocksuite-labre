import { svgFrameOf } from '@labre/affine-block-surface';

import type { OwmPlot } from './export.js';
import type { WardleyNodeKeyword } from './import.js';
import {
  type DrawnWardleyMap,
  type DrawnWardleyNode,
  finiteAttr,
  startDrawnMap,
  textOf,
} from './svg-read.js';
import { WARDLEY_SVG_IMPORT_REMARKS } from './svg-remarks.js';

/**
 * A wardley-map-renderer SVG (labre-mcp's renderer), recognised (ADR 0032
 * §4.2).
 *
 * Read against `src/render/*` of that renderer and the corpus files it
 * rendered. Every layer is a `<g data-layer="…">` — `title`, `axes`,
 * `pipelines`, `edges`, `evolvesTo`, `nodes`, `steps`, `accelerators`,
 * `labels`, `notes`, `legend` — in BOTH modes; the interactive mode adds
 * `data-id` / `data-kind` on one group per artefact. So the producer is
 * certain from the `axes` and `nodes` layers alone, and the mode only decides
 * how much is read by id rather than by geometry:
 *
 * - a node is one or more concentric shapes in the `nodes` layer: a plain
 *   circle (a component), with a `clipPath` `anchor-clip-<id>` and a
 *   silhouette (an anchor), a triangle `<polygon>` and three rings inside a
 *   16-unit circle (a market), or a 30-unit grey disc (an ecosystem); a
 *   method's aura is one more concentric circle. Interactive: one
 *   `g[data-kind=component][data-id]` per node, whose `data-id` is its id;
 *   static: no id at all, so the node is named by its index;
 * - a name is a `<text>` of the `labels` layer: by `data-id` in interactive
 *   mode, and in static mode by GEOMETRY — every label is matched to the
 *   nearest node or pipeline handle, closest pairs first, because the
 *   renderer orders labels by input and handles after components;
 * - a dependency is a `<line>` of the `edges` layer, consumer end first; it
 *   names no node in either mode (its `data-id` is the RELATION's), so both
 *   ends are bound by geometry: each end within its node's own reach;
 * - an evolution is a dashed line of the `evolvesTo` layer leaving a node,
 *   and an inertia bar the 6-wide line across it; the renderer draws no twin,
 *   so the twin takes the node's name;
 * - a pipeline is a `<rect>` of the `pipelines` layer with its own handle
 *   square in `nodes` and its own label: it stands alone, it does not hang
 *   under a component;
 * - the plot is the two axis lines: the x axis from `(left, bottom)` to
 *   `(right, bottom)`, the y axis from `(left, bottom)` to `(left, top)`.
 *
 * The axes layer, the background rect and the renderer's own legend are
 * chrome the native board redraws; `steps`, `accelerators`, flow labels and
 * anything else are left to the sketch.
 */

const LAYER = (root: Element, name: string) =>
  root.querySelector(`g[data-layer="${name}"]`) ?? undefined;

/** How far a dependency's end may sit from the centre of its node. */
const END_REACH = 6;

interface Shape {
  element: Element;
  x: number;
  y: number;
  r: number;
}

/** A circle's centre and radius in file units, or `undefined` when unreadable. */
function circleOf(element: Element): Shape | undefined {
  const [cx, cy, r] = ['cx', 'cy', 'r'].map(name => finiteAttr(element, name));
  if (cx === undefined || cy === undefined || r === undefined) return undefined;
  const frame = svgFrameOf(element);
  return {
    element,
    x: frame.ox + cx * frame.s,
    y: frame.oy + cy * frame.s,
    r: r * frame.s,
  };
}

/** A line's two ends in file units. */
function lineOf(
  element: Element
): [number, number, number, number] | undefined {
  const values = ['x1', 'y1', 'x2', 'y2'].map(name =>
    finiteAttr(element, name)
  );
  if (values.some(value => value === undefined)) return undefined;
  const frame = svgFrameOf(element);
  const [x1, y1, x2, y2] = values as number[];
  return [
    frame.ox + x1 * frame.s,
    frame.oy + y1 * frame.s,
    frame.ox + x2 * frame.s,
    frame.oy + y2 * frame.s,
  ];
}

/** A rect's box in file units. */
function rectOf(
  element: Element
): [number, number, number, number] | undefined {
  const values = ['x', 'y', 'width', 'height'].map(name =>
    finiteAttr(element, name)
  );
  if (values.some(value => value === undefined)) return undefined;
  const frame = svgFrameOf(element);
  const [x, y, w, h] = values as number[];
  return [
    frame.ox + x * frame.s,
    frame.oy + y * frame.s,
    w * frame.s,
    h * frame.s,
  ];
}

const visible = (element: Element) =>
  !element.classList.contains('hit-area') &&
  element.getAttribute('stroke') !== 'transparent';

/** The plot off the two axis lines, or `undefined`. */
function plotOf(axes: Element): OwmPlot | undefined {
  const lines = Array.from(axes.querySelectorAll('line'))
    .map(lineOf)
    .filter((line): line is [number, number, number, number] => !!line);
  const xAxis = lines
    .filter(([, y1, , y2]) => Math.abs(y1 - y2) < 0.5)
    .sort((a, b) => Math.abs(b[2] - b[0]) - Math.abs(a[2] - a[0]))[0];
  if (!xAxis) return undefined;
  const [left, bottom, right] = xAxis;
  const yAxis = lines.find(
    ([x1, y1, x2, y2]) =>
      Math.abs(x1 - left) < 0.5 &&
      Math.abs(x2 - left) < 0.5 &&
      Math.abs(y1 - bottom) < 0.5 &&
      y2 < y1
  );
  if (!yAxis || right <= left) return undefined;
  const top = yAxis[3];
  return { x0: left, y0: top, width: right - left, height: bottom - top };
}

/**
 * The nodes of the `nodes` layer: concentric shapes clustered under the
 * largest circle that holds them, then named by what the cluster contains.
 */
function nodesOf(
  layer: Element,
  live: boolean
): { node: DrawnWardleyNode; group?: Element; r: number }[] {
  const found: { node: DrawnWardleyNode; group?: Element; r: number }[] = [];
  const clusters: { shapes: Shape[]; container: Element }[] = [];

  const units = live
    ? Array.from(layer.children).filter(
        child =>
          child.getAttribute('data-kind') === 'component' &&
          child.hasAttribute('data-id')
      )
    : [layer];
  for (const unit of units) {
    const circles = Array.from(unit.children)
      .filter(child => child.localName === 'circle')
      .map(circleOf)
      .filter((shape): shape is Shape => !!shape);
    for (const circle of circles) {
      const home = live
        ? clusters.find(cluster => cluster.container === unit)
        : clusters.find(cluster =>
            cluster.shapes.some(
              shape =>
                Math.hypot(shape.x - circle.x, shape.y - circle.y) <
                Math.max(shape.r, circle.r)
            )
          );
      if (home) home.shapes.push(circle);
      else clusters.push({ shapes: [circle], container: unit });
    }
  }

  const anchors = new Set(
    Array.from(layer.querySelectorAll('clipPath'))
      .filter(clip =>
        (clip.getAttribute('id') ?? '').startsWith('anchor-clip-')
      )
      .map(clip => clip.querySelector('circle'))
      .map(circle => (circle ? circleOf(circle) : undefined))
      .filter((shape): shape is Shape => !!shape)
      .map(shape => `${shape.x},${shape.y}`)
  );
  const polygons = Array.from(layer.querySelectorAll('polygon'));

  clusters.forEach((cluster, index) => {
    const outer = cluster.shapes.reduce((a, b) => (b.r > a.r ? b : a));
    // The node's own circle: concentric with the outermost one.
    const centre = cluster.shapes.find(
      shape => Math.hypot(shape.x - outer.x, shape.y - outer.y) < 0.5
    )!;
    const market = polygons.some(polygon => {
      const box = polygon.getAttribute('points') ?? '';
      const xs = box.match(/-?[\d.]+/g)?.map(Number) ?? [];
      const px = (xs[0] + xs[2] + xs[4]) / 3;
      const py = (xs[1] + xs[3] + xs[5]) / 3;
      return Math.hypot(px - outer.x, py - outer.y) < outer.r;
    });
    const kind: WardleyNodeKeyword = anchors.has(`${centre.x},${centre.y}`)
      ? 'anchor'
      : market && outer.r >= 12
        ? 'market'
        : outer.r >= 25
          ? 'ecosystem'
          : 'component';
    const id = live
      ? (cluster.container.getAttribute('data-id') ?? `node ${index + 1}`)
      : `node ${index + 1}`;
    found.push({
      node: { id, kind, name: '', x: centre.x, y: centre.y },
      group: live ? cluster.container : undefined,
      r: Math.max(centre.r, END_REACH),
    });
  });
  return found;
}

export function recogniseWardleyMapRenderer(
  root: Element
): DrawnWardleyMap | undefined {
  const axes = LAYER(root, 'axes');
  const nodesLayer = LAYER(root, 'nodes');
  if (!axes || !nodesLayer) return undefined;

  const live = root.querySelector('[data-id][data-kind]') !== null;
  const { drawn, consume } = startDrawnMap({
    producer: live
      ? 'wardley-map-renderer SVG (interactive)'
      : 'wardley-map-renderer SVG',
    plot: plotOf(axes),
  });

  /* Chrome: redrawn by the native board. */
  consume(axes);
  consume(LAYER(root, 'legend'));
  const backdrop = Array.from(root.children).find(
    child =>
      child.localName === 'rect' &&
      (child.getAttribute('data-kind') === 'background' ||
        root.firstElementChild === child)
  );
  consume(backdrop);
  const titleLayer = LAYER(root, 'title');
  const title = textOf(titleLayer?.querySelector('text') ?? undefined);
  if (title.length > 0) {
    drawn.title = title;
    consume(titleLayer);
  }

  /* Nodes. */
  const nodes = nodesOf(nodesLayer, live);
  for (const { node } of nodes) drawn.nodes.push(node);
  // Every node is read, so the layer's own shapes are all consumed; a
  // pipeline handle is consumed with its pipeline below.
  for (const child of Array.from(nodesLayer.children)) {
    const handle =
      child.getAttribute('data-part') === 'handle' ||
      (child.localName === 'rect' &&
        child.getAttribute('width') === child.getAttribute('height'));
    if (!handle) consume(child);
  }

  /* Pipelines: a rect, its handle square and its label. */
  const handles = Array.from(nodesLayer.children).filter(
    child =>
      child.getAttribute('data-part') === 'handle' ||
      (child.localName === 'rect' &&
        child.getAttribute('width') === child.getAttribute('height'))
  );
  const pipelineLayer = LAYER(root, 'pipelines');
  const pipelines: {
    id: string;
    box: [number, number, number, number];
    handle?: { x: number; y: number };
  }[] = [];
  for (const unit of Array.from(pipelineLayer?.children ?? [])) {
    const rect =
      unit.localName === 'rect'
        ? unit
        : (unit.querySelector('rect') ?? undefined);
    const box = rect ? rectOf(rect) : undefined;
    if (!box) continue;
    const id =
      unit.getAttribute('data-id') ?? `pipeline ${pipelines.length + 1}`;
    const handle = handles
      .map(candidate => {
        const square = (
          candidate.localName === 'rect'
            ? [candidate]
            : Array.from(candidate.querySelectorAll('rect')).filter(visible)
        )[0];
        const at = square ? rectOf(square) : undefined;
        return at
          ? {
              element: candidate,
              x: at[0] + at[2] / 2,
              y: at[1] + at[3] / 2,
              id: candidate.getAttribute('data-id'),
            }
          : undefined;
      })
      .find(
        candidate =>
          candidate &&
          (candidate.id === id ||
            (candidate.id === null &&
              candidate.x >= box[0] &&
              candidate.x <= box[0] + box[2] &&
              Math.abs(candidate.y - box[1]) < box[3]))
      );
    pipelines.push({
      id,
      box,
      handle: handle ? { x: handle.x, y: handle.y } : undefined,
    });
    consume(unit);
    consume(handle?.element);
  }

  /* Names: by id in interactive mode, by geometry otherwise. */
  const labelLayer = LAYER(root, 'labels');
  const labels = Array.from(labelLayer?.querySelectorAll('text') ?? []);
  const names = new Map<string, string>();
  const targets = [
    ...nodes.map(({ node }) => ({ id: node.id, x: node.x, y: node.y })),
    ...pipelines.flatMap(pipeline =>
      pipeline.handle ? [{ id: pipeline.id, ...pipeline.handle }] : []
    ),
  ];
  if (live) {
    for (const label of labels) {
      const id = label.getAttribute('data-id');
      if (id === null || names.has(id)) continue;
      if (!targets.some(target => target.id === id)) continue;
      names.set(id, textOf(label));
      consume(label);
    }
  } else {
    // Closest pairs first: a label is placed beside its own node, and the
    // collision avoidance that moves it only ever moves it a little.
    const pairs = labels
      .flatMap(label => {
        const x = finiteAttr(label, 'x');
        const y = finiteAttr(label, 'y');
        if (x === undefined || y === undefined) return [];
        const frame = svgFrameOf(label);
        const lx = frame.ox + x * frame.s;
        const ly = frame.oy + y * frame.s;
        return targets.map(target => ({
          label,
          target,
          distance: Math.hypot(lx - target.x, ly - target.y),
        }));
      })
      .sort((a, b) => a.distance - b.distance);
    const used = new Set<Element>();
    for (const { label, target, distance } of pairs) {
      if (used.has(label) || names.has(target.id) || distance > 200) continue;
      used.add(label);
      names.set(target.id, textOf(label));
      consume(label);
    }
  }
  for (const node of drawn.nodes) node.name = names.get(node.id) ?? '';
  for (const pipeline of pipelines) {
    drawn.pipelines.push({
      id: pipeline.id,
      name: names.get(pipeline.id) ?? '',
      top: pipeline.box[1],
      x1: pipeline.box[0],
      x2: pipeline.box[0] + pipeline.box[2],
    });
  }

  /* Dependencies: both ends bound by geometry, in either mode. */
  const nodeAt = (x: number, y: number) =>
    nodes
      .map(entry => ({
        entry,
        distance: Math.hypot(entry.node.x - x, entry.node.y - y),
      }))
      .filter(({ entry, distance }) => distance <= entry.r)
      .sort((a, b) => a.distance - b.distance)[0]?.entry.node;
  for (const unit of Array.from(LAYER(root, 'edges')?.children ?? [])) {
    const line =
      unit.localName === 'line'
        ? unit
        : Array.from(unit.querySelectorAll('line')).find(visible);
    const ends = line ? lineOf(line) : undefined;
    if (!ends) continue;
    const from = nodeAt(ends[0], ends[1]);
    const to = nodeAt(ends[2], ends[3]);
    if (!from || !to || from === to) {
      drawn.remarks.push({
        kind: 'warning',
        sourceId: unit.getAttribute('data-id') ?? undefined,
        element: 'link',
        message: WARDLEY_SVG_IMPORT_REMARKS.danglingLink[1],
        messageKey: WARDLEY_SVG_IMPORT_REMARKS.danglingLink[0],
      });
      continue;
    }
    drawn.links.push({ from: from.id, to: to.id });
    // The lines and nothing else: a flow label the relation carries has no
    // native home, so it stays for the sketch.
    for (const drawnLine of unit.localName === 'line'
      ? [unit]
      : Array.from(unit.querySelectorAll('line'))) {
      consume(drawnLine);
    }
  }

  /* Evolutions and inertia. */
  const evolveLayer = LAYER(root, 'evolvesTo');
  const evolveUnits = live
    ? Array.from(evolveLayer?.children ?? [])
    : evolveLayer
      ? [evolveLayer]
      : [];
  for (const unit of evolveUnits) {
    // In interactive mode the inertia bar is a sibling of the arrow's group,
    // not a child of it, so a unit may be the line itself.
    const lines =
      unit.localName === 'line'
        ? [unit]
        : Array.from(unit.querySelectorAll('line'));
    for (const line of lines.filter(visible)) {
      const ends = lineOf(line);
      if (!ends) continue;
      const width = finiteAttr(line, 'stroke-width') ?? 1;
      if (width >= 4) {
        drawn.inertias.push({
          x: (ends[0] + ends[2]) / 2,
          y: (ends[1] + ends[3]) / 2,
        });
        consume(line);
        continue;
      }
      const owner = nodeAt(ends[0], ends[1]);
      if (!owner) continue;
      drawn.evolutions.push({ of: owner.id, name: owner.name, x: ends[2] });
      consume(line);
    }
    // The hit areas, and the arrowheads that finish the arrows read above.
    for (const rest of Array.from(
      unit.querySelectorAll('line.hit-area, polygon')
    )) {
      consume(rest);
    }
  }

  return drawn;
}
