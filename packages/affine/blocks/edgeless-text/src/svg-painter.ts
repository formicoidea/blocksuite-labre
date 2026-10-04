import {
  type BlockSvgPainter,
  BlockSvgPainterExtension,
} from '@labre/affine-block-surface';
import { getFontString, wrapText } from '@labre/affine-gfx-text';
import { DefaultTheme, type EdgelessTextBlockModel } from '@labre/affine-model';
import { HEADING_SCALE, type HeadingLevel } from '@labre/affine-shared/consts';
import type { BlockModel } from '@labre/store';

import { EDGELESS_TEXT_BASE_FONT_SIZE } from './edgeless-toolbar/font-size.js';

/** `--affine-line-height` is `calc(1em + 8px)`: what a body line adds to its size. */
const BODY_LINE_EXTRA = 8;
/** The container's 1px border, which the text sits inside. */
const BORDER = 1;

interface TextRun {
  level?: HeadingLevel;
  text: string;
}

/** Every paragraph and list item of the block, depth first, as plain text. */
function runsOf(model: BlockModel, runs: TextRun[] = []): TextRun[] {
  for (const child of model.children) {
    if (child.text) {
      const type = (child.props as { type?: string }).type;
      runs.push({
        level:
          type !== undefined && type in HEADING_SCALE
            ? (type as HeadingLevel)
            : undefined,
        text: child.text.toString(),
      });
    }
    runsOf(child, runs);
  }
  return runs;
}

/**
 * An edgeless text, redrawn as VECTOR text for "Export SVG" (ADR 0025,
 * amendment of 2026-10-04).
 *
 * The block is DOM, so no canvas renderer paints it; this lays it out the way
 * its CSS does, with the canvas text renderer's own font string and wrapping
 * (`@labre/affine-gfx-text`): one line run per paragraph, its size and weight
 * from `HEADING_SCALE` for a heading and from the 15px body otherwise, wrapped
 * to the block's width only when the block has one (`hasMaxWidth`), then
 * rotated about the block's centre and scaled by `scale`, as on screen.
 *
 * ponytail: each paragraph is drawn in the BLOCK's style — inline bold, italic,
 * colour and links are flattened, list bullets and numbers are not drawn, and
 * heading margins are ignored. Upgrade by walking the paragraph's deltas the
 * way `wrapTextDeltas` does for a canvas text, when a board needs it.
 */
export const edgelessTextSvgPainter: BlockSvgPainter<EdgelessTextBlockModel> = (
  model,
  ctx,
  matrix,
  renderer
) => {
  const {
    scale,
    rotate,
    color,
    fontFamily,
    fontStyle,
    fontWeight,
    textAlign,
    hasMaxWidth,
  } = model.props;
  const [, , w, h] = model.deserializedXYWH;
  ctx.setTransform(
    matrix
      .translate(w / 2, h / 2)
      .rotate(rotate)
      .translate(-w / 2, -h / 2)
      .scale(scale)
  );

  const width = w / scale - 2 * BORDER;
  const x =
    BORDER +
    (textAlign === 'center' ? width / 2 : textAlign === 'right' ? width : 0);
  ctx.fillStyle = renderer.getColorValue(color, DefaultTheme.textColor, true);
  ctx.textAlign = textAlign;
  ctx.textBaseline = 'middle';

  let y = BORDER;
  for (const { level, text } of runsOf(model)) {
    const heading = level ? HEADING_SCALE[level] : undefined;
    const fontSize = heading?.fontSize ?? EDGELESS_TEXT_BASE_FONT_SIZE;
    const lineHeight = fontSize + (heading?.lineHeightExtra ?? BODY_LINE_EXTRA);
    const font = getFontString({
      fontStyle,
      fontWeight: heading ? String(heading.fontWeight) : fontWeight,
      fontSize,
      fontFamily,
    });
    ctx.font = font;
    const lines = (hasMaxWidth ? wrapText(text, font, width) : text).split(
      '\n'
    );
    for (const line of lines) {
      if (line) ctx.fillText(line, x, y + lineHeight / 2);
      y += lineHeight;
    }
  }
};

export const EdgelessTextSvgPainterExtension = BlockSvgPainterExtension(
  'affine:edgeless-text',
  edgelessTextSvgPainter
);
