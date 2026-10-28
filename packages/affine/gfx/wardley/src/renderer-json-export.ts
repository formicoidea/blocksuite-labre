import { Bound } from '@labre/global/gfx';
import type { ForeignInterchange } from '@labre/std/gfx';

import { WARDLEY_BACKGROUND } from './background.js';
import { matchLabels, owmDefaultPlot, owmPlotOf } from './export.js';
import { HANDLE_SIZE, PIPELINE_HEIGHT } from './node/consts.js';
import {
  type WardleyArtefactKind,
  wardleyLabelBoxFor,
  wardleyNodeProps,
} from './presets.js';
import {
  JSON_ATTR,
  JSON_SCOPE,
  type JsonComponentKind,
  jsonCarriedOf,
  jsonDecoratorCentre,
  jsonInertiaCentre,
  rendererColour,
  rendererCoordsOf,
  round3,
  sameColour,
} from './renderer-json.js';
import { WARDLEY_ROLE } from './roles.js';

/**
 * A Wardley board as a `@formicoidea/wardley-map-renderer` JSON map — the
 * inverse of `renderer-json-import.ts` (ADR 0012, amendment of 2026-10-28).
 *
 * ## Structural, so it needs no editor
 *
 * The OWM writer picks its artefacts by `instanceof` (`export-board.ts`),
 * which loads the element classes; this one reads what every element holds
 * whatever it is — `type`, `role`, `kind`, its box, its text, its two ends,
 * its `interchange` — so it runs on live models and on stored props alike, and
 * lives on the `./interchange` entry beside its reader.
 *
 * ## What comes back
 *
 * Each component from the board: its id (`interchange.json.id`, or the
 * element's own when the file gave none or two elements claim one), the name
 * beside it, its type from the node's kind, its centre on the first map's
 * plot to three decimals (the renderer's rounding), its decorators from the
 * climate arrows and inertia bars in their slots, its evolutions from the
 * change arrows leaving it. Every field the reader carried is merged back
 * UNDER what the board says, so a field the board draws always wins. A
 * relation is a dependency, consumer first. What the board holds and the
 * format has no word for is a warning, never a silent drop.
 *
 * A coordinate is clamped to 0…1, because the renderer refuses anything else
 * and this file is written to be rendered; the warning names what was off.
 */

export interface WardleyJsonExportOptions {
  /** The board's title, used when the map came from no file that had one. */
  name?: string;
}

/** What the writer reads of an element, live model or stored props. */
interface Element {
  id: string;
  type: string;
  role?: string;
  kind?: string;
  xywh?: string;
  elementBound?: { x: number; y: number; w: number; h: number };
  text?: unknown;
  strokeColor?: unknown;
  source?: { id?: string; position?: unknown };
  target?: { id?: string; position?: unknown };
  interchange?: Record<string, ForeignInterchange>;
}

type Json = Record<string, unknown>;
type Box = { x: number; y: number; w: number; h: number };

/** How far a decorator may sit from its slot and still belong to the node. */
const SLOT_TOLERANCE = 24;
/** How far an inertia bar may sit off an evolution arrow and still be on it. */
const ARROW_TOLERANCE = 12;

const COMPONENT_KINDS: readonly string[] = [
  'anchor',
  'component',
  'method',
  'market',
  'ecosystem',
];

export function exportWardleyRendererJson(
  input: readonly unknown[],
  options: WardleyJsonExportOptions = {}
): { text: string; warnings: string[] } {
  const elements = input as readonly Element[];
  const warnings: string[] = [];

  /* ── The map ──────────────────────────────────────────────────────── */

  const maps = elements.filter(e => e.type === WARDLEY_BACKGROUND.type);
  const map = maps[0];
  if (maps.length > 1) {
    warnings.push(
      `This board holds ${maps.length} Wardley maps and a renderer map is one. Everything was measured against the first map in the document.`
    );
  }
  if (!map) {
    warnings.push(
      'No Wardley map background was found, so coordinates were read against a default map at the origin.'
    );
  }
  const plot = map ? owmPlotOf(boxOf(map)) : owmDefaultPlot();
  const mapCarried = map ? jsonCarriedOf(map) : undefined;
  const documentAttrs = mapCarried?.attrs?.[JSON_SCOPE.document];
  const named = options.name?.trim() ? options.name : undefined;
  const fileTitle = documentAttrs?.[JSON_ATTR.title];
  // The file's title wins over the caller's name, as OWM's does (D3): record
  // what the file said, never what the host happens to call the page.
  const title = fileTitle ?? named ?? '';
  const documentRest = parsed(documentAttrs?.[JSON_ATTR.rest]) ?? {};

  /* ── The artefacts ────────────────────────────────────────────────── */

  const nodes = elements.filter(
    e => e.type === 'wardleyNode' && e.role !== undefined
  );
  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const labels = elements.filter(
    e => e.type === 'text' && e.role === WARDLEY_ROLE.label
  );
  const connectors = elements.filter(e => e.type === 'connector');
  const bars = elements.filter(e => e.role === WARDLEY_ROLE.inertia);

  const components = nodes.filter(n => COMPONENT_KINDS.includes(n.kind ?? ''));
  const pipelines = nodes.filter(n => n.kind === 'pipeline');
  const climate = nodes.filter(
    n => n.kind === 'accelerator' || n.kind === 'decelerator'
  );
  const handles = nodes.filter(n => n.kind === 'handle');
  const written = nodes.filter(
    n => COMPONENT_KINDS.includes(n.kind ?? '') || n.kind === 'pipeline'
  );

  /** The pipeline a handle sits on: astride its body's top edge. */
  const ownerOfHandle = new Map<string, Element>();
  const handleOf = new Map<string, Element>();
  for (const handle of handles) {
    const h = centreOf(boxOf(handle));
    const body = pipelines.find(p => {
      const b = boxOf(p);
      return (
        h.x >= b.x - 1 &&
        h.x <= b.x + b.w + 1 &&
        Math.abs(h.y - b.y) <= HANDLE_SIZE / 2 + 1
      );
    });
    if (body && !handleOf.has(body.id)) {
      ownerOfHandle.set(handle.id, body);
      handleOf.set(body.id, handle);
    }
  }

  /* ── Names ────────────────────────────────────────────────────────── */

  const taken = new Set<Element>();
  const nameOf = new Map<string, string>();
  for (const pipeline of pipelines) {
    // A pipeline's name sits above its HANDLE, which is where the toolbar
    // writes it; the body may be any width, so the shared matcher, which
    // predicts from the body, would look in the wrong place.
    const body = boxOf(pipeline);
    const handle = handleOf.get(pipeline.id);
    const cx = handle ? centreOf(boxOf(handle)).x : body.x + body.w / 2;
    const slot = wardleyLabelBoxFor(
      'pipeline',
      cx,
      body.y + PIPELINE_HEIGHT / 2
    );
    let best: { label: Element; distance: number } | undefined;
    for (const label of labels) {
      if (taken.has(label)) continue;
      const b = boxOf(label);
      const distance = Math.hypot(b.x - slot.x, b.y - slot.y);
      if (distance <= SLOT_TOLERANCE && (!best || distance < best.distance)) {
        best = { label, distance };
      }
    }
    if (best) {
      taken.add(best.label);
      nameOf.set(pipeline.id, textOf(best.label));
    }
  }
  const matched = matchLabels(
    [...components, ...climate].map(node => ({
      id: node.id,
      kind: node.kind ?? '',
      role: node.role,
      elementBound: boxOf(node),
    })),
    labels
      .filter(label => !taken.has(label))
      .map(label => ({ text: textOf(label), elementBound: boxOf(label) }))
  );
  for (const [id, name] of matched) nameOf.set(id, name);

  /* ── Ids: the file's, unless two elements claim one ───────────────── */

  const used = new Set<string>();
  const idOf = new Map<string, string>();
  for (const node of written) {
    const carried = jsonCarriedOf(node)?.id;
    let id = carried && !used.has(carried) ? carried : node.id;
    for (let n = 2; used.has(id); n += 1) id = `${node.id}-${n}`;
    used.add(id);
    idOf.set(node.id, id);
  }

  /** The component an edge end names: a node, or the pipeline of a handle. */
  const componentAt = (end: Element['source']): Element | undefined => {
    const node = end?.id === undefined ? undefined : nodeById.get(end.id);
    if (!node) return undefined;
    if (node.kind === 'handle') return ownerOfHandle.get(node.id);
    return idOf.has(node.id) ? node : undefined;
  };

  /* ── Evolutions ───────────────────────────────────────────────────── */

  interface Arrow {
    from: Element;
    start: { x: number; y: number };
    end: { x: number; y: number };
    rest: Json;
    inertia: boolean;
  }
  const arrows: Arrow[] = [];
  let looseArrows = 0;
  for (const connector of connectors) {
    if (connector.role !== WARDLEY_ROLE.changeArrow) continue;
    const from = componentAt(connector.source);
    const sourceNode =
      connector.source?.id === undefined
        ? undefined
        : nodeById.get(connector.source.id);
    const end = pointOf(connector.target, nodeById);
    if (!from || !sourceNode || !end) {
      looseArrows += 1;
      continue;
    }
    arrows.push({
      from,
      start: centreOf(boxOf(sourceNode)),
      end,
      rest: selfRest(connector),
      inertia: false,
    });
  }

  /* ── Decorators: whose slot is each one in ────────────────────────── */

  const decorated = new Map<string, Set<string>>();
  const flag = (node: Element, what: string) => {
    const set = decorated.get(node.id) ?? new Set<string>();
    set.add(what);
    decorated.set(node.id, set);
  };
  let looseClimate = 0;
  for (const arrow of climate) {
    const which = arrow.kind as 'accelerator' | 'decelerator';
    const at = centreOf(boxOf(arrow));
    const owner = nearest(components, node => {
      const c = centreOf(boxOf(node));
      const slot = jsonDecoratorCentre(
        node.kind as JsonComponentKind,
        which,
        c.x,
        c.y
      );
      return Math.hypot(at.x - slot.cx, at.y - slot.cy);
    });
    if (owner && owner.distance <= SLOT_TOLERANCE) {
      flag(
        owner.item,
        which === 'accelerator' ? 'accelerator' : 'deaccelerator'
      );
    } else looseClimate += 1;
  }
  let looseBars = 0;
  for (const bar of bars) {
    const at = centreOf(boxOf(bar));
    const onArrow = nearest(arrows, arrow =>
      segmentDistance(at, arrow.start, arrow.end)
    );
    if (onArrow && onArrow.distance <= ARROW_TOLERANCE) {
      onArrow.item.inertia = true;
      continue;
    }
    const owner = nearest(components, node => {
      const c = centreOf(boxOf(node));
      const slot = jsonInertiaCentre(node.kind as JsonComponentKind, c.x, c.y);
      return Math.hypot(at.x - slot.cx, at.y - slot.cy);
    });
    if (owner && owner.distance <= SLOT_TOLERANCE) flag(owner.item, 'inertia');
    else looseBars += 1;
  }

  /* ── Components ───────────────────────────────────────────────────── */

  let clamped = 0;
  const coords = (x: number, y: number) => {
    const { evolution, visibility } = rendererCoordsOf(plot, x, y);
    const clamp = (value: number) => {
      const bounded = Math.min(1, Math.max(0, value));
      if (round3(bounded) !== round3(value)) clamped += 1;
      return round3(bounded);
    };
    return { evolution: clamp(evolution), visibility: clamp(visibility) };
  };

  const unnamed: string[] = [];
  const out: Json[] = written.map(node => {
    const id = idOf.get(node.id)!;
    const self = jsonCarriedOf(node)?.attrs?.[JSON_SCOPE.self] ?? {};
    const rest = parsed(self[JSON_ATTR.rest]) ?? {};
    const carriedEvolutions = Array.isArray(rest.evolvesTo)
      ? rest.evolvesTo
      : [];
    delete rest.evolvesTo;
    const name = nameOf.get(node.id) ?? '';
    if (name.length === 0) unnamed.push(id);
    const subtype = parsedValue(self[JSON_ATTR.subtype]);
    const box = boxOf(node);
    const centre = coords(box.x + box.w / 2, box.y + box.h / 2);

    const mapped: Json = {
      id,
      label: { name },
      ...typeOf(node.kind ?? '', subtype),
      position: {
        evolution: { scalar: centre.evolution },
        visibility: { scalar: centre.visibility },
      },
    };
    if (node.kind === 'pipeline') {
      const topLeft = coords(box.x, box.y);
      const bottomRight = coords(box.x + box.w, box.y + box.h);
      const handle = handleOf.get(node.id);
      const handleEvolution = handle
        ? coords(centreOf(boxOf(handle)).x, box.y).evolution
        : undefined;
      const middle = round3((topLeft.evolution + bottomRight.evolution) / 2);
      mapped.pipelineGeometry = {
        evoStart: topLeft.evolution,
        evoEnd: bottomRight.evolution,
        visStart: topLeft.visibility,
        visEnd: bottomRight.visibility,
        ...(handleEvolution !== undefined &&
        (handleEvolution !== middle || self[JSON_ATTR.handle] === 'true')
          ? { handleEvolution }
          : {}),
      };
    }
    const colour = colourOf(node, parsedValue(self[JSON_ATTR.color]));
    if (colour !== undefined) mapped.color = colour;
    const method = parsedValue(self[JSON_ATTR.method]);
    if (node.kind === 'method') {
      // A method drawn here says there IS one, not which: what the file named
      // comes back, and a method placed from the toolbar is a buying policy,
      // which is what Labre's build / buy / outsource is.
      mapped.method = method ?? {
        category: 'buying-policy',
        recommendation: '',
      };
    } else if (method !== undefined && node.kind !== 'component') {
      // A pipeline, a market, an ecosystem or an anchor has no method item to
      // be drawn as, so the file's method rides along; a plain COMPONENT is
      // one somebody turned out of a method, and the method goes with it.
      mapped.method = method;
    }
    for (const what of decorated.get(node.id) ?? []) mapped[what] = true;
    const evolutions = arrows
      .filter(arrow => arrow.from === node)
      .map(arrow => {
        const target = coords(arrow.end.x, arrow.end.y);
        return ordered(
          merge(arrow.rest, {
            position: {
              evolution: { scalar: target.evolution },
              visibility: { scalar: target.visibility },
            },
            ...(arrow.inertia ? { inertia: true } : {}),
          }),
          ['position', 'evolveType', 'inertia']
        );
      });
    if (evolutions.length + carriedEvolutions.length > 0) {
      mapped.evolvesTo = [...evolutions, ...carriedEvolutions];
    }
    return ordered(merge(rest, mapped), COMPONENT_ORDER);
  });

  /* ── Relations ────────────────────────────────────────────────────── */

  const relationIds = new Set<string>();
  let looseLinks = 0;
  const relations: Json[] = [];
  for (const connector of connectors) {
    if (connector.role !== WARDLEY_ROLE.dependency) continue;
    const consumer = componentAt(connector.source);
    const supplier = componentAt(connector.target);
    if (!consumer || !supplier) {
      looseLinks += 1;
      continue;
    }
    const rest = selfRest(connector);
    const carried = jsonCarriedOf(connector)?.id;
    let id = carried && !relationIds.has(carried) ? carried : connector.id;
    for (let n = 2; relationIds.has(id); n += 1) id = `${connector.id}-${n}`;
    relationIds.add(id);
    const label = textOf(connector).trim();
    // The words on the link are the flow's label; a link whose words were
    // removed carries no flow any more, whatever style the file gave it.
    if (label.length === 0) delete rest.flow;
    relations.push(
      ordered(
        merge(rest, {
          id,
          consumer: idOf.get(consumer.id)!,
          supplier: idOf.get(supplier.id)!,
          type: typeof rest.type === 'string' ? rest.type : 'DependsOn',
          ...(label.length > 0 ? { flow: { label } } : {}),
        }),
        ['id', 'consumer', 'supplier', 'type', 'flow']
      )
    );
  }

  /* ── What the reader could not draw, back verbatim ───────────────── */

  const carriedOf = (scope: string) =>
    (mapCarried?.children?.[scope] ?? []).flatMap(text => {
      const value = parsedValue(text);
      return value === undefined ? [] : [value];
    });

  const document = ordered(
    {
      ...documentRest,
      title,
      components: [...out, ...carriedOf(JSON_SCOPE.components)],
      relations: [...relations, ...carriedOf(JSON_SCOPE.relations)],
    },
    ['title', 'context', 'components', 'relations', 'renderConfig']
  );

  /* ── What the format could not say ───────────────────────────────── */

  const count = (n: number, one: string, many: string) =>
    `${n} ${n === 1 ? one : many}`;
  if (fileTitle !== undefined && named !== undefined && fileTitle !== named) {
    warnings.push(
      `This map came from a file titled "${fileTitle}", and that is the title written out, not "${named}".`
    );
  }
  if (unnamed.length > 0) {
    warnings.push(
      `${count(unnamed.length, 'component has', 'components have')} no name on the map and ${unnamed.length === 1 ? 'was' : 'were'} written with an empty one: ${unnamed.slice(0, 5).join(', ')}.`
    );
  }
  if (clamped > 0) {
    warnings.push(
      `${count(clamped, 'coordinate falls', 'coordinates fall')} outside the map's plot and ${clamped === 1 ? 'was' : 'were'} written at its edge: the renderer reads 0…1 only.`
    );
  }
  const porters = nodes.filter(n => n.kind === 'porter').length;
  if (porters > 0) {
    warnings.push(
      `${count(porters, "Porter's forces glyph", "Porter's forces glyphs")} could not be written: the renderer JSON has no word for one.`
    );
  }
  const areas = nodes.filter(n => n.kind === 'area').length;
  if (areas > 0) {
    warnings.push(
      `${count(areas, 'area', 'areas')} could not be written: the renderer JSON has no word for a zone of the map.`
    );
  }
  const notes = map
    ? elements.filter(
        e =>
          e.type === 'text' &&
          e.role === undefined &&
          inside(centreOf(boxOf(e)), boxOf(map))
      ).length
    : 0;
  if (notes > 0) {
    warnings.push(
      `${count(notes, 'free text', 'free texts')} on the map could not be written: the renderer JSON has no note.`
    );
  }
  if (looseLinks > 0) {
    warnings.push(
      `${count(looseLinks, 'link has an end', 'links have ends')} that is loose or not on a component, so ${looseLinks === 1 ? 'it was' : 'they were'} left out.`
    );
  }
  if (looseArrows > 0) {
    warnings.push(
      `${count(looseArrows, 'evolution arrow does', 'evolution arrows do')} not leave a component, so ${looseArrows === 1 ? 'it was' : 'they were'} left out.`
    );
  }
  if (looseClimate > 0) {
    warnings.push(
      `${count(looseClimate, 'accelerator or decelerator sits', 'accelerators or decelerators sit')} under no component, and the renderer draws one only on a component, so ${looseClimate === 1 ? 'it was' : 'they were'} left out.`
    );
  }
  if (looseBars > 0) {
    warnings.push(
      `${count(looseBars, 'inertia bar sits', 'inertia bars sit')} on no evolution arrow and beside no component, so ${looseBars === 1 ? 'it was' : 'they were'} left out.`
    );
  }

  const text = JSON.stringify(document, null, 2) + '\n';
  return { text, warnings };
}

/* ── What a component is, in the renderer's words ─────────────────────── */

const COMPONENT_ORDER = [
  'id',
  'label',
  'type',
  'subtype',
  'nature',
  'position',
  'description',
  'evolvesTo',
  'pipelineGeometry',
  'color',
  'method',
  'inertia',
  'accelerator',
  'deaccelerator',
  'step',
];

/**
 * `type` and `subtype` from the node's kind. A market or an ecosystem IS its
 * subtype; a component or a method keeps the one the file gave it unless that
 * one named a kind the node no longer is; an anchor has none.
 */
function typeOf(kind: string, carried: unknown): Json {
  switch (kind) {
    case 'anchor':
      return { type: 'anchor' };
    case 'market':
    case 'ecosystem':
      return { type: 'component', subtype: kind };
    case 'pipeline':
      return {
        type: 'pipeline',
        ...(carried === undefined ? {} : { subtype: carried }),
      };
    default:
      return carried === undefined ||
        carried === 'market' ||
        carried === 'ecosystem'
        ? { type: 'component' }
        : { type: 'component', subtype: carried };
  }
}

/**
 * The renderer `color` of a node: the file's own word while the board still
 * paints it, the stroke's hex once somebody changed it, nothing while the
 * node keeps the toolbar's stroke.
 */
function colourOf(node: Element, carried: unknown): string | undefined {
  const stroke = node.strokeColor;
  const preset = wardleyNodeProps(node.kind as WardleyArtefactKind, {
    xywh: '[0,0,0,0]',
  }).strokeColor;
  if (typeof carried === 'string') {
    const painted = rendererColour(carried);
    if (painted ? sameColour(stroke, painted) : sameColour(stroke, preset)) {
      return carried;
    }
  }
  if (typeof stroke === 'string' && stroke.startsWith('#')) {
    return sameColour(stroke, preset) ? undefined : stroke;
  }
  return undefined;
}

/* ── The pieces ───────────────────────────────────────────────────────── */

function boxOf(element: Element): Box {
  if (element.elementBound) {
    const { x, y, w, h } = element.elementBound;
    return { x, y, w, h };
  }
  if (typeof element.xywh === 'string') {
    const { x, y, w, h } = Bound.deserialize(element.xywh);
    return { x, y, w, h };
  }
  return { x: 0, y: 0, w: 0, h: 0 };
}

const centreOf = (box: Box) => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 });

const inside = (point: { x: number; y: number }, box: Box) =>
  point.x >= box.x &&
  point.x <= box.x + box.w &&
  point.y >= box.y &&
  point.y <= box.y + box.h;

/** A text element's words, whether a `Y.Text` or a plain string. */
function textOf(element: { text?: unknown }): string {
  const text = element.text;
  return text === undefined || text === null ? '' : String(text);
}

/** Where an edge end is: the centre of the node it names, or its free point. */
function pointOf(
  end: Element['target'],
  nodeById: ReadonlyMap<string, Element>
): { x: number; y: number } | undefined {
  if (end?.id !== undefined) {
    const node = nodeById.get(end.id);
    return node ? centreOf(boxOf(node)) : undefined;
  }
  const position = end?.position;
  if (
    Array.isArray(position) &&
    typeof position[0] === 'number' &&
    typeof position[1] === 'number'
  ) {
    return { x: position[0], y: position[1] };
  }
  return undefined;
}

function nearest<T>(
  items: readonly T[],
  distance: (item: T) => number
): { item: T; distance: number } | undefined {
  let best: { item: T; distance: number } | undefined;
  for (const item of items) {
    const d = distance(item);
    if (!best || d < best.distance) best = { item, distance: d };
  }
  return best;
}

/** The distance from `p` to the segment `a`–`b`. */
function segmentDistance(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t =
    length === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)
        );
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** The carried `rest` of an element's own payload, as an object. */
function selfRest(element: Element): Json {
  return (
    parsed(
      jsonCarriedOf(element)?.attrs?.[JSON_SCOPE.self]?.[JSON_ATTR.rest]
    ) ?? {}
  );
}

function parsedValue(text: string | undefined): unknown {
  if (text === undefined) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** A carried JSON object, or `undefined` when there is none. */
function parsed(text: string | undefined): Json | undefined {
  const value = parsedValue(text);
  return isRecord(value) ? value : undefined;
}

const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** `over` laid over `under`, object by object; `over` wins everywhere else. */
function merge(under: unknown, over: Json): Json {
  const base: Json = isRecord(under) ? { ...under } : {};
  for (const [key, value] of Object.entries(over)) {
    base[key] =
      isRecord(value) && isRecord(base[key]) ? merge(base[key], value) : value;
  }
  return base;
}

/** The same object, its known keys first in the renderer's own order. */
function ordered(value: Json, order: readonly string[]): Json {
  const out: Json = {};
  for (const key of order) if (key in value) out[key] = value[key];
  for (const [key, field] of Object.entries(value)) {
    if (!(key in out)) out[key] = field;
  }
  return out;
}
