import {
  type CanvasRenderer,
  type ElementRenderer,
  ElementRendererExtension,
} from '@labre/affine-block-surface';
import type { CynefinElementModel } from '@labre/affine-model';
import {
  type ChromeWording,
  TranslationProvider,
  translateKey,
} from '@labre/affine-shared/services';

import { FONT_FAMILY, refScale } from '../utils';
import {
  COLORS,
  DARK_BACK_PATHS,
  DARK_FRONT_PATHS,
  DASH_RECTS,
  DOMAINS,
  HATCHES,
  MARKERS,
  REF_H,
  REF_W,
  SMALL_LABELS,
  TEAL_LABELS,
  TEAL_PATH,
  TEAL_WIDTH,
} from './consts';

/**
 * Canvas renderer for the Liminal Cynefin diagram — reproduces the official SVG:
 * the dark hand-drawn boundary, the teal "iterate" curve, the dashed
 * Complicated↔Clear paving and the hatched cliff, plus the four domain blocks
 * (heading + Probe/Sense/Respond decisions), the teal annotation labels and the
 * central Aporia (A) / Confusion (C) markers. Drawn in the fixed reference space
 * and scaled uniformly to the element bounds.
 *
 * ## i18n
 *
 * Every word above is a `ChromeWording` (`./consts.ts`), resolved through the
 * `CanvasRenderer` this function is handed as its 4th argument — the same
 * `renderer.std` `framework-background/renderer.ts` reads for a declared
 * background. `renderer` is optional (absent in a bare unit test that calls
 * this function with three arguments), in which case every wording reads its
 * English fallback, byte-identical to before these keys existed.
 *
 * The three-line decisions are the one wrinkle: with no host they are drawn as
 * they always were — a bold lead word plus the roman remainder, two
 * `fillText` calls — because that split is known to be exactly the English
 * text. Once a host answers, the WHOLE sentence is drawn as one run: a
 * translation is not guaranteed to keep the same first word, so guessing where
 * to split it would be inventing typography the translator never asked for.
 */
export const cynefin: ElementRenderer<CynefinElementModel> = (
  model,
  ctx,
  matrix,
  renderer
) => {
  const tr = (wording: ChromeWording): string =>
    renderer ? translateKey(renderer.std, ...wording) : wording[1];
  // The host's catalogue, or `null` with no host — used to decide whether a
  // decision line is drawn bold-lead/roman-rest (English, exactly as before)
  // or as one translated run. See the docstring above.
  const hasHost = Boolean(
    (renderer as CanvasRenderer | undefined)?.std.getOptional(
      TranslationProvider
    )
  );
  const [, , w, h] = model.deserializedXYWH;
  const cx = w / 2;
  const cy = h / 2;
  ctx.setTransform(
    matrix
      .translateSelf(cx, cy)
      .rotateSelf(model.rotate)
      .translateSelf(-cx, -cy)
  );

  const { s, ox, oy } = refScale(w, h, REF_W, REF_H);
  ctx.translate(ox, oy);
  ctx.scale(s, s);

  ctx.lineCap = 'butt';

  // ── Dark boundary strokes (behind the teal curve) ───────────────────
  ctx.strokeStyle = COLORS.boundary;
  for (const [d, lw, miter] of DARK_BACK_PATHS) {
    ctx.lineJoin = miter ? 'miter' : 'round';
    ctx.lineWidth = lw;
    ctx.stroke(new Path2D(d));
  }
  ctx.lineJoin = 'round';

  // ── Dashed boundary (oriented square pavings) ───────────────────────
  ctx.fillStyle = COLORS.boundary;
  for (const [x, y, sz, rot] of DASH_RECTS) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
    ctx.restore();
  }

  // ── Teal "iterate" liminal curve ────────────────────────────────────
  if (model.showLiminalLine) {
    ctx.strokeStyle = COLORS.teal;
    ctx.lineWidth = TEAL_WIDTH;
    ctx.stroke(new Path2D(TEAL_PATH));
  }

  // ── Dark boundary strokes (over the teal curve) ─────────────────────
  ctx.strokeStyle = COLORS.boundary;
  for (const [d, lw, miter] of DARK_FRONT_PATHS) {
    ctx.lineJoin = miter ? 'miter' : 'round';
    ctx.lineWidth = lw;
    ctx.stroke(new Path2D(d));
  }
  ctx.lineJoin = 'round';

  // ── Cliff hatching ──────────────────────────────────────────────────
  ctx.lineWidth = 3;
  for (const [x1, y1, x2, y2] of HATCHES) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  ctx.textBaseline = 'alphabetic';

  // ── Titles: domain headings + A / C marker glyphs and names ─────────
  if (model.showTitles) {
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.heading;
    ctx.font = `700 30px ${FONT_FAMILY}`;
    for (const d of DOMAINS) ctx.fillText(tr(d.heading), d.x, d.hy);

    ctx.textAlign = 'center';
    for (const m of MARKERS) {
      ctx.fillStyle = COLORS.body;
      ctx.font = `700 38px ${FONT_FAMILY}`;
      // The letter itself is notation, not a word — never translated.
      ctx.fillText(m.letter, m.lx, m.ly);
      ctx.font = `13.5px ${FONT_FAMILY}`;
      ctx.fillText(tr(m.name), m.nx, m.ny);
    }
  }

  // ── Explanatory text: subheadings, decisions, annotations, notes ────
  if (model.showDescriptions) {
    // Subheadings (h2) + decision lines
    ctx.textAlign = 'left';
    for (const d of DOMAINS) {
      ctx.fillStyle = COLORS.heading;
      ctx.font = `700 15px ${FONT_FAMILY}`;
      ctx.fillText(tr(d.subheading), d.x, d.sy);

      ctx.fillStyle = COLORS.body;
      for (const { lead, rest, wording, y } of d.lines) {
        if (hasHost) {
          // A translated sentence: one run, no assumed bold-lead boundary.
          ctx.font = `13.5px ${FONT_FAMILY}`;
          ctx.fillText(tr(wording), d.x, y);
        } else {
          // No host: exactly the bold-lead / roman-rest split that shipped
          // before these keys existed.
          ctx.font = `700 13.5px ${FONT_FAMILY}`;
          ctx.fillText(lead, d.x, y);
          const leadW = ctx.measureText(lead).width;
          ctx.font = `13.5px ${FONT_FAMILY}`;
          ctx.fillText(rest, d.x + leadW, y);
        }
      }
    }

    ctx.textAlign = 'center';

    // Teal annotation labels
    ctx.fillStyle = COLORS.teal;
    ctx.font = `700 15px ${FONT_FAMILY}`;
    for (const [wording, x, y] of TEAL_LABELS) ctx.fillText(tr(wording), x, y);

    // Small exaptation sub-labels
    ctx.fillStyle = COLORS.body;
    ctx.font = `10.5px ${FONT_FAMILY}`;
    for (const [wording, x, y] of SMALL_LABELS) {
      ctx.fillText(tr(wording), x, y);
    }

    // Marker notes ("prepare to exit")
    ctx.fillStyle = COLORS.teal;
    ctx.font = `700 15px ${FONT_FAMILY}`;
    for (const m of MARKERS) {
      if (m.note) ctx.fillText(tr(m.note.wording), m.note.x, m.note.y);
    }
  }
};

export const CynefinRendererExtension = ElementRendererExtension(
  'cynefin',
  cynefin
);
