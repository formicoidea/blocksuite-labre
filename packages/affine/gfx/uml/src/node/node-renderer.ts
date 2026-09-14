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
  UML_PACKAGE_TAB,
  umlCompartmentBoxes,
} from '../component.js';

/**
 * Renderer for a UML node — the glyph layer, and nothing else.
 *
 * ## What the native shape does, and what this file does
 *
 * The native shape renderer runs FIRST and owns the fill, the stroke and the
 * theme. This file then paints, in the element-local frame, only what a
 * rectangle cannot be: the compartment separators of §11.4.4, the underline of
 * an instance's name (§9.8.4), the package's tab (§12.2.4), the note's folded
 * corner (Annex A) and the actor's stick figure (§18.1.4).
 *
 * Two kinds need nothing at all. A `use-case` IS the native ellipse — §18.1.4
 * draws it with no decoration whatever — and drawing anything over it would be
 * inventing a notation. And an `object` is a class box with a split and a rule
 * under its name, which is the third branch below rather than a picture.
 *
 * ## Every offset is READ, never restated
 *
 * The separator positions come from `umlCompartmentBoxes` — the same pure
 * function the creation site places the text tiers with — so a rule is drawn
 * exactly between two compartments rather than near where they were last time
 * somebody looked. The actor's figure is bounded by the top of its own label
 * box, from the same call, so the words can never land on the legs.
 *
 * ## Colours come off the MODEL
 *
 * Both fill and stroke are read from the element, never from a table: a node's
 * colours are editable from the shape toolbar like any other shape's, and a
 * glyph that painted the pack's own ink would silently ignore the user's choice.
 * `presets.ts` is what SEEDS them.
 *
 * The glyph-bodied kinds — `package`, `note`, `actor` — are created unfilled and
 * unstroked (`presets.ts`), so the native rect paints nothing and the glyph IS
 * the body: it fills with the element's `fillColor` and outlines with its
 * `strokeColor`, which is what keeps them recolourable from the same toolbar as
 * every other shape.
 */

const TAU = Math.PI * 2;

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

/** Draw one straight segment, skipping a degenerate one. */
function line(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

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
  inset: number
): void {
  const x0 = inset;
  const y0 = inset;
  const x1 = w - inset;
  const y1 = h - inset;
  const bw = x1 - x0;
  const bh = y1 - y0;
  if (!(bw > 0) || !(bh > 0)) return;

  // ── The four compartmented kinds: one rule per split ─────────────────
  if (
    kind === 'class' ||
    kind === 'interface' ||
    kind === 'enumeration' ||
    kind === 'object'
  ) {
    const boxes = umlCompartmentBoxes(kind, 0, 0, w, h);
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

  // ── The use case: the native ellipse, and nothing on it ──────────────
  if (kind === 'use-case') return;

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

  paintGlyph(model.kind, ctx, w, h, strokeWidth / 2);
};

export const UmlNodeRendererExtension = ElementRendererExtension(
  'umlNode',
  umlNode
);
