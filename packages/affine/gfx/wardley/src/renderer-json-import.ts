import type {
  InterchangeImportContext,
  InterchangeImportResult,
  InterchangeNote,
  SerializedElementProps,
} from '@labre/affine-block-surface/interchange';
import type { ForeignInterchange } from '@labre/std/gfx';

import { owmDefaultPlot } from './export.js';
import { INERTIA_SIZE, PIPELINE_WIDTH } from './node/consts.js';
import { WARDLEY_NODE_SIZE } from './presets.js';
import {
  JSON_ATTR,
  JSON_SCOPE,
  type JsonComponentKind,
  jsonDecoratorCentre,
  jsonInertiaCentre,
  jsonPayload,
  rendererColour,
  rendererPointOf,
} from './renderer-json.js';
import {
  wardleyChangeArrowElement,
  wardleyDependencyElement,
  wardleyInertiaElement,
  wardleyMapElement,
  wardleyMarketElements,
  wardleyNodeElements,
  wardleyPipelineElements,
} from './toolbox.js';

/**
 * The renderer JSON reader's remarks whose wording is FIXED, as
 * `[key, English]` pairs — the shape and the reason of
 * `WARDLEY_OWM_IMPORT_REMARKS`: a reader has no `std`, so it hands the key
 * over and `reportInterchangeImport` resolves it. Contributed to the
 * manifest by `./translations.ts`.
 */
export const WARDLEY_JSON_IMPORT_REMARKS = {
  notJson: [
    'com.labre.wardley.import.json.remark.not-json',
    'This file is not JSON, so nothing was read from it.',
  ],
  notAMap: [
    'com.labre.wardley.import.json.remark.not-a-map',
    'This JSON is not a wardley-map-renderer map: it has no `components` list, so nothing was read from it.',
  ],
  invalidComponent: [
    'com.labre.wardley.import.json.remark.invalid-component',
    'this component lacks an id, a name, a type or a numeric position, so it was not drawn. It is kept verbatim and written back on the next export.',
  ],
  invalidRelation: [
    'com.labre.wardley.import.json.remark.invalid-relation',
    'a relation lacks its consumer or its supplier, so it was not drawn. It is kept verbatim and written back on the next export.',
  ],
  undeclaredEnd: [
    'com.labre.wardley.import.json.remark.undeclared-end',
    'a relation names this, and no component of the file has this id. The relation is kept verbatim and written back on the next export, but not drawn.',
  ],
  duplicateId: [
    'com.labre.wardley.import.json.remark.duplicate-id',
    'this id is used by more than one component. Both are on the map, and every relation naming it means the first.',
  ],
  invalidEvolution: [
    'com.labre.wardley.import.json.remark.invalid-evolution',
    'an evolution of this component has no numeric target position, so it was not drawn. It is kept and written back on the next export.',
  ],
  outOfRange: [
    'com.labre.wardley.import.json.remark.out-of-range',
    'its position falls outside 0…1, so it is drawn off the map’s plot.',
  ],
  noGeometry: [
    'com.labre.wardley.import.json.remark.no-geometry',
    'this pipeline has no usable `pipelineGeometry`, so it was drawn at the toolbar’s size around its position. The file did not say how wide it is.',
  ],
  carriedField: [
    'com.labre.wardley.import.json.remark.carried-field',
    '{{count}} `{{kind}}` field(s) kept on the map and written back on the next export. Nothing on this canvas draws them.',
  ],
} as const satisfies Record<string, readonly [key: string, english: string]>;

const R = WARDLEY_JSON_IMPORT_REMARKS;

/**
 * A `@formicoidea/wardley-map-renderer` JSON map, read as a Wardley map made
 * of the TOOLBAR's own artefacts (ADR 0012 P3, ADR 0045).
 *
 * ## Why the toolbox, and not the OWM reader's layout
 *
 * The OWM reader draws its own composites (a wider label, a larger anchor,
 * no group) and draws an `evolve` as a second component plus an arrow. A
 * map read that way and handed to a model to edit came back from the
 * connector's bench with a duplicate component at the target of every
 * evolution, a pipeline named twice with its square centred, and the source's
 * squares and colours gone. Every element here is a `WARDLEY_TOOLBOX`
 * builder's, so a map read from JSON is made of exactly what a user places
 * from the toolbar, and nothing else.
 *
 * ## An evolution is an arrow to a point, never a twin
 *
 * The renderer draws `evolvesTo` as an arrow and no second node, and the
 * toolbar's Arrow tool, dragged from a component and dropped on the empty
 * map, leaves exactly that: the change-arrow connector with a free end
 * (`ConnectorTool.dragEnd` keeps `target: { position }`). So each target is
 * that connector, built by `wardleyChangeArrowElement` and given the point.
 *
 * ## The mapping (field → what draws it), and the loss table
 *
 * | renderer field                                  | on the board                                                        |
 * | ----------------------------------------------- | ------------------------------------------------------------------- |
 * | `type: anchor`                                  | the `anchor` item                                                   |
 * | `type: component`                               | the `component` item; with a `method`, the `method` item            |
 * | `subtype: market` / `ecosystem`                 | the `market` / `ecosystem` item                                     |
 * | `type: pipeline` + `pipelineGeometry`           | the `pipeline` item, its body stretched to the geometry, its handle at `handleEvolution` |
 * | `id`                                            | `interchange.json.id` on the node, given back on export             |
 * | `label.name`                                    | the name the toolbar writes beside the node                         |
 * | `position.evolution` / `visibility` `.scalar`   | the node's centre on the map's plot, to three decimals              |
 * | `evolvesTo[].position`                          | a `change-arrow` from the node to that point                        |
 * | `evolvesTo[].inertia`                           | an `inertia` bar at the arrow's midpoint                            |
 * | `inertia`                                       | an `inertia` bar right of the node's name                           |
 * | `accelerator` / `deaccelerator`                 | the `accelerator` / `decelerator` item under the node               |
 * | `color` (a renderer name or `#hex`)             | the node's stroke                                                   |
 * | `relations[]` (`consumer` → `supplier`)         | a `dependency`, consumer first (ADR 0010); `flow.label` its text    |
 * | `title`                                         | the board's name, kept on the map and written back                  |
 * | `label.position`, `nature`, `description`, `step`, `subtype` (other), `method.category` / `recommendation`, `position.evolution.range`, `evolvesTo[].evolveType`, relation `type` (Flow, Constraint) and `flow.style`, `context`, `renderConfig`, any unknown field | **carried**: kept on the element (`interchange.json`) and written back, not drawn |
 * | a component, relation or evolution this reader cannot draw (missing id, name, type or number; an undeclared end) | **carried** whole on the map and written back, with a warning |
 * | `accelerator` / `deaccelerator` / `inertia` on a pipeline                 | **carried**: the toolbar has no place for them on a pipeline |
 * | `false` for `inertia`, `accelerator`, `deaccelerator`                      | **lost**: written back absent, which the renderer reads the same |
 * | a pipeline's own `position`                                                | **lost**: the renderer draws the geometry, and the writer gives back the body's centre |
 *
 * Nothing is quarantined: every carried field is a statement of its own
 * that the drawing cannot contradict.
 *
 * ## A bad document is a report
 *
 * Text that is not JSON, or JSON with no `components` list, comes back as an
 * empty import whose report says why — never as an exception from inside
 * the reader.
 */
export function importWardleyRendererJson(
  source: string,
  context: InterchangeImportContext = {}
): InterchangeImportResult {
  let root: unknown;
  try {
    root = JSON.parse(source);
  } catch {
    return refused(R.notJson);
  }
  if (!isRecord(root) || !Array.isArray(root.components)) {
    return refused(R.notAMap);
  }

  const notes: InterchangeNote[] = [];
  const carriedKinds = new Map<string, number>();
  const carryKinds = (paths: readonly string[]) => {
    for (const path of paths) {
      carriedKinds.set(path, (carriedKinds.get(path) ?? 0) + 1);
    }
  };
  const warn = (
    [key, message]: readonly [string, string],
    sourceId?: string,
    element?: string
  ) =>
    notes.push({
      kind: 'warning',
      messageKey: key,
      message,
      ...(sourceId === undefined ? {} : { sourceId }),
      ...(element === undefined ? {} : { element }),
    });

  /* ── The document ─────────────────────────────────────────────────── */

  const titled = typeof root.title === 'string';
  const title = titled
    ? (root.title as string)
    : context.name?.replace(/\.json$/i, '').trim() || undefined;
  const documentRest = Object.fromEntries(
    Object.entries(root).filter(
      ([key]) => !['title', 'components', 'relations'].includes(key)
    )
  );
  const relations: unknown[] = Array.isArray(root.relations)
    ? root.relations
    : [];
  if (root.relations !== undefined && !Array.isArray(root.relations)) {
    documentRest.relations = root.relations;
  }
  carryKinds(Object.keys(documentRest));
  const carriedComponents: string[] = [];
  const carriedRelations: string[] = [];

  /* ── Components: which are drawable, and under which local name ───── */

  const components: Drawable[] = [];
  const byId = new Map<string, Drawable>();
  const seen = new Map<string, number>();
  for (const raw of root.components as unknown[]) {
    const component = drawable(raw);
    if (!component) {
      carriedComponents.push(JSON.stringify(raw));
      warn(
        R.invalidComponent,
        isRecord(raw) && typeof raw.id === 'string' ? raw.id : undefined,
        'component'
      );
      continue;
    }
    const count = (seen.get(component.id) ?? 0) + 1;
    seen.set(component.id, count);
    if (count > 1) warn(R.duplicateId, component.id, 'component');
    // A second component under one id gets a local name of its own, so its
    // group and its arrows still find IT; relations naming the id mean the
    // first, which is the materializer's rule and the renderer's lookup.
    component.local = count === 1 ? component.id : `${component.id}#${count}`;
    components.push(component);
    if (!byId.has(component.id)) byId.set(component.id, component);
  }

  /* ── Laying out ───────────────────────────────────────────────────── */

  const plot = owmDefaultPlot();
  const elements: SerializedElementProps[] = [];
  const map = wardleyMapElement('classic', { x: 0, y: 0 });
  const mapPayload: ForeignInterchange = {};
  const documentAttrs: Record<string, string> = {};
  if (title !== undefined) documentAttrs[JSON_ATTR.title] = title;
  if (Object.keys(documentRest).length > 0) {
    documentAttrs[JSON_ATTR.rest] = JSON.stringify(documentRest);
  }
  if (Object.keys(documentAttrs).length > 0) {
    mapPayload.attrs = { [JSON_SCOPE.document]: documentAttrs };
  }
  elements.push(map);

  const nodes: SerializedElementProps[] = [];
  const decorations: SerializedElementProps[] = [];
  const arrows: SerializedElementProps[] = [];
  let mappedArrows = 0;

  // Pipelines first: a body is drawn under the components it holds.
  const ordered = [
    ...components.filter(c => c.kind === 'pipeline'),
    ...components.filter(c => c.kind !== 'pipeline'),
  ];
  for (const component of ordered) {
    const { evolution, visibility } = component;
    if ([evolution, visibility].some(value => value < 0 || value > 1)) {
      warn(R.outOfRange, component.id, component.raw.type as string);
    }
    const [cx, cy] = rendererPointOf(plot, evolution, visibility);
    const { payload, carried } = componentPayload(component);
    carryKinds(carried);

    if (component.kind === 'pipeline') {
      const built = pipelineOf(component, plot, cx, cy, () =>
        notes.push({
          kind: 'invented-layout',
          sourceId: component.id,
          element: 'pipeline',
          messageKey: R.noGeometry[0],
          message: R.noGeometry[1],
        })
      );
      decorate(built, `${component.local}:node`, payload, component.stroke);
      nodes.push(...built);
      const handle = boxCentre(byLocal(built, `${component.local}:handle`));
      component.end = `${component.local}:handle`;
      component.at = handle;
    } else {
      const kind = component.kind;
      const { w, h } = WARDLEY_NODE_SIZE[kind];
      const at = { x: cx - w / 2, y: cy - h / 2 };
      const name = component.name;
      const built =
        kind === 'market'
          ? wardleyMarketElements(at, name, component.local)
          : wardleyNodeElements(kind, at, name, component.local);
      decorate(built, `${component.local}:node`, payload, component.stroke);
      nodes.push(...built);
      component.end = `${component.local}:node`;
      component.at = { x: cx, y: cy };

      for (const which of ['accelerator', 'decelerator'] as const) {
        const flag = which === 'accelerator' ? 'accelerator' : 'deaccelerator';
        if (component.raw[flag] !== true) continue;
        const centre = jsonDecoratorCentre(kind, which, cx, cy);
        const size = WARDLEY_NODE_SIZE[which];
        decorations.push(
          ...wardleyNodeElements(
            which,
            { x: centre.cx - size.w / 2, y: centre.cy - size.h / 2 },
            undefined,
            `${component.local}:${which}`
          )
        );
      }
      if (component.raw.inertia === true) {
        decorations.push(
          barAt(jsonInertiaCentre(kind, cx, cy), `${component.local}:inertia`)
        );
      }
    }

    /* Each evolution: the toolbar's arrow, dropped on the target point. */
    const from = component.at;
    component.evolutions.forEach((target, index) => {
      const [tx, ty] = rendererPointOf(
        plot,
        target.evolution,
        target.visibility
      );
      const self: Record<string, string> = {};
      if (Object.keys(target.rest).length > 0) {
        self[JSON_ATTR.rest] = JSON.stringify(target.rest);
        carryKinds(pathsOf(target.rest).map(path => `evolvesTo.${path}`));
      }
      arrows.push({
        ...wardleyChangeArrowElement(component.end, component.end),
        target: { position: [tx, ty] },
        ...withPayload({
          ...(Object.keys(self).length > 0
            ? { attrs: { [JSON_SCOPE.self]: self } }
            : {}),
        }),
      });
      mappedArrows += 1;
      if (target.inertia) {
        decorations.push(
          barAt(
            { cx: (from.x + tx) / 2, cy: (from.y + ty) / 2 },
            `${component.local}:evolve-${index + 1}:inertia`
          )
        );
      }
    });
    if (component.invalidEvolutions > 0) {
      warn(R.invalidEvolution, component.id, 'evolvesTo');
    }
  }

  /* ── Relations ────────────────────────────────────────────────────── */

  const links: SerializedElementProps[] = [];
  for (const raw of relations) {
    if (
      !isRecord(raw) ||
      typeof raw.consumer !== 'string' ||
      typeof raw.supplier !== 'string'
    ) {
      carriedRelations.push(JSON.stringify(raw));
      warn(R.invalidRelation, undefined, 'relation');
      continue;
    }
    const consumer = byId.get(raw.consumer);
    const supplier = byId.get(raw.supplier);
    if (!consumer || !supplier) {
      carriedRelations.push(JSON.stringify(raw));
      for (const end of [raw.consumer, raw.supplier]) {
        if (!byId.has(end)) warn(R.undeclaredEnd, end, 'relation');
      }
      continue;
    }
    const { label, rest } = relationParts(raw);
    carryKinds(pathsOf(rest).map(path => `relation.${path}`));
    links.push({
      // `consumer` is the one that depends, so it is the SOURCE: the verb of
      // `wardley:dependency` (ADR 0010), never inverted.
      ...wardleyDependencyElement(consumer.end, supplier.end, label),
      ...withPayload({
        ...(typeof raw.id === 'string' ? { id: raw.id } : {}),
        ...(Object.keys(rest).length > 0
          ? {
              attrs: {
                [JSON_SCOPE.self]: { [JSON_ATTR.rest]: JSON.stringify(rest) },
              },
            }
          : {}),
      }),
    });
  }

  /* ── What could not be drawn rides on the map, verbatim ──────────── */

  const children: Record<string, string[]> = {};
  if (carriedComponents.length > 0) {
    children[JSON_SCOPE.components] = carriedComponents;
  }
  if (carriedRelations.length > 0) {
    children[JSON_SCOPE.relations] = carriedRelations;
  }
  if (Object.keys(children).length > 0) mapPayload.children = children;
  Object.assign(map, withPayload(mapPayload));

  for (const [kind, count] of carriedKinds) {
    notes.push({
      kind: 'carried',
      element: kind,
      messageKey: R.carriedField[0],
      // Filled from the declared wording, so the sentence a host translates
      // and the one a host with no catalogue reads cannot drift apart.
      message: R.carriedField[1]
        .replace('{{count}}', String(count))
        .replace('{{kind}}', kind),
      messageParams: { count, kind },
    });
  }

  elements.push(...nodes, ...decorations, ...links, ...arrows);

  const carriedFields = [...carriedKinds.values()].reduce((a, b) => a + b, 0);
  return {
    elements,
    report: {
      mapped:
        (titled ? 1 : 0) + components.length + links.length + mappedArrows,
      carried:
        carriedFields + carriedComponents.length + carriedRelations.length,
      // Every carried field is a sentence of its own that the drawing cannot
      // contradict, so nothing needs keeping out of the next export (D5).
      quarantined: 0,
      notes,
    },
  };
}

/* ── The shape check ──────────────────────────────────────────────────── */

type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** A component this reader can draw, and where its pieces go. */
interface Drawable {
  raw: Json;
  id: string;
  name: string;
  kind: JsonComponentKind | 'pipeline';
  evolution: number;
  visibility: number;
  stroke?: string;
  evolutions: {
    evolution: number;
    visibility: number;
    inertia: boolean;
    rest: Json;
  }[];
  invalidEvolutions: number;
  /** The local name its pieces are built under. */
  local: string;
  /** The local id a connector attaches to: the node, or a pipeline's handle. */
  end: string;
  /** Where that end is, on the surface. */
  at: { x: number; y: number };
}

/** `raw` as a drawable component, or `undefined` when it is not one. */
function drawable(raw: unknown): Drawable | undefined {
  if (!isRecord(raw) || typeof raw.id !== 'string' || raw.id.length === 0) {
    return undefined;
  }
  const label = raw.label;
  if (!isRecord(label) || typeof label.name !== 'string') return undefined;
  const position = raw.position;
  if (!isRecord(position)) return undefined;
  const evolution = isRecord(position.evolution)
    ? position.evolution.scalar
    : undefined;
  const visibility = isRecord(position.visibility)
    ? position.visibility.scalar
    : undefined;
  if (!finite(evolution) || !finite(visibility)) return undefined;
  const kind = kindOf(raw);
  if (!kind) return undefined;

  const evolutions: Drawable['evolutions'] = [];
  let invalidEvolutions = 0;
  for (const entry of Array.isArray(raw.evolvesTo) ? raw.evolvesTo : []) {
    const target = targetOf(entry);
    if (target) evolutions.push(target);
    else invalidEvolutions += 1;
  }
  const stroke =
    typeof raw.color === 'string' ? rendererColour(raw.color) : undefined;
  return {
    raw,
    id: raw.id,
    name: label.name,
    kind,
    evolution,
    visibility,
    ...(stroke === undefined ? {} : { stroke }),
    evolutions,
    invalidEvolutions,
    local: raw.id,
    end: '',
    at: { x: 0, y: 0 },
  };
}

/** The toolbar item a component is drawn as, or `undefined` for a foreign type. */
function kindOf(raw: Json): Drawable['kind'] | undefined {
  switch (raw.type) {
    case 'anchor':
      return 'anchor';
    case 'pipeline':
      return 'pipeline';
    case 'component':
      if (raw.subtype === 'market') return 'market';
      if (raw.subtype === 'ecosystem') return 'ecosystem';
      return raw.method === undefined ? 'component' : 'method';
    default:
      return undefined;
  }
}

/** One `evolvesTo` entry as a target point, or `undefined` when it is not one. */
function targetOf(entry: unknown): Drawable['evolutions'][number] | undefined {
  if (!isRecord(entry) || !isRecord(entry.position)) return undefined;
  const { evolution, visibility } = entry.position;
  const e = isRecord(evolution) ? evolution.scalar : undefined;
  const v = isRecord(visibility) ? visibility.scalar : undefined;
  if (!finite(e) || !finite(v)) return undefined;
  const rest = clone(entry);
  removePath(rest, ['position', 'evolution', 'scalar']);
  removePath(rest, ['position', 'visibility', 'scalar']);
  if (typeof entry.inertia === 'boolean') delete rest.inertia;
  return { evolution: e, visibility: v, inertia: entry.inertia === true, rest };
}

/* ── What rides on a component's node ─────────────────────────────────── */

/**
 * The payload of a component's node, and the paths it carries.
 *
 * `rest` is the component minus every field the board draws, so the writer
 * merges what the board says over it and the file comes back whole. The
 * three fields the board draws only in part ride beside it on their own,
 * because the writer decides on them from the board: `subtype` (a market or
 * an ecosystem is the node's kind), `method` (the method item says there is
 * one, not which), `color` (the stroke, when the renderer can name it).
 */
function componentPayload(component: Drawable): {
  payload: ForeignInterchange;
  carried: string[];
} {
  const raw = component.raw;
  const pipeline = component.kind === 'pipeline';
  const rest = clone(raw);
  for (const key of ['id', 'type', 'evolvesTo', 'subtype', 'method', 'color']) {
    delete rest[key];
  }
  removePath(rest, ['label', 'name']);
  removePath(rest, ['position', 'evolution', 'scalar']);
  removePath(rest, ['position', 'visibility', 'scalar']);
  if (pipeline && geometryOf(raw)) {
    delete rest.pipelineGeometry;
    // The body is drawn from the geometry; the position of a pipeline with
    // one is not drawn by the renderer either, and comes back as its centre.
    delete rest.position;
  }
  if (!pipeline) {
    for (const flag of ['inertia', 'accelerator', 'deaccelerator']) {
      if (typeof raw[flag] === 'boolean') delete rest[flag];
    }
  }
  const invalid = (Array.isArray(raw.evolvesTo) ? raw.evolvesTo : []).filter(
    entry => !targetOf(entry)
  );
  if (invalid.length > 0) rest.evolvesTo = invalid;
  else if (raw.evolvesTo !== undefined && !Array.isArray(raw.evolvesTo)) {
    rest.evolvesTo = raw.evolvesTo;
  }

  const self: Record<string, string> = {};
  const carried = pathsOf(rest);
  if (Object.keys(rest).length > 0) self[JSON_ATTR.rest] = JSON.stringify(rest);
  // Whether the file named the handle itself, so the writer names it back
  // even where it sits at the middle, which is the renderer's default.
  if (pipeline && geometryOf(raw)?.handleEvolution !== undefined) {
    self[JSON_ATTR.handle] = 'true';
  }
  const drawnSubtype =
    component.kind === 'market' || component.kind === 'ecosystem';
  if (raw.subtype !== undefined) {
    self[JSON_ATTR.subtype] = JSON.stringify(raw.subtype);
    if (!drawnSubtype) carried.push('subtype');
  }
  if (raw.method !== undefined) {
    self[JSON_ATTR.method] = JSON.stringify(raw.method);
    carried.push('method');
  }
  if (raw.color !== undefined) {
    self[JSON_ATTR.color] = JSON.stringify(raw.color);
    if (component.stroke === undefined) carried.push('color');
  }
  return {
    payload: {
      id: component.id,
      ...(Object.keys(self).length > 0
        ? { attrs: { [JSON_SCOPE.self]: self } }
        : {}),
    },
    carried,
  };
}

/** A relation's drawn label, and every field the board does not draw. */
function relationParts(raw: Json): { label?: string; rest: Json } {
  const rest = clone(raw);
  for (const key of ['id', 'consumer', 'supplier']) delete rest[key];
  if (rest.type === 'DependsOn') delete rest.type;
  let label: string | undefined;
  if (isRecord(rest.flow) && typeof rest.flow.label === 'string') {
    label = rest.flow.label;
    delete rest.flow.label;
    if (Object.keys(rest.flow).length === 0) delete rest.flow;
  }
  return { ...(label === undefined ? {} : { label }), rest };
}

/* ── The pieces ───────────────────────────────────────────────────────── */

/** A usable `pipelineGeometry`, or `undefined`. */
function geometryOf(raw: Json):
  | {
      evoStart: number;
      evoEnd: number;
      visStart: number;
      visEnd: number;
      handleEvolution?: number;
    }
  | undefined {
  const geometry = raw.pipelineGeometry;
  if (!isRecord(geometry)) return undefined;
  const { evoStart, evoEnd, visStart, visEnd, handleEvolution } = geometry;
  if (![evoStart, evoEnd, visStart, visEnd].every(finite)) return undefined;
  if (handleEvolution !== undefined && !finite(handleEvolution))
    return undefined;
  return {
    evoStart: evoStart as number,
    evoEnd: evoEnd as number,
    visStart: visStart as number,
    visEnd: visEnd as number,
    ...(handleEvolution === undefined ? {} : { handleEvolution }),
  };
}

/**
 * The pipeline item, as the toolbar builds it, around the handle the file
 * places; its body then takes the geometry's box, the one gesture a user makes
 * after placing one. A pipeline with no usable geometry is the toolbar's item
 * centred on the component's position, and the report says so.
 */
function pipelineOf(
  component: Drawable,
  plot: ReturnType<typeof owmDefaultPlot>,
  cx: number,
  cy: number,
  onInvented: () => void
): SerializedElementProps[] {
  const geometry = geometryOf(component.raw);
  const { w, h } = WARDLEY_NODE_SIZE.pipeline;
  if (!geometry) {
    onInvented();
    return wardleyPipelineElements(
      { x: cx - w / 2, y: cy - h / 2 },
      component.name,
      component.local
    );
  }
  const [x1, y1] = rendererPointOf(plot, geometry.evoStart, geometry.visStart);
  const [x2, y2] = rendererPointOf(plot, geometry.evoEnd, geometry.visEnd);
  const left = Math.min(x1, x2);
  const top = Math.min(y1, y2);
  const width = Math.max(Math.abs(x2 - x1), 1);
  const height = Math.max(Math.abs(y2 - y1), 1);
  const [handleX] = rendererPointOf(
    plot,
    geometry.handleEvolution ?? (geometry.evoStart + geometry.evoEnd) / 2,
    0
  );
  const built = wardleyPipelineElements(
    { x: handleX - PIPELINE_WIDTH / 2, y: top },
    component.name,
    component.local
  );
  const body = byLocal(built, `${component.local}:node`);
  body.xywh = `[${left},${top},${width},${height}]`;
  return built;
}

/** The toolbar's inertia bar, centred on a point. */
function barAt(
  centre: { cx: number; cy: number },
  local: string
): SerializedElementProps {
  return wardleyInertiaElement(
    {
      x: centre.cx - INERTIA_SIZE.w / 2,
      y: centre.cy - INERTIA_SIZE.h / 2,
    },
    local
  );
}

/** Put a component's payload, and its colour, on the node a builder made. */
function decorate(
  built: SerializedElementProps[],
  nodeId: string,
  payload: ForeignInterchange,
  stroke: string | undefined
) {
  const node = byLocal(built, nodeId);
  Object.assign(node, withPayload(payload));
  if (stroke !== undefined) node.strokeColor = stroke;
}

function byLocal(
  built: SerializedElementProps[],
  id: string
): SerializedElementProps {
  const found = built.find(element => element.id === id);
  // The builders name their pieces; a missing one is this file's bug.
  if (!found) throw new Error(`toolbox built no ${id}`);
  return found;
}

function boxCentre(element: SerializedElementProps): { x: number; y: number } {
  const [x, y, w, h] = JSON.parse(String(element.xywh)) as number[];
  return { x: x + w / 2, y: y + h / 2 };
}

const withPayload = (payload: ForeignInterchange) => {
  const interchange = jsonPayload(payload);
  return interchange ? { interchange } : {};
};

/** The empty import a refusal is, with its one sentence. */
function refused([key, message]: readonly [
  string,
  string,
]): InterchangeImportResult {
  return {
    elements: [],
    report: {
      mapped: 0,
      carried: 0,
      quarantined: 0,
      notes: [{ kind: 'warning', messageKey: key, message }],
    },
  };
}

const clone = (value: Json): Json => JSON.parse(JSON.stringify(value)) as Json;

/** Delete a nested key, and every object the deletion leaves empty. */
function removePath(target: Json, path: readonly string[]) {
  const [head, ...tail] = path;
  if (head === undefined) return;
  if (tail.length === 0) {
    delete target[head];
    return;
  }
  const next = target[head];
  if (!isRecord(next)) return;
  removePath(next, tail);
  if (Object.keys(next).length === 0) delete target[head];
}

/**
 * The carried fields of a payload, named the way the report names them: a
 * key, or a dotted path through `label` and `position`, whose children are
 * fields in their own right (`label.position`, `position.evolution.range`).
 */
function pathsOf(rest: Json, prefix = ''): string[] {
  const nested: Record<string, readonly string[]> = {
    '': ['label', 'position'],
    'position.': ['evolution', 'visibility'],
  };
  return Object.entries(rest).flatMap(([key, value]) =>
    nested[prefix]?.includes(key) && isRecord(value)
      ? pathsOf(value, `${prefix}${key}.`)
      : [`${prefix}${key}`]
  );
}
