import {
  type EmbedCardStyle,
  type ImageBlockProps,
  isWholeImage,
} from '@labre/affine-model';
import type { BlockStdScope } from '@labre/std';
import type { BlockModel } from '@labre/store';

import { ratioCrop } from '../crop/crop-math.js';

/**
 * The frame of a replaced element (ADR 0044, amendment of 2026-11-04): what
 * arrives takes its size, whatever its own. A picture of other proportions is cut
 * to it and zoomed by the crop of ADR 0037, never distorted.
 */

export type Box = { w: number; h: number };
type Natural = Pick<Required<ImageBlockProps>, 'width' | 'height'>;

const CARD_WIDE_RATIO = 2;
const DISPLAYED_FRAME =
  '.resizable-img, .affine-attachment-container, .affine-attachment-card';

/**
 * The crop that cuts `image` to the proportions of `box`, as stored props:
 * nothing when the picture already has them (the whole image is the absent key,
 * ADR 0037).
 */
export function cropToBox(
  box: Box,
  image: Natural
): Pick<ImageBlockProps, 'crop'> {
  if (!(box.w > 0 && box.h > 0)) return {};
  const rect = ratioCrop(box.w / box.h, image.width, image.height);
  return isWholeImage(rect) ? {} : { crop: rect };
}

/**
 * What a page image stores to show `image` in `box`. On a page `width` and `height`
 * are the size of the WHOLE picture and the crop its visible share (ADR 0037), so a
 * crop asks for a whole picture larger than the box.
 */
export function pageImageProps(
  box: Box,
  image: Natural
): Pick<ImageBlockProps, 'width' | 'height' | 'crop'> {
  const { crop } = cropToBox(box, image);
  return {
    width: box.w / (crop?.w ?? 1),
    height: box.h / (crop?.h ?? 1),
    ...(crop ? { crop } : {}),
  };
}

/** The box a page image with a stored size shows, its crop taken into account. */
export function storedImageBox({
  width,
  height,
  crop,
}: Partial<Pick<ImageBlockProps, 'width' | 'height' | 'crop'>>): Box | null {
  if (!width || !height) return null;
  return { w: width * (crop?.w ?? 1), h: height * (crop?.h ?? 1) };
}

/**
 * The box a block outside the canvas shows: the size it stores, else what it was
 * laid out at (`offset*`: a note on a canvas scales it, the frame does not change).
 * `null` when it was never laid out, for a page that is not on screen.
 */
export function displayedBox(
  std: BlockStdScope,
  model: BlockModel
): Box | null {
  // An attachment has none of these: it reads as no stored size.
  const stored = storedImageBox(model.props as Partial<ImageBlockProps>);
  if (stored) return stored;
  const shown = std.view
    ?.getBlock(model.id)
    ?.querySelector<HTMLElement>(DISPLAYED_FRAME);
  return shown?.offsetWidth && shown.offsetHeight
    ? { w: shown.offsetWidth, h: shown.offsetHeight }
    : null;
}

/** The card a file draws in a frame: a band in a wide one, a tile otherwise. */
export function cardStyleFor(box: Box): EmbedCardStyle {
  return box.w >= box.h * CARD_WIDE_RATIO ? 'horizontalThin' : 'cubeThick';
}
