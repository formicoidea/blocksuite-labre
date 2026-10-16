import {
  type ElementRenderer,
  ElementRendererExtension,
  notationColor,
} from '@labre/affine-block-surface';
import type { EdgyBoardElementModel } from '@labre/affine-model';
import { NOTATION_NEUTRALS } from '@labre/affine-shared/consts';

/** The shared notation scale's card: painted at render time, so every board. */
const BOARD_FILL = NOTATION_NEUTRALS.cardFill;
const BOARD_BORDER = NOTATION_NEUTRALS.cardBorder;
const BOARD_RADIUS = 16;
const BOARD_BORDER_WIDTH = 2;

/**
 * Canvas renderer for the blank EDGY board: a plain white rounded rectangle
 * with a discreet border. The board only exists to host free-form EDGY
 * modelling and grant the spotlight-on-hover behavior to the elements laid on
 * top of it.
 */
export const edgyBoard: ElementRenderer<EdgyBoardElementModel> = (
  model,
  ctx,
  matrix,
  renderer
) => {
  const [, , w, h] = model.deserializedXYWH;
  const cx = w / 2;
  const cy = h / 2;
  ctx.setTransform(
    matrix
      .translateSelf(cx, cy)
      .rotateSelf(model.rotate)
      .translateSelf(-cx, -cy)
  );

  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, BOARD_RADIUS);
  ctx.fillStyle = notationColor(renderer, BOARD_FILL, 'fill');
  ctx.fill();
  ctx.strokeStyle = notationColor(renderer, BOARD_BORDER);
  ctx.lineWidth = BOARD_BORDER_WIDTH;
  ctx.stroke();
};

export const EdgyBoardRendererExtension = ElementRendererExtension(
  'edgyBoard',
  edgyBoard
);
