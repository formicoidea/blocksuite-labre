import {
  UML_DIAGRAM_KIND_TAG,
  UML_FRAGMENT_BAND,
  UML_FRAME_BAND_HEIGHT,
  UML_LIFELINE_HEAD,
  type UmlDiagramKind,
  type UmlFragmentOperand,
  type UmlFragmentOperator,
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
  type UmlAssociationEnd,
  type UmlOperation,
  type UmlProperty,
  parseActivityEdge,
  parseCompartment,
  parseEndLabel,
  parseLifelineIdent,
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
  /**
   * A connector's ends.
   *
   * `position` is the RELATIVE point the end is anchored at on the element it
   * touches — `[0.5, 0.5]` for a centre anchor, `[0, 0.35]` for a message
   * attached a third of the way down a lifeline's left edge. Read for one thing
   * only, and it is the thing a sequence diagram is made of: §17.4.4 says the
   * HEIGHT an arrow is drawn at is WHEN it happens, and that height is stored
   * here rather than derived — a connector's own bound is computed by the router
   * and reads `[0,0,0,0]` on a freshly loaded document.
   */
  source?: { id?: string; position?: readonly number[] } | null;
  target?: { id?: string; position?: readonly number[] } | null;
  /** A `umlFragment`'s interaction operator (§17.6.4). */
  operator?: string;
  /** A `umlFragment`'s operand bands, top to bottom (§17.6.4). */
  operands?: readonly UmlFragmentOperand[];
  /**
   * The two PER-END labels of a connector (ADR 0020), beside `text`.
   *
   * `unknown` for the reason {@link UmlSourceElement.name} is: a live connector
   * holds a `Y.Text` and a spec hands over a string, and both go through
   * `umlTierText`.
   */
  sourceLabel?: unknown;
  targetLabel?: unknown;
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
  | 'transition'
  // Phase 3 — the five MESSAGES of §17.4.4.
  //
  // In this union for the reason the three behaviour edges above are, and the
  // reason is the same sentence: {@link RELATION_OF_ROLE} is what a connector's
  // role is read against, so a message missing here would make every arrow on a
  // sequence sheet look like an untyped connector, warn an author about a line
  // they drew correctly, and export nothing. Neither writer emits one from
  // {@link UmlModel.relations} — a message is written by the
  // {@link UmlInteraction} that owns it, where its POSITION IN TIME is known.
  | 'message-sync'
  | 'message-async'
  | 'message-reply'
  | 'message-create'
  | 'message-delete';

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
  /**
   * What is written beside the SOURCE end of the line — §11.5.4's adornments.
   *
   * Present whenever the connector carries an end label at all, whatever the
   * relationship is. On the four kinds §11.5.4 governs
   * ({@link ADORNED_RELATION_KINDS}) it is PARSED — a multiplicity, a role name,
   * a visibility glyph; on every other kind only
   * {@link UmlAssociationEnd.raw} is filled, because a multiplicity beside a
   * generalization is not a multiplicity of anything and writing one into a file
   * would state a fact the metamodel has nowhere to hold. Carrying the raw text
   * regardless is what keeps the round trip lossless: the author's words come
   * back on the board even where no writer can spell them.
   */
  sourceEnd?: UmlAssociationEnd;
  /** What is written beside the TARGET end — see {@link sourceEnd}. */
  targetEnd?: UmlAssociationEnd;
}

/**
 * The relationships whose end labels §11.5.4 gives a MEANING to.
 *
 * An Association and its two aggregation flavours, plus the CommunicationPath
 * §19.4.3 defines as "an Association between two DeploymentTargets" — which is
 * why it is in the set: it is an Association, so its ends are Properties and
 * take a multiplicity like any other.
 */
export const ADORNED_RELATION_KINDS: ReadonlySet<UmlRelationKind> =
  new Set<UmlRelationKind>([
    'association',
    'aggregation',
    'composition',
    'communication-path',
  ]);

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

/* ── The interaction IR (§17.2.4 sequence diagrams) ───────────────────────── */

/**
 * §17.4.3's `messageSort`, as the five arrows an `sd` sheet is drawn with.
 *
 * A projection of {@link UmlRelationKind} rather than a union of its own, for
 * the reason {@link UmlActivityEdge.kind} is one: a message IS a connector on
 * the canvas, read off the same role table in the same pass, and two spellings
 * of the same five words would be two things to keep in step.
 */
export type UmlMessageKind = Extract<
  UmlRelationKind,
  | 'message-sync'
  | 'message-async'
  | 'message-reply'
  | 'message-create'
  | 'message-delete'
>;

/**
 * A Lifeline (§17.3) — the participant column: a named head over a dashed
 * spine.
 *
 * `name` and `type` are the two halves of §17.3.4's `<name> : <Type>`, split by
 * `parseLifelineIdent` — the same grammar `keywords.ts` seeds a fresh head
 * with. `type` is absent when the author wrote a bare participant name, which
 * is most of them.
 */
export interface UmlLifeline extends UmlNodeBase {
  /** The Classifier this participant is an instance of (§17.3.4). */
  type?: string;
}

/**
 * One Message (§17.4) — its two ends, its label, and WHEN it happens.
 *
 * ## Why `y` is on the record and the list is sorted by it
 *
 * Because on a sequence diagram the vertical axis IS time (§17.4.4: "every line
 * fragment is either horizontal or downwards"), and every writer needs the
 * order rather than the height: XMI serializes a pair of
 * `MessageOccurrenceSpecification`s per message and an Interaction's `fragment`
 * list is READ IN ORDER, PlantUML's whole syntax is one message per line top to
 * bottom. So the canvas's one statement about sequence — the height an arrow was
 * drawn at — is turned into an order here, once, and the writers take a list.
 *
 * `sourceId` and `targetId` are the ids the connector actually resolves to,
 * which is a LIFELINE or an EXECUTION ({@link UmlExecution}): §17.4.4 draws an
 * arrow onto the bar as readily as onto the spine, and a reading that snapped
 * every end to a lifeline would lose which activation the author aimed at.
 * A writer that needs the covering lifeline resolves it through
 * {@link UmlExecution.lifelineId}.
 */
export interface UmlMessage {
  /** The connector's own surface id — what a report names it by. */
  id: string;
  kind: UmlMessageKind;
  sourceId: string;
  targetId: string;
  /** The connector's centre text: §17.4.4's message label, as written. */
  label?: string;
  /** The height it is drawn at — see the docblock. */
  y: number;
}

/**
 * One InteractionOperand (§17.6.4) — a horizontal band of a combined fragment,
 * separated from the next by a dashed line.
 *
 * `guard` is §17.6.4's `[…]` InteractionConstraint WITHOUT its brackets, the
 * same way {@link UmlActivityEdge.guard} and {@link UmlTransition.guard} carry
 * theirs: the brackets are the notation's delimiter, and a writer that had to
 * strip them would be parsing its own model. The canvas keeps them — they are
 * what the author typed and what the renderer paints — and
 * {@link umlGuardText} takes exactly one pair off on the way in here.
 *
 * `y0` and `y1` are the band's own top and bottom in canvas units, because that
 * is what decides which messages are inside WHICH operand — an `alt`'s two
 * branches are told apart by nothing else.
 */
export interface UmlInteractionOperand {
  guard?: string;
  y0: number;
  y1: number;
}

/**
 * A CombinedFragment (§17.6) — the rectangle with an operator in its corner —
 * and, under the `ref` operator, §17.7's InteractionUse.
 *
 * ONE record for both, because the canvas draws one element for both
 * (`UmlFragmentElementModel`): §17.7.4's InteractionUse is the same rectangle
 * with the same pentagon, and every tool offers it from the same menu. The
 * writers branch on `operator === 'ref'`, which is one line each.
 *
 * `name` is the fragment's own word — the first operand's guard on an `alt`,
 * the referenced interaction's name on a `ref`.
 *
 * `coveredLifelineIds` is GEOMETRY, like every other membership in this file:
 * a fragment covers the lifelines whose spine runs through it, because that is
 * what §17.6.4 draws and a canvas holds no second statement about it.
 */
export interface UmlCombinedFragment extends UmlNodeBase {
  operator: UmlFragmentOperator;
  operands: UmlInteractionOperand[];
  coveredLifelineIds: string[];
}

/**
 * An ExecutionSpecification (§17.2.4) — the thin bar saying the participant is
 * busy between two occurrences.
 *
 * `lifelineId` is the spine the bar sits ON, resolved by measuring
 * ({@link umlLifelineAt}): a bar is a plain node and the canvas holds no
 * parent link, exactly as a port's owner and a lollipop's component are read by
 * measuring. Absent for a bar drawn off every spine — which is on the drawing
 * and in no file.
 */
export interface UmlExecution extends UmlNodeBase {
  lifelineId?: string;
  /** The occurrence it starts at. */
  y0: number;
  /** The occurrence it finishes at. */
  y1: number;
}

/** A DestructionOccurrenceSpecification (§17.2.4) — the X a lifeline ends at. */
export interface UmlDestruction extends UmlNodeBase {
  lifelineId?: string;
  y: number;
}

/**
 * One Interaction — the whole of what an `sd` sheet says.
 *
 * {@link UmlActivity}'s and {@link UmlStateMachine}'s twin, down to the reading
 * that the FRAME IS THE INTERACTION: §17.2.4 draws the interaction as a
 * rectangle with `sd <name>` in its corner, which is Annex A's frame, which is
 * the frame this model was read off.
 */
export interface UmlInteraction {
  /** The diagram frame's surface id — the Interaction IS the sheet. */
  id: string;
  name: string;
  lifelines: UmlLifeline[];
  /** ORDERED by `y`: top to bottom is earlier to later (§17.4.4). */
  messages: UmlMessage[];
  fragments: UmlCombinedFragment[];
  executions: UmlExecution[];
  destructions: UmlDestruction[];
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
  /** §17.2 — the Interaction this sheet draws, or nothing. The same shape. */
  interactions: UmlInteraction[];
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
  'message-sync': UML_ROLE['message-sync'],
  'message-async': UML_ROLE['message-async'],
  'message-reply': UML_ROLE['message-reply'],
  'message-create': UML_ROLE['message-create'],
  'message-delete': UML_ROLE['message-delete'],
};

/** The five message kinds, as a set — what tells a message from a relation. */
const MESSAGE_KINDS: ReadonlySet<UmlRelationKind> = new Set<UmlRelationKind>([
  'message-sync',
  'message-async',
  'message-reply',
  'message-create',
  'message-delete',
]);

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
export interface UmlHostCandidate {
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

/* ── The sequence sheet's own geometry (§17.2.4) ──────────────────────── */

/**
 * The x of a lifeline's SPINE — the dashed line everything on a sequence sheet
 * is measured against.
 *
 * The centre of the element's own box, which is the column and not the head:
 * `UmlNodeElementModel` makes a lifeline a narrow tall column so that the
 * connector layer's native anchors land on the spine, and paints the 160-wide
 * head over the top of it. So the spine is the column's own centre line, and
 * this function exists so that the four readers below cannot each decide that
 * differently.
 */
export function umlSpineX(lifeline: UmlBox): number {
  return lifeline.x + lifeline.w / 2;
}

/**
 * How far off a spine a bar or a cross may be drawn and still be ON it.
 *
 * Half the HEAD's width, and it is the notation's own number rather than a
 * guess: §17.2.4 draws an ExecutionSpecification as a bar centred on the spine
 * and a destruction as a cross centred on it, so the honest tolerance is "nearer
 * to this spine than to any other", and lifelines laid out at the 200-unit
 * spacing of an invented sequence layout are 200 apart. 80 is inside that by a
 * comfortable margin, so a bar dropped a little off centre finds its own
 * lifeline and a bar dropped between two finds neither.
 */
export const UML_SPINE_TOLERANCE = UML_LIFELINE_HEAD.w / 2;

/**
 * Which lifeline a bar or a cross is drawn ON — {@link umlHostOf}'s twin for
 * §17.2.4's two glyphs.
 *
 * A different reading from `umlHostOf` and deliberately so: a port is attached
 * to a box by TOUCHING it, and a bar is attached to a spine by SITTING ON it —
 * one is an edge-to-edge gap, the other a distance from one vertical line. The
 * nearest spine within {@link UML_SPINE_TOLERANCE} wins; an exact tie is broken
 * by the smaller id, never by the order the surface happened to be walked in,
 * for the reason `umlHostOf` gives: this decides what a FILE says.
 *
 * `undefined` when nothing is that near — a bar drawn between two spines belongs
 * to neither, and inventing an owner for it would put an execution on a
 * participant the author never drew it on.
 */
export function umlLifelineAt<T extends UmlHostCandidate>(
  glyph: UmlBox | undefined,
  lifelines: readonly T[]
): T | undefined {
  if (!glyph) return undefined;
  const cx = glyph.x + glyph.w / 2;
  let best: T | undefined;
  let bestGap = Number.POSITIVE_INFINITY;
  for (const lifeline of lifelines) {
    if (!lifeline.bounds) continue;
    const gap = Math.abs(cx - umlSpineX(lifeline.bounds));
    if (gap > UML_SPINE_TOLERANCE) continue;
    if (gap < bestGap || (gap === bestGap && best && lifeline.id < best.id)) {
      best = lifeline;
      bestGap = gap;
    }
  }
  return best;
}

/**
 * The operand bands of a combined fragment, as boxes — §17.6.4's horizontal
 * slices, separated by dashed lines.
 *
 * The operator BAND is carved off the top first (`UML_FRAGMENT_BAND`), exactly
 * as `umlSheetOf` carves the frame's heading off: the pentagon is the
 * fragment's own chrome, and a guard written over it is on the furniture rather
 * than in an operand.
 *
 * `size` is a relative WEIGHT (`UmlFragmentOperand`), so the bands are the body
 * divided in proportion — a fragment dragged taller keeps its operands' shares.
 * A fragment that declares no operands is ONE operand, which is what every
 * `opt`, every `loop` and every `ref` is, and its guard is the fragment's own
 * `name`.
 */
/**
 * A guard as the IR spells it — §17.6.4's condition with ONE surrounding pair
 * of brackets taken off.
 *
 * The canvas text is exactly what the author types, and §17.6.4.4 prints the
 * condition **in brackets**: `[x > 0]`, `[else]`. So the brackets are stored,
 * the renderer paints them verbatim, and the delimiter is stripped HERE, once,
 * for both writers — PlantUML writes its own `[…]` back round the condition and
 * XMI writes a bare `LiteralString`, and neither should have to parse the
 * model it is given.
 *
 * Tolerant in both directions, because a guard is free text an author types:
 * `x > 0` typed without brackets is the same condition and exports identically,
 * and `[[x > 0]]` gives up exactly one pair. Only a pair that actually
 * SURROUNDS the condition is taken — `[a] or [b]` opens and closes twice, and
 * dropping its outer characters would turn a sentence inside out.
 */
export function umlGuardText(written: string | undefined): string {
  const text = (written ?? '').trim();
  if (text.length < 2 || !text.startsWith('[') || !text.endsWith(']')) {
    return text;
  }
  let depth = 0;
  for (const [index, character] of [...text].entries()) {
    if (character === '[') depth += 1;
    else if (character === ']') {
      depth -= 1;
      if (depth === 0 && index < text.length - 1) return text;
    }
  }
  return depth === 0 ? text.slice(1, -1).trim() : text;
}

export function umlOperandBands(
  box: UmlBox,
  operands: readonly UmlFragmentOperand[] | undefined,
  name: string
): UmlInteractionOperand[] {
  const band = Math.min(UML_FRAGMENT_BAND, box.h);
  const top = box.y + band;
  const body = Math.max(0, box.h - band);
  const guardOf = (index: number, written: string | undefined) => {
    // …and the brackets come OFF here (see {@link umlGuardText}): the canvas
    // holds `[x > 0]` because that is what §17.6.4 draws and what the author
    // typed, and the IR holds the condition.
    const guard = umlGuardText(written ?? (index === 0 ? name : ''));
    return guard ? { guard } : {};
  };

  if (!operands || operands.length === 0) {
    return [{ ...guardOf(0, undefined), y0: top, y1: top + body }];
  }

  const weights = operands.map(operand =>
    Number.isFinite(operand.size) && operand.size > 0 ? operand.size : 1
  );
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const bands: UmlInteractionOperand[] = [];
  let y = top;
  for (const [index, operand] of operands.entries()) {
    // The LAST band is closed on the box rather than on the running sum, so
    // rounding cannot leave a sliver of the fragment in no operand at all.
    const next =
      index === operands.length - 1
        ? top + body
        : y + (body * weights[index]) / total;
    bands.push({ ...guardOf(index, operand.name), y0: y, y1: next });
    y = next;
  }
  return bands;
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
  /** §17.6.4's combined fragments — phase 3's frame. */
  const fragmentElements: UmlSourceElement[] = [];
  /** Every element's own box, by its own id — what a message's height is read
   * off (a connector's end names the ELEMENT it touches, which may be a tier or
   * a group rather than the node the end resolves to). */
  const boxOfElement = new Map<string, UmlBox>();

  for (const element of elements) {
    if (Array.isArray(element.childIds)) {
      groups.push({ id: element.id, childIds: element.childIds });
    }
    const box = umlBoundsOf(element);
    if (box) boxOfElement.set(element.id, box);
    if (element.type === 'umlNode') nodes.push(element);
    else if (element.type === 'umlSubject') subjects.push(element);
    else if (element.type === 'umlPartition') partitionElements.push(element);
    else if (element.type === 'umlRegion') regionElements.push(element);
    else if (element.type === 'umlFragment') fragmentElements.push(element);
    else if (element.type === 'connector') connectors.push(element);
  }

  /** What one node's group says, by tier. */
  const tiersOf = (node: UmlSourceElement) => {
    const group = umlGroupOf(node.id, groups);
    const component: UmlComponent = group ? siblingsOf(group, elements) : {};
    // `label` is the actor's and the use case's tier, `name` the classifier's
    // and `ident` §17.3.4's lifeline head — one of the three, never two
    // (`component.ts`). The head is read here rather than anywhere special
    // because a lifeline's name IS its head: `parseLifelineIdent` takes the
    // line this returns and splits it into the participant and its classifier.
    const named = component.name ?? component.label ?? component.ident;
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
  const lifelines: UmlLifeline[] = [];
  const executions: UmlExecution[] = [];
  const destructions: UmlDestruction[] = [];
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
    } else if (kind === 'lifeline') {
      // §17.3.4's `<name> : <Type>` — the one compartment a lifeline has, and
      // the same grammar §11.6.4 gives an instance. `keywords` and `isAbstract`
      // are `stereotypesOf`'s, read off the head like any other name tier.
      const ident = parseLifelineIdent(base.name);
      lifelines.push({
        ...base,
        // The `[<selector>]` §17.3.4 allows between the name and the colon is
        // kept ON the name rather than given a field of its own: it is part of
        // WHICH participant this is — `customers[3]` is one of a set — and
        // neither writer has a slot for it (`Lifeline::selector` is a
        // ValueSpecification, and a whiteboard has drawn no expression). Folded
        // back here, the head survives out and in; split out, it would be a
        // third field two writers would drop.
        name: ident.selector
          ? `${ident.name ?? ''}[${ident.selector}]`
          : (ident.name ?? ''),
        ...(ident.type ? { type: ident.type } : {}),
      });
    } else if (kind === 'execution') {
      // The bar's own extent IS the pair of occurrences it runs between
      // (§17.2.4): the top is the start, the bottom the finish. The lifeline it
      // sits on is measured below, once every spine on the sheet is known.
      executions.push({
        ...base,
        y0: bounds ? bounds.y : 0,
        y1: bounds ? bounds.y + bounds.h : 0,
      });
    } else if (kind === 'destruction') {
      destructions.push({
        ...base,
        y: bounds ? bounds.y + bounds.h / 2 : 0,
      });
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

  // ── The interaction's geometry (§17.2.4, §17.6.4) ─────────────────────
  //
  // Two readings, both by MEASURING, and both for the reason §11.3.4's port and
  // §10.4.4's lollipop are read that way: the notation draws a mark ON a line
  // and a rectangle AROUND a group of lines, and a whiteboard holds no second
  // statement about either. A bar off every spine and a fragment over no
  // lifeline are kept on the drawing and written into no file.

  for (const execution of executions) {
    const lifeline = umlLifelineAt(execution.bounds, lifelines);
    if (lifeline) execution.lifelineId = lifeline.id;
  }
  for (const destruction of destructions) {
    const lifeline = umlLifelineAt(destruction.bounds, lifelines);
    if (lifeline) destruction.lifelineId = lifeline.id;
  }

  const fragments: UmlCombinedFragment[] = [];
  for (const fragment of fragmentElements) {
    if (!onSheet(fragment)) continue;
    const box = umlBoundsOf(fragment);
    const written = umlTierText(fragment.name);
    const operator =
      (fragment.operator as UmlFragmentOperator | undefined) ?? 'alt';
    // A fragment COVERS the lifelines whose spine runs through it (§17.6.4),
    // ordered left to right — which is the order `ref over a, b` is written in
    // and the order a reader's eye takes them in.
    const covered = box
      ? lifelines
          .filter(lifeline => {
            const spine = lifeline.bounds
              ? umlSpineX(lifeline.bounds)
              : undefined;
            return (
              spine !== undefined && spine >= box.x && spine <= box.x + box.w
            );
          })
          .sort((a, b) => {
            const gap = umlSpineX(a.bounds!) - umlSpineX(b.bounds!);
            return gap !== 0 ? gap : a.id < b.id ? -1 : 1;
          })
          .map(lifeline => lifeline.id)
      : [];
    fragments.push({
      id: fragment.id,
      name: written,
      keywords: [],
      isAbstract: false,
      ...(box ? { bounds: box } : {}),
      // The model defaults it, and a fixture that states nothing means the
      // default rather than a fragment with no word in its pentagon.
      operator,
      // A `ref`'s `name` is the INTERACTION it refers to (§17.7.4), never a
      // guard, so it is not handed to the operand it would otherwise become the
      // condition of. Every other operator's `name` is the first operand's
      // guard, which is what `UmlFragmentElementModel.name` says it is.
      operands: box
        ? umlOperandBands(
            box,
            fragment.operands,
            operator === 'ref' ? '' : written
          )
        : [{ y0: 0, y1: 0 }],
      coveredLifelineIds: covered,
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
  /** §17.4's arrows, with the height each was drawn at. See {@link UmlMessage}. */
  const messages: UmlMessage[] = [];
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
    // §11.5.4's adornments, read off the two per-end labels ADR 0020 added to
    // the connector. Parsed only where the clause applies; kept verbatim
    // everywhere else — see {@link UmlRelation.sourceEnd}.
    const endOf = (text: unknown): UmlAssociationEnd | undefined => {
      const raw = umlTierText(text);
      if (!raw) return undefined;
      return ADORNED_RELATION_KINDS.has(kind) ? parseEndLabel(raw) : { raw };
    };
    const sourceEnd = endOf(connector.sourceLabel);
    const targetEnd = endOf(connector.targetLabel);

    relations.push({
      kind,
      sourceId: source,
      targetId: target,
      ...(label ? { label } : {}),
      ...(sourceEnd ? { sourceEnd } : {}),
      ...(targetEnd ? { targetEnd } : {}),
    });

    if (MESSAGE_KINDS.has(kind)) {
      messages.push({
        id: connector.id,
        kind: kind as UmlMessageKind,
        sourceId: source,
        targetId: target,
        ...(label ? { label } : {}),
        y: umlMessageHeight(
          connector,
          from ? boxOfElement.get(from) : undefined,
          to ? boxOfElement.get(to) : undefined
        ),
      });
    }
  }

  // §17.4.4: "every line fragment is either horizontal or downwards" — the
  // vertical axis is time, so the ORDER is what every writer needs and the
  // height is what the canvas stated. Sorted once, here, with document order
  // breaking a tie: two messages drawn at exactly the same height are two the
  // author did not order, and a sort that reordered them on every export would
  // make a golden file flap.
  messages.sort((a, b) => a.y - b.y);

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

  const interactions: UmlInteraction[] =
    lifelines.length > 0 ||
    messages.length > 0 ||
    fragments.length > 0 ||
    executions.length > 0 ||
    destructions.length > 0
      ? [
          {
            id: diagram.id,
            name,
            lifelines,
            messages,
            fragments,
            executions,
            destructions,
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
    interactions,
    relations,
    warnings,
  };
}

/**
 * The HEIGHT one message was drawn at — §17.4.4's whole statement about time.
 *
 * Read off the connector's stored END POSITIONS first, and that is the point of
 * the function: a connector's own bound is DERIVED by the router from the path
 * between its ends, and a freshly loaded document answers `[0,0,0,0]` until
 * something paints. A `position` is in the store, so an export run against a
 * document nobody has opened orders the conversation exactly as an export run
 * against a board on screen does.
 *
 * Both ends when both are anchored, because §17.4.4 draws a message as a
 * horizontal line and the two ends agree; the midpoint is what a message drawn
 * slightly sloping means. One end when only one is anchored. The connector's own
 * box when neither is — a message the author dragged onto empty canvas — and
 * zero when there is nothing at all to read, which puts it first and says so by
 * being obviously at the top.
 */
function umlMessageHeight(
  connector: UmlSourceElement,
  from: UmlBox | undefined,
  to: UmlBox | undefined
): number {
  const at = (
    end: { position?: readonly number[] } | null | undefined,
    box: UmlBox | undefined
  ): number | undefined => {
    const t = end?.position?.[1];
    if (!box || typeof t !== 'number' || !Number.isFinite(t)) return undefined;
    return box.y + t * box.h;
  };
  const head = at(connector.source, from);
  const tail = at(connector.target, to);
  if (head !== undefined && tail !== undefined) return (head + tail) / 2;
  if (head !== undefined) return head;
  if (tail !== undefined) return tail;

  const bounds = umlBoundsOf(connector);
  if (bounds && (bounds.w !== 0 || bounds.h !== 0)) {
    return bounds.y + bounds.h / 2;
  }
  return 0;
}

/* ── The interaction, as a TIMELINE (§17.2.4) ─────────────────────────── */

/**
 * One thing that happens on a sequence sheet, at the height it happens at.
 *
 * A discriminated union over the five, and a TREE rather than a list: a combined
 * fragment carries the entries drawn inside each of its operands, which is what
 * §17.6.4 makes it — an `InteractionOperand` OWNS the fragments in its band, and
 * PlantUML's `alt … else … end` is the same nesting spelled with keywords.
 */
export type UmlTimelineEntry =
  | { at: 'message'; y: number; message: UmlMessage }
  | { at: 'execution-start'; y: number; execution: UmlExecution }
  | { at: 'execution-finish'; y: number; execution: UmlExecution }
  | { at: 'destruction'; y: number; destruction: UmlDestruction }
  | {
      at: 'fragment';
      y: number;
      fragment: UmlCombinedFragment;
      operands: UmlTimelineOperand[];
    };

/** One operand's band and what is drawn in it. */
export interface UmlTimelineOperand {
  operand: UmlInteractionOperand;
  entries: UmlTimelineEntry[];
}

/**
 * Which entry comes first when two were drawn at exactly the same height.
 *
 * Only a hand-drawn board ever ties — an invented layout gives every event a
 * slot of its own — and the order is the one a reader would write the lines in:
 * the fragment that CONTAINS the moment opens first, then the arrow, then the
 * bar it starts, then the bar it ends, and last the cross that ends the
 * participant.
 */
const TIMELINE_RANK: Record<UmlTimelineEntry['at'], number> = {
  fragment: 0,
  message: 1,
  'execution-start': 2,
  'execution-finish': 3,
  destruction: 4,
};

/**
 * One Interaction as the ordered, nested account of what happens on it — the
 * reading BOTH writers take, so that a `.puml` and an XMI file can never
 * disagree about the order of a conversation.
 *
 * ## What decides that something is INSIDE a fragment
 *
 * Two things, and both are what §17.6.4 draws: the moment falls inside the
 * fragment's box VERTICALLY, and the fragment COVERS the lifeline it happens on
 * ({@link UmlCombinedFragment.coveredLifelineIds}). The second is what stops an
 * `alt` drawn over two of five participants from swallowing a message exchanged
 * between the other three at the same height — which a y-only test would, and
 * which would put an arrow in a branch nobody drew it in.
 *
 * The innermost matching fragment wins, measured by AREA, exactly as `umlHostOf`
 * and `containerOf` decide every other containment in this framework.
 *
 * Pure and total: every message, bar and cross of the interaction comes back
 * exactly once, whether it landed in a fragment or at the top level.
 */
export function umlInteractionTimeline(
  interaction: UmlInteraction
): UmlTimelineEntry[] {
  const lifelineOfExecution = new Map(
    interaction.executions.map(execution => [
      execution.id,
      execution.lifelineId,
    ])
  );
  /** The spine an end of a message is on — a lifeline, or a bar's lifeline. */
  const spineOf = (id: string): string | undefined =>
    lifelineOfExecution.has(id) ? lifelineOfExecution.get(id) : id;

  const covers = new Map(
    interaction.fragments.map(fragment => [
      fragment.id,
      new Set(fragment.coveredLifelineIds),
    ])
  );
  const areaOf = (fragment: UmlCombinedFragment) =>
    fragment.bounds
      ? Math.max(0, fragment.bounds.w) * Math.max(0, fragment.bounds.h)
      : Number.POSITIVE_INFINITY;

  /**
   * The innermost fragment a moment on these spines falls in.
   *
   * `exclude` is the fragment being placed itself, so that a fragment cannot
   * claim to contain itself; a fragment nested in another is placed against the
   * outer one by its own top edge.
   */
  const fragmentAt = (
    y: number,
    spines: readonly (string | undefined)[],
    exclude?: UmlCombinedFragment
  ): UmlCombinedFragment | undefined => {
    let best: UmlCombinedFragment | undefined;
    let bestArea = Number.POSITIVE_INFINITY;
    for (const fragment of interaction.fragments) {
      if (fragment === exclude || !fragment.bounds) continue;
      const box = fragment.bounds;
      if (y < box.y || y > box.y + box.h) continue;
      if (exclude?.bounds && areaOf(fragment) <= areaOf(exclude)) continue;
      const covered = covers.get(fragment.id)!;
      const named = spines.filter((id): id is string => Boolean(id));
      // A fragment covering NO lifeline of this moment is a rectangle drawn
      // beside the conversation, not round it.
      if (named.length > 0 && !named.every(id => covered.has(id))) continue;
      const area = areaOf(fragment);
      if (
        area < bestArea ||
        (area === bestArea && best && fragment.id < best.id)
      ) {
        best = fragment;
        bestArea = area;
      }
    }
    return best;
  };

  /** Which operand band of a fragment holds this height — the last that opens. */
  const bandAt = (fragment: UmlCombinedFragment, y: number): number => {
    let index = 0;
    for (const [at, operand] of fragment.operands.entries()) {
      if (y >= operand.y0) index = at;
    }
    return index;
  };

  const built = new Map<
    string,
    Extract<UmlTimelineEntry, { at: 'fragment' }>
  >();
  for (const fragment of interaction.fragments) {
    built.set(fragment.id, {
      at: 'fragment',
      y: fragment.bounds ? fragment.bounds.y : 0,
      fragment,
      operands: fragment.operands.map(operand => ({ operand, entries: [] })),
    });
  }

  const root: UmlTimelineEntry[] = [];
  const place = (
    entry: UmlTimelineEntry,
    spines: readonly (string | undefined)[],
    self?: UmlCombinedFragment
  ) => {
    const host = fragmentAt(entry.y, spines, self);
    if (!host) {
      root.push(entry);
      return;
    }
    const container = built.get(host.id)!;
    const band = container.operands[bandAt(host, entry.y)];
    if (band) band.entries.push(entry);
    else root.push(entry);
  };

  // Outermost first, so a nested fragment's own container already exists when
  // the fragments inside it are placed. Ordering by area is what makes that
  // true whatever order the canvas was walked in.
  for (const fragment of [...interaction.fragments].sort(
    (a, b) => areaOf(b) - areaOf(a)
  )) {
    place(built.get(fragment.id)!, fragment.coveredLifelineIds, fragment);
  }

  for (const message of interaction.messages) {
    place({ at: 'message', y: message.y, message }, [
      spineOf(message.sourceId),
      spineOf(message.targetId),
    ]);
  }
  for (const execution of interaction.executions) {
    place({ at: 'execution-start', y: execution.y0, execution }, [
      execution.lifelineId,
    ]);
    place({ at: 'execution-finish', y: execution.y1, execution }, [
      execution.lifelineId,
    ]);
  }
  for (const destruction of interaction.destructions) {
    place({ at: 'destruction', y: destruction.y, destruction }, [
      destruction.lifelineId,
    ]);
  }

  const order = (entries: UmlTimelineEntry[]): UmlTimelineEntry[] => {
    const sorted = [...entries].sort(
      (a, b) => a.y - b.y || TIMELINE_RANK[a.at] - TIMELINE_RANK[b.at]
    );
    for (const entry of sorted) {
      if (entry.at !== 'fragment') continue;
      for (const band of entry.operands) band.entries = order(band.entries);
    }
    return sorted;
  };
  return order(root);
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
