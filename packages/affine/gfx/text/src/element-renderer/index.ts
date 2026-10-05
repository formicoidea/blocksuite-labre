import {
  type ElementRenderer,
  ElementRendererExtension,
} from '@labre/affine-block-surface';
import { DefaultTheme, type TextElementModel } from '@labre/affine-model';
import { deltaInsertsToChunks } from '@labre/std/inline';

import {
  alphabeticBaselineOffset,
  getFontString,
  getLineHeight,
  getTextWidth,
  isRTL,
  paintTextDecoration,
  wrapTextDeltas,
} from './utils.js';

export const text: ElementRenderer<TextElementModel> = (
  model,
  ctx,
  matrix,
  renderer
) => {
  const {
    fontSize,
    fontWeight,
    fontStyle,
    fontFamily,
    textAlign,
    textDecoration,
    rotate,
  } = model;
  const [, , w, h] = model.deserializedXYWH;
  const cx = w / 2;
  const cy = h / 2;

  ctx.setTransform(
    matrix.translateSelf(cx, cy).rotateSelf(rotate).translateSelf(-cx, -cy)
  );

  // const deltas: ITextDelta[] = yText.toDelta() as ITextDelta[];
  const font = getFontString({
    fontStyle,
    fontWeight,
    fontSize,
    fontFamily,
  });
  const deltas = wrapTextDeltas(model.text, font, w);
  const lines = deltaInsertsToChunks(deltas);
  const lineHeightPx = getLineHeight(fontFamily, fontSize, fontWeight);
  const horizontalOffset =
    textAlign === 'center' ? w / 2 : textAlign === 'right' ? w : 0;

  const color = renderer.getColorValue(
    model.color,
    DefaultTheme.textColor,
    true
  );

  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = textAlign;
  ctx.textBaseline = 'ideographic';

  for (const [lineIndex, line] of lines.entries()) {
    let beforeTextWidth = 0;

    for (const delta of line) {
      const str = delta.insert;
      const rtl = isRTL(str);
      const shouldTemporarilyAttach = rtl && !ctx.canvas.isConnected;
      if (shouldTemporarilyAttach) {
        // to correctly render RTL text mixed with LTR, we have to append it
        // to the DOM
        document.body.append(ctx.canvas);
      }

      ctx.canvas.setAttribute('dir', rtl ? 'rtl' : 'ltr');

      // 0.5 comes from v-line padding
      const offset =
        textAlign === 'center' ? 0 : textAlign === 'right' ? -0.5 : 0.5;
      const x = horizontalOffset + beforeTextWidth + offset;
      const y = (lineIndex + 1) * lineHeightPx;
      ctx.fillText(str, x, y);

      if (textDecoration) {
        paintTextDecoration(ctx, {
          decoration: textDecoration,
          lineText: str,
          font,
          x,
          // Painted on the ideographic baseline (the bottom of the font box);
          // the line hangs off the alphabetic one, a descent above it.
          baselineY: y + alphabeticBaselineOffset(font, 'ideographic'),
          fontFamily,
          fontSize,
          fontWeight,
          color,
        });
      }

      beforeTextWidth += getTextWidth(str, font);

      if (shouldTemporarilyAttach) {
        ctx.canvas.remove();
      }
    }
  }
};

export const TextElementRendererExtension = ElementRendererExtension(
  'text',
  text
);

export * from './utils';
