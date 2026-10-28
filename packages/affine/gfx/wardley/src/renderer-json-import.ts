import type {
  InterchangeImportContext,
  InterchangeImportResult,
  InterchangeNote,
  SerializedElementProps,
} from '@labre/affine-block-surface/interchange';

import { owmDefaultPlot } from './export.js';
import { INERTIA_SIZE, PIPELINE_WIDTH } from './node/consts.js';
import { WARDLEY_NATURE_TAG_ID } from './natures.js';
import { WARDLEY_NODE_SIZE } from './presets.js';
import {
  descriptionSlot,
  EVOLVE_TYPES,
  type JsonComponentKind,
  jsonContextElement,
  jsonDecoratorCentre,
  jsonDescriptionElement,
  jsonLabelBox,
  jsonLabelShift,
  jsonRangeElement,
  jsonStepCentre,
  jsonStepElement,
  jsonTitleElement,
  LABRE_NATURES,
  methodLook,
  PHASE_LINES,
  relationLook,
  type RelationType,
  rendererCanvasOf,
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
    'this component lacks an id, a name, a type or a numeric position, so it was not imported.',
  ],
  invalidRelation: [
    'com.labre.wardley.import.json.remark.invalid-relation',
    'a relation lacks its consumer or its supplier, so it was not imported.',
  ],
  undeclaredEnd: [
    'com.labre.wardley.import.json.remark.undeclared-end',
    'a relation names this, and no component of the file has this id, so the relation was not imported.',
  ],
  duplicateId: [
    'com.labre.wardley.import.json.remark.duplicate-id',
    'this id is used by more than one component. Both are on the map, and every relation naming it means the first.',
  ],
  invalidEvolution: [
    'com.labre.wardley.import.json.remark.invalid-evolution',
    'an evolution of this component has no numeric target position, so it was not imported.',
  ],
  outOfRange: [
    'com.labre.wardley.import.json.remark.out-of-range',
    'its position falls outside 0…1, so it is drawn off the map’s plot.',
  ],
  noGeometry: [
    'com.labre.wardley.import.json.remark.no-geometry',
    'this pipeline has no usable `pipelineGeometry`, so it was drawn at the toolbar’s size around its position. The file did not say how wide it is.',
  ],
  droppedField: [
    'com.labre.wardley.import.json.remark.dropped-field',
    '{{count}} `{{kind}}` field(s) have nothing on this canvas to show them, so they were not imported.',
  ],
} as const satisfies Record<string, readonly [key: string, english: string]>;

const R = WARDLEY_JSON_IMPORT_REMARKS;

/**
 * A `@formicoidea/wardley-map-renderer` JSON map, read as a Wardley map made
 * of what a user places from the TOOLBAR (ADR 0012 P3, ADR 0045, PO decisions
 * of 2026-10-28).
 *
 * ## Only what shows, made of the toolbar's own artefacts
 *
 * The OWM path the connector used drew a second component at the target of
 * every evolution, a pipeline's name twice with its square centred, and lost
 * the source's squares and colours (the connector's bench). Here every
 * Wardley element is a `WARDLEY_TOOLBOX` builder's, given its real
 * parameters; what the toolbox has no item for is a plain shape or a free
 * text, grouped with the component it belongs to; and what nothing can show
 * is dropped and named in the report. No id and no field of the file is
 * stored on any element.
 *
 * ## The mapping
 *
 * | renderer field                                   | on the canvas                                                                 |
 * | ------------------------------------------------ | ----------------------------------------------------------------------------- |
 * | `type` anchor / component / pipeline; `subtype` market / ecosystem; a `method` | the toolbox anchor, component, pipeline, market, ecosystem, method item |
 * | `subtype` userNeed / solution / supplier / functional | a plain component (the subtype has no look)                              |
 * | `label.name` / `label.position`                  | the toolbox name, moved by the offset (`jsonLabelBox`)                        |
 * | `position.*.scalar`                              | the node's centre on the plot (visibility 0 is the TOP)                       |
 * | `position.evolution.range`                       | a thin plain rect at the node's height, under it, in its group               |
 * | `nature` activity / data / practice / knowledge  | the `wardley:nature` tag; the other five are dropped                          |
 * | `description`                                    | a free text under the name, in the component's group                         |
 * | `color`                                          | the node's stroke (an unknown name paints black, as in the renderer)         |
 * | `method` (category, recommendation)              | the method item's colours (`methodLook`)                                      |
 * | `accelerator` / `deaccelerator`                  | the toolbox climate arrow beside the node, where the renderer draws it      |
 * | `step`                                           | a numbered plain dot at the node's upper left, in its group                  |
 * | `evolvesTo[].position` / `evolveType` / `inertia` | the toolbox change arrow to that point, `evolveType` as its label, an inertia item on each phase line it crosses (at its middle when it crosses none) |
 * | `pipelineGeometry`                               | the pipeline's body stretched to the box, its handle at `handleEvolution`    |
 * | `relations[]` and their `type`, `flow`           | the toolbox dependency link, consumer first; Flow blue and thicker, Constraint black and as thick; `flow.label` its text, `flow.style` its dash or double width |
 * | `title` / `context`                              | free texts above / under the map                                              |
 * | `renderConfig` axis and phase labels and toggles | the map's own fields                                                          |
 * | `id`s, component `inertia`, a pipeline's `position`, subtype / nature on a pipeline, the rest of `renderConfig`, unknown fields | **dropped**, named in the report |
 *
 * ## An evolution is an arrow to a point, never a twin
 *
 * The toolbar's Arrow tool, dragged from a component and dropped on the empty
 * map, leaves the change-arrow connector with a free end
 * (`ConnectorTool.dragEnd` keeps `target: { position }`), and the renderer
 * draws an evolution as an arrow and no second node. So it is that.
 *
 * ## A bad document is a report
 *
 * Text that is not JSON, or JSON with no `components` list, imports nothing
 * and the report says why; the reader never throws.
 */
export function importWardleyRendererJson(
  source: string,
  // The caller's name is no title: the map's name is the page's, and only a
  // title the file wrote becomes a text on the canvas.
  _context: InterchangeImportContext = {}
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
  const dropped = new Map<string, number>();
  const drop = (kind: string) =>
    dropped.set(kind, (dropped.get(kind) ?? 0) + 1);
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

  /* ── The map, its title and its context ───────────────────────────── */

  const plot = owmDefaultPlot();
  const canvas = rendererCanvasOf(root.renderConfig);
  const map = wardleyMapElement('classic', { x: 0, y: 0 });
  Object.assign(map, mapFieldsOf(root.renderConfig, drop));
  const mapBox = boxOf(map);
  const texts: SerializedElementProps[] = [];
  const display = isRecord(root.renderConfig)
    ? root.renderConfig.display
    : undefined;
  const titleShown = !isRecord(display) || display.title !== false;
  if (typeof root.title === 'string' && root.title.trim() && titleShown) {
    texts.push(jsonTitleElement(root.title, mapBox, 'title'));
  }
  if (typeof root.context === 'string' && root.context.trim()) {
    texts.push(jsonContextElement(root.context, mapBox, 'context'));
  }
  for (const key of Object.keys(root)) {
    if (!TOP_LEVEL.includes(key)) drop(key);
  }

  /* ── Components: which are drawable, and under which local name ───── */

  const components: Drawable[] = [];
  const byId = new Map<string, Drawable>();
  const seen = new Map<string, number>();
  for (const raw of root.components as unknown[]) {
    const component = drawable(raw);
    if (!component) {
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
    // group and its arrows still find IT; a relation naming the id means the
    // first.
    component.local = count === 1 ? component.id : `${component.id}#${count}`;
    components.push(component);
    if (!byId.has(component.id)) byId.set(component.id, component);
  }

  /* ── Laying out ───────────────────────────────────────────────────── */

  const pieces: SerializedElementProps[] = [];
  const decorations: SerializedElementProps[] = [];
  const arrows: SerializedElementProps[] = [];

  // Pipelines first: a body is drawn under the components it holds.
  const ordered = [
    ...components.filter(c => c.kind === 'pipeline'),
    ...components.filter(c => c.kind !== 'pipeline'),
  ];
  for (const component of ordered) {
    const { raw, evolution, visibility } = component;
    if ([evolution, visibility].some(value => value < 0 || value > 1)) {
      warn(R.outOfRange, component.id, String(raw.type));
    }
    for (const key of Object.keys(raw)) {
      if (!COMPONENT_FIELDS.includes(key)) drop(key);
    }
    const [cx, cy] = rendererPointOf(plot, evolution, visibility);
    const local = component.local;
    const extras: SerializedElementProps[] = [];
    const under: SerializedElementProps[] = [];
    let built: SerializedElementProps[];

    if (component.kind === 'pipeline') {
      for (const key of ['subtype', 'nature', 'method', 'step']) {
        if (raw[key] !== undefined) drop(`pipeline ${key}`);
      }
      for (const key of ['accelerator', 'deaccelerator', 'inertia']) {
        if (raw[key] === true) drop(`pipeline ${key}`);
      }
      built = pipelineOf(component, plot, cx, cy, () =>
        notes.push({
          kind: 'invented-layout',
          sourceId: component.id,
          element: 'pipeline',
          messageKey: R.noGeometry[0],
          message: R.noGeometry[1],
        })
      );
      const handle = centreOf(boxOf(byLocal(built, `${local}:handle`)));
      component.end = `${local}:handle`;
      component.at = handle;
      const label = byLocal(built, `${local}:label`);
      const offset = labelOffsetOf(raw);
      if (offset) {
        // A pipeline's name is centred above its handle; an offset moves it
        // by its difference from the renderer's default, as for any name.
        const box = boxOf(label);
        const shift = jsonLabelShift(plot, offset, canvas);
        label.xywh = boxString({
          ...box,
          x: box.x + shift.x,
          y: box.y + shift.y,
        });
      }
      if (typeof raw.description === 'string' && raw.description.trim()) {
        extras.push(
          jsonDescriptionElement(
            raw.description,
            descriptionSlot(boxOf(label)),
            `${local}:description`
          )
        );
      }
      if (raw.color !== undefined) {
        if (typeof raw.color === 'string') {
          byLocal(built, `${local}:node`).strokeColor = rendererColour(
            raw.color
          );
        } else drop('color');
      }
    } else {
      const kind = component.kind;
      const { w, h } = WARDLEY_NODE_SIZE[kind];
      const at = { x: cx - w / 2, y: cy - h / 2 };
      built =
        kind === 'market'
          ? wardleyMarketElements(at, component.name, local)
          : wardleyNodeElements(kind, at, component.name, local);
      const node = byLocal(built, `${local}:node`);
      const label = byLocal(built, `${local}:label`);
      component.end = `${local}:node`;
      component.at = { x: cx, y: cy };

      /* The name, where the file moved it. */
      const offset = labelOffsetOf(raw);
      if (offset) {
        const placed = jsonLabelBox(plot, w, cx, cy, offset, canvas);
        const box = boxOf(label);
        label.xywh = boxString({ ...box, x: placed.x, y: placed.y });
        label.textAlign = placed.textAlign;
      }

      /* The node's own parameters. */
      applyColour(component, node, drop);
      applyNature(raw, kind, node, drop);
      if (kind === 'method') applyMethod(raw.method, node, drop);
      else if (raw.method !== undefined) drop('method');
      if (raw.subtype !== undefined && !DRAWN_SUBTYPES.includes(raw.subtype)) {
        // userNeed, solution, supplier, functional: a plain component, which
        // is what each of them looks like here (PO, 2026-10-28).
        if (raw.subtype !== 'functional') drop('subtype');
      }
      if (raw.inertia === true) drop('inertia');

      /* What the toolbox has no item for: plain pieces in the group. */
      if (typeof raw.description === 'string' && raw.description.trim()) {
        extras.push(
          jsonDescriptionElement(
            raw.description,
            descriptionSlot(boxOf(label)),
            `${local}:description`
          )
        );
      }
      const step = stepOf(raw.step);
      if (step) {
        extras.push(
          jsonStepElement(
            jsonStepCentre(kind, cx, cy),
            step.number,
            step.color === undefined ? undefined : rendererColour(step.color),
            `${local}:step`
          )
        );
      } else if (raw.step !== undefined) drop('step');
      const range = rangeOf(raw);
      if (range) {
        const [left] = rendererPointOf(plot, range[0], visibility);
        const [right] = rendererPointOf(plot, range[1], visibility);
        under.push(jsonRangeElement(left, right, cy, `${local}:range`));
      }

      /* The climate arrows, where the renderer draws them. */
      for (const which of ['accelerator', 'decelerator'] as const) {
        const flag = which === 'accelerator' ? 'accelerator' : 'deaccelerator';
        if (raw[flag] !== true) continue;
        const centre = jsonDecoratorCentre(kind, which, cx, cy);
        const size = WARDLEY_NODE_SIZE[which];
        decorations.push(
          ...wardleyNodeElements(
            which,
            { x: centre.cx - size.w / 2, y: centre.cy - size.h / 2 },
            undefined,
            `${local}:${which}`
          )
        );
      }
    }
    pieces.push(...withExtras(built, `${local}:group`, under, extras));

    /* Each evolution: the toolbar's arrow, dropped on the target point. */
    const from = component.at;
    component.evolutions.forEach((target, index) => {
      const [tx, ty] = rendererPointOf(
        plot,
        target.evolution,
        target.visibility
      );
      arrows.push({
        ...wardleyChangeArrowElement(
          component.end,
          component.end,
          target.evolveType
        ),
        target: { position: [tx, ty] },
      });
      if (target.inertia) {
        inertiaCentres(
          plot,
          from,
          { x: tx, y: ty },
          component.evolution,
          target.evolution
        ).forEach((centre, n) =>
          decorations.push(
            barAt(centre, `${local}:evolve-${index + 1}:inertia-${n + 1}`)
          )
        );
      }
    });
    if (component.invalidEvolutions > 0) {
      warn(R.invalidEvolution, component.id, 'evolvesTo');
    }
  }

  /* ── Relations ────────────────────────────────────────────────────── */

  const relations: unknown[] = Array.isArray(root.relations)
    ? root.relations
    : [];
  const links: SerializedElementProps[] = [];
  for (const raw of relations) {
    if (
      !isRecord(raw) ||
      typeof raw.consumer !== 'string' ||
      typeof raw.supplier !== 'string'
    ) {
      warn(R.invalidRelation, undefined, 'relation');
      continue;
    }
    const consumer = byId.get(raw.consumer);
    const supplier = byId.get(raw.supplier);
    if (!consumer || !supplier) {
      for (const end of [raw.consumer, raw.supplier]) {
        if (!byId.has(end)) warn(R.undeclaredEnd, end, 'relation');
      }
      continue;
    }
    const type: RelationType =
      raw.type === 'Flow' || raw.type === 'Constraint' ? raw.type : 'DependsOn';
    const flow = isRecord(raw.flow) ? raw.flow : undefined;
    const label = typeof flow?.label === 'string' ? flow.label : undefined;
    links.push({
      // `consumer` is the one that depends, so it is the SOURCE: the verb of
      // `wardley:dependency` (ADR 0010), never inverted.
      ...wardleyDependencyElement(consumer.end, supplier.end, label),
      ...relationLook(type, flow?.style),
    });
  }

  for (const [kind, count] of dropped) {
    notes.push({
      kind: 'warning',
      element: kind,
      messageKey: R.droppedField[0],
      // Filled from the declared wording, so the sentence a host translates
      // and the one a host with no catalogue reads cannot drift apart.
      message: R.droppedField[1]
        .replace('{{count}}', String(count))
        .replace('{{kind}}', kind),
      messageParams: { count, kind },
    });
  }

  const elements = [
    map,
    ...pieces,
    ...decorations,
    ...links,
    ...arrows,
    ...texts,
  ];
  return {
    elements,
    report: {
      mapped: texts.length + components.length + links.length + arrows.length,
      // Nothing is kept that the canvas does not show (PO, 2026-10-28).
      carried: 0,
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

const TOP_LEVEL = [
  'title',
  'context',
  'components',
  'relations',
  'renderConfig',
];

/** The component fields something on the canvas shows (`id` and `position`
 *  place it; the pipeline's own position is dropped on its branch). */
const COMPONENT_FIELDS = [
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

const DRAWN_SUBTYPES: readonly unknown[] = ['market', 'ecosystem'];

/** A component this reader can draw, and where its pieces go. */
interface Drawable {
  raw: Json;
  id: string;
  name: string;
  kind: JsonComponentKind | 'pipeline';
  evolution: number;
  visibility: number;
  evolutions: {
    evolution: number;
    visibility: number;
    inertia: boolean;
    evolveType?: string;
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
  return {
    raw,
    id: raw.id,
    name: label.name,
    kind,
    evolution,
    visibility,
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
  const evolveType = EVOLVE_TYPES.find(type => type === entry.evolveType);
  return {
    evolution: e,
    visibility: v,
    inertia: entry.inertia === true,
    ...(evolveType === undefined ? {} : { evolveType }),
  };
}

const labelOffsetOf = (raw: Json) => {
  const position = isRecord(raw.label) ? raw.label.position : undefined;
  if (!isRecord(position) || !finite(position.dx) || !finite(position.dy)) {
    return undefined;
  }
  return { dx: position.dx, dy: position.dy };
};

const stepOf = (step: unknown) => {
  if (!isRecord(step) || !finite(step.number)) return undefined;
  return {
    number: step.number,
    ...(typeof step.color === 'string' ? { color: step.color } : {}),
  };
};

const rangeOf = (raw: Json): [number, number] | undefined => {
  const position = isRecord(raw.position) ? raw.position : undefined;
  const range = isRecord(position?.evolution)
    ? position.evolution.range
    : undefined;
  if (!Array.isArray(range) || !finite(range[0]) || !finite(range[1])) {
    return undefined;
  }
  return [range[0], range[1]];
};

/* ── A node's parameters ──────────────────────────────────────────────── */

function applyColour(
  component: Drawable,
  node: SerializedElementProps,
  drop: (kind: string) => void
) {
  const color = component.raw.color;
  if (color === undefined) return;
  // A method node's two colours ARE its method, so a `color` on one has no
  // paint left to take.
  if (typeof color !== 'string' || component.kind === 'method') {
    drop('color');
    return;
  }
  node.strokeColor = rendererColour(color);
}

function applyNature(
  raw: Json,
  kind: JsonComponentKind,
  node: SerializedElementProps,
  drop: (kind: string) => void
) {
  if (raw.nature === undefined) return;
  const nature = LABRE_NATURES.find(value => value === raw.nature);
  // The tag qualifies a component; an anchor has no nature here, and the
  // renderer's five other natures have no value (PO, 2026-10-28).
  if (nature === undefined || kind === 'anchor') {
    drop('nature');
    return;
  }
  node.tags = {
    [WARDLEY_NATURE_TAG_ID]: [`${WARDLEY_NATURE_TAG_ID}/${nature}`],
  };
}

/**
 * A method node's look for the file's `method`.
 *
 * ponytail: the colours stand in for the method until the method node gains
 * real method and nature parameters (`feat/wardley-method-nature`); then this
 * writes those, and `methodOf` on the export side reads them.
 */
function applyMethod(
  method: unknown,
  node: SerializedElementProps,
  drop: (kind: string) => void
) {
  const look = methodLook(method);
  if (look) Object.assign(node, look);
  else drop('method');
}

/** The map's own fields a `renderConfig` sets; the rest of it is dropped. */
function mapFieldsOf(
  config: unknown,
  drop: (kind: string) => void
): Record<string, unknown> {
  if (config === undefined) return {};
  if (!isRecord(config)) {
    drop('renderConfig');
    return {};
  }
  const out: Record<string, unknown> = {};
  let used = 0;
  const display = isRecord(config.display) ? config.display : {};
  if (display.axisEvolution === false) out.showXAxis = false;
  if (display.axisValueChain === false) out.showYAxis = false;
  if (display.phases === false) {
    out.showColumnDividers = false;
    out.showColumnLabels = false;
  }
  for (const key of ['axisEvolution', 'axisValueChain', 'phases', 'title']) {
    if (display[key] !== undefined) used += 1;
  }
  const background = isRecord(config.style)
    ? (config.style as Json).background
    : undefined;
  const facet = (name: string) => {
    const element = isRecord(background) ? background[name] : undefined;
    if (!isRecord(element)) return undefined;
    const pick = (side: unknown) => (isRecord(side) ? side : {});
    return { ...pick(element.default), ...pick(element.override) };
  };
  const axisText = (name: string) => {
    const label = facet(name)?.label;
    return isRecord(label) && typeof label.text === 'string'
      ? label.text
      : undefined;
  };
  const x = axisText('axisEvolution');
  const y = axisText('axisValueChain');
  if (x !== undefined) (out.xAxisTitle = x), (used += 1);
  if (y !== undefined) (out.yAxisTitle = y), (used += 1);
  const phases = facet('phases')?.labels;
  if (Array.isArray(phases)) {
    phases.slice(0, 4).forEach((label, index) => {
      if (isRecord(label) && typeof label.text === 'string') {
        out[`phase${index}`] = label.text;
        used += 1;
      }
    });
  }
  // The canvas size is read too: it is what a name's offset is measured on
  // (`rendererCanvasOf`).
  const style = isRecord(config.style) ? config.style : {};
  const canvas = isRecord(background) ? background.canvas : undefined;
  for (const element of [style.view, canvas]) {
    if (!isRecord(element)) continue;
    for (const side of [element.default, element.override]) {
      if (!isRecord(side)) continue;
      for (const key of ['width', 'height']) {
        if (side[key] !== undefined) used += 1;
      }
    }
  }
  if (leafCount(config) > used) drop('renderConfig');
  return out;
}

const leafCount = (value: unknown): number =>
  isRecord(value)
    ? Object.values(value).reduce<number>((n, v) => n + leafCount(v), 0)
    : Array.isArray(value)
      ? value.reduce<number>((n, v) => n + leafCount(v), 0)
      : 1;

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
  if (handleEvolution !== undefined && !finite(handleEvolution)) {
    return undefined;
  }
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
 * centred on the component's position, and the report says so. Its own
 * `position` places nothing else: the renderer draws the geometry.
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
  const [handleX] = rendererPointOf(
    plot,
    geometry.handleEvolution ?? (geometry.evoStart + geometry.evoEnd) / 2,
    0
  );
  const top = Math.min(y1, y2);
  const built = wardleyPipelineElements(
    { x: handleX - PIPELINE_WIDTH / 2, y: top },
    component.name,
    component.local
  );
  byLocal(built, `${component.local}:node`).xywh = boxString({
    x: Math.min(x1, x2),
    y: top,
    w: Math.max(Math.abs(x2 - x1), 1),
    h: Math.max(Math.abs(y2 - y1), 1),
  });
  return built;
}

/**
 * Where an evolution's inertia goes: on every phase line the arrow crosses,
 * as the renderer draws it, and at the arrow's middle when it crosses none —
 * "if there is an inertia bar, draw it" (PO, 2026-10-28).
 */
function inertiaCentres(
  plot: ReturnType<typeof owmDefaultPlot>,
  from: { x: number; y: number },
  to: { x: number; y: number },
  fromEvolution: number,
  toEvolution: number
): { cx: number; cy: number }[] {
  const low = Math.min(fromEvolution, toEvolution);
  const high = Math.max(fromEvolution, toEvolution);
  const crossed = PHASE_LINES.filter(line => line > low && line < high);
  if (crossed.length === 0) {
    return [{ cx: (from.x + to.x) / 2, cy: (from.y + to.y) / 2 }];
  }
  return crossed.map(line => {
    const t = (line - fromEvolution) / (toEvolution - fromEvolution);
    const [x] = rendererPointOf(plot, line, 0);
    return { cx: x, cy: from.y + t * (to.y - from.y) };
  });
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

/**
 * A builder's elements with a component's own plain pieces joining its OUTER
 * group, so its description, step dot and range bar move with it. Members
 * come before their group (ADR 0012 D3); `under` comes first of all, so the
 * range bar is painted beneath the node.
 */
function withExtras(
  built: SerializedElementProps[],
  groupId: string,
  under: readonly SerializedElementProps[],
  extras: readonly SerializedElementProps[]
): SerializedElementProps[] {
  const group = byLocal(built, groupId);
  const joined = [...under, ...extras].map(piece => [piece.id, true]);
  return [
    ...under,
    ...built.filter(element => element !== group),
    ...extras,
    {
      ...group,
      children: {
        ...(group.children as Record<string, boolean>),
        ...Object.fromEntries(joined),
      },
    },
  ];
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

function boxOf(element: SerializedElementProps) {
  const [x, y, w, h] = JSON.parse(String(element.xywh)) as number[];
  return { x, y, w, h };
}

const centreOf = (box: { x: number; y: number; w: number; h: number }) => ({
  x: box.x + box.w / 2,
  y: box.y + box.h / 2,
});

const boxString = (box: { x: number; y: number; w: number; h: number }) =>
  `[${box.x},${box.y},${box.w},${box.h}]`;

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
