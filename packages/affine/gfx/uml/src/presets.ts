import {
  FontFamily,
  FontStyle,
  FontWeight,
  ShapeStyle,
  StrokeStyle,
  TextAlign,
  type UmlNodeKind,
} from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';

import type { UmlBox } from './component.js';
import {
  UML_CARD,
  UML_INK,
  UML_NAME_FONT_SIZE,
  UML_NODE_BOX,
  UML_NODE_RADIUS,
  UML_NODE_STROKE_WIDTH,
} from './consts.js';
import { UML_ROLE_OF_KIND } from './roles.js';

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
 * Twenty-three of thirty-five, and the node renderer is the authority on which. A package is
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
 * conditionally: all thirty-five write the same key set with different values. Kept
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
 */
export function umlTextProps(
  role: string,
  box: UmlBox,
  options: { fontSize: number; align: TextAlign; bold?: boolean }
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
  };
}
