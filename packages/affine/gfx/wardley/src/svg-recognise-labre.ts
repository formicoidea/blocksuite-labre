import { BOARD_SVG_MARKER_VERSION } from '@labre/affine-block-surface';

import { matchLabels, type OwmPlot, owmPlotOf } from './export.js';
import type { WardleyNodeKeyword } from './import.js';
import { WARDLEY_ROLE, WARDLEY_ROLES } from './roles.js';
import { type DrawnWardleyMap, startDrawnMap } from './svg-read.js';
import { WARDLEY_SVG_IMPORT_REMARKS } from './svg-remarks.js';

/**
 * Labre's own board SVG, recognised (ADR 0032 §4.1, §6) — first in detection
 * order, because it is the one producer whose file states roles exactly.
 *
 * The export wraps every element it replays in a `<g>` carrying
 * `data-labre-id`, `-type`, `-role`, `-xywh` (the stored bound, in the file's
 * coordinates), `-source` / `-target` on a connector and `-group` on a grouped
 * element, and stamps the root with `data-labre-svg`. Certain on that root
 * stamp, at a version this reader knows.
 *
 * So nothing is guessed but names: the plot is the map's own (`owmPlotOf` on
 * the board's bound), a node's place is its stored bound, a dependency names
 * its two ends, a change arrow names the twin it points at. A NAME is read off
 * the `<text>` the renderer drew, never off a marker — the markers carry no
 * prose — and matched to its node with the very function the OWM export uses
 * (`matchLabels`), so the export and this import agree on whose name is
 * whose. What the statements have no word for — an area, a Porter's force, a
 * method, another framework's artefact, a role no Wardley table declares —
 * is left to the sketch.
 */

/** Roles that are a node of the value chain, and the keyword each lays out as. */
const NODE_KEYWORD: Record<string, WardleyNodeKeyword> = Object.assign(
  Object.create(null),
  {
    [WARDLEY_ROLE.component]: 'component',
    [WARDLEY_ROLE.anchor]: 'anchor',
    [WARDLEY_ROLE.market]: 'market',
    [WARDLEY_ROLE.ecosystem]: 'ecosystem',
    [WARDLEY_ROLE.accelerator]: 'accelerator',
    [WARDLEY_ROLE.decelerator]: 'deaccelerator',
  }
);

interface Marked {
  element: Element;
  id: string;
  type: string;
  role?: string;
  box: { x: number; y: number; w: number; h: number };
  source?: string;
  target?: string;
}

/** A bound a marker states, as four finite numbers, or `undefined`. */
function boxOf(raw: string | null): Marked['box'] | undefined {
  if (raw === null) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!Array.isArray(parsed) || parsed.length !== 4) return undefined;
  if (
    !parsed.every(value => typeof value === 'number' && Number.isFinite(value))
  )
    return undefined;
  const [x, y, w, h] = parsed as number[];
  return { x, y, w, h };
}

const centreOf = (box: Marked['box']) => ({
  x: box.x + box.w / 2,
  y: box.y + box.h / 2,
});

/** The words a group's own `<text>`s draw, line after line. */
function drawnText(element: Element): string {
  return Array.from(element.querySelectorAll('text'))
    .map(text => text.textContent ?? '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function recogniseLabreExport(
  root: Element
): DrawnWardleyMap | undefined {
  if (root.getAttribute('data-labre-svg') !== BOARD_SVG_MARKER_VERSION) {
    return undefined;
  }

  const { drawn, consume: consumeElement } = startDrawnMap({
    producer: `Labre SVG ${BOARD_SVG_MARKER_VERSION}`,
  });
  const consume = (marked: Marked | undefined) =>
    consumeElement(marked?.element);

  /* Every marked group whose numbers are numbers and whose role is Wardley's. */
  const marked: Marked[] = [];
  for (const element of Array.from(root.querySelectorAll('g[data-labre-id]'))) {
    const id = element.getAttribute('data-labre-id') ?? '';
    const box = boxOf(element.getAttribute('data-labre-xywh'));
    if (id.length === 0) continue;
    if (!box) {
      drawn.remarks.push({
        kind: 'warning',
        sourceId: id,
        message: WARDLEY_SVG_IMPORT_REMARKS.unreadableCoordinates[1],
        messageKey: WARDLEY_SVG_IMPORT_REMARKS.unreadableCoordinates[0],
      });
      continue;
    }
    const role = element.getAttribute('data-labre-role') ?? undefined;
    // A role no Wardley table declares — another framework's, or a forged
    // one — is not this reader's to read: that element stays a sketch, and is
    // never a new role (ADR 0032 §7).
    if (role !== undefined && !WARDLEY_ROLES[role]) continue;
    marked.push({
      element,
      id,
      type: element.getAttribute('data-labre-type') ?? '',
      role,
      box,
      source: element.getAttribute('data-labre-source') ?? undefined,
      target: element.getAttribute('data-labre-target') ?? undefined,
    });
  }
  const byId = new Map(marked.map(entry => [entry.id, entry]));
  const withRole = (role: string) =>
    marked.filter(entry => entry.role === role);

  /* The map, and its plot. */
  const map = withRole(WARDLEY_ROLE.map)[0];
  if (map) {
    const plot: OwmPlot = owmPlotOf(map.box);
    drawn.plot = plot;
    consume(map);
  }

  /* Names, matched the way the OWM export matches them. */
  const named = marked.filter(entry => entry.type === 'wardleyNode');
  const labels = withRole(WARDLEY_ROLE.label);
  const names = matchLabels(
    named.map(entry => ({
      id: entry.id,
      kind: entry.role?.slice('wardley:'.length) ?? '',
      role: entry.role,
      elementBound: entry.box,
    })),
    labels.map(entry => ({
      text: drawnText(entry.element),
      elementBound: entry.box,
    }))
  );

  /* Change arrows first: their targets are twins, not nodes. */
  const twins = new Set<string>();
  for (const arrow of withRole(WARDLEY_ROLE.changeArrow)) {
    const from = arrow.source ? byId.get(arrow.source) : undefined;
    const twin = arrow.target ? byId.get(arrow.target) : undefined;
    if (!from || !twin || !NODE_KEYWORD[from.role ?? '']) continue;
    twins.add(twin.id);
    drawn.evolutions.push({
      of: from.id,
      name: names.get(twin.id) ?? names.get(from.id) ?? '',
      x: centreOf(twin.box).x,
    });
    consume(arrow);
    consume(twin);
  }

  /* Nodes. */
  for (const entry of named) {
    const keyword = NODE_KEYWORD[entry.role ?? ''];
    if (!keyword || twins.has(entry.id)) continue;
    drawn.nodes.push({
      id: entry.id,
      kind: keyword,
      name: names.get(entry.id) ?? '',
      ...centreOf(entry.box),
    });
    consume(entry);
  }

  /* Pipelines stand alone; a handle is redrawn with its body. */
  const handleOf = new Map<string, string>();
  const bodies = withRole(WARDLEY_ROLE.pipeline);
  for (const body of bodies) {
    drawn.pipelines.push({
      id: body.id,
      name: names.get(body.id) ?? '',
      top: body.box.y,
      x1: body.box.x,
      x2: body.box.x + body.box.w,
    });
    consume(body);
  }
  for (const handle of withRole(WARDLEY_ROLE.handle)) {
    const { x, y } = centreOf(handle.box);
    const body = bodies.find(
      candidate =>
        x >= candidate.box.x &&
        x <= candidate.box.x + candidate.box.w &&
        Math.abs(y - candidate.box.y) <= handle.box.h
    );
    if (!body) continue;
    // The layout names the handle it mints after its pipeline.
    handleOf.set(handle.id, `${body.id} handle`);
    consume(handle);
  }

  /* Dependencies, by the two ids they name. */
  const nodeIds = new Set(drawn.nodes.map(node => node.id));
  const end = (id: string | undefined) =>
    id === undefined ? undefined : nodeIds.has(id) ? id : handleOf.get(id);
  for (const link of withRole(WARDLEY_ROLE.dependency)) {
    const from = end(link.source);
    const to = end(link.target);
    if (from === undefined || to === undefined) {
      drawn.remarks.push({
        kind: 'warning',
        sourceId: link.id,
        element: 'link',
        message: WARDLEY_SVG_IMPORT_REMARKS.danglingLink[1],
        messageKey: WARDLEY_SVG_IMPORT_REMARKS.danglingLink[0],
      });
      continue;
    }
    drawn.links.push({ from, to });
    consume(link);
  }

  /* Inertia bars, and free texts — an OWM note is a free text on the map. */
  for (const bar of withRole(WARDLEY_ROLE.inertia)) {
    drawn.inertias.push(centreOf(bar.box));
    consume(bar);
  }
  for (const text of marked.filter(
    entry => entry.type === 'text' && entry.role === undefined
  )) {
    const words = drawnText(text.element);
    if (words.length === 0) continue;
    drawn.notes.push({ text: words, ...centreOf(text.box) });
    consume(text);
  }

  /* A glyph's own wiring (a market's dots and triangle), and the groups. */
  const wiring = new Set(
    marked
      .filter(entry => entry.type === 'wardleyNode' && entry.role === undefined)
      .map(entry => entry.id)
  );
  for (const entry of marked) {
    const glyph =
      wiring.has(entry.id) ||
      (entry.type === 'connector' &&
        entry.role === undefined &&
        wiring.has(entry.source ?? '') &&
        wiring.has(entry.target ?? ''));
    if (glyph || entry.type === 'group') consume(entry);
  }
  // The clip paths svgcanvas hoists to the root draw nothing by themselves.
  for (const defs of Array.from(root.children).filter(
    child => child.localName === 'defs'
  )) {
    drawn.consumed.add(defs);
  }

  // A label goes when it named something now drawn natively — the layout
  // writes that name again. One that named nothing, or named an artefact left
  // to the sketch (a method, a force), stays visible beside it.
  const redrawn = new Set(
    [
      ...drawn.nodes.map(node => node.id),
      ...twins,
      ...bodies.map(body => body.id),
    ].flatMap(id => (names.has(id) ? [names.get(id)!] : []))
  );
  for (const label of labels) {
    if (redrawn.has(drawnText(label.element))) consume(label);
  }

  return drawn;
}
