import type { SerializedElementProps } from '@labre/affine-block-surface/interchange';
import {
  ConnectorMode,
  FontFamily,
  FontStyle,
  FontWeight,
  ShapeStyle,
  StrokeStyle,
  TextAlign,
  TextDecoration,
} from '@labre/affine-model/headless';
import type { UmlNodeKind } from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';

import {
  type UmlBox,
  umlCompartmentBoxes,
  umlLabelRoleOf,
} from './component.js';
import {
  UML_BODY_FONT_SIZE,
  UML_CARD,
  UML_DIAGRAM_BOX,
  UML_EDGE_WIDTH,
  UML_FRAGMENT_BOX,
  UML_INK,
  UML_NAME_FONT_SIZE,
  UML_NODE_BOX,
  UML_NODE_RADIUS,
  UML_NODE_STROKE_WIDTH,
  UML_PARTITION_BOX,
  UML_REGION_BOX,
  UML_SUBJECT_BOX,
} from './consts.js';
import { UML_EDGE_STYLE, type UmlEdgeRole } from './edge-styles.js';
import { UML_UNLABELLED_KINDS } from './keywords.js';
import { UML_ROLE, UML_ROLE_OF_KIND } from './roles.js';

/**
 * What a UML shape IS, as props — the ONE description the creation site, the
 * morph and the templates all read (R17).
 *
 * The rule exists because a kind's appearance is written by the preset of the
 * kind it was created as and nothing ever rewrites it afterwards: a second table
 * restating the same sizes and colours would agree with this one on the day it
 * was written and drift on the first restyle. Derived, they cannot — a morphed
 * classifier and one freshly drawn from the toolbox are the same element.
 *
 * ## No colour decisions here, and that is the notation's doing
 *
 * UML 2.5.1 defines no palette. Every figure in the specification is black lines
 * on white paper, and what tells a class from an interface from an enumeration
 * is the KEYWORD written above the name (§9.5.4), never a hue. So this file
 * seeds one ink and one paper off the shared neutral scale (R33, through
 * `consts.ts`) and spends its judgement on the two things the spec DOES
 * legislate: which kinds are a divided rectangle, and which are a picture.
 */

/**
 * The kinds whose GLYPH draws the body, so the native shape underneath paints
 * nothing at all.
 *
 * Twenty-five of thirty-eight, and the node renderer is the authority on which. A package is
 * a tabbed folder (§12.2.4), a note a rectangle with a folded corner (Annex A),
 * an actor a stick figure (§18.1.4) — none of which a native rect can be, so
 * each is created `filled: false` with `StrokeStyle.None` and the renderer
 * paints the outline and the body itself, reading `fillColor` / `strokeColor`
 * off this same model. Both therefore stay editable from the ordinary shape
 * toolbar, exactly like every other node's.
 *
 * Phase 2 added six more, and every one of them for the same reason:
 *
 *  - `node`, `device` and `execution-environment` are the 3-D CUBE of §19.4.4 —
 *    three faces, two of them parallelograms, which no `shapeType` has;
 *  - `provided-interface` and `required-interface` are the ball and the socket
 *    of §10.4.4, each a curve on a stub rather than a filled area;
 *  - `port` is the one that looks as if a native rect would do (§11.3.4 draws a
 *    small square), and it is here because the square is the GLYPH: it is drawn
 *    to a fixed proportion of the element so that a port dragged bigger stays a
 *    port rather than becoming a box, and it is centred so the name written
 *    beside it lines up with it.
 *
 * The USE CASE is deliberately not on the list, and it is the one that looks as
 * if it should be: an ellipse is not a rectangle either — but it is a native
 * `shapeType`, so the platform draws it, fills it and hit-tests it with no glyph
 * involved. Nor are `component` and `artifact`, which ARE the native filled
 * rectangle with a small icon painted into the corner. A kind is on this list
 * when the SHAPE LAYER cannot draw its body, not when it has a glyph.
 *
 * They stay hit-testable across their whole area all the same:
 * `UmlNodeElementModel.includesPoint` forces the interior test regardless of
 * `filled`, which is what keeps an unfilled package draggable and
 * double-clickable across its body rather than along its (absent) stroke.
 */
export const GLYPH_BODY_KINDS: ReadonlySet<UmlNodeKind> = new Set<UmlNodeKind>([
  'package',
  'note',
  'actor',
  'port',
  'provided-interface',
  'required-interface',
  'node',
  'device',
  'execution-environment',
  // Phase 2, the behaviour marks. Fourteen more, and every one of them for the
  // reason the nine above are here — the shape layer cannot draw the body:
  //
  //  - `initial`, `junction`, `activity-final`, `flow-final`, `final-state`,
  //    `shallow-history`, `deep-history`, `entry-point`, `exit-point` are
  //    CIRCLES with something inside them (a second disc, a cross, a letter) or
  //    a filled disc at a fixed proportion of the element — an `ellipse`
  //    shapeType would stretch into an egg and would carry nothing inside it;
  //  - `fork` is the bar of §15.3.4, drawn to a fixed proportion of the element
  //    so a fork dragged taller stays a bar rather than becoming a box;
  //  - `send-signal` and `accept-event` are the convex and concave pentagons of
  //    §16.3.4, which no `shapeType` has;
  //  - `time-event` is the hourglass of §16.10.4, two triangles meeting at a
  //    point;
  //  - `terminate` is a bare X — nothing but two strokes, and a filled
  //    rectangle behind it would be a box the notation does not draw.
  //
  // NOT on the list, and each looking as if it should be: `action` and `state`
  // are the native rect with a `radius` (§15.3.4, §14.2.4 — a round-cornered
  // rectangle IS a native rounded rect); `decision` and `choice` are the native
  // `diamond` shapeType; `object-node` is the plain native rect of §15.4.4.
  'initial',
  'activity-final',
  'flow-final',
  'fork',
  'send-signal',
  'accept-event',
  'time-event',
  'final-state',
  'junction',
  'shallow-history',
  'deep-history',
  'entry-point',
  'exit-point',
  'terminate',
  // Phase 3, the interaction marks. Two more, and again because the shape
  // layer cannot draw the body:
  //
  //  - `lifeline` is §17.3.4's head box over a DASHED SPINE, and the element is
  //    the 16-wide column the spine runs down — a native rect would paint a
  //    tall thin box where the notation draws a line, and would paint no head
  //    at all;
  //  - `destruction` is a bare X (§17.2.4), two strokes and nothing else, so a
  //    filled rectangle behind it would be a box the notation does not draw —
  //    the argument `terminate` already makes.
  //
  // `execution` is deliberately NOT here: §17.2.4 draws an
  // ExecutionSpecification as a thin FILLED RECTANGLE on the spine, which is
  // exactly what a native rect is. The shape layer fills it, strokes it,
  // hit-tests it and re-themes it, and a glyph over it would reimplement all
  // four — the same call `object-node` and `action` make.
  'lifeline',
  'destruction',
]);

/**
 * The kinds the native shape draws with ROUNDED corners.
 *
 * Two, and both by the notation's own instruction: §15.3.4 draws an Action as a
 * round-cornered rectangle and §14.2.4 draws a State as one. They are the only
 * places this pack departs from `radius: 0`, which is not a house style but what
 * §11.4.4 draws for a classifier — so the departure is as literal as the rule.
 *
 * A native `radius` rather than a glyph, which is what keeps both OFF
 * {@link GLYPH_BODY_KINDS}: the shape layer fills, strokes, hit-tests and
 * re-themes a rounded rect for free, and a glyph-drawn one would have to
 * reimplement all four.
 */
export const ROUNDED_KINDS: ReadonlySet<UmlNodeKind> = new Set<UmlNodeKind>([
  'action',
  'state',
]);

/**
 * The kinds the native shape draws as a DIAMOND.
 *
 * §15.3.4's decision/merge node and §14.2.4's choice pseudostate — two different
 * metaclasses on two different diagrams, drawn as the same diamond, which is why
 * they share this line and not a role. `diamond` is a native `shapeType`, so the
 * platform fills it, strokes it and hit-tests it with no glyph involved, exactly
 * as it does the use case's ellipse.
 */
const DIAMOND_KINDS: ReadonlySet<UmlNodeKind> = new Set<UmlNodeKind>([
  'decision',
  'choice',
]);

/**
 * Every prop a UML shape is created with, for one kind and one box.
 *
 * `index` is deliberately NOT here: it is a layering statement the creation site
 * makes about the handful of elements it is about to write in painting order,
 * and it means nothing to an element that already exists.
 *
 * No `text` either, and that is R16 rather than an omission: a classifier's
 * name, attributes and operations are canvas TEXT elements grouped with the
 * shape, and the shape is a body and nothing else. Its text COLOUR and FACE are
 * still seeded, because a shape's native inner text remains reachable — an
 * author may type into it through the plain shape editor, and what they type
 * must not arrive in some other diagram's font.
 */
export function umlNodeProps(
  kind: UmlNodeKind,
  box: { xywh: string }
): Record<string, unknown> & { type: string } {
  const glyphBody = GLYPH_BODY_KINDS.has(kind);

  return {
    type: 'umlNode',
    kind,
    // Semantic identity, posted next to `kind` — which stays untouched and keeps
    // driving the rendering. The role is the authority on what the box MEANS,
    // and it is the only thing that can say so: a class, an interface and an
    // enumeration are the SAME rectangle, told apart by their keyword line
    // (`./roles.ts`).
    role: UML_ROLE_OF_KIND[kind],
    // The kinds the platform draws for us that are not rectangles. §18.1.4
    // draws a use case as an ellipse; §15.3.4 and §14.2.4 draw a decision and a
    // choice as a diamond. A native `shapeType` means the platform fills it,
    // strokes it and hit-tests it with no glyph involved.
    shapeType:
      kind === 'use-case'
        ? 'ellipse'
        : DIAMOND_KINDS.has(kind)
          ? 'diamond'
          : 'rect',
    filled: !glyphBody,
    fillColor: UML_CARD,
    strokeColor: UML_INK,
    strokeWidth: UML_NODE_STROKE_WIDTH,
    strokeStyle: glyphBody ? StrokeStyle.None : StrokeStyle.Solid,
    shapeStyle: ShapeStyle.General,
    // Zero roughness everywhere, and not a default worth revisiting: UML's
    // figures are drawn with a ruler, and a hand-drawn wobble would be this
    // pack inventing a house style for a notation that has one.
    roughness: 0,
    // The corner is a different question, and the notation answers it per
    // artefact: square for a classifier (§11.4.4), ROUNDED for an action
    // (§15.3.4) and a state (§14.2.4). So the zero here is the classifier's
    // rule rather than a pack-wide one — see {@link ROUNDED_KINDS}.
    radius: ROUNDED_KINDS.has(kind) ? UML_NODE_RADIUS : 0,
    color: UML_INK,
    fontFamily: FontFamily.Inter,
    fontSize: UML_NAME_FONT_SIZE,
    textAlign: TextAlign.Center,
    xywh: box.xywh,
  };
}

/**
 * The box {@link umlMorphProps} hands {@link umlNodeProps} and then throws away.
 * Never written to a document: a morph keeps the geometry the element already
 * has, and this exists only because the one builder takes a box.
 */
const DISCARDED_BOX = '[0,0,0,0]';

/** What a morph must never rewrite: identity, geometry, and the user's words. */
const NOT_A_MORPH = ['type', 'xywh', 'text'] as const;

/**
 * What a kind is worth to a shape that ALREADY EXISTS — {@link umlNodeProps}
 * minus the three things a morph has no business touching.
 *
 * ## Why the whole preset, and not `{kind, role}`
 *
 * Because on this pack's own table it is visibly not enough. Morphing a class to
 * a package flips `filled` and `strokeStyle` (the folder is a glyph, the class
 * is a native rect); morphing either to a use case rewrites `shapeType` from
 * `rect` to `ellipse`. Two keys would leave a filled rectangle painted behind a
 * tabbed folder, or an ellipse's label centred in a box that is still square.
 *
 * Shipped in phase 1 although the morph itself is tranche D's: the preset is
 * what a morph is FOR, and writing it here beside the creation props is what
 * stops the two from being written by different hands against different tables.
 */
export function umlMorphProps(kind: UmlNodeKind): Record<string, unknown> {
  // Widened to the plain record on the way in: `type` is required on what the
  // creation builder returns, and `delete` may only take an optional key.
  const props: Record<string, unknown> = {
    ...umlNodeProps(kind, { xywh: DISCARDED_BOX }),
  };
  for (const key of NOT_A_MORPH) delete props[key];
  return props;
}

/**
 * Every key ANY kind's props may carry — the union over the whole pack.
 *
 * Computed rather than listed, so a preset that starts spreading a key
 * conditionally is covered on the day it is added rather than on the day
 * somebody notices.
 */
const EVERY_MORPH_KEY = new Set(
  (Object.keys(UML_NODE_BOX) as UmlNodeKind[]).flatMap(kind =>
    Object.keys(umlMorphProps(kind))
  )
);

/**
 * The fields to DELETE after morphing to `kind` — the keys some other kind
 * writes and this one does not.
 *
 * EMPTY for every kind today, because no UML preset spreads anything
 * conditionally: all thirty-eight write the same key set with different values. Kept
 * anyway, and derived rather than hard-coded to `[]`, for the reason BPMN's and
 * C4's equivalents exist at all — a patch cannot express absence, and the day
 * one kind stops writing a key the previous kind's value would otherwise stay
 * in the Y.Map, silently in force.
 */
export function umlMorphClears(kind: UmlNodeKind): readonly string[] {
  const present = new Set(Object.keys(umlMorphProps(kind)));
  return [...EVERY_MORPH_KEY].filter(key => !present.has(key));
}

/**
 * Every prop a compartment's TEXT element is created with.
 *
 * Passing them all explicitly is not belt and braces: `surface.addElement` runs
 * new props through `EditPropsStore.applyLastProps('text', …)`, which merges
 * whatever the user last set on a free text element underneath — a 24px face, a
 * colour from another diagram, a left alignment. Explicit props win the merge,
 * so the only ones that survive it are the ones written here. An operations
 * compartment inheriting the colour of the last sticky note somebody typed would
 * be a notation set by accident.
 *
 * `hasMaxWidth` is what keeps a long signature inside the classifier instead of
 * running out over the canvas: the box wraps at its own width and grows
 * downward, and the group grows with it, so a component always contains its own
 * words.
 *
 * `bold` is offered for exactly one tier — the classifier's NAME, which is the
 * heading of the box and, at 16px against a 13px feature line, is not set apart
 * by size alone. Everything else is Regular, because UML reserves its type
 * variations for meanings the grammar reads (italics for abstract, §9.2.4) and
 * a decorative weight would compete with them.
 *
 * `decoration` is written only when given — see {@link umlNameDecoration}. A
 * decoration is not a remembered style, so `applyLastProps` has none to merge
 * and its absence is the plain text every other tier is.
 */
export function umlTextProps(
  role: string,
  box: UmlBox,
  options: {
    fontSize: number;
    align: TextAlign;
    bold?: boolean;
    decoration?: TextDecoration;
  }
): Record<string, unknown> & { type: string } {
  return {
    type: 'text',
    role,
    color: UML_INK,
    fontFamily: FontFamily.Inter,
    fontSize: options.fontSize,
    fontWeight: options.bold ? FontWeight.SemiBold : FontWeight.Regular,
    fontStyle: FontStyle.Normal,
    textAlign: options.align,
    hasMaxWidth: true,
    xywh: new Bound(box.x, box.y, box.w, box.h).serialize(),
    ...(options.decoration ? { textDecoration: options.decoration } : {}),
  };
}

/**
 * The decoration a kind's NAME tier is created with: an instance's name is
 * underlined (§9.8.4), every other name is left undecided — no key at all, so
 * it stores what it stored before ADR 0030.
 *
 * One preset, read by every creation site (the toolbox, the importers, and the
 * templates that record the toolbox), so none restates the notation. The
 * underline lives on the TEXT since ADR 0030 §4: it runs under the words, not
 * across the compartment, and the author can restyle it from the text toolbar.
 * The glyph's old rule survives only as a paint-time fallback for a name that
 * never carried the field (`node/node-renderer.ts`).
 */
export function umlNameDecoration(
  kind: UmlNodeKind
): TextDecoration | undefined {
  return kind === 'object' ? TextDecoration.Underline : undefined;
}

/* ── The whole artefact: shape, tiers, group ──────────────────────────── */

/**
 * The glyph kinds whose one tier is a `uml:name` rather than a `uml:label`.
 *
 * The line between the two is drawn by `roles.ts` and it is not about having a
 * rectangle: `uml:name` is the tier a KEYWORD may be written on and the grammar
 * reads back, `uml:label` is a name and nothing else. So:
 *
 *  - a **package** name is a namespace, parseable and qualified (§12.2.4), and a
 *    **note**'s text is what the exporter writes as the comment's body;
 *  - the three **deployment cubes** are named INSIDE their front face, over a
 *    keyword line — `«device»`, `«executionEnvironment»` (§19.4.4) — which is
 *    exactly what a name compartment is for. It is also load-bearing rather than
 *    tidy: the morph's `afterMorph` rewrites `uml:name` and only that, so a cube
 *    labelled instead of named would morph into a device that never said so.
 *
 * Everything else here carries a LABEL: a port's word sits beside a 16-unit
 * square and the two interface marks' beside a ball and a socket, none of them
 * inside anything, and none of them ever carrying a keyword.
 *
 * Written once, here, since {@link umlArtefactElements} became the one assembly
 * (`docs/adr/0045`): the toolbar and the importers each used to keep a copy.
 */
const NAMED_GLYPH_KINDS: ReadonlySet<UmlNodeKind> = new Set<UmlNodeKind>([
  'package',
  'note',
  'node',
  'device',
  'execution-environment',
]);

/** The words of an artefact, tier by tier, written exactly as given. */
export interface UmlTierTexts {
  name: string;
  /** The second compartment, one member per line; `''` when absent. */
  attributes?: string;
  /** The third compartment, one member per line; `''` when absent. */
  operations?: string;
}

/** The elements of one artefact, as {@link umlArtefactElements} names them. */
export type UmlArtefactPart =
  | 'shape'
  | 'name'
  | 'attributes'
  | 'operations'
  | 'group';

/**
 * One UML artefact in `box`, as the elements a document holds: the shape, the
 * tiers its kind is worth, and the group that makes them one thing, LAST.
 *
 * The ONE assembly of an artefact (`docs/adr/0045`): the toolbar's actions
 * (through the toolbox, `toolbox.ts`), a host with no editor (the same
 * toolbox) and every importer (`umlElementsFromModel`, `import.ts`) write
 * through here, so a class drawn by hand, one placed by a host and one read
 * out of a `.puml` file are the same five elements, down to the stroke width.
 * What differs between them is what they pass: where the box is, the words
 * (the toolbar's seeds, a host's texts, the file's own), and the ids.
 *
 * ## How many tiers is the LAYOUT's answer, not this function's
 *
 * A tier is written for each box {@link umlCompartmentBoxes} returns and for
 * no other: a class gets name, attributes and operations; an object, a
 * component, an artifact and a state a name over one body tier; a glyph its
 * one word, placed against its picture. A mark the notation draws no word on
 * ({@link UML_UNLABELLED_KINDS}) is the SHAPE alone, and therefore no group
 * either: a group of one element is a wrapper a user would have to descend
 * through to reach the mark it holds.
 *
 * ## The name tier
 *
 * `uml:name` on a divided box and on the five {@link NAMED_GLYPH_KINDS};
 * otherwise the kind's label role ({@link umlLabelRoleOf}: a lifeline's head
 * is `uml:lifeline-ident`, every other single word `uml:label`). Bold on a
 * divided box only, where it is the heading; read LEFT on a note, which holds
 * a sentence rather than a title (Annex A); underlined on an instance
 * ({@link umlNameDecoration}). A compartment of features is a list of
 * signatures and is read down its left edge (§9.5.4).
 *
 * ## Ids
 *
 * `id(part)` is asked once per element, in painting order — shape, name,
 * attributes, operations, group — and only for the elements written: the
 * importer mints its `uml-import-<n>` names in that order, the toolbox
 * prefixes a local name.
 */
export function umlArtefactElements(
  kind: UmlNodeKind,
  box: UmlBox,
  tiers: UmlTierTexts,
  id: (part: UmlArtefactPart) => string
): SerializedElementProps[] {
  const shape = {
    // NO `text`: the words are the tiers below, and the shape is a body and
    // nothing else (R16).
    ...umlNodeProps(kind, {
      xywh: new Bound(box.x, box.y, box.w, box.h).serialize(),
    }),
    id: id('shape'),
  };
  if (UML_UNLABELLED_KINDS.has(kind)) return [shape];

  const boxes = umlCompartmentBoxes(kind, box.x, box.y, box.w, box.h);
  const compartmented = boxes.attributes !== undefined;
  const members: SerializedElementProps[] = [
    shape,
    {
      ...umlTextProps(
        compartmented || NAMED_GLYPH_KINDS.has(kind)
          ? UML_ROLE.name
          : umlLabelRoleOf(kind),
        boxes.name,
        {
          fontSize: UML_NAME_FONT_SIZE,
          align: kind === 'note' ? TextAlign.Left : TextAlign.Center,
          ...(compartmented ? { bold: true } : {}),
          decoration: umlNameDecoration(kind),
        }
      ),
      id: id('name'),
      text: tiers.name,
    },
  ];
  for (const [part, role, tierBox] of [
    ['attributes', UML_ROLE.attributes, boxes.attributes],
    ['operations', UML_ROLE.operations, boxes.operations],
  ] as const) {
    if (!tierBox) continue;
    members.push({
      ...umlTextProps(role, tierBox, {
        fontSize: UML_BODY_FONT_SIZE,
        align: TextAlign.Left,
      }),
      id: id(part),
      text: tiers[part] ?? '',
    });
  }
  return [
    ...members,
    {
      type: 'group',
      id: id('group'),
      // A plain record is a legal `children`: the group's own `propsToY` takes
      // the KEYS. No title, deliberately: the group renderer paints one only
      // while the artefact is selected, and a package announcing itself as
      // "Group 3" above its own name is a label nobody wrote.
      children: Object.fromEntries(members.map(m => [m.id, true])),
    },
  ];
}

/* ── The frames ───────────────────────────────────────────────────────── */

/** The five background elements a UML diagram is drawn on and in. */
export type UmlFrameType =
  | 'umlDiagram'
  | 'umlSubject'
  | 'umlPartition'
  | 'umlRegion'
  | 'umlFragment';

/** The box each frame is created at, by the toolbar and the importers. */
export const UML_FRAME_BOX: Readonly<
  Record<UmlFrameType, { readonly w: number; readonly h: number }>
> = {
  umlDiagram: UML_DIAGRAM_BOX,
  umlSubject: UML_SUBJECT_BOX,
  umlPartition: UML_PARTITION_BOX,
  umlRegion: UML_REGION_BOX,
  umlFragment: UML_FRAGMENT_BOX,
};

/** The role each frame carries — one table, read by every creation site. */
const UML_FRAME_ROLE: Readonly<Record<UmlFrameType, string>> = {
  umlDiagram: UML_ROLE.diagram,
  umlSubject: UML_ROLE.subject,
  umlPartition: UML_ROLE.partition,
  umlRegion: UML_ROLE.region,
  umlFragment: UML_ROLE.fragment,
};

/**
 * A frame's props: its type, its role, the fields the caller states (a name, a
 * diagram's kind, a fragment's operator…) and its box. The toolbox and the
 * importers both write a frame through here, so the role a frame is born with
 * is the one table above.
 */
export function umlFrameProps(
  type: UmlFrameType,
  box: { xywh: string },
  fields: Record<string, unknown>
): SerializedElementProps {
  return { type, role: UML_FRAME_ROLE[type], ...fields, xywh: box.xywh };
}

/* ── The relationships ────────────────────────────────────────────────── */

/**
 * One UML relationship, as the props `surface.addElement` takes, ends left to
 * the caller: the role, the STRAIGHT mode, the ink and the line
 * {@link UML_EDGE_STYLE} says the relationship looks like.
 *
 * The edge tools arm the connector with it (`activateUmlEdge`), the toolbox
 * builds a host's connector from it and the importers draw a file's
 * relations through it, so the three are one line. STRAIGHT, always: a class
 * diagram is a graph, not a process laid out in lanes, and the elbows of an
 * orthogonal router would read as a route through the diagram nobody drew.
 */
export function umlConnectorProps(edge: UmlEdgeRole) {
  return {
    type: 'connector' as const,
    role: UML_ROLE[edge],
    mode: ConnectorMode.Straight,
    stroke: UML_INK,
    strokeWidth: UML_EDGE_WIDTH,
    ...UML_EDGE_STYLE[edge],
  };
}
