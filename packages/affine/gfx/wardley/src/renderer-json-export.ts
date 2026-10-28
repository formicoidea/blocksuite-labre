import { Bound } from '@labre/global/gfx';

import { WARDLEY_BACKGROUND } from './background.js';
import { matchLabels, owmDefaultPlot, owmPlotOf } from './export.js';
import { WARDLEY_NATURE_TAG_ID } from './natures.js';
import { HANDLE_SIZE, PIPELINE_HEIGHT } from './node/consts.js';
import {
  type WardleyArtefactKind,
  wardleyLabelBoxFor,
  WARDLEY_NODE_SIZE,
  wardleyNodeProps,
} from './presets.js';
import {
  type Box,
  descriptionSlot,
  EVOLVE_TYPES,
  isDefaultLabelOffset,
  isRangeShape,
  type JsonComponentKind,
  jsonDecoratorCentre,
  jsonLabelOffset,
  jsonLabelUnshift,
  jsonStepCentre,
  LABRE_NATURES,
  methodOf,
  relationOf,
  rendererColourName,
  rendererCoordsOf,
  round3,
  sameColour,
} from './renderer-json.js';
import { WARDLEY_ROLE } from './roles.js';

/**
 * A Wardley board as a `@formicoidea/wardley-map-renderer` JSON map — the
 * inverse of `renderer-json-import.ts` (ADR 0012, amendment of 2026-10-28).
 *
 * ## What it reads: what the canvas shows, and nothing stored
 *
 * No foreign id and no foreign field rides on any element, so this writer
 * reads what is VISIBLE and recognises each piece by what it is:
 *
 * - a component is a Wardley node of a component kind, its type its `kind`,
 *   its place its centre on the first map's plot, its nature the
 *   `wardley:nature` tag, its colour its stroke, its method the method node's
 *   colours (`methodOf`);
 * - its name, description, step dot and range bar are found in its GROUP
 *   first (the reader puts them there), by what they are: the text with the
 *   `wardley:label` role, a plain text, a plain ellipse holding a number, a
 *   thin plain rect. Ungrouped, each is looked for in its slot;
 * - a climate arrow is a decorator of the component whose slot it sits in; an
 *   inertia bar on an evolution arrow is that evolution's inertia; an arrow's
 *   label, when it is a renderer evolution type, is its `evolveType`;
 * - a dependency link's colour and width say its relation type, its words
 *   the flow's label;
 * - the plain text right above the map is the title, the one right under it
 *   the context; the map's own labels and toggles are its `renderConfig`.
 *
 * Ids are Labre's: a component's is the slug of its name (`paiement`,
 * `paiement-2`), a relation's `r1`… What the format has no word for, and a
 * free text or shape nobody claims, is left out with a warning.
 *
 * It needs no editor: it reads stored fields, never `instanceof`, so it runs
 * on live models and stored props alike and lives on `./interchange`.
 */

export interface WardleyJsonExportOptions {
  /** The page's title, written when no title text sits above the map. */
  name?: string;
}

/** What the writer reads of an element, live model or stored props. */
interface Element {
  id: string;
  type: string;
  role?: string;
  kind?: string;
  xywh?: string;
  elementBound?: Box;
  text?: unknown;
  textAlign?: unknown;
  shapeType?: unknown;
  fillColor?: unknown;
  strokeColor?: unknown;
  stroke?: unknown;
  strokeWidth?: unknown;
  strokeStyle?: unknown;
  tags?: unknown;
  children?: unknown;
  childIds?: unknown;
  source?: { id?: string; position?: unknown };
  target?: { id?: string; position?: unknown };
  [field: string]: unknown;
}

type Json = Record<string, unknown>;

/** How far a piece may sit from its slot and still belong to the node. */
const SLOT_TOLERANCE = 24;
/** How far an inertia bar may sit off an evolution arrow and still be on it. */
const ARROW_TOLERANCE = 12;
/** How far above or under the map a title or a context may sit. */
const MARGIN_REACH = 120;

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

  /* ── What is on the board ─────────────────────────────────────────── */

  const nodes = elements.filter(
    e => e.type === 'wardleyNode' && e.role !== undefined
  );
  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const labels = elements.filter(
    e => e.type === 'text' && e.role === WARDLEY_ROLE.label
  );
  const plainTexts = elements.filter(
    e => e.type === 'text' && e.role === undefined
  );
  const plainShapes = elements.filter(
    e => e.type === 'shape' && e.role === undefined
  );
  const connectors = elements.filter(e => e.type === 'connector');
  const bars = elements.filter(e => e.role === WARDLEY_ROLE.inertia);
  const groups = elements.filter(e => e.type === 'group');
  const byId = new Map(elements.map(e => [e.id, e]));

  const written = nodes.filter(
    n => COMPONENT_KINDS.includes(n.kind ?? '') || n.kind === 'pipeline'
  );
  const pipelines = written.filter(n => n.kind === 'pipeline');
  const climate = nodes.filter(
    n => n.kind === 'accelerator' || n.kind === 'decelerator'
  );
  const handles = nodes.filter(n => n.kind === 'handle');
  const claimed = new Set<Element>();

  /* ── Title and context: the plain texts just above and under the map ─ */

  let title: string | undefined;
  let mapContext: string | undefined;
  if (map) {
    const box = boxOf(map);
    const beside = (text: Element) => {
      const b = boxOf(text);
      return b.x < box.x + box.w && b.x + b.w > box.x;
    };
    const above = nearest(
      plainTexts.filter(t => beside(t) && boxOf(t).y + boxOf(t).h <= box.y + 1),
      t => box.y - (boxOf(t).y + boxOf(t).h)
    );
    if (above && above.distance <= MARGIN_REACH) {
      title = textOf(above.item);
      claimed.add(above.item);
    }
    const under = nearest(
      plainTexts.filter(t => beside(t) && boxOf(t).y >= box.y + box.h - 1),
      t => boxOf(t).y - (box.y + box.h)
    );
    if (under && under.distance <= MARGIN_REACH) {
      mapContext = textOf(under.item);
      claimed.add(under.item);
    }
  }

  /* ── The pipeline a handle sits on: astride its body's top edge ───── */

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

  /* ── A component's own pieces: its group first ────────────────────── */

  const parentOf = new Map<string, Element>();
  for (const group of groups) {
    for (const child of childIdsOf(group)) {
      if (!parentOf.has(child)) parentOf.set(child, group);
    }
  }
  /** Everything in the node's group, when that group is the node's own. */
  const ownGroup = (node: Element): Element[] => {
    const group = parentOf.get(node.id);
    if (!group) return [];
    const members: Element[] = [];
    const walk = (g: Element) => {
      for (const id of childIdsOf(g)) {
        const child = byId.get(id);
        if (!child) continue;
        if (child.type === 'group') walk(child);
        else members.push(child);
      }
    };
    walk(group);
    // A group a user made around several components is not one component's.
    const artefacts = members.filter(
      m =>
        m.type === 'wardleyNode' && m.role !== undefined && m.kind !== 'handle'
    );
    return artefacts.length === 1 ? members : [];
  };

  interface Pieces {
    label?: Element;
    description?: Element;
    step?: Element;
    range?: Element;
  }
  const piecesOf = new Map<string, Pieces>();
  for (const node of [...written, ...climate]) {
    const pieces: Pieces = {};
    for (const member of ownGroup(node)) {
      if (member === node || claimed.has(member)) continue;
      if (member.type === 'text' && member.role === WARDLEY_ROLE.label) {
        pieces.label ??= member;
      } else if (member.type === 'text' && member.role === undefined) {
        pieces.description ??= member;
      } else if (isStep(member)) {
        pieces.step ??= member;
      } else if (isRange(member)) {
        pieces.range ??= member;
      } else continue;
      claimed.add(member);
    }
    piecesOf.set(node.id, pieces);
  }

  /* ── Names left ungrouped: by place ───────────────────────────────── */

  for (const pipeline of pipelines) {
    const pieces = piecesOf.get(pipeline.id)!;
    if (pieces.label) continue;
    const slot = pipelineLabelSlot(pipeline, handleOf.get(pipeline.id));
    const found = nearest(
      labels.filter(l => !claimed.has(l)),
      l => Math.hypot(boxOf(l).x - slot.x, boxOf(l).y - slot.y)
    );
    if (found && found.distance <= SLOT_TOLERANCE) {
      pieces.label = found.item;
      claimed.add(found.item);
    }
  }
  const unnamedNodes = [...written, ...climate].filter(
    n => n.kind !== 'pipeline' && !piecesOf.get(n.id)?.label
  );
  const freeLabels = labels.filter(l => !claimed.has(l));
  const matched = matchLabels(
    unnamedNodes.map(node => ({
      id: node.id,
      kind: node.kind ?? '',
      role: node.role,
      elementBound: boxOf(node),
    })),
    // The matcher answers with each label's text; handing it the label's id
    // as its text gets the element back.
    freeLabels.map(label => ({ text: label.id, elementBound: boxOf(label) }))
  );
  for (const [nodeId, labelId] of matched) {
    const label = byId.get(labelId);
    if (!label) continue;
    piecesOf.get(nodeId)!.label = label;
    claimed.add(label);
  }

  /* ── The other pieces left ungrouped: by place ────────────────────── */

  for (const node of written) {
    if (node.kind === 'pipeline') continue;
    const pieces = piecesOf.get(node.id)!;
    const c = centreOf(boxOf(node));
    const kind = node.kind as JsonComponentKind;
    if (!pieces.description && pieces.label) {
      const slot = descriptionSlot(boxOf(pieces.label));
      const found = nearest(
        plainTexts.filter(t => !claimed.has(t)),
        t => Math.hypot(boxOf(t).x - slot.x, boxOf(t).y - slot.y)
      );
      if (found && found.distance <= SLOT_TOLERANCE / 2) {
        pieces.description = found.item;
        claimed.add(found.item);
      }
    }
    if (!pieces.step) {
      const slot = jsonStepCentre(kind, c.x, c.y);
      const found = nearest(
        plainShapes.filter(s => !claimed.has(s) && isStep(s)),
        s => distanceTo(centreOf(boxOf(s)), slot)
      );
      if (found && found.distance <= SLOT_TOLERANCE / 2) {
        pieces.step = found.item;
        claimed.add(found.item);
      }
    }
    if (!pieces.range) {
      const found = plainShapes.find(s => {
        if (claimed.has(s) || !isRange(s)) return false;
        const b = boxOf(s);
        return (
          Math.abs(b.y + b.h / 2 - c.y) <= 2 && b.x <= c.x && c.x <= b.x + b.w
        );
      });
      if (found) {
        pieces.range = found;
        claimed.add(found);
      }
    }
  }

  /* ── Ids: Labre's, minted from the names ──────────────────────────── */

  const nameOf = (node: Element) => {
    const label = piecesOf.get(node.id)?.label;
    return label ? textOf(label) : '';
  };
  const used = new Set<string>();
  const idOf = new Map<string, string>();
  for (const node of written) {
    const stem = slug(nameOf(node)) || node.id;
    let id = stem;
    for (let n = 2; used.has(id); n += 1) id = `${stem}-${n}`;
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
    evolveType?: string;
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
    const label = textOf(connector).trim().toLowerCase();
    const evolveType = EVOLVE_TYPES.find(type => type === label);
    arrows.push({
      from,
      start: centreOf(boxOf(sourceNode)),
      end,
      ...(evolveType === undefined ? {} : { evolveType }),
      inertia: false,
    });
  }

  /* ── Decorators: which slot each one is in ────────────────────────── */

  const decorated = new Map<string, Set<string>>();
  let looseClimate = 0;
  for (const arrow of climate) {
    const which = arrow.kind as 'accelerator' | 'decelerator';
    const at = centreOf(boxOf(arrow));
    const owner = nearest(
      written.filter(n => n.kind !== 'pipeline'),
      node => {
        const c = centreOf(boxOf(node));
        const slot = jsonDecoratorCentre(
          node.kind as JsonComponentKind,
          which,
          c.x,
          c.y
        );
        return distanceTo(at, slot);
      }
    );
    if (owner && owner.distance <= SLOT_TOLERANCE) {
      const set = decorated.get(owner.item.id) ?? new Set<string>();
      set.add(which === 'accelerator' ? 'accelerator' : 'deaccelerator');
      decorated.set(owner.item.id, set);
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
    } else looseBars += 1;
  }

  /* ── Components ───────────────────────────────────────────────────── */

  let clamped = 0;
  const clamp = (value: number) => {
    const bounded = Math.min(1, Math.max(0, value));
    if (round3(bounded) !== round3(value)) clamped += 1;
    return round3(bounded);
  };
  const coords = (x: number, y: number) => {
    const { evolution, visibility } = rendererCoordsOf(plot, x, y);
    return { evolution: clamp(evolution), visibility: clamp(visibility) };
  };

  const unnamed: string[] = [];
  const unqualified: string[] = [];
  const components: Json[] = written.map(node => {
    const id = idOf.get(node.id)!;
    const pieces = piecesOf.get(node.id)!;
    const name = nameOf(node);
    if (name.length === 0) unnamed.push(id);
    const box = boxOf(node);
    const centre = centreOf(box);
    const at = coords(centre.x, centre.y);
    const kind = node.kind ?? 'component';
    const out: Json = { id, label: { name } };

    /* The name's offset, when it is not where the toolbar puts it. */
    if (pieces.label) {
      const offset =
        kind === 'pipeline'
          ? pipelineLabelOffset(plot, node, handleOf.get(node.id), pieces.label)
          : jsonLabelOffset(
              plot,
              WARDLEY_NODE_SIZE[kind as WardleyArtefactKind].w,
              centre.x,
              centre.y,
              boxOf(pieces.label),
              pieces.label.textAlign
            );
      if (!isDefaultLabelOffset(offset)) {
        (out.label as Json).position = offset;
      }
    }

    /* Type, subtype, nature. */
    const nature = natureOf(node);
    if (kind === 'anchor') out.type = 'anchor';
    else if (kind === 'pipeline') out.type = 'pipeline';
    else out.type = 'component';
    if (kind === 'market' || kind === 'ecosystem') out.subtype = kind;
    if (nature !== undefined) {
      // The renderer accepts these four natures on a `functional` component
      // only, so the subtype is written with them.
      if (kind === 'component' || kind === 'method') {
        out.subtype = 'functional';
        out.nature = nature;
      } else unqualified.push(id);
    }

    out.position = {
      evolution: { scalar: at.evolution },
      visibility: { scalar: at.visibility },
    };
    if (pieces.range) {
      const r = boxOf(pieces.range);
      (out.position as Json).evolution = {
        scalar: at.evolution,
        range: [coords(r.x, r.y).evolution, coords(r.x + r.w, r.y).evolution],
      };
    }
    if (pieces.description) {
      const text = textOf(pieces.description);
      if (text.trim()) out.description = text;
    }

    const evolutions = arrows
      .filter(arrow => arrow.from === node)
      .map(arrow => {
        const target = coords(arrow.end.x, arrow.end.y);
        return {
          position: {
            evolution: { scalar: target.evolution },
            visibility: { scalar: target.visibility },
          },
          ...(arrow.evolveType === undefined
            ? {}
            : { evolveType: arrow.evolveType }),
          ...(arrow.inertia ? { inertia: true } : {}),
        };
      });
    if (evolutions.length > 0) out.evolvesTo = evolutions;

    if (kind === 'pipeline') {
      const topLeft = coords(box.x, box.y);
      const bottomRight = coords(box.x + box.w, box.y + box.h);
      const handle = handleOf.get(node.id);
      const handleEvolution = handle
        ? coords(centreOf(boxOf(handle)).x, box.y).evolution
        : undefined;
      const middle = round3((topLeft.evolution + bottomRight.evolution) / 2);
      out.pipelineGeometry = {
        evoStart: topLeft.evolution,
        evoEnd: bottomRight.evolution,
        visStart: topLeft.visibility,
        visEnd: bottomRight.visibility,
        ...(handleEvolution !== undefined && handleEvolution !== middle
          ? { handleEvolution }
          : {}),
      };
    }

    if (kind === 'method') {
      // ponytail: read from the node's colours until the method node gains
      // real method parameters (`feat/wardley-method-nature`). A method the
      // colours do not name is still a method, with no recommendation.
      out.method = methodOf(node) ?? {
        category: 'buying-policy',
        recommendation: '',
      };
    } else {
      const colour = colourOf(node);
      if (colour !== undefined) out.color = colour;
    }
    for (const flag of decorated.get(node.id) ?? []) out[flag] = true;
    if (pieces.step) {
      const number = Number.parseInt(textOf(pieces.step), 10);
      const fill = pieces.step.fillColor;
      out.step = {
        number,
        ...(typeof fill === 'string' && !sameColour(fill, '#cc0000')
          ? { color: rendererColourName(fill) }
          : {}),
      };
    }
    return out;
  });

  /* ── Relations ────────────────────────────────────────────────────── */

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
    const { type, style } = relationOf(connector);
    const label = textOf(connector).trim();
    relations.push({
      id: `r${relations.length + 1}`,
      consumer: idOf.get(consumer.id)!,
      supplier: idOf.get(supplier.id)!,
      type,
      // The renderer's `flow` needs a label, so a style alone is not written.
      ...(label.length > 0
        ? { flow: { label, ...(style === undefined ? {} : { style }) } }
        : {}),
    });
  }

  /* ── The document ─────────────────────────────────────────────────── */

  const renderConfig = map ? renderConfigOf(map) : undefined;
  const document: Json = {
    title: title ?? options.name?.trim() ?? '',
    ...(mapContext === undefined ? {} : { context: mapContext }),
    components,
    relations,
    ...(renderConfig === undefined ? {} : { renderConfig }),
  };

  /* ── What the format could not say ───────────────────────────────── */

  const count = (n: number, one: string, many: string) =>
    `${n} ${n === 1 ? one : many}`;
  if (unnamed.length > 0) {
    warnings.push(
      `${count(unnamed.length, 'component has', 'components have')} no name on the map and ${unnamed.length === 1 ? 'was' : 'were'} written with an empty one: ${unnamed.slice(0, 5).join(', ')}.`
    );
  }
  if (unqualified.length > 0) {
    warnings.push(
      `The renderer gives a nature to a plain component only, so the nature of ${unqualified.slice(0, 5).join(', ')} was not written.`
    );
  }
  if (clamped > 0) {
    warnings.push(
      `${count(clamped, 'coordinate falls', 'coordinates fall')} outside the map's plot and ${clamped === 1 ? 'was' : 'were'} written at its edge: the renderer reads 0…1 only.`
    );
  }
  for (const [kind, what] of [
    ['porter', "Porter's forces glyph"],
    ['area', 'area'],
  ] as const) {
    const n = nodes.filter(node => node.kind === kind).length;
    if (n > 0) {
      warnings.push(
        `${count(n, what, `${what}s`)} could not be written: the renderer JSON has no word for ${n === 1 ? 'it' : 'them'}.`
      );
    }
  }
  const strays = map
    ? [...plainTexts, ...plainShapes].filter(
        e => !claimed.has(e) && inside(centreOf(boxOf(e)), boxOf(map))
      ).length
    : 0;
  if (strays > 0) {
    warnings.push(
      `${count(strays, 'free text or shape', 'free texts or shapes')} on the map belong to no component, so ${strays === 1 ? 'it was' : 'they were'} not written.`
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
      `${count(looseClimate, 'accelerator or decelerator sits', 'accelerators or decelerators sit')} beside no component, and the renderer draws one only on a component, so ${looseClimate === 1 ? 'it was' : 'they were'} left out.`
    );
  }
  if (looseBars > 0) {
    warnings.push(
      `${count(looseBars, 'inertia bar sits', 'inertia bars sit')} on no evolution arrow, so ${looseBars === 1 ? 'it was' : 'they were'} left out.`
    );
  }

  const text = JSON.stringify(document, null, 2) + '\n';
  return { text, warnings };
}

/* ── What the map says of itself ──────────────────────────────────────── */

/** The map's own labels and toggles, as the `renderConfig` that sets them. */
function renderConfigOf(map: Element): Json | undefined {
  const display: Json = {};
  if (map.showXAxis === false) display.axisEvolution = false;
  if (map.showYAxis === false) display.axisValueChain = false;
  if (map.showColumnDividers === false && map.showColumnLabels === false) {
    display.phases = false;
  }
  const background: Json = {};
  const axis = (text: unknown) =>
    typeof text === 'string' ? { default: { label: { text } } } : undefined;
  const x = axis(map.xAxisTitle);
  const y = axis(map.yAxisTitle);
  if (x) background.axisEvolution = x;
  if (y) background.axisValueChain = y;
  const phases = [0, 1, 2, 3].map(index => map[`phase${index}`]);
  let last = -1;
  phases.forEach((text, index) => {
    if (typeof text === 'string') last = index;
  });
  if (last >= 0) {
    background.phases = {
      default: {
        labels: phases
          .slice(0, last + 1)
          .map(text => (typeof text === 'string' ? { text } : {})),
      },
    };
  }
  const config: Json = {};
  if (Object.keys(display).length > 0) config.display = display;
  if (Object.keys(background).length > 0) config.style = { background };
  return Object.keys(config).length > 0 ? config : undefined;
}

/* ── A node's parameters ──────────────────────────────────────────────── */

/** The `wardley:nature` value a node carries, if it is one of the four. */
function natureOf(node: Element): string | undefined {
  const tags = node.tags as
    | { get?: (key: string) => unknown; [key: string]: unknown }
    | undefined;
  if (!tags) return undefined;
  const values =
    typeof tags.get === 'function'
      ? tags.get(WARDLEY_NATURE_TAG_ID)
      : tags[WARDLEY_NATURE_TAG_ID];
  if (!Array.isArray(values)) return undefined;
  const prefix = `${WARDLEY_NATURE_TAG_ID}/`;
  return LABRE_NATURES.find(nature => values.includes(`${prefix}${nature}`));
}

/** The renderer `color` of a node: its stroke, unless it is the toolbar's. */
function colourOf(node: Element): string | undefined {
  const stroke = node.strokeColor;
  if (typeof stroke !== 'string' || !stroke.startsWith('#')) return undefined;
  const preset = wardleyNodeProps(node.kind as WardleyArtefactKind, {
    xywh: '[0,0,0,0]',
  }).strokeColor;
  return sameColour(stroke, preset) ? undefined : rendererColourName(stroke);
}

/** A pipeline's name slot: centred above its handle, as the toolbar writes it. */
function pipelineLabelSlot(pipeline: Element, handle: Element | undefined) {
  const body = boxOf(pipeline);
  const cx = handle ? centreOf(boxOf(handle)).x : body.x + body.w / 2;
  return wardleyLabelBoxFor('pipeline', cx, body.y + PIPELINE_HEIGHT / 2);
}

function pipelineLabelOffset(
  plot: ReturnType<typeof owmPlotOf>,
  pipeline: Element,
  handle: Element | undefined,
  label: Element
) {
  const slot = pipelineLabelSlot(pipeline, handle);
  const box = boxOf(label);
  return jsonLabelUnshift(plot, { x: box.x - slot.x, y: box.y - slot.y });
}

const isStep = (element: Element) =>
  element.type === 'shape' &&
  element.role === undefined &&
  element.shapeType === 'ellipse' &&
  /^\d+$/.test(textOf(element).trim());

const isRange = (element: Element) =>
  element.type === 'shape' &&
  element.role === undefined &&
  isRangeShape(element.shapeType, boxOf(element));

/** A name of the renderer's id alphabet: lower case, ascii, dashes. */
function slug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/* ── The pieces ───────────────────────────────────────────────────────── */

/** A group's member ids, from a live model (`childIds`) or stored props. */
function childIdsOf(group: Element): string[] {
  if (Array.isArray(group.childIds)) return group.childIds as string[];
  const children = group.children as
    | { keys?: () => Iterable<string> }
    | Record<string, unknown>
    | undefined;
  if (!children) return [];
  if (typeof children.keys === 'function') {
    return [...(children.keys as () => Iterable<string>)()];
  }
  return Object.keys(children);
}

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

const distanceTo = (
  a: { x: number; y: number },
  b: { cx: number; cy: number }
) => Math.hypot(a.x - b.cx, a.y - b.cy);

const inside = (point: { x: number; y: number }, box: Box) =>
  point.x >= box.x &&
  point.x <= box.x + box.w &&
  point.y >= box.y &&
  point.y <= box.y + box.h;

/** A text's words, whether a `Y.Text` or a plain string. */
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
