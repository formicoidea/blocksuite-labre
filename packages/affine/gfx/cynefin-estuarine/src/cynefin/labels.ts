import type { BackgroundLabelHit } from '@labre/affine-block-surface';
import { backgroundTextHitBox } from '@labre/affine-block-surface';
import type { CynefinElementModel } from '@labre/affine-model';
import type { ChromeWording } from '@labre/affine-shared/services';

import { refScale } from '../utils';
import type { DomainBlock } from './consts';
import { DOMAINS, HEADING_SIZE, REF_H, REF_W } from './consts';

/** Resolves a wording against the host's catalogue, or falls back to English. */
export type CynefinWordingResolver = (wording: ChromeWording) => string;

/**
 * What a domain heading SAYS: the user's own word, else the vocabulary.
 *
 * The very precedence `backgroundLabelText` applies to a declared background —
 * user text wins over the catalogue, the catalogue over the shipped English —
 * spelled out here because this diagram has no declaration to apply it for it.
 * An empty string is a real answer (the user erased the word), which is why the
 * test is against `undefined` and not against falsiness.
 */
export function cynefinHeadingText(
  model: CynefinElementModel,
  block: DomainBlock,
  translate: CynefinWordingResolver
): string {
  const own = (model as unknown as Record<string, unknown>)[block.prop];
  return own === undefined || own === null
    ? translate(block.heading)
    : String(own);
}

/**
 * Clickable boxes of the four domain headings, in ELEMENT-LOCAL coordinates.
 *
 * Built from the same reference positions and the same uniform letterbox fit
 * the renderer draws them with, so the target tracks the word at any size, and
 * empty while the headings are hidden — a label that is not painted may not be
 * aimed at either.
 */
export function cynefinLabelHits(
  model: CynefinElementModel,
  w: number,
  h: number,
  translate: CynefinWordingResolver
): BackgroundLabelHit[] {
  if (!model.showTitles) return [];

  const { s, ox, oy } = refScale(w, h, REF_W, REF_H);
  return DOMAINS.map(block => {
    const text = cynefinHeadingText(model, block, translate);
    return {
      id: block.prop,
      prop: block.prop,
      text,
      ...backgroundTextHitBox(
        text,
        HEADING_SIZE * s,
        ox + block.x * s,
        oy + block.hy * s
      ),
    };
  });
}
