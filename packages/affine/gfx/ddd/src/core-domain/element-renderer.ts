import {
  type ElementRenderer,
  ElementRendererExtension,
} from '@labre/affine-block-surface';
import type { CoreDomainChartElementModel } from '@labre/affine-model';

import { FONT_FAMILY, refScale } from '../shared/utils';
import { AXIS, COLORS, REF_H, REF_W, ZONE_LABELS, ZONES } from './consts';

/**
 * Canvas renderer for the Core Domain Chart background — the translucent
 * Generic / Supporting / Core zone bands, the two axes with arrow heads and the
 * Low/High ticks + zone names. Drawn in the fixed reference space and scaled
 * uniformly to the element bounds.
 */
export const coreDomain: ElementRenderer<CoreDomainChartElementModel> = (
  model,
  ctx,
  matrix
) => {
  const [, , w, h] = model.deserializedXYWH;
  const cx = w / 2;
  const cy = h / 2;
  ctx.setTransform(
    matrix.translateSelf(cx, cy).rotateSelf(model.rotate).translateSelf(-cx, -cy)
  );

  const { s, ox, oy } = refScale(w, h, REF_W, REF_H);
  ctx.translate(ox, oy);
  ctx.scale(s, s);

  // ── Translucent zone bands ──────────────────────────────────────────
  if (model.showZones) {
    ctx.globalAlpha = 0.6;
    for (const z of ZONES) {
      ctx.fillStyle = z.fill;
      ctx.fillRect(z.x, z.y, z.w, z.h);
    }
    ctx.globalAlpha = 1;
  }

  // ── Axes with arrow heads ───────────────────────────────────────────
  ctx.strokeStyle = COLORS.axis;
  ctx.fillStyle = COLORS.axis;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  // Y axis (up)
  ctx.beginPath();
  ctx.moveTo(AXIS.ox, AXIS.oy);
  ctx.lineTo(AXIS.ox, AXIS.top + 6);
  ctx.stroke();
  arrow(ctx, AXIS.ox, AXIS.top, 0);
  // X axis (right)
  ctx.beginPath();
  ctx.moveTo(AXIS.ox, AXIS.oy);
  ctx.lineTo(AXIS.right - 6, AXIS.oy);
  ctx.stroke();
  arrow(ctx, AXIS.right, AXIS.oy, 90);

  ctx.textBaseline = 'alphabetic';

  // ── Zone names ──────────────────────────────────────────────────────
  ctx.textAlign = 'center';
  for (const [text, x, y, size] of ZONE_LABELS) {
    ctx.fillStyle = COLORS.zoneLabel;
    ctx.font = `700 ${size}px ${FONT_FAMILY}`;
    ctx.fillText(text, x, y);
  }

  // ── Axis titles + Low/High ticks ────────────────────────────────────
  if (model.showLabels) {
    ctx.fillStyle = COLORS.title;
    ctx.font = `600 14px ${FONT_FAMILY}`;

    ctx.save();
    ctx.translate(28, 400);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Complexity', 0, 0);
    ctx.restore();

    ctx.fillText('Business differentiation', 450, 800);

    ctx.fillStyle = COLORS.tick;
    ctx.font = `12px ${FONT_FAMILY}`;
    // X ticks
    ctx.fillText('Low', 84, 792);
    ctx.fillText('High', 838, 792);
    // Y ticks
    ctx.save();
    ctx.translate(48, 758);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Low', 0, 0);
    ctx.restore();
    ctx.save();
    ctx.translate(38, 44);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('High', 0, 0);
    ctx.restore();
  }
};

/** Filled triangular arrow head at (x, y); `deg` rotates it (0 = pointing up). */
function arrow(ctx: CanvasRenderingContext2D, x: number, y: number, deg: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-5, 9);
  ctx.lineTo(5, 9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export const CoreDomainRendererExtension = ElementRendererExtension(
  'coreDomain',
  coreDomain
);
