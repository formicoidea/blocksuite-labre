import {
  type ElementRenderer,
  ElementRendererExtension,
} from '@labre/affine-block-surface';
import { shape as shapeRenderer } from '@labre/affine-gfx-shape';
import {
  type BpmnNodeElementModel,
  type BpmnNodeKind,
  DefaultTheme,
} from '@labre/affine-model';

/**
 * Renderer for a BPMN flow-object node.
 *
 * The shape body (ellipse / rounded rect / diamond) is drawn by REUSING the
 * native shape renderer — so stroke width, colors, inner text and theme behave
 * exactly like a native shape. On top of it, this file paints the MARKERS the
 * notation asks for, all of them stroke-based, scale-aware and drawn in the
 * node's own (editable) stroke colour:
 *
 *  - events    — envelope (message), clock (timer), solid disc (terminate);
 *  - tasks     — a person (user) or a gear (service) in the top-left corner;
 *  - activity  — the `+` box at the bottom edge (sub-process, call activity);
 *  - gateway   — the X (exclusive) or the `+` (parallel);
 *  - data      — folded page, cylinder, open bracket.
 *
 * The last three are different in kind from the rest: their silhouette is not a
 * native shape, so the glyph draws the BODY too — fill and outline — and the
 * native rect underneath is created unfilled and unstroked (see `NODE_PRESETS`
 * in `actions.ts`). It is still what carries the inner text, the selection
 * bounds and the connector anchors.
 *
 * ## Simplifications against bpmn.io, deliberately
 *
 * - **Message start vs message end**: the spec fills the end event's envelope
 *   solid and leaves the start event's hollow. Both are drawn hollow here, and
 *   the distinction is carried by the ring weight the two already have — thin
 *   green for a start, thick red for an end — which is the louder signal of the
 *   two and the one that is legible zoomed out.
 * - The **timer** has no hour ticks and the **data store** no shelf lines: at
 *   the sizes this canvas draws them, both read as noise around the shape.
 *
 * Mirrors the EDGY node renderer.
 */

/** Kinds the renderer decorates. Everything else is a plain native shape. */
const GLYPH_KINDS: ReadonlySet<BpmnNodeKind> = new Set<BpmnNodeKind>([
  'startEventMessage',
  'startEventTimer',
  'endEventMessage',
  'endEventTerminate',
  'taskUser',
  'taskService',
  'subProcess',
  'callActivity',
  'gatewayExclusive',
  'gatewayParallel',
  'dataObject',
  'dataStore',
  'textAnnotation',
]);

const TAU = Math.PI * 2;

export const bpmnNode: ElementRenderer<BpmnNodeElementModel> = (
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

  // Native shape (fill / stroke / inner text / theme handled natively).
  shapeRenderer(model, ctx, matrix, renderer, rc, bound);

  const kind = model.kind;
  if (!GLYPH_KINDS.has(kind)) return;

  const color = renderer.getColorValue(
    model.strokeColor,
    DefaultTheme.shapeStrokeColor,
    true
  );
  const strokeWidth = model.strokeWidth || 1;
  /** The smaller half-extent, the unit every glyph is sized against. */
  const unit = Math.min(w, h);

  ctx.setTransform(glyphMatrix);
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // ── Gateways: X (exclusive) or + (parallel), centred on the diamond ──
  if (kind === 'gatewayExclusive' || kind === 'gatewayParallel') {
    const r = unit * 0.2;
    ctx.translate(cx, cy);
    ctx.lineWidth = Math.max(2, unit * 0.06);
    ctx.beginPath();
    if (kind === 'gatewayExclusive') {
      ctx.moveTo(-r, -r);
      ctx.lineTo(r, r);
      ctx.moveTo(-r, r);
      ctx.lineTo(r, -r);
    } else {
      ctx.moveTo(-r, 0);
      ctx.lineTo(r, 0);
      ctx.moveTo(0, -r);
      ctx.lineTo(0, r);
    }
    ctx.stroke();
    return;
  }

  // ── Events ───────────────────────────────────────────────────────────
  if (kind === 'startEventMessage' || kind === 'endEventMessage') {
    // Envelope: a rectangle a little under half the ring's diameter, with the
    // flap folded down to just past its middle.
    const ew = unit * 0.44;
    const eh = ew * 0.7;
    const x = cx - ew / 2;
    const y = cy - eh / 2;
    ctx.lineWidth = Math.max(1, unit * 0.04);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + ew, y);
    ctx.lineTo(x + ew, y + eh);
    ctx.lineTo(x, y + eh);
    ctx.lineTo(x, y);
    ctx.moveTo(x, y);
    ctx.lineTo(cx, y + eh * 0.62);
    ctx.lineTo(x + ew, y);
    ctx.stroke();
    return;
  }

  if (kind === 'startEventTimer') {
    // Clock: a rim and two hands, at twelve and at four.
    const r = unit * 0.24;
    ctx.lineWidth = Math.max(1, unit * 0.04);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy - r * 0.72);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + r * 0.52, cy + r * 0.38);
    ctx.stroke();
    return;
  }

  if (kind === 'endEventTerminate') {
    // Terminate: a solid disc — the process stops here and nothing else runs.
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, unit * 0.28, 0, TAU);
    ctx.fill();
    return;
  }

  // ── Activities ───────────────────────────────────────────────────────
  if (kind === 'taskUser' || kind === 'taskService') {
    // Both markers sit in the top-left corner, inside a square of the same
    // side, so a row of tasks reads as a column of markers down the left.
    const side = unit * 0.24;
    const inset = unit * 0.1;
    const ox = inset + side / 2;
    const oy = inset + side / 2;
    ctx.lineWidth = Math.max(1, unit * 0.028);

    if (kind === 'taskUser') {
      // A head over a pair of shoulders.
      ctx.beginPath();
      ctx.arc(ox, oy - side * 0.2, side * 0.2, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ox, oy + side * 0.42, side * 0.36, Math.PI, TAU);
      ctx.stroke();
      return;
    }

    // A gear: hub, body and eight teeth.
    const rOuter = side * 0.5;
    const rBody = rOuter * 0.72;
    ctx.beginPath();
    ctx.arc(ox, oy, rBody, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ox, oy, rOuter * 0.28, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.moveTo(ox + Math.cos(a) * rBody, oy + Math.sin(a) * rBody);
      ctx.lineTo(ox + Math.cos(a) * rOuter, oy + Math.sin(a) * rOuter);
    }
    ctx.stroke();
    return;
  }

  if (kind === 'subProcess' || kind === 'callActivity') {
    // The collapsed marker: a small boxed `+` on the bottom edge, saying
    // "there is a whole process folded up in here". The call activity carries
    // the SAME marker — what tells the two apart is its thick border, which is
    // a creation-time preset rather than anything drawn here.
    const side = unit * 0.2;
    const bx = cx;
    const by = h - unit * 0.1 - side / 2;
    const half = side / 2;
    const arm = side * 0.3;
    ctx.lineWidth = Math.max(1, unit * 0.028);
    ctx.beginPath();
    ctx.moveTo(bx - half, by - half);
    ctx.lineTo(bx + half, by - half);
    ctx.lineTo(bx + half, by + half);
    ctx.lineTo(bx - half, by + half);
    ctx.lineTo(bx - half, by - half);
    ctx.moveTo(bx - arm, by);
    ctx.lineTo(bx + arm, by);
    ctx.moveTo(bx, by - arm);
    ctx.lineTo(bx, by + arm);
    ctx.stroke();
    return;
  }

  // ── Data and artifacts: the glyph IS the body ────────────────────────
  // The native rect under these three is unfilled and unstroked, so both the
  // fill and the outline are drawn here — off the model's own colours, which
  // keeps them editable from the shape toolbar like every other node's.
  const fill = renderer.getColorValue(
    model.fillColor,
    DefaultTheme.shapeFillColor,
    true
  );
  const half = strokeWidth / 2;
  const x0 = half;
  const y0 = half;
  const x1 = w - half;
  const y1 = h - half;
  ctx.lineWidth = strokeWidth;
  ctx.fillStyle = fill;

  if (kind === 'dataObject') {
    // A page with its top-right corner turned down.
    const fold = Math.min(w, h) * 0.28;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1 - fold, y0);
    ctx.lineTo(x1, y0 + fold);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x0, y1);
    ctx.lineTo(x0, y0);
    ctx.fill();
    ctx.stroke();
    // The fold itself, drawn after the body so it is not painted over.
    ctx.beginPath();
    ctx.moveTo(x1 - fold, y0);
    ctx.lineTo(x1 - fold, y0 + fold);
    ctx.lineTo(x1, y0 + fold);
    ctx.stroke();
    return;
  }

  if (kind === 'dataStore') {
    // A cylinder: an elliptical lid, two straight sides and a bulging floor.
    const rx = (x1 - x0) / 2;
    const ry = (y1 - y0) * 0.16;
    const mx = (x0 + x1) / 2;
    const top = y0 + ry;
    const bottom = y1 - ry;
    ctx.beginPath();
    ctx.moveTo(x0, top);
    ctx.lineTo(x0, bottom);
    // Floor, left to right through the lowest point.
    ctx.ellipse(mx, bottom, rx, ry, 0, Math.PI, 0, true);
    ctx.lineTo(x1, top);
    // Back up the front of the lid, right to left.
    ctx.ellipse(mx, top, rx, ry, 0, 0, Math.PI, false);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // The lid's own far edge, which the body path does not include.
    ctx.beginPath();
    ctx.ellipse(mx, top, rx, ry, 0, 0, TAU);
    ctx.stroke();
    return;
  }

  // `textAnnotation`: an open bracket down the leading edge and nothing else —
  // no fill, no closing edge. A note is attached to the picture, not framed in
  // it, and the three missing sides are what say so.
  const arm = Math.min(w * 0.18, h * 0.35);
  ctx.beginPath();
  ctx.moveTo(x0 + arm, y0);
  ctx.lineTo(x0, y0);
  ctx.lineTo(x0, y1);
  ctx.lineTo(x0 + arm, y1);
  ctx.stroke();
};

export const BpmnNodeRendererExtension = ElementRendererExtension(
  'bpmnNode',
  bpmnNode
);
