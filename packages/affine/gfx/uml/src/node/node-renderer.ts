import {
  type ElementRenderer,
  ElementRendererExtension,
} from '@labre/affine-block-surface';
import { shape as shapeRenderer } from '@labre/affine-gfx-shape';
import {
  DefaultTheme,
  type UmlNodeElementModel,
  type UmlNodeKind,
} from '@labre/affine-model';

import {
  UML_ACTOR_FIGURE,
  UML_CUBE_DEPTH,
  UML_PACKAGE_TAB,
  umlCompartmentBoxes,
  type UmlCompartmentBoxes,
  umlComponentSiblings,
} from '../component.js';
import { isActGlyphKind, paintActGlyph } from './act-glyphs.js';
import { line, solidRect, TAU } from './paint.js';
import { isSdGlyphKind, paintSdGlyph } from './sd-glyphs.js';
import { isStmGlyphKind, paintStmGlyph } from './stm-glyphs.js';

/**
 * Renderer for a UML node — the glyph layer, and nothing else.
 *
 * ## What the native shape does, and what this file does
 *
 * The native shape renderer runs FIRST and owns the fill, the stroke and the
 * theme. This file then paints, in the element-local frame, only what a
 * rectangle cannot be: the compartment separators of §11.4.4, the underline of
 * an instance's name (§9.8.4), the package's tab (§12.2.4), the note's folded
 * corner (Annex A), the actor's stick figure (§18.1.4), the component's
 * two-tabbed icon (§11.6.4), the artifact's document icon (§19.3.4), the port's
 * square (§11.3.4), the ball and socket of §10.4.4 and the 3-D cube of §19.4.4.
 *
 * The behaviour families of phase 2 add fourteen more marks, and they live in
 * two modules of their own — `act-glyphs.ts` for the control nodes of §15.3.4
 * and the signal shapes of §16.3.4 / §16.10.4, `stm-glyphs.ts` for the final
 * state and the pseudostates of §14.2.4. The BRANCH stays here, because which
 * kind gets which picture is this file's subject and the `never` at the end of
 * `paintGlyph` is what keeps it total; the drawing moved out because a
 * thousand-line renderer is a file nobody reads the middle of.
 *
 * Five kinds need nothing at all. A `use-case` IS the native ellipse (§18.1.4),
 * an `action` and a `state`'s body the native ROUNDED rect (§15.3.4, §14.2.4),
 * a `decision` and a `choice` the native diamond, an `object-node` the plain
 * native rect (§15.4.4) — and drawing anything over any of them would be
 * inventing a notation. An `object` is a class box with a split and a rule under
 * its name, which is the first branch below rather than a picture; so are a
 * `component` and an `artifact`, each with a small icon dropped in the corner of
 * the box the shape layer has already drawn.
 *
 * ## Every offset is READ, never restated
 *
 * The separator positions come from `umlCompartmentBoxes` — the same pure
 * function the creation site places the text tiers with — so a rule is drawn
 * exactly between two compartments rather than near where they were last time
 * somebody looked. The actor's figure is bounded by the top of its own label
 * box, from the same call, so the words can never land on the legs.
 *
 * …and once a component's tiers are ON the canvas, they are the better source
 * still: `umlNodeCompartments` reads the separators off the body tier's own box
 * when the group can be reached, so a classifier `UmlCompartmentWatcher` has
 * grown for a five-line attributes compartment is ruled where its compartments
 * now are. The default stack is the answer for a shape with no group behind it,
 * which is every one of them at creation time.
 *
 * ## Colours come off the MODEL
 *
 * Both fill and stroke are read from the element, never from a table: a node's
 * colours are editable from the shape toolbar like any other shape's, and a
 * glyph that painted the pack's own ink would silently ignore the user's choice.
 * `presets.ts` is what SEEDS them.
 *
 * The glyph-bodied kinds — `package`, `note`, `actor`, `port`, the two interface
 * glyphs and the three cubes — are created unfilled and unstroked
 * (`presets.ts`), so the native rect paints nothing and the glyph IS the body:
 * it fills with the element's `fillColor` and outlines with its `strokeColor`,
 * which is what keeps them recolourable from the same toolbar as every other
 * shape.
 */

/* ── The glyph geometry, as fractions of the node box ──────────────────── */

/**
 * How wide the package's tab is (§12.2.4), as a fraction of the box.
 *
 * Only the WIDTH: the tab's height is `UML_PACKAGE_TAB`, owned by
 * `component.ts` because that is where the name compartment is placed under it,
 * and two files each picking their own number is how a label comes to sit on a
 * fold. Wide enough to read as a folder tab and no wider — a tab that ran most
 * of the width would read as a compartment.
 */
const PACKAGE_TAB_WIDTH = 0.42;

/** The note's folded corner (Annex A), as a fraction of the SHORTER side. */
const NOTE_FOLD = 0.22;

/**
 * The actor's stick figure (§18.1.4), in fractions of the figure box — which is
 * the element box down to the top of its label, never the element box itself.
 */
const ACTOR = {
  /** Head radius, against the figure's width and against its height. */
  headOfWidth: 0.24,
  headOfHeight: 0.18,
  /** Where the spine ends, as a fraction of the figure's height. */
  hipY: 0.66,
  /** The arms: their height, and how far out they reach. */
  armY: 0.46,
  armX: 0.06,
  /** Where the feet land. */
  footY: 0.98,
  footX: 0.12,
} as const;

/**
 * The component's own icon (§11.6.4) — the little rectangle with two tabs
 * sticking out of its left edge, dropped in the top-right corner of the box.
 *
 * Fractions of the node box, like every other glyph metric here, so a component
 * dragged to any size carries an icon in proportion to it. The icon is what
 * MAKES the box a component: §11.6.4 offers the icon or the `«component»`
 * keyword, and this pack draws the icon, which is why the name seed writes no
 * keyword (`keywords.ts`).
 */
const COMPONENT_ICON = {
  /** The icon body, against the box's width and height. */
  width: 0.16,
  height: 0.2,
  /** Its inset from the top-right corner, against the shorter side. */
  margin: 0.06,
  /** The two tabs, against the icon body: how far they protrude, how tall. */
  tabWidth: 0.4,
  tabHeight: 0.26,
  /** Where each tab's top edge sits, against the icon body's height. */
  tabTop: [0.16, 0.58],
} as const;

/**
 * The artifact's document icon (§19.3.4) — a small sheet of paper with its
 * top-right corner turned down, in the same corner as the component's.
 *
 * Narrower and taller than the component's icon because it is a PAGE, and a page
 * read as a square would read as a box.
 */
const ARTIFACT_ICON = {
  width: 0.1,
  height: 0.19,
  margin: 0.06,
  /** The turned-down corner, against the icon's shorter side. */
  fold: 0.36,
} as const;

/**
 * The ball and the socket (§10.4.4), as fractions of the glyph's box.
 *
 * One radius from whichever dimension is the tighter, so the ball stays ROUND at
 * any aspect ratio the element is dragged to — the same rule the actor's head
 * follows, and for the same reason. What is left under the circle is the STUB:
 * the short line that, on a real diagram, runs to the component's border.
 */
const INTERFACE_GLYPH = {
  radiusOfWidth: 0.3,
  radiusOfHeight: 0.34,
} as const;

/* ── The glyphs ────────────────────────────────────────────────────────── */

/**
 * Paint one kind, in the element-local frame, with `fillStyle` / `strokeStyle` /
 * `lineWidth` already set from the model.
 *
 * @param inset half the stroke width — a body is drawn inside it, so the outline
 * lands within the element's bounds rather than straddling them.
 */
function paintGlyph(
  kind: UmlNodeKind,
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  inset: number,
  boxes: UmlSeparators
): void {
  const x0 = inset;
  const y0 = inset;
  const x1 = w - inset;
  const y1 = h - inset;
  const bw = x1 - x0;
  const bh = y1 - y0;
  if (!(bw > 0) || !(bh > 0)) return;

  // ── The compartmented kinds: one rule per split ──────────────────────
  if (
    kind === 'class' ||
    kind === 'interface' ||
    kind === 'enumeration' ||
    kind === 'object' ||
    kind === 'component' ||
    kind === 'artifact' ||
    // §14.2.4 rules a state off between its name and its internal activities —
    // the object's layout exactly, drawn on the native ROUNDED rect the preset
    // gives it rather than on a square one.
    kind === 'state'
  ) {
    // Full width, edge to edge: §11.4.4 draws a compartment line right across
    // the classifier, unlike the inset the text tiers sit within.
    for (const split of boxes.splits) {
      if (split <= y0 || split >= y1) continue;
      line(ctx, x0, split, x1, split);
    }

    // An instance's name is UNDERLINED (§9.8.4) — the one mark that tells a
    // reader an object from the class it is an instance of. Drawn under the NAME
    // box and only as wide as it, so it reads as a rule under the words rather
    // than as a fifth compartment line.
    if (kind === 'object') {
      const { name } = boxes;
      const under = name.y + name.h;
      if (under > y0 && under < y1 && name.w > 0) {
        line(ctx, name.x, under, name.x + name.w, under);
      }
    }

    // The two kinds whose box is told from a class's by a picture in its
    // corner, drawn over the body the shape layer has already filled.
    if (kind === 'component') paintComponentIcon(ctx, x1, y0, bw, bh);
    if (kind === 'artifact') paintArtifactIcon(ctx, x1, y0, bw, bh);
    return;
  }

  // ── The package: a tab, and the body under it (§12.2.4) ──────────────
  if (kind === 'package') {
    const tabW = bw * PACKAGE_TAB_WIDTH;
    // Against the ELEMENT box, not the stroke-inset one: `component.ts` places
    // the name compartment under `h * UML_PACKAGE_TAB`, and the fold has to be
    // the line that number names.
    const tabH = Math.max(0, Math.min(h * UML_PACKAGE_TAB - y0, bh));
    // The tab first, so the body's top edge — drawn over it — closes the join
    // on the right of the tab and nowhere else, which is the folder silhouette.
    ctx.beginPath();
    ctx.moveTo(x0, y0 + tabH);
    ctx.lineTo(x0, y0);
    ctx.lineTo(x0 + tabW, y0);
    ctx.lineTo(x0 + tabW, y0 + tabH);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x0, y0 + tabH);
    ctx.lineTo(x1, y0 + tabH);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x0, y1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    return;
  }

  // ── The note: a rectangle with its top-right corner turned down ──────
  if (kind === 'note') {
    const fold = Math.min(bw, bh) * NOTE_FOLD;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1 - fold, y0);
    ctx.lineTo(x1, y0 + fold);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x0, y1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // The fold itself: the two edges of the turned-down triangle. Drawn as
    // lines and not as a filled flap, which is how Annex A draws it — a shaded
    // flap would claim a light source the notation has none of.
    ctx.beginPath();
    ctx.moveTo(x1 - fold, y0);
    ctx.lineTo(x1 - fold, y0 + fold);
    ctx.lineTo(x1, y0 + fold);
    ctx.stroke();
    return;
  }

  // ── The actor: a stick figure over its own name (§18.1.4) ────────────
  if (kind === 'actor') {
    // The figure stops where the label starts: `component.ts` owns that line
    // (`UML_ACTOR_FIGURE`) and places the name element below it, so the words
    // can never land on the legs.
    const figureH = Math.max(0, Math.min(h * UML_ACTOR_FIGURE - y0, bh));
    if (!(figureH > 0)) return;

    const cx = w / 2;
    // One radius from whichever dimension is the tighter, so the head stays
    // CIRCULAR at any aspect ratio the author drags the element to.
    const headR = Math.max(
      0,
      Math.min(bw * ACTOR.headOfWidth, figureH * ACTOR.headOfHeight)
    );
    if (headR > 0) {
      ctx.beginPath();
      ctx.arc(cx, y0 + headR, headR, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }

    const hipY = y0 + figureH * ACTOR.hipY;
    // The spine, from under the head down to the hips.
    line(ctx, cx, y0 + headR * 2, cx, hipY);
    // The arms, straight across.
    const armY = y0 + figureH * ACTOR.armY;
    line(ctx, x0 + bw * ACTOR.armX, armY, x1 - bw * ACTOR.armX, armY);
    // …and the two legs.
    const footY = y0 + figureH * ACTOR.footY;
    line(ctx, cx, hipY, x0 + bw * ACTOR.footX, footY);
    line(ctx, cx, hipY, x1 - bw * ACTOR.footX, footY);
    return;
  }

  // ── The port: a small filled square (§11.3.4) ────────────────────────
  if (kind === 'port') {
    // A SQUARE, from the shorter side and centred: a port dragged into a
    // rectangle is still a port, and §11.3.4 draws one square. The whole body,
    // because the port is created unstroked and unfilled — the glyph is it.
    const side = Math.min(bw, bh);
    solidRect(ctx, x0 + (bw - side) / 2, y0 + (bh - side) / 2, side, side);
    return;
  }

  // ── The two interface glyphs: a ball, or a socket, on a stub ─────────
  if (kind === 'provided-interface' || kind === 'required-interface') {
    const radius = Math.max(
      0,
      Math.min(
        bw * INTERFACE_GLYPH.radiusOfWidth,
        bh * INTERFACE_GLYPH.radiusOfHeight
      )
    );
    if (!(radius > 0)) return;

    const cx = w / 2;
    const cy = y0 + radius;

    if (kind === 'provided-interface') {
      // The lollipop: a CLOSED circle, filled, saying the component offers this
      // interface (§10.4.4).
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, TAU);
      ctx.fill();
      ctx.stroke();
    } else {
      // The socket: the BOTTOM half of the circle, a cup opening UPWARD — away
      // from the component the stub below runs to, so a ball can nest in it
      // (§10.4.4). Its deepest point is (cx, cy + radius), exactly where the
      // stub starts, so the line meets the back of the cup and not a horn.
      // Stroked and never filled: it is an arc, and a filled half-disc would
      // read as a ball cut in two.
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI);
      ctx.stroke();
    }

    // The stub: the short line that, on a real diagram, runs from the glyph to
    // the border of the component it belongs to. Drawn straight DOWN, which is
    // the one direction that needs no knowledge of where that component is.
    if (cy + radius < y1) line(ctx, cx, cy + radius, cx, y1);
    return;
  }

  // ── The three deployment targets: one 3-D cube (§19.4.4) ─────────────
  if (
    kind === 'node' ||
    kind === 'device' ||
    kind === 'execution-environment'
  ) {
    // Against the ELEMENT box, not the stroke-inset one, and clamped: the front
    // face has to be the rectangle `component.ts` writes the name inside, and
    // two files each deriving their own depth is how a name ends up on a roof.
    const depth = Math.max(
      0,
      Math.min(Math.min(w, h) * UML_CUBE_DEPTH, Math.min(bw, bh))
    );
    const backX = x1 - depth;
    const backY = y0 + depth;

    // The top and the right first, the FRONT last: the front face is opaque, so
    // painting it over the other two closes every join that should not be seen
    // and leaves the three edges that make the solid read as a solid.
    if (depth > 0) {
      ctx.beginPath();
      ctx.moveTo(x0, backY);
      ctx.lineTo(x0 + depth, y0);
      ctx.lineTo(x1, y0);
      ctx.lineTo(backX, backY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(backX, backY);
      ctx.lineTo(x1, y0);
      ctx.lineTo(x1, y1 - depth);
      ctx.lineTo(backX, y1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    solidRect(ctx, x0, backY, backX - x0, y1 - backY);
    return;
  }

  // ── The kinds the SHAPE LAYER draws whole, with nothing painted over ──
  //
  // A use case is the native ellipse of §18.1.4; an `action` and the body of a
  // `state` are the native ROUNDED rect of §15.3.4 and §14.2.4 (`radius` on the
  // preset, not a glyph); a `decision` and a `choice` are the native diamond;
  // an `object-node` is the plain native rect of §15.4.4. Drawing anything over
  // any of them would be inventing a notation.
  //
  // `state` is absent from this list because it is handled ABOVE, with the
  // compartmented kinds: the rounded body is the shape layer's, the rule under
  // the name is this file's.
  if (
    kind === 'use-case' ||
    kind === 'action' ||
    kind === 'object-node' ||
    kind === 'decision' ||
    kind === 'choice' ||
    // …and, since phase 3, §17.2.4's ExecutionSpecification: a thin FILLED
    // rectangle on a lifeline's spine, which is a native rect and nothing more.
    kind === 'execution'
  ) {
    return;
  }

  // ── The behaviour marks, by family ───────────────────────────────────
  //
  // Delegated rather than inlined: the two families between them are fourteen
  // pictures, and the branch a reader needs to follow is WHICH KIND GETS WHICH,
  // not how a bullseye is struck. Each module closes its own switch with a
  // `never`, so the delegation costs none of the exhaustiveness the last branch
  // of this function exists for.
  const box = { x0, y0, x1, y1, bw, bh, w, h };
  if (isActGlyphKind(kind)) {
    paintActGlyph(kind, ctx, box);
    return;
  }
  if (isStmGlyphKind(kind)) {
    paintStmGlyph(kind, ctx, box);
    return;
  }
  // Phase 3's two: §17.3.4's lifeline — the one glyph in the pack that is
  // BIGGER than the element it belongs to — and §17.2.4's destruction X.
  if (isSdGlyphKind(kind)) {
    paintSdGlyph(kind, ctx, box);
    return;
  }

  /**
   * Every kind is drawn above, and this is what keeps that true: `kind` is
   * narrowed to `never` here only if the branches are exhaustive over
   * {@link UmlNodeKind}, so a kind added to the model's union without a picture
   * of its own stops the build.
   *
   * Which is the whole point of closing the last branch rather than letting it
   * fall through. A renderer that silently paints a package tab on somebody's
   * new artefact is worse than one that paints nothing: the first is a wrong
   * picture nobody is told about, the second is a missing one everybody sees.
   */
  const unhandled: never = kind;
  void unhandled;
}

/* ── The two corner icons ──────────────────────────────────────────────── */

/**
 * The component icon (§11.6.4): a small rectangle with two tabs protruding from
 * its LEFT edge, in the top-right corner of the box.
 *
 * Painted as three solid bodies rather than as one outline, because that is what
 * the notation draws — the tabs are little plugs sticking out of the module, and
 * an author who recolours the component recolours them with it.
 *
 * @param x1 the right edge of the body, already inset by half the stroke.
 * @param y0 its top edge, likewise.
 */
function paintComponentIcon(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y0: number,
  bw: number,
  bh: number
): void {
  const iw = bw * COMPONENT_ICON.width;
  const ih = bh * COMPONENT_ICON.height;
  const margin = Math.min(bw, bh) * COMPONENT_ICON.margin;
  const tabW = iw * COMPONENT_ICON.tabWidth;
  const tabH = ih * COMPONENT_ICON.tabHeight;
  // The tabs hang off the left of the body, so the body is indented by their
  // width: the whole icon still fits inside the margin it was given.
  const left = x1 - margin - iw;
  const top = y0 + margin;
  if (!(iw > 0) || !(ih > 0) || left - tabW < 0) return;

  solidRect(ctx, left, top, iw, ih);
  for (const at of COMPONENT_ICON.tabTop) {
    solidRect(ctx, left - tabW / 2, top + ih * at, tabW, tabH);
  }
}

/**
 * The artifact icon (§19.3.4): a sheet of paper with its top-right corner turned
 * down, in the same corner of the box as the component's.
 *
 * The same silhouette as the note glyph, two orders of magnitude smaller and
 * standing for something else entirely — which is the notation's doing, not a
 * shortcut: a note is a piece of paper pinned to a diagram, an artifact is a
 * file the system ships.
 */
function paintArtifactIcon(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y0: number,
  bw: number,
  bh: number
): void {
  const iw = bw * ARTIFACT_ICON.width;
  const ih = bh * ARTIFACT_ICON.height;
  const margin = Math.min(bw, bh) * ARTIFACT_ICON.margin;
  const fold = Math.min(iw, ih) * ARTIFACT_ICON.fold;
  const left = x1 - margin - iw;
  const top = y0 + margin;
  if (!(iw > 0) || !(ih > 0) || left < 0) return;

  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left + iw - fold, top);
  ctx.lineTo(left + iw, top + fold);
  ctx.lineTo(left + iw, top + ih);
  ctx.lineTo(left, top + ih);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // The fold, as two lines — the same way the note draws its own, and for the
  // same reason: a shaded flap would claim a light source UML has none of.
  ctx.beginPath();
  ctx.moveTo(left + iw - fold, top);
  ctx.lineTo(left + iw - fold, top + fold);
  ctx.lineTo(left + iw, top + fold);
  ctx.stroke();
}

/* ── Where the compartments actually are ───────────────────────────────── */

/**
 * The half of {@link UmlCompartmentBoxes} the glyph layer draws from: where the
 * separators go, and where the name is.
 *
 * The other two boxes are the TEXT ELEMENTS' business — they are the tiers, and
 * they are already on the canvas — so a renderer holding them would be holding a
 * second opinion about where words it does not draw ought to be.
 */
type UmlSeparators = Pick<UmlCompartmentBoxes, 'name' | 'splits'>;

/**
 * The compartment layout to stroke this node's separators from: the one its
 * TIERS describe if they can be reached, and the default stack otherwise.
 *
 * ## Why the tiers and not the line counts
 *
 * `UmlCompartmentWatcher` grows a classifier whose attributes tier has
 * overflowed and moves the three texts to the boxes the taller stack yields —
 * so after an edit the compartments are no longer the default three-line stack a
 * rectangle implies, and a renderer still drawing that stack would rule a line
 * straight through the fourth attribute.
 *
 * It could be told the LINE COUNTS and recompute the same walk. It reads the
 * tiers' own boxes instead, for two reasons. It is cheaper — `deserializedXYWH`
 * is cached on the element, while a line count means materializing every tier's
 * `Y.Text` into a string on every frame of every pan — and it cannot disagree
 * with what the reader sees: a separator IS the boundary between two
 * compartments, and reading the boundary off the compartments is the shortest
 * possible route to that. An author who nudges a tier by hand takes the rule
 * with them, which is the same answer.
 *
 * ## The ceiling
 *
 * ponytail: the tiers are read in the node's own unrotated frame, so a ROTATED
 * `umlNode` falls back to the default stack. A UML group cannot be rotated
 * (`GroupElementModel.rotate` is a constant 0), so this only reaches a shape
 * somebody rotated out of its own group — at which point the words are not
 * turning with it either and the picture is already the author's problem.
 * Raising it means projecting each tier's box through `-rotate` about the
 * node's centre, which is four lines nobody has asked for yet.
 */
export function umlNodeCompartments(
  model: UmlNodeElementModel,
  w: number,
  h: number
): UmlSeparators {
  const defaults = umlCompartmentBoxes(model.kind, 0, 0, w, h);
  const group = model.group;
  // No splits at all is a kind that is a PICTURE (a package, an actor, a cube):
  // there are no compartments to read off, and nothing below would mean
  // anything. A rotated shape is the documented ceiling above.
  if (defaults.splits.length === 0 || model.rotate || !group) return defaults;

  const children = group.childElements;
  const component = umlComponentSiblings(
    { id: group.id, childIds: group.childIds },
    children as unknown as { id: string; role?: string }[]
  );
  // The BODY tier is what both separators hang off: the line above it is where
  // the name compartment stops, the line below it where the operations start.
  // Its role is `uml:attributes` on all seven compartmented kinds — a slot list,
  // a component's parts, a state's activities included (`component.ts`).
  const body = children.find(child => child.id === component.attributes?.id);
  if (!body) return defaults;

  const [nodeX, nodeY] = model.deserializedXYWH;
  const top = body.y - nodeY;
  const bottom = top + body.h;
  // A tier dragged clean off its node says nothing useful about where a line
  // INSIDE the node goes.
  if (!(top > 0) || !(bottom > top)) return defaults;

  const name = children.find(child => child.id === component.name?.id);
  return {
    // The name box is read for the one thing it is used for: the rule under an
    // INSTANCE's name (§9.8.4), which has to stay under the words once a
    // two-line name has pushed them down.
    name: name
      ? { x: name.x - nodeX, y: name.y - nodeY, w: name.w, h: name.h }
      : defaults.name,
    // How MANY separators is the notation's answer and the default walk already
    // made it — one for the kinds §9.8.4 / §11.6.4 / §19.3.4 / §14.2.4 draw as a
    // name over a single body, two for a classifier. Only the positions are read
    // off the tier.
    splits: defaults.splits.length === 1 ? [top] : [top, bottom],
  };
}

export const umlNode: ElementRenderer<UmlNodeElementModel> = (
  model,
  ctx,
  matrix,
  renderer,
  rc,
  bound
) => {
  const [, , w, h] = model.deserializedXYWH;
  const cx = w / 2;
  const cy = h / 2;

  // Capture the element-local transform BEFORE the shape renderer mutates the
  // matrix, so the glyph can be drawn in the same space afterwards.
  const glyphMatrix = DOMMatrix.fromMatrix(matrix)
    .translateSelf(cx, cy)
    .rotateSelf(model.rotate)
    .translateSelf(-cx, -cy);

  // Native shape: fill, stroke and theme, all handled natively.
  shapeRenderer(model, ctx, matrix, renderer, rc, bound);

  const stroke = renderer.getColorValue(
    model.strokeColor,
    DefaultTheme.shapeStrokeColor,
    true
  );
  const fill = renderer.getColorValue(
    model.fillColor,
    DefaultTheme.shapeFillColor,
    true
  );
  const strokeWidth = model.strokeWidth || 1;

  ctx.setTransform(glyphMatrix);
  ctx.strokeStyle = stroke;
  ctx.fillStyle = fill;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  paintGlyph(
    model.kind,
    ctx,
    w,
    h,
    strokeWidth / 2,
    umlNodeCompartments(model, w, h)
  );
};

export const UmlNodeRendererExtension = ElementRendererExtension(
  'umlNode',
  umlNode
);
