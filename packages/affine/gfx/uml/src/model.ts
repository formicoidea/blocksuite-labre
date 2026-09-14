import {
  UML_DIAGRAM_KIND_TAG,
  UML_FRAME_BAND_HEIGHT,
  type UmlDiagramKind,
  type UmlNodeKind,
} from '@labre/affine-model';

import {
  type UmlBox,
  type UmlComponent,
  type UmlComponentElement,
  type UmlComponentGroup,
  umlComponentSiblings,
  umlGroupOf,
  umlTierText,
} from './component.js';
import {
  type UmlOperation,
  type UmlProperty,
  parseActivityEdge,
  parseCompartment,
  parseOperation,
  parseProperty,
  parseStateBehavior,
  parseTransition,
} from './grammar.js';
import { stereotypesOf } from './keywords.js';
import { UML_ROLE } from './roles.js';

/**
 * The neutral intermediate representation one UML diagram exports through.
 *
 * ## Why there is an IR at all
 *
 * Two writers — PlantUML and XMI — and one canvas. Without a model in between,
 * each writer would have to know that a class's name lives in a grouped text
 * element with the role `uml:name`, that its attributes are a second one, that a
 * connector's ends may land on the group rather than on the shape, and that a
 * package contains what its box contains. Two copies of that reading is two
 * copies that drift, and the drift shows up as two files that disagree about the
 * same drawing.
 *
 * So the canvas is read ONCE, here, and the writers take records. It is also
 * what makes them testable with literals: a golden XMI test needs a model, not a
 * surface.
 *
 * ## Pure
 *
 * Elements in, records out. No `std`, no DOM, no clock, no randomness — the
 * discipline `docs/adr/0012` P3 sets for every interchange function, and the
 * reason {@link umlModelFrom} takes plain structural records
 * ({@link UmlSourceElement}) rather than element models: the same function runs
 * against a live surface and against six object literals in a spec.
 */

/* ── What the canvas hands over ───────────────────────────────────────── */

/**
 * The shape of an element as this module reads it.
 *
 * Structural, and deliberately so: every field is one a real
 * `GfxPrimitiveElementModel` carries, and every field is optional, so a test can
 * hand over `{ id, type, kind, xywh }` and get the same answer a surface does.
 * `text` and `name` are `unknown` because on a live element they are a `Y.Text`
 * and in a spec they are a string, and nothing here has any business knowing
 * which — both go through `umlTierText`, which stringifies whatever it is given.
 * That is also what keeps this file free of a Yjs import.
 */
export interface UmlSourceElement extends UmlComponentElement {
  /** `'umlDiagram'`, `'umlNode'`, `'umlSubject'`, `'connector'`, `'text'`, … */
  type?: string;
  /** `UmlNodeKind` on a node, `UmlDiagramKind` on a frame. */
  kind?: string;
  name?: unknown;
  heading?: unknown;
  /** Which way a `umlPartition`'s band runs (§15.6.4). */
  orientation?: string;
  xywh?: string;
  deserializedXYWH?: readonly number[];
  elementBound?: { x: number; y: number; w: number; h: number };
  /** A group's members. */
  childIds?: readonly string[];
  /** A connector's ends. */
  source?: { id?: string } | null;
  target?: { id?: string } | null;
}

/* ── The IR ───────────────────────────────────────────────────────────── */

/** A slot of an InstanceSpecification — `attribute = value` (§11.6.4). */
export interface UmlSlot {
  name: string;
  /** Absent when the author named a feature and gave it no value. */
  value?: string;
}

/** What every drawn artefact states, whatever kind it is. */
export interface UmlNodeBase {
  /** The surface element's id — what a relation's ends resolve to. */
  id: string;
  name: string;
  /** Annex C labels read off the name compartment, in order. */
  keywords: string[];
  /** `{abstract}` was written on it (§9.2.4). */
  isAbstract: boolean;
  /** Where it is drawn — what package and subject nesting is decided by. */
  bounds?: UmlBox;
}

/** A Class, an Interface, an Enumeration or an InstanceSpecification. */
export interface UmlClassifier extends UmlNodeBase {
  kind: Extract<UmlNodeKind, 'class' | 'interface' | 'enumeration' | 'object'>;
  /** The attribute compartment, parsed. Empty for an object. */
  attributes: UmlProperty[];
  /** The operation compartment, parsed. Empty for an object. */
  operations: UmlOperation[];
  /** The value compartment of an object. Empty for the other three. */
  slots: UmlSlot[];
  /**
   * The compartments as the author TYPED them — trimmed, blanks and elision
   * markers dropped, and otherwise untouched.
   *
   * Carried beside the parsed forms because one of the two writers wants each.
   * XMI needs the structure: it has a slot for a visibility, a type and a
   * multiplicity and nothing to do with a line. PlantUML's member syntax IS
   * §9.5.4's own notation, so re-spelling a parsed property for it could only
   * lose what the parser did not model — a constraint, an unusual modifier, a
   * qualified redefinition. Both readings of the same compartment, stated once
   * here rather than re-derived in two files.
   */
  lines: {
    attributes: string[];
    operations: string[];
  };
  /**
   * The Classifier an object is an instance OF — the `Class` of
   * `object : Class` (§11.6.4). Objects only, and absent when the author wrote
   * a bare instance name.
   */
  instanceOf?: string;
}

/** A Package (§12.2), an Actor or a UseCase (§18.1) — a named box. */
export type UmlPackageNode = UmlNodeBase;
export type UmlActorNode = UmlNodeBase;
export type UmlUseCaseNode = UmlNodeBase;

/**
 * A Port (§11.3) — the small square on an EncapsulatedClassifier's boundary.
 *
 * `ownerId` is the surface id of the component (or the node) the square is drawn
 * ON, and it is GEOMETRY rather than a stored link: §11.3.4 says the symbol "may
 * be placed either overlapping the boundary of the rectangle symbol denoting
 * that EncapsulatedClassifier or it may be shown inside the rectangle symbol",
 * and a canvas has no other statement to read. See {@link umlHostOf} for the
 * reading and for its tolerance.
 *
 * Absent when the author has drawn a port beside every box, which is a port
 * belonging to nothing — the file writes it nowhere rather than guessing an
 * owner, and the drawing keeps it.
 */
export interface UmlPort extends UmlNodeBase {
  ownerId?: string;
}

/**
 * A Component (§11.6) — the classifier rectangle with the two-tab icon.
 *
 * `provided` and `required` are the NAMES read off the lollipops and sockets
 * drawn against it, not references: §10.4.4 draws a provided Interface as a
 * circle "labeled with the name of the Interface, attached by a solid line to
 * the BehavioredClassifier that realizes this Interface", and on this canvas the
 * glyph carries its own `uml:label` and nothing else. The names are what both
 * writers need — XMI mints a `uml:Interface` per name, PlantUML declares one —
 * and what neither can get from an id, because the glyph IS the interface as far
 * as the drawing is concerned.
 *
 * `ports` are the squares on its border, resolved the same geometric way.
 */
export interface UmlComponentNode extends UmlNodeBase {
  ports: UmlPort[];
  /** Interface names read off the lollipops touching this component. */
  provided: string[];
  /** Interface names read off the sockets touching this component. */
  required: string[];
}

/** An Artifact (§19.3) — the `«artifact»` rectangle with the document icon. */
export type UmlArtifactNode = UmlNodeBase;

/**
 * A Node, a Device or an ExecutionEnvironment (§19.4) — the perspective cube.
 *
 * ONE record with a `kind` discriminant rather than three lists, because §19.4.2
 * makes Device and ExecutionEnvironment specializations of Node and §19.4.4
 * draws all three as the same cube: the keyword is the difference, and both
 * writers need exactly that — an `xmi:type` and a PlantUML stereotype.
 */
export interface UmlDeploymentNode extends UmlNodeBase {
  kind: Extract<UmlNodeKind, 'node' | 'device' | 'execution-environment'>;
}

/** The subject of a use case diagram — the rectangle the cases sit in. */
export type UmlSubjectBox = UmlNodeBase;

/** A Comment (Annex A) — prose, kept whole. */
export interface UmlNote extends UmlNodeBase {
  /** The note's text, verbatim: a note is prose, not a name compartment. */
  body: string;
}

/**
 * The relationships phase 1 draws — the local half of each `uml:…` edge role.
 *
 * A closed union rather than an open string, because every writer maps it
 * TOTALLY: a `Record<UmlRelationKind, …>` in `plantuml.ts` and an exhaustive
 * `switch` in `xmi.ts` both fail the build the day a tenth relationship is drawn
 * with nothing to write it as. That failure is cheap here and expensive in a
 * file somebody exported.
 */
export type UmlRelationKind =
  // Phase 1 — the class and use case families.
  | 'association'
  | 'aggregation'
  | 'composition'
  | 'generalization'
  | 'realization'
  | 'dependency'
  | 'anchor'
  | 'include'
  | 'extend'
  // Phase 2 — the structural families (§19.2.4, §19.3.4, §19.4.4).
  | 'deploy'
  | 'manifest'
  | 'communication-path'
  // Phase 2 — the behaviour families (§15.2.4, §14.2.4.8).
  //
  // Read here AS RELATIONS even though neither writer emits one from
  // {@link UmlModel.relations}: a control flow, an object flow and a transition
  // are written by the Activity and the StateMachine that own them
  // ({@link UmlActivity.edges}, {@link UmlStateMachine.transitions}). They are
  // in this union all the same, because the union is what
  // {@link RELATION_OF_ROLE} reads a connector's ROLE against — a kind missing
  // here would make every flow on an activity sheet look like an untyped
  // connector, warn the author about a line they typed correctly, and export
  // nothing.
  | 'control-flow'
  | 'object-flow'
  | 'transition';

/** One connector, once both of its ends are known artefacts of this diagram. */
export interface UmlRelation {
  kind: UmlRelationKind;
  /**
   * The SUBJECT of the sentence the edge's direction states (the role table in
   * `roles.ts`): the specific classifier of a generalization, the WHOLE of an
   * aggregation, the base UseCase of an include, the extending UseCase of an
   * extend.
   */
  sourceId: string;
  targetId: string;
  /** The connector's own centre text, when it carries one. */
  label?: string;
}

/* ── The behaviour IR (§15.2.4 activities, §14.2.4 state machines) ────────── */

/** The ten glyphs an `act` sheet draws — §15.3.4, §15.4.4, §16.3.4, §16.10.4. */
export type UmlActivityNodeKind = Extract<
  UmlNodeKind,
  | 'action'
  | 'initial'
  | 'activity-final'
  | 'flow-final'
  | 'decision'
  | 'fork'
  | 'object-node'
  | 'send-signal'
  | 'accept-event'
  | 'time-event'
>;

/**
 * One node of an Activity — the glyph, its words, and the lane it is drawn in.
 *
 * ONE record with a `kind` discriminant rather than ten lists, for the reason
 * {@link UmlDeploymentNode} gives: §15.7 makes all ten ActivityNodes and both
 * writers need exactly the discriminant — an `xmi:type` and a PlantUML
 * stereotype. A list per glyph would be ten fields the writers would have to
 * concatenate back into one traversal order.
 */
export interface UmlActivityNode extends UmlNodeBase {
  kind: UmlActivityNodeKind;
  /**
   * The surface id of the `umlPartition` whose box holds this node's centre —
   * §15.6.4's swimlane, read at EXPORT time from geometry and never stored.
   *
   * The same reading {@link UmlPort.ownerId} gets, and for the same reason: a
   * partition is a band drawn across the sheet, membership is which band a glyph
   * sits in, and a canvas holds no second statement about it. Absent for a node
   * drawn between the lanes, or on a sheet with no lanes at all — which is most
   * of them.
   */
  partitionId?: string;
}

/** One ActivityEdge — the arrow, and the three things §15.2.4 writes on it. */
export interface UmlActivityEdge {
  /** §15.7.9 / §15.7.11 — which of the two kinds of token travels. */
  kind: Extract<UmlRelationKind, 'control-flow' | 'object-flow'>;
  sourceId: string;
  targetId: string;
  /** The edge's own name, "notated near the arrow". */
  name?: string;
  /** The `[…]` guard, without its brackets — §15.2.4's own notation. */
  guard?: string;
  /** `{weight = …}`'s value, as written — see {@link UmlActivityEdgeLabel}. */
  weight?: string;
}

/** An ActivityPartition (§15.6) — the swimlane, and what is drawn in it. */
export interface UmlPartition extends UmlNodeBase {
  /** Which way the band runs. A column unless the author turned it. */
  orientation: 'vertical' | 'horizontal';
  /**
   * The activity nodes whose centres it holds, in document order.
   *
   * Listed on the partition AS WELL AS named by each node's
   * {@link UmlActivityNode.partitionId}, and the duplication is the one
   * {@link UmlModel.ports} already explains: the XMI writer walks the lane (an
   * `ActivityPartition` carries `node` idrefs, so it needs the list) while a
   * reader asking which lane one action is in must not have to scan every lane
   * to find out. Both readings are built from one pass, so they cannot disagree.
   */
  nodeIds: string[];
}

/**
 * One Activity — the whole of what an `act` sheet says.
 *
 * A frame is ONE Activity: §15.2.4 draws the border and the name in the upper
 * left corner, Annex A replaces that border with the diagram frame, and that is
 * exactly the frame this model was read off. So the id and the name are the
 * sheet's own, and a second activity on one canvas is a second frame — the same
 * reading ADR 0017 makes about every other UML sheet.
 */
export interface UmlActivity {
  /** The diagram frame's surface id — the Activity IS the sheet. */
  id: string;
  name: string;
  nodes: UmlActivityNode[];
  edges: UmlActivityEdge[];
  partitions: UmlPartition[];
}

/** The nine glyphs §14.2.4 routes transitions through. */
export type UmlPseudostateKind = Extract<
  UmlNodeKind,
  | 'initial'
  | 'choice'
  | 'junction'
  | 'shallow-history'
  | 'deep-history'
  | 'entry-point'
  | 'exit-point'
  | 'terminate'
  | 'fork'
>;

/** A Region (§14.2.4) — the composite state, drawn as a box round its parts. */
export interface UmlRegion extends UmlNodeBase {
  /**
   * The region this one is drawn inside — §14.2.4's nested composite state.
   *
   * Geometry, most-nested first, exactly as a package inside a package is read
   * (`xmi.ts`'s `containerOf`). Absent for a region at the top level of the
   * sheet, which is where most of them are.
   */
  parentId?: string;
}

/** A State (§14.2.4.4) — the rounded box and its internal activities. */
export interface UmlState extends UmlNodeBase {
  /** `entry / …` lines, in order, as the expressions alone. */
  entry: string[];
  /** `do / …` lines — the metamodel's `doActivity`. */
  doActivity: string[];
  /** `exit / …` lines. */
  exit: string[];
  /**
   * Every line of the compartment that is NONE of the three — an internal
   * transition (§14.2.4.4's second compartment), a constraint, a note to self.
   *
   * Carried rather than dropped for the reason {@link UmlClassifier.lines}
   * exists: the author typed it, so something has to be able to write it back,
   * and a writer that silently lost a compartment would be the worst kind of
   * lossy export. Neither writer has a metamodel slot for it today; PlantUML
   * prints it as a state line.
   */
  lines: string[];
  /** The composite state whose box holds its centre — {@link UmlRegion}. */
  regionId?: string;
}

/** A FinalState (§14.2.4.5) — the bullseye a machine stops at. */
export interface UmlFinalState extends UmlNodeBase {
  regionId?: string;
}

/** A Pseudostate (§14.2.4.6) — a vertex that routes rather than one that is. */
export interface UmlPseudostate extends UmlNodeBase {
  kind: UmlPseudostateKind;
  regionId?: string;
}

/** One Transition (§14.2.4.8) — its two ends and its label, parsed. */
export interface UmlTransition {
  sourceId: string;
  targetId: string;
  /** `<trigger> [',' <trigger>]*`, verbatim and in order. */
  triggers: string[];
  /** The `[…]` guard, without its brackets. */
  guard?: string;
  /** The `/ <behavior-expression>` effect, as written. */
  effect?: string;
}

/**
 * One StateMachine — the whole of what an `stm` sheet says.
 *
 * {@link UmlActivity}'s twin, and it carries its vertices in FOUR lists rather
 * than one discriminated list because the metamodel does: a State owns
 * behaviours and regions, a FinalState owns neither and forbids both
 * (§14.5.11.4), and a Pseudostate is a `kind` attribute on one metaclass. Three
 * different `xmi:type`s with three different shapes is three lists; ten
 * identically shaped ActivityNodes is one.
 */
export interface UmlStateMachine {
  /** The diagram frame's surface id — the StateMachine IS the sheet. */
  id: string;
  name: string;
  /** The composite states, outermost and nested alike. */
  regions: UmlRegion[];
  states: UmlState[];
  finalStates: UmlFinalState[];
  pseudostates: UmlPseudostate[];
  transitions: UmlTransition[];
}

/** One diagram, as everything the writers need and nothing else. */
export interface UmlModel {
  diagram: {
    id: string;
    kind: UmlDiagramKind;
    name: string;
    /** `<kind> <name>` — Annex A's frame heading. */
    heading: string;
    bounds?: UmlBox;
  };
  classifiers: UmlClassifier[];
  packages: UmlPackageNode[];
  actors: UmlActorNode[];
  useCases: UmlUseCaseNode[];
  subjects: UmlSubjectBox[];
  notes: UmlNote[];
  /** §11.6 — the component boxes, each carrying its ports and its interfaces. */
  components: UmlComponentNode[];
  /**
   * §11.3 — every port on the sheet, whether or not it found a host.
   *
   * Listed here AS WELL AS under its component, and the duplication is on
   * purpose: the XMI writer walks the components (a `uml:Port` is an
   * `ownedAttribute`, so it has nowhere else to go) while a reader asking "how
   * many ports are on this sheet" — a check, a count, a later rule — must not
   * have to know that a hostless one is invisible from every component. The two
   * readings hold the SAME record, so they cannot disagree.
   */
  ports: UmlPort[];
  /** §19.3 — the artefacts. */
  artifacts: UmlArtifactNode[];
  /** §19.4 — the nodes, devices and execution environments. */
  nodes: UmlDeploymentNode[];
  /**
   * §15.2 — the Activity this sheet draws, or nothing.
   *
   * A LIST holding zero or one entry rather than an optional field, and the
   * shape is what makes both writers a loop instead of a branch: every other
   * artefact on this model is a list, `for (const activity of model.activities)`
   * reads identically to `for (const component of model.components)`, and a
   * sheet that draws no flow contributes nothing without either writer testing
   * for it. Populated when the sheet holds an activity NODE or an activity EDGE
   * — a lone arrow is still something the author drew.
   */
  activities: UmlActivity[];
  /** §14.2 — the StateMachine this sheet draws, or nothing. The same shape. */
  stateMachines: UmlStateMachine[];
  relations: UmlRelation[];
  /**
   * What the READING could not make sense of, one line each, in the user's
   * words (`InterchangeExportResult.warnings`).
   *
   * Never an error and never noise: the two cases below are both a connector
   * the author DREW that no file can carry, which is the one thing a user who
   * clicked Export is entitled to be told about. A shape with no role, a
   * neutral connector between two neutral shapes, a type name that names
   * nothing on this sheet — none of those is warned about, because none of them
   * is a statement the author made and lost (`docs/adr/0010`).
   */
  warnings: string[];
}

/* ── Roles ────────────────────────────────────────────────────────────── */

/**
 * The connector role that states each relationship — C1's vocabulary, read
 * rather than re-spelled.
 *
 * `Record<UmlRelationKind, string>` and therefore compile-total in both
 * directions: a relation kind with no role fails here, and a role renamed in
 * `roles.ts` fails here too rather than silently exporting nothing.
 */
const RELATION_ROLE: Record<UmlRelationKind, string> = {
  association: UML_ROLE.association,
  aggregation: UML_ROLE.aggregation,
  composition: UML_ROLE.composition,
  generalization: UML_ROLE.generalization,
  realization: UML_ROLE.realization,
  dependency: UML_ROLE.dependency,
  anchor: UML_ROLE.anchor,
  include: UML_ROLE.include,
  extend: UML_ROLE.extend,
  deploy: UML_ROLE.deploy,
  manifest: UML_ROLE.manifest,
  'communication-path': UML_ROLE['communication-path'],
  'control-flow': UML_ROLE['control-flow'],
  'object-flow': UML_ROLE['object-flow'],
  transition: UML_ROLE.transition,
};

const RELATION_OF_ROLE = new Map<string, UmlRelationKind>(
  Object.entries(RELATION_ROLE).map(([kind, role]) => [
    role,
    kind as UmlRelationKind,
  ])
);

/* ── Geometry ─────────────────────────────────────────────────────────── */

/**
 * An element's box, from whichever of the three spellings it carries.
 *
 * `deserializedXYWH` first because that is what a live element answers with;
 * `elementBound` because that is what the shared canvas fixtures build; the
 * serialized `xywh` last, for a record that carries only what the store holds.
 */
export function umlBoundsOf(element: UmlSourceElement): UmlBox | undefined {
  const xywh = element.deserializedXYWH;
  if (xywh && xywh.length >= 4) {
    return { x: xywh[0], y: xywh[1], w: xywh[2], h: xywh[3] };
  }
  const bound = element.elementBound;
  if (bound && typeof bound.x === 'number') {
    return { x: bound.x, y: bound.y, w: bound.w, h: bound.h };
  }
  if (typeof element.xywh === 'string') {
    const parts = element.xywh
      .replace(/^\[/, '')
      .replace(/\]$/, '')
      .split(',')
      .map(Number);
    if (parts.length >= 4 && parts.every(Number.isFinite)) {
      return { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
    }
  }
  return undefined;
}

/** Inclusive containment of a box's CENTRE in another box. */
export function umlCentreInside(inner: UmlBox, outer: UmlBox): boolean {
  const cx = inner.x + inner.w / 2;
  const cy = inner.y + inner.h / 2;
  return (
    cx >= outer.x &&
    cx <= outer.x + outer.w &&
    cy >= outer.y &&
    cy <= outer.y + outer.h
  );
}

/**
 * How near a glyph has to be drawn to count as attached to a box, in model
 * units.
 *
 * The one number this file invents, and the reason it is small: §10.4.4 and
 * §11.3.4 both describe a symbol TOUCHING a rectangle — a lollipop "attached by
 * a solid line" to the classifier that realizes it, a port "overlapping the
 * boundary" of the box it is on. Touching is a gap of zero, and a hand drawing
 * on a canvas misses by a few units, so the tolerance is a couple of grid steps
 * and not a neighbourhood: an interface glyph parked halfway across the sheet is
 * not this component's, and a reading that guessed would put an interface in the
 * file that nobody drew.
 *
 * Read by {@link umlHostOf} and by {@link umlBoxGap}'s callers alike, so the
 * port's owner and the interface's component are decided by the same distance.
 */
export const UML_ATTACH_TOLERANCE = 24;

/**
 * The GAP between two boxes — zero when they touch or overlap, otherwise the
 * shortest distance from edge to edge.
 *
 * Edges, never centres: a lollipop is thirty units across and a component two
 * hundred, so "nearest centre" would hand a glyph to whichever box happens to be
 * squattest rather than to the one it is drawn against. The same argument
 * `gapSquared` makes in the validation engine, one package over.
 */
export function umlBoxGap(a: UmlBox, b: UmlBox): number {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)));
  const dy = Math.max(0, Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h)));
  return Math.hypot(dx, dy);
}

/**
 * The DRAWING area of a diagram frame — the frame minus its heading band.
 *
 * The same carve-out `c4/export.ts` makes with `backgroundPlot`, arrived at from
 * the MODEL's own constant so this module owes the framework declaration
 * nothing: the top margin is where the frame writes its own heading
 * (`UmlDiagramElementModel`), and an element laid over the heading is on the
 * sheet's chrome rather than on its drawing area.
 */
export function umlSheetOf(frame: UmlBox): UmlBox {
  const band = Math.min(UML_FRAME_BAND_HEIGHT, frame.h);
  return { x: frame.x, y: frame.y + band, w: frame.w, h: frame.h - band };
}

/** The little {@link umlHostOf} needs to know about a candidate host. */
interface UmlHostCandidate {
  id: string;
  bounds?: UmlBox;
}

/**
 * Which box a glyph is drawn AGAINST — the one reading that gives a port its
 * owner and a lollipop its component.
 *
 * The nearest host within {@link UML_ATTACH_TOLERANCE}, and `undefined` when
 * nothing is that near: a port drawn in the middle of the sheet belongs to
 * nothing, and inventing an owner for it would put a `uml:Port` on a component
 * the author never drew it on.
 *
 * ## The tie-breaks, and why there are two of them
 *
 * A component nested inside another (§11.6.4's white-box view) puts a port on
 * the boundary of BOTH, at a gap of zero from each. The smaller box wins,
 * because the most-nested container is the one the author was aiming at — the
 * same reading `containerOf` makes in the two writers. And an exact tie on both
 * gap and area is broken by the smaller id, never by the order the surface
 * happened to be walked in: this decides what a FILE says, and a Y.Map rebuilt
 * on every load does not promise an order.
 */
export function umlHostOf<T extends UmlHostCandidate>(
  glyph: UmlBox | undefined,
  hosts: readonly T[],
  tolerance: number = UML_ATTACH_TOLERANCE
): T | undefined {
  if (!glyph) return undefined;
  let best: T | undefined;
  let bestGap = Number.POSITIVE_INFINITY;
  let bestArea = Number.POSITIVE_INFINITY;
  for (const host of hosts) {
    if (!host.bounds) continue;
    const gap = umlBoxGap(glyph, host.bounds);
    if (gap > tolerance) continue;
    const area = Math.max(0, host.bounds.w) * Math.max(0, host.bounds.h);
    const better =
      gap < bestGap ||
      (gap === bestGap &&
        (area < bestArea ||
          (area === bestArea && best !== undefined && host.id < best.id)));
    if (better) {
      best = host;
      bestGap = gap;
      bestArea = area;
    }
  }
  return best;
}

/* ── Reading the canvas ───────────────────────────────────────────────── */

export interface UmlModelOptions {
  /**
   * Which words belong to which shape — `component.ts`'s
   * {@link umlComponentSiblings}, injectable.
   *
   * Injectable rather than only imported so a caller can resolve a component
   * some other way (a test with a hand-built resolution, a host that already
   * holds the answer) without this module growing a second reading of a group.
   * The default IS `umlComponentSiblings`, so nothing has two behaviours.
   */
  siblingsOf?: (
    group: UmlComponentGroup,
    elements: readonly UmlComponentElement[]
  ) => UmlComponent;
}

/** The classifier kinds — the four that carry compartments. */
const CLASSIFIER_KINDS = new Set([
  'class',
  'interface',
  'enumeration',
  'object',
]);

/** The glyphs only an ACTIVITY draws — §15.3.4, §15.4.4, §16.3.4, §16.10.4. */
const ACTIVITY_ONLY_KINDS = new Set<string>([
  'action',
  'activity-final',
  'flow-final',
  'decision',
  'object-node',
  'send-signal',
  'accept-event',
  'time-event',
]);

/** The pseudostates only a STATE MACHINE draws — §14.2.4.6. */
const PSEUDOSTATE_ONLY_KINDS = new Set<string>([
  'choice',
  'junction',
  'shallow-history',
  'deep-history',
  'entry-point',
  'exit-point',
  'terminate',
]);

/**
 * The two glyphs BOTH behaviour sheets draw, and the one ambiguity this file
 * has to resolve rather than report.
 *
 * §15.3.4 and §14.2.4 draw the same filled disc and the same solid bar and mean
 * the same thing by each — a beginning, a split or a join — which is why
 * `roles.ts` gives each ONE role instead of two. A role is a statement about
 * meaning and the meaning is genuinely the same; an EXPORT, though, has to put
 * the disc in an `uml:Activity` or in a `uml:StateMachine`, and those are two
 * different metaclasses in two different packages.
 *
 * So the sheet's own heading decides: on an `stm` frame the disc is a
 * `Pseudostate kind="initial"` and the bar a `Pseudostate kind="fork"`, and
 * everywhere else they are an `InitialNode` and a `ForkNode`. Annex A makes that
 * heading a required part of the frame (`kinds.ts`), so the statement is always
 * there to read — and it is the author's own, which is the only thing that could
 * honestly settle this.
 */
const UML_SHARED_BEHAVIOUR_KINDS = new Set<string>(['initial', 'fork']);

/**
 * One diagram, read off a flat element list.
 *
 * ## What belongs to it
 *
 * Geometry, exactly as every other framework in this library attributes: an
 * element is on this sheet when its CENTRE is inside the frame's drawing area.
 * Selecting a frame therefore selects what is drawn on it, and a second frame
 * beside it is a second diagram — the reading `c4/export.ts` argues for at
 * length, and the reason UML ships four diagram kinds on one canvas (ADR 0017).
 *
 * ## How an end finds its artefact
 *
 * A UML node is drawn as a GROUP — a shape plus its written tiers — and every
 * part of that group is connectable. An arrow dragged onto a class records the
 * id of the group, of the name tier or of the attribute tier about as often as
 * the shape's, and all four look identical to the person drawing it. So each
 * part answers for its shape, and only where the group holds exactly ONE UML
 * node: a lasso somebody drew round two classes points at neither in
 * particular, and guessing there would put a relationship in the file that
 * nobody drew.
 *
 * ## Two things geometry decides, and nothing else does
 *
 * Phase 2 added the only readings in this file that measure one element against
 * ANOTHER element: which component a PORT sits on (§11.3.4) and which component
 * a lollipop or a socket is drawn against (§10.4.4, §11.6.4). Both are the
 * notation's own statement — the specification describes a small symbol placed
 * on or touching a rectangle, and a whiteboard holds no second link to read — so
 * the reading is {@link umlHostOf} and the tolerance is
 * {@link UML_ATTACH_TOLERANCE}. A glyph that touches nothing is kept on the
 * drawing and written into no file, which is the same call the rest of this
 * module makes about anything it cannot attribute.
 *
 * ## What is warned about
 *
 * Two things, and both are a line the author DREW that the file cannot carry: a
 * typed relationship with an end this diagram cannot resolve, and a connector
 * between two UML nodes carrying no role at all. The second is not an error —
 * `docs/adr/0010` is explicit that the role IS the statement, so a bare
 * connector relates nothing — but a user who drew a line between two classes
 * and gets a file without it is owed the sentence.
 *
 * Neither is said about a connector that is not this sheet's. A line belongs to
 * this diagram when at least one of its ends resolves to an artefact of it, or —
 * for a line attached to nothing — when its own centre is inside the sheet.
 * Anything else is another frame's drawing, and warning about it would mean
 * every export of a two-frame board complaining about lines that are perfectly
 * drawn next door.
 */
export function umlModelFrom(
  diagram: UmlSourceElement,
  elements: readonly UmlSourceElement[],
  options: UmlModelOptions = {}
): UmlModel {
  const siblingsOf = options.siblingsOf ?? umlComponentSiblings;
  const warnings: string[] = [];

  const frame = umlBoundsOf(diagram);
  const sheet = frame ? umlSheetOf(frame) : undefined;
  const onSheet = (element: UmlSourceElement): boolean => {
    if (!sheet) return true;
    const bounds = umlBoundsOf(element);
    return bounds ? umlCentreInside(bounds, sheet) : false;
  };

  const groups: UmlComponentGroup[] = [];
  const nodes: UmlSourceElement[] = [];
  const subjects: UmlSourceElement[] = [];
  const connectors: UmlSourceElement[] = [];
  /** §15.6.4's swimlanes and §14.2.4's composite states — the two new frames. */
  const partitionElements: UmlSourceElement[] = [];
  const regionElements: UmlSourceElement[] = [];

  for (const element of elements) {
    if (Array.isArray(element.childIds)) {
      groups.push({ id: element.id, childIds: element.childIds });
    }
    if (element.type === 'umlNode') nodes.push(element);
    else if (element.type === 'umlSubject') subjects.push(element);
    else if (element.type === 'umlPartition') partitionElements.push(element);
    else if (element.type === 'umlRegion') regionElements.push(element);
    else if (element.type === 'connector') connectors.push(element);
  }

  /** What one node's group says, by tier. */
  const tiersOf = (node: UmlSourceElement) => {
    const group = umlGroupOf(node.id, groups);
    const component: UmlComponent = group ? siblingsOf(group, elements) : {};
    // `label` is the actor's and the use case's tier and `name` the
    // classifier's — one of the two, never both (`component.ts`).
    const named = component.name ?? component.label;
    return {
      // The shape's own inner text is a FALLBACK and not a source: a node whose
      // group was released, or whose tiers were deleted, still states its name
      // if the shape carries one. The test is EXISTENCE of the tier — a name an
      // author deliberately cleared has been cleared.
      name: named ? umlTierText(named.text) : umlTierText(node.text),
      attributes: umlTierText(component.attributes?.text),
      operations: umlTierText(component.operations?.text),
    };
  };

  /**
   * What the frame SAYS it draws — read before the nodes, because two glyphs
   * are shared between the behaviour sheets and the sheet's own heading is what
   * tells them apart (see {@link UML_SHARED_BEHAVIOUR_KINDS}).
   */
  const diagramKind = (diagram.kind as UmlDiagramKind | undefined) ?? 'class';
  const readsAsStateMachine = diagramKind === 'stm';

  const classifiers: UmlClassifier[] = [];
  const packages: UmlPackageNode[] = [];
  const actors: UmlActorNode[] = [];
  const useCases: UmlUseCaseNode[] = [];
  const notes: UmlNote[] = [];
  const subjectBoxes: UmlSubjectBox[] = [];
  const components: UmlComponentNode[] = [];
  const ports: UmlPort[] = [];
  const artifacts: UmlArtifactNode[] = [];
  const deploymentNodes: UmlDeploymentNode[] = [];
  const activityNodes: UmlActivityNode[] = [];
  const states: UmlState[] = [];
  const finalStates: UmlFinalState[] = [];
  const pseudostates: UmlPseudostate[] = [];
  /** The lollipops and the sockets, held until every box is known. */
  const providedGlyphs: UmlNodeBase[] = [];
  const requiredGlyphs: UmlNodeBase[] = [];

  /** Every id that answers for an artefact of this diagram. */
  const artefactOf = new Map<string, string>();

  for (const node of nodes) {
    if (!onSheet(node)) continue;
    const kind = node.kind as UmlNodeKind | undefined;
    if (!kind) continue;

    const tiers = tiersOf(node);
    const stated = stereotypesOf(tiers.name);
    const bounds = umlBoundsOf(node);
    const base: UmlNodeBase = {
      id: node.id,
      name: stated.name,
      keywords: stated.keywords,
      isAbstract: stated.isAbstract,
      ...(bounds ? { bounds } : {}),
    };

    if (CLASSIFIER_KINDS.has(kind)) {
      const classifierKind = kind as UmlClassifier['kind'];
      const attributeLines = parseCompartment(tiers.attributes);
      const operationLines =
        classifierKind === 'object' ? [] : parseCompartment(tiers.operations);
      const classifier: UmlClassifier = {
        ...base,
        kind: classifierKind,
        // An object has no attribute compartment: §11.6.4 gives it SLOTS, and
        // the same lines are read as one or the other, never as both.
        attributes:
          classifierKind === 'object' ? [] : attributeLines.map(parseProperty),
        operations: operationLines.map(parseOperation),
        slots: classifierKind === 'object' ? attributeLines.map(slotOf) : [],
        lines: { attributes: attributeLines, operations: operationLines },
      };
      if (classifierKind === 'object') {
        // `object : Class` (§11.6.4) — the instance name and the Classifier it
        // instantiates, which is what XMI's `classifier` reference needs.
        const colon = base.name.indexOf(':');
        if (colon >= 0) {
          classifier.name = base.name.slice(0, colon).trim();
          const named = base.name.slice(colon + 1).trim();
          if (named) classifier.instanceOf = named;
        }
      }
      classifiers.push(classifier);
    } else if (kind === 'package') {
      packages.push(base);
    } else if (kind === 'actor') {
      actors.push(base);
    } else if (kind === 'use-case') {
      useCases.push(base);
    } else if (kind === 'note') {
      // A note is PROSE: no keyword is lifted out of it and no `{abstract}` is
      // read off it, because a note that mentions «create» is a note that
      // mentions it.
      notes.push({ ...base, name: '', keywords: [], body: tiers.name.trim() });
    } else if (kind === 'component') {
      // The ports and the interface names are filled in below, once every box
      // on the sheet is known: they are read by GEOMETRY, and a glyph drawn
      // before its component would otherwise find nothing to attach to.
      components.push({ ...base, ports: [], provided: [], required: [] });
    } else if (kind === 'port') {
      ports.push(base);
    } else if (kind === 'provided-interface' || kind === 'required-interface') {
      // The lollipop and the socket are the only drawn artefacts that are NOT
      // elements of the model: §10.4.4 draws each as a notation for a
      // relationship — an InterfaceRealization, a Usage — between the interface
      // it names and the classifier it touches, and both writers turn it into
      // exactly that. So it answers for nothing, which is why this branch does
      // not reach the `artefactOf` line below: a connector dropped on a lollipop
      // resolves to no artefact, and the warning says the end is not on the
      // diagram rather than the file carrying a reference to a circle.
      (kind === 'provided-interface' ? providedGlyphs : requiredGlyphs).push(
        base
      );
      continue;
    } else if (kind === 'artifact') {
      artifacts.push(base);
    } else if (
      kind === 'node' ||
      kind === 'device' ||
      kind === 'execution-environment'
    ) {
      deploymentNodes.push({ ...base, kind });
    } else if (
      ACTIVITY_ONLY_KINDS.has(kind) ||
      (UML_SHARED_BEHAVIOUR_KINDS.has(kind) && !readsAsStateMachine)
    ) {
      activityNodes.push({ ...base, kind: kind as UmlActivityNodeKind });
    } else if (kind === 'state') {
      // §14.2.4.4's internal activities compartment. It is the `uml:attributes`
      // tier — the same tier a class writes its properties in, reused because a
      // state's compartment is the second one down and the creation site seeds
      // it with `entry / …`. Every line that is NOT one of the three labels
      // stays in `lines`, so an internal transition somebody wrote survives.
      const entry: string[] = [];
      const doActivity: string[] = [];
      const exit: string[] = [];
      const lines: string[] = [];
      for (const line of parseCompartment(tiers.attributes)) {
        const behavior = parseStateBehavior(line);
        if (!behavior) {
          lines.push(line);
          continue;
        }
        // A label with nothing after it is a line somebody is halfway through,
        // and an empty behaviour expression is not a behaviour: it is kept as a
        // line of the compartment rather than written into a file as a Behavior
        // with no body.
        if (!behavior.expression) {
          lines.push(line);
          continue;
        }
        if (behavior.kind === 'entry') entry.push(behavior.expression);
        else if (behavior.kind === 'do') doActivity.push(behavior.expression);
        else exit.push(behavior.expression);
      }
      states.push({ ...base, entry, doActivity, exit, lines });
    } else if (kind === 'final-state') {
      finalStates.push(base);
    } else if (
      PSEUDOSTATE_ONLY_KINDS.has(kind) ||
      (UML_SHARED_BEHAVIOUR_KINDS.has(kind) && readsAsStateMachine)
    ) {
      pseudostates.push({ ...base, kind: kind as UmlPseudostateKind });
    } else {
      // A kind this build does not draw yet (a later phase widens the union):
      // it is on the sheet and it answers for itself, but nothing writes it
      // down.
      continue;
    }
    artefactOf.set(node.id, node.id);
  }

  // ── The structural attachments, once every box on the sheet is known ──
  //
  // Two geometric readings, and the only two in this file that are about one
  // element's position relative to ANOTHER element rather than to a frame.
  // Neither is a fallback for a link the store could have held: §11.3.4 and
  // §10.4.4 describe a small symbol drawn ON or AGAINST a rectangle, and on a
  // whiteboard that is the whole of what the author stated.

  /** A port's host: the component or the cube its square sits on (§11.3.4). */
  const portHosts: UmlHostCandidate[] = [...components, ...deploymentNodes];
  const componentById = new Map(
    components.map(component => [component.id, component])
  );
  for (const port of ports) {
    const host = umlHostOf(port.bounds, portHosts);
    if (!host) continue;
    port.ownerId = host.id;
    // Only a COMPONENT owns a port in the file: `uml:Port` is an
    // `ownedAttribute` of an EncapsulatedClassifier, and a port drawn on a cube
    // is a drawing this pack keeps and writes nowhere.
    componentById.get(host.id)?.ports.push(port);
  }

  /**
   * An interface glyph's component: the box it touches, or the component that
   * owns the PORT it touches — §11.3.4's "A provided Interface may be shown
   * using the lollipop notation attached to the Port".
   */
  const glyphHosts: UmlHostCandidate[] = [...components, ...ports];
  const attachInterface = (glyph: UmlNodeBase, provided: boolean) => {
    const name = glyph.name.trim();
    if (!name) return;
    const host = umlHostOf(glyph.bounds, glyphHosts);
    if (!host) return;
    const owner =
      componentById.get(host.id) ??
      componentById.get(ports.find(port => port.id === host.id)?.ownerId ?? '');
    if (!owner) return;
    const list = provided ? owner.provided : owner.required;
    // §11.3.4 lists several interfaces on one lollipop, separated by commas —
    // and a component that provides the same interface twice says it once.
    for (const each of name.split(',')) {
      const trimmed = each.trim();
      if (trimmed && !list.includes(trimmed)) list.push(trimmed);
    }
  };
  for (const glyph of providedGlyphs) attachInterface(glyph, true);
  for (const glyph of requiredGlyphs) attachInterface(glyph, false);

  for (const subject of subjects) {
    if (!onSheet(subject)) continue;
    const bounds = umlBoundsOf(subject);
    subjectBoxes.push({
      id: subject.id,
      name: umlTierText(subject.name),
      keywords: [],
      isAbstract: false,
      ...(bounds ? { bounds } : {}),
    });
    artefactOf.set(subject.id, subject.id);
  }

  // ── The two behaviour FRAMES, and what they hold ──────────────────────
  //
  // Neither is registered in `artefactOf`, and that is the lollipop's precedent
  // rather than an omission: a swimlane and a composite state are furniture the
  // author draws responsibility and nesting with, so a flow dropped on one
  // relates nothing. The warning an author gets for a control flow ending on a
  // lane is then the right one — an end that is not on the diagram — instead of
  // a file carrying an arrow into a band.

  const partitions: UmlPartition[] = [];
  for (const partition of partitionElements) {
    if (!onSheet(partition)) continue;
    const bounds = umlBoundsOf(partition);
    partitions.push({
      id: partition.id,
      name: umlTierText(partition.name),
      keywords: [],
      isAbstract: false,
      // The model defaults it, and a fixture that states nothing means the
      // default rather than an absent band.
      orientation:
        partition.orientation === 'horizontal' ? 'horizontal' : 'vertical',
      nodeIds: [],
      ...(bounds ? { bounds } : {}),
    });
  }

  const regions: UmlRegion[] = [];
  for (const region of regionElements) {
    if (!onSheet(region)) continue;
    const bounds = umlBoundsOf(region);
    regions.push({
      id: region.id,
      name: umlTierText(region.name),
      keywords: [],
      isAbstract: false,
      ...(bounds ? { bounds } : {}),
    });
  }

  /** The smallest frame whose box holds a centre — most-nested wins. */
  const frameOf = <T extends UmlNodeBase>(
    element: UmlNodeBase,
    frames: readonly T[],
    strictlyLarger = false
  ): T | undefined => {
    const bounds = element.bounds;
    if (!bounds) return undefined;
    const own = Math.max(0, bounds.w) * Math.max(0, bounds.h);
    let best: T | undefined;
    let bestArea = Number.POSITIVE_INFINITY;
    for (const candidate of frames) {
      const box = candidate.bounds;
      if (candidate.id === element.id || !box) continue;
      if (!umlCentreInside(bounds, box)) continue;
      const area = Math.max(0, box.w) * Math.max(0, box.h);
      if (strictlyLarger && area <= own) continue;
      if (area < bestArea) {
        best = candidate;
        bestArea = area;
      }
    }
    return best;
  };

  const partitionById = new Map(partitions.map(lane => [lane.id, lane]));
  for (const node of activityNodes) {
    const lane = frameOf(node, partitions);
    if (!lane) continue;
    node.partitionId = lane.id;
    partitionById.get(lane.id)?.nodeIds.push(node.id);
  }

  // §14.2.4's nesting: a composite state drawn inside a composite state. The
  // strict-area test is what makes it an order rather than a cycle — the same
  // guard `containerOf` holds for a package inside a package.
  for (const region of regions) {
    const parent = frameOf(region, regions, true);
    if (parent) region.parentId = parent.id;
  }
  for (const vertex of [...states, ...finalStates, ...pseudostates]) {
    const region = frameOf(vertex, regions);
    if (region) vertex.regionId = region.id;
  }

  // Each part of a node's group answers for the node — but only where the group
  // holds exactly one. See the docblock.
  for (const group of groups) {
    const inside = group.childIds.filter(id => artefactOf.has(id));
    if (inside.length !== 1) continue;
    const artefact = artefactOf.get(inside[0])!;
    artefactOf.set(group.id, artefact);
    for (const childId of group.childIds) {
      if (!artefactOf.has(childId)) artefactOf.set(childId, artefact);
    }
  }

  const relations: UmlRelation[] = [];
  for (const connector of connectors) {
    const from = connector.source?.id;
    const to = connector.target?.id;
    const source = from ? artefactOf.get(from) : undefined;
    const target = to ? artefactOf.get(to) : undefined;

    // ── Is this line on THIS sheet at all? ───────────────────────────────
    //
    // The element list is the whole surface, not one frame's worth of it, so
    // every connector of every diagram arrives here. A connector has no centre
    // of its own until the router has run — its bound is derived from the path
    // between its two ends, and a freshly loaded document answers `[0,0,0,0]` —
    // so the reading that decides membership is its ENDS: a line belongs to this
    // sheet when at least one of them resolves to an artefact of it. Only where
    // neither does is the connector's own box asked, which catches the one case
    // the ends cannot — a line the author drew on this sheet and attached to
    // nothing.
    //
    // Without this test a board with two frames warned twice on every export
    // about connectors that are perfectly drawn on the OTHER sheet (the
    // tranche-F recette's finding): the ends resolved on neither diagram's
    // `artefactOf`, so each export claimed the other's lines were dangling.
    if (!source && !target && !onSheet(connector)) continue;

    const kind = connector.role
      ? RELATION_OF_ROLE.get(connector.role)
      : undefined;

    if (!kind) {
      // A connector the author drew between two UML artefacts and never typed.
      if (source && target) {
        warnings.push(
          'A connector between two UML elements carries no relationship type, so it is not in the file. Redraw it with one of the UML relationship tools.'
        );
      }
      continue;
    }

    if (!source || !target) {
      warnings.push(
        `A ${kind} could not be written: one of its ends is not on this diagram.`
      );
      continue;
    }

    const label = umlTierText(connector.text);
    relations.push({
      kind,
      sourceId: source,
      targetId: target,
      ...(label ? { label } : {}),
    });
  }

  const kind = diagramKind;
  const name = umlTierText(diagram.name);
  const heading =
    typeof diagram.heading === 'string' && diagram.heading
      ? diagram.heading
      : `${UML_DIAGRAM_KIND_TAG[kind] ?? kind} ${name}`.trim();

  // ── The two behaviours, assembled ─────────────────────────────────────
  //
  // The edges are PROJECTED from `relations` rather than read again: one pass
  // over the connectors resolved every end, applied every attribution rule and
  // raised every warning, and a second pass could only disagree with it. What is
  // added here is the LABEL grammar — §15.2.4's guard and weight, §14.2.4.8's
  // triggers, guard and effect — which is the one thing a flow says that a
  // structural relationship does not.

  const activityEdges: UmlActivityEdge[] = [];
  const transitions: UmlTransition[] = [];
  for (const relation of relations) {
    if (relation.kind === 'control-flow' || relation.kind === 'object-flow') {
      const annotations = parseActivityEdge(relation.label);
      activityEdges.push({
        kind: relation.kind,
        sourceId: relation.sourceId,
        targetId: relation.targetId,
        ...annotations,
      });
    } else if (relation.kind === 'transition') {
      const label = parseTransition(relation.label);
      transitions.push({
        sourceId: relation.sourceId,
        targetId: relation.targetId,
        ...label,
      });
    }
  }

  // A sheet holds a behaviour when it holds a GLYPH of it or a LINE of it: an
  // author who has drawn two arrows and no boxes yet has still said something,
  // and a writer that dropped it would lose the drawing rather than summarise
  // it. A sheet holding neither contributes an empty list and neither writer
  // emits a word.
  const activities: UmlActivity[] =
    activityNodes.length > 0 ||
    activityEdges.length > 0 ||
    partitions.length > 0
      ? [
          {
            id: diagram.id,
            name,
            nodes: activityNodes,
            edges: activityEdges,
            partitions,
          },
        ]
      : [];

  const stateMachines: UmlStateMachine[] =
    states.length > 0 ||
    finalStates.length > 0 ||
    pseudostates.length > 0 ||
    transitions.length > 0 ||
    regions.length > 0
      ? [
          {
            id: diagram.id,
            name,
            regions,
            states,
            finalStates,
            pseudostates,
            transitions,
          },
        ]
      : [];

  return {
    diagram: {
      id: diagram.id,
      kind,
      name,
      heading,
      ...(frame ? { bounds: frame } : {}),
    },
    classifiers,
    packages,
    actors,
    useCases,
    subjects: subjectBoxes,
    notes,
    components,
    ports,
    artifacts,
    nodes: deploymentNodes,
    activities,
    stateMachines,
    relations,
    warnings,
  };
}

/**
 * One line of an object's compartment as a SLOT.
 *
 * Read through {@link parseProperty} rather than by splitting on `=`, so that
 * `stock : Integer = 3` — a slot an author wrote the feature's type on — gives
 * the same `stock = 3` a bare `stock = 3` does. The type is dropped because a
 * slot does not declare one: §11.6.4's compartment gives VALUES to features the
 * Classifier already typed.
 */
function slotOf(line: string): UmlSlot {
  const property = parseProperty(line);
  return {
    name: property.name,
    ...(property.defaultValue ? { value: property.defaultValue } : {}),
  };
}
