import {
  type C4NodeKind,
  FontFamily,
  ShapeStyle,
  StrokeStyle,
  TextAlign,
} from '@labre/affine-model';

import {
  NODE_PALETTE,
  NODE_RADIUS,
  NODE_STROKE_WIDTH,
  TITLE_FONT_SIZE,
} from './consts';
import { C4_ROLE_OF_KIND } from './roles';

/**
 * What a C4 shape IS, as props — the ONE description the creation site and the
 * morph both read.
 *
 * Split out of `actions.ts` when the morph landed, for the reason BPMN's
 * `presets.ts` gives about `bpmnNodeProps`: a kind's appearance is written by
 * the preset of the kind it was created as and nothing else ever rewrites it,
 * so a morph that restated the table would agree with the palette the day it
 * was written and drift on the first restyle. Derived, they cannot: a morphed
 * component and one freshly drawn from the sub-menu are the same element.
 */

/**
 * The kinds whose GLYPH draws the body, so the native shape underneath paints
 * nothing at all.
 *
 * Five of nine, and the renderer is the authority on which. A person is a head
 * fused into a rounded body and a database is a cylinder, neither of which a
 * native rect can be. `mobile` and `browser` joined them with the PO's recette
 * of 27/08/2026: the reference stencil paints their OUTER rectangle in the
 * node's darker colour — the bezel — and insets a lighter SCREEN in it, which is
 * the reverse of a band painted over a body, so there is nothing left for a
 * native rect to contribute. Same call BPMN makes for `dataObject` /
 * `dataStore`.
 *
 * They stay hit-testable across their whole area all the same:
 * `C4NodeElementModel.includesPoint` forces the interior test regardless of
 * `filled` — which is the fix for the PO's second report, that these nodes could
 * not be double-clicked into their text editor.
 *
 * This is also the one table the container FAMILY morphs across: a `container`
 * is a plain filled rect and a `database`, a `mobile` and a `browser` are not,
 * so `filled` and `strokeStyle` genuinely flip on the way between them — which
 * is exactly why {@link c4MorphProps} is the whole preset and not `{kind, role}`.
 */
export const GLYPH_BODY_KINDS: ReadonlySet<C4NodeKind> = new Set<C4NodeKind>([
  'person',
  'person-ext',
  'database',
  'mobile',
  'browser',
]);

/**
 * Every prop a C4 shape is created with, for one kind and one box.
 *
 * `index` is deliberately NOT here: it is a layering statement the creation
 * site makes about the five elements it is about to write in painting order,
 * and it means nothing to an element that already exists.
 *
 * No `text` either, and that is the arrangement rather than an omission: since
 * the PO's recette of 28/08/2026 the name is a `c4:title` CHILD, and the shape
 * is a body and nothing else. Its text COLOUR is still seeded — an element
 * drawn before that change carries its name here, and the node view routes a
 * double-click to that editor for exactly those, so the words have to stay
 * legible.
 */
export function c4NodeProps(
  kind: C4NodeKind,
  box: { xywh: string }
): Record<string, unknown> & { type: string } {
  const paint = NODE_PALETTE[kind];
  const glyphBody = GLYPH_BODY_KINDS.has(kind);

  return {
    type: 'c4Node',
    kind,
    // Semantic identity, posted next to `kind` — which stays untouched and keeps
    // driving the rendering. The role is the authority on what the box MEANS,
    // and it is the only thing that can say so: three of the four levels are the
    // same rounded rectangle (see `./roles.ts`).
    role: C4_ROLE_OF_KIND[kind],
    shapeType: 'rect',
    // A glyph-bodied kind paints nothing natively: the head, the block and the
    // cylinder are drawn by the renderer, which reads `fillColor` /
    // `strokeColor` off this same model — so both stay editable from the shape
    // toolbar exactly like every other node's.
    filled: !glyphBody,
    fillColor: paint.fill,
    strokeColor: paint.border,
    strokeWidth: NODE_STROKE_WIDTH,
    strokeStyle: glyphBody ? StrokeStyle.None : StrokeStyle.Solid,
    shapeStyle: ShapeStyle.General,
    roughness: 0,
    // Per kind, and mostly ZERO: the stencil draws the boxed levels as plain
    // square-cornered rectangles, and rounds only the two devices. Harmless on a
    // glyph-bodied kind, whose native shape is invisible.
    radius: NODE_RADIUS[kind],
    color: paint.text,
    fontFamily: FontFamily.Inter,
    fontSize: TITLE_FONT_SIZE,
    textAlign: TextAlign.Center,
    xywh: box.xywh,
  };
}

/**
 * The box {@link c4MorphProps} hands {@link c4NodeProps} and then throws away.
 * Never written to a document: a morph keeps the geometry the element already
 * has, and this exists only because the one builder takes a box.
 */
const DISCARDED_BOX = '[0,0,0,0]';

/** What a morph must never rewrite: identity, geometry, and the user's words. */
const NOT_A_MORPH = ['type', 'xywh', 'text'] as const;

/**
 * What a kind is worth to a shape that ALREADY EXISTS — {@link c4NodeProps}
 * minus the three things a morph has no business touching.
 *
 * ## Why the whole preset, and not `{kind, role}`
 *
 * Because on this pack's own table it is visibly not enough. The container
 * family — `container`, `database`, `mobile`, `browser` — is four kinds where
 * one paints its body natively and three hand it to the renderer, so `filled`
 * and `strokeStyle` flip between them, and two of them round their corners
 * where the others do not ({@link NODE_RADIUS}). Morph a container to a
 * database with two keys and the cylinder arrives with the rectangle still
 * painted behind it. The `-ext` families are the same argument in colour: grey
 * IS what "somebody else owns this" means, and it lives in `fillColor` /
 * `strokeColor`.
 */
export function c4MorphProps(kind: C4NodeKind): Record<string, unknown> {
  // Widened to the plain record on the way in: `type` is required on what the
  // creation builder returns, and `delete` may only take an optional key.
  const props: Record<string, unknown> = {
    ...c4NodeProps(kind, { xywh: DISCARDED_BOX }),
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
  (Object.keys(NODE_PALETTE) as C4NodeKind[]).flatMap(kind =>
    Object.keys(c4MorphProps(kind))
  )
);

/**
 * The fields to DELETE after morphing to `kind` — the keys some other kind
 * writes and this one does not.
 *
 * EMPTY for every kind today, because no C4 preset spreads anything
 * conditionally: all nine write the same key set with different values. Kept
 * anyway, and derived rather than hard-coded to `[]`, for the reason BPMN's
 * equivalent exists at all — a patch cannot express absence, and the day one
 * kind stops writing a key the previous kind's value would otherwise stay in
 * the Y.Map, silently in force.
 */
export function c4MorphClears(kind: C4NodeKind): readonly string[] {
  const present = new Set(Object.keys(c4MorphProps(kind)));
  return [...EVERY_MORPH_KEY].filter(key => !present.has(key));
}
