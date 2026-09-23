import type { BackgroundLabelHit } from '@labre/affine-block-surface';
import { backgroundTextHitBox } from '@labre/affine-block-surface';
import type { EstuarineElementModel } from '@labre/affine-model';
import type { ChromeWording } from '@labre/affine-shared/services';

import { LABEL_LETTER_SPACING, LABELS, REF_X, REF_Y } from './consts';

/** Resolves a wording against the host's catalogue, or falls back to English. */
export type EstuarineWordingResolver = (wording: ChromeWording) => string;

/** The three curve legends, in the order the renderer paints them. */
export type EstuarineLegendKey = keyof typeof LABELS;

/**
 * Only the factors the legends need out of `EstuarineFit`.
 *
 * Taken as a parameter rather than imported: the fit is computed in
 * `./element-renderer.ts`, which reads this module to know what a legend says,
 * and a module cycle to save two fields would be a poor trade.
 */
export interface EstuarineLegendFit {
  sx: number;
  sy: number;
  /** The one undeformed factor — type is never stretched. */
  strokeScale: number;
}

/**
 * What a legend SAYS: the user's own word, else the vocabulary.
 *
 * The very precedence `backgroundLabelText` applies to a declared background —
 * user text wins over the catalogue, the catalogue over the shipped English —
 * spelled out here because this map has no declaration to apply it for it. An
 * empty string is a real answer (the user erased the word), which is why the
 * test is against `undefined` and not against falsiness.
 */
export function estuarineLegendText(
  model: EstuarineElementModel,
  key: EstuarineLegendKey,
  translate: EstuarineWordingResolver
): string {
  const label = LABELS[key];
  const own = (model as unknown as Record<string, unknown>)[label.prop];
  return own === undefined || own === null
    ? translate(label.wording)
    : String(own);
}

/**
 * Clickable boxes of the visible legends, in ELEMENT-LOCAL coordinates.
 *
 * Anchored through the same fit the renderer anchors them with: proportionally
 * in both directions — through the same cropped window (`REF_X` / `REF_Y`) —
 * and typed isotropically. A legend whose curve is switched off is not painted
 * and is therefore not aimable either.
 */
export function estuarineLabelHits(
  model: EstuarineElementModel,
  fit: EstuarineLegendFit,
  translate: EstuarineWordingResolver
): BackgroundLabelHit[] {
  const props = model as unknown as Record<string, unknown>;
  const hits: BackgroundLabelHit[] = [];

  for (const key of Object.keys(LABELS) as EstuarineLegendKey[]) {
    const label = LABELS[key];
    if (!props[label.visibleProp]) continue;

    const text = estuarineLegendText(model, key, translate);
    const box = backgroundTextHitBox(
      text,
      label.size * fit.strokeScale,
      (label.x - REF_X) * fit.sx,
      (label.y - REF_Y) * fit.sy,
      'center'
    );
    // A legend is letter-spaced, so it is wider than the shared estimate: half
    // of the extra width on each side, since the word is centred on its anchor.
    const spread =
      (Math.max(text.length - 1, 0) * LABEL_LETTER_SPACING * fit.strokeScale) /
      2;
    hits.push({
      id: key,
      prop: label.prop,
      text,
      ...box,
      minX: box.minX - spread,
      maxX: box.maxX + spread,
    });
  }

  return hits;
}
