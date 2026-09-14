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
  parseCompartment,
  parseOperation,
  parseProperty,
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
  | 'association'
  | 'aggregation'
  | 'composition'
  | 'generalization'
  | 'realization'
  | 'dependency'
  | 'anchor'
  | 'include'
  | 'extend';

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
 * ## What is warned about
 *
 * Two things, and both are a line the author DREW that the file cannot carry: a
 * typed relationship with an end this diagram cannot resolve, and a connector
 * between two UML nodes carrying no role at all. The second is not an error —
 * `docs/adr/0010` is explicit that the role IS the statement, so a bare
 * connector relates nothing — but a user who drew a line between two classes
 * and gets a file without it is owed the sentence.
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

  for (const element of elements) {
    if (Array.isArray(element.childIds)) {
      groups.push({ id: element.id, childIds: element.childIds });
    }
    if (element.type === 'umlNode') nodes.push(element);
    else if (element.type === 'umlSubject') subjects.push(element);
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

  const classifiers: UmlClassifier[] = [];
  const packages: UmlPackageNode[] = [];
  const actors: UmlActorNode[] = [];
  const useCases: UmlUseCaseNode[] = [];
  const notes: UmlNote[] = [];
  const subjectBoxes: UmlSubjectBox[] = [];

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
    } else {
      // A kind this build does not draw yet (phase 2 widens the union): it is
      // on the sheet and it answers for itself, but nothing writes it down.
      continue;
    }
    artefactOf.set(node.id, node.id);
  }

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

  const kind = (diagram.kind as UmlDiagramKind | undefined) ?? 'class';
  const name = umlTierText(diagram.name);
  const heading =
    typeof diagram.heading === 'string' && diagram.heading
      ? diagram.heading
      : `${UML_DIAGRAM_KIND_TAG[kind] ?? kind} ${name}`.trim();

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
