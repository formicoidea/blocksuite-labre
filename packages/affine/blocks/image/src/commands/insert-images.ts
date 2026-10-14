import type { Command } from '@labre/std';
import type { BlockModel } from '@labre/store';

import { pickAndAddSiblingImageBlocks } from '../asset-picker.js';

/**
 * Inserts images next to the selection: from the host's asset dialog
 * (`AssetPickerProvider`) when there is one, from the system file chooser
 * otherwise.
 */
export const insertImagesCommand: Command<
  {
    selectedModels?: BlockModel[];
    removeEmptyLine?: boolean;
    placement?: 'after' | 'before';
  },
  {
    insertedImageIds: Promise<string[]>;
  }
> = (ctx, next) => {
  const { selectedModels, placement, removeEmptyLine, std } = ctx;
  if (!selectedModels?.length) return;

  const targetModel =
    placement === 'before'
      ? selectedModels[0]
      : selectedModels[selectedModels.length - 1];

  return next({
    insertedImageIds: pickAndAddSiblingImageBlocks(
      std,
      targetModel,
      placement
    ).then(result => {
      if (result.length && removeEmptyLine && targetModel.text?.length === 0) {
        std.store.deleteBlock(targetModel);
      }

      return result;
    }),
  });
};
