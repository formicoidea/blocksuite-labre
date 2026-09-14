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
 * Nine of sixteen, and the node renderer is the authority on which. A package is
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
    // The one kind the platform draws for us that is not a rectangle. §18.1.4
    // draws a use case as an ellipse, and a native `shapeType` means the
    // platform fills it, strokes it and hit-tests it with no glyph involved.
    shapeType: kind === 'use-case' ? 'ellipse' : 'rect',
    filled: !glyphBody,
    fillColor: UML_CARD,
    strokeColor: UML_INK,
    strokeWidth: UML_NODE_STROKE_WIDTH,
    strokeStyle: glyphBody ? StrokeStyle.None : StrokeStyle.Solid,
    shapeStyle: ShapeStyle.General,
    // Zero, everywhere, and not a default worth revisiting: UML's figures are
    // drawn with a ruler. A hand-drawn roughness or a rounded corner would be
    // this pack inventing a house style for a notation that has one.
    roughness: 0,
    radius: 0,
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
 * conditionally: all eight write the same key set with different values. Kept
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
