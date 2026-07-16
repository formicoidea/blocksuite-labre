import { EdgelessCRUDIdentifier } from '@labre/affine-block-surface';
import { type ShapeElementModel, TextFitMode } from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';

import { normalizeShapeBound } from './element-renderer/shape/utils.js';

const CYCLE: Record<TextFitMode, TextFitMode> = {
  [TextFitMode.Grow]: TextFitMode.Contained,
  [TextFitMode.Contained]: TextFitMode.Overflow,
  [TextFitMode.Overflow]: TextFitMode.Grow,
};

export const nextTextFitMode = (mode: TextFitMode) => CYCLE[mode];

/**
 * Apply a text fit mode to shapes. Entering `grow` re-clamps each shape's
 * bounds to its text (the mode's invariant); the two fixed-bounds modes
 * leave the bounds as the user set them. Both writes land in the same
 * history batch (one undo step).
 */
export function applyTextFitMode(
  std: BlockStdScope,
  models: ShapeElementModel[],
  mode: TextFitMode
) {
  const crud = std.get(EdgelessCRUDIdentifier);
  std.store.captureSync();

  for (const model of models) {
    crud.updateElement(model.id, { textFitMode: mode });
    // The model now reads the new mode, so the grow clamp applies.
    if (mode === TextFitMode.Grow && model.text) {
      crud.updateElement(model.id, {
        xywh: normalizeShapeBound(
          model,
          Bound.fromXYWH(model.deserializedXYWH)
        ).serialize(),
      });
    }
  }
}
