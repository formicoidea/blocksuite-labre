import type { ImageBlockModel } from '@labre/affine-model';
import {
  AssetPickerProvider,
  type ToolbarAction,
  type ToolbarContext,
} from '@labre/affine-shared/services';
import { ReplaceIcon } from '@blocksuite/icons/lit';

import { pickAndReplaceImage } from '../asset-picker.js';
import { IMAGE_TOOLBAR_REPLACE } from '../translations.js';

/**
 * "Replace" on the image toolbar, page and canvas alike: opens the host's
 * asset dialog in `replace` mode and swaps the picture in place
 * (`replaceImage`). It exists only with an `AssetPickerProvider` and on a
 * writable document: without a host there is no library to pick from.
 */
export function imageReplaceToolbarAction(
  getModel: (ctx: ToolbarContext) => ImageBlockModel | null
): ToolbarAction {
  return {
    id: 'a.replace',
    tooltip: 'Replace',
    tooltipWording: IMAGE_TOOLBAR_REPLACE,
    icon: ReplaceIcon(),
    when: ctx =>
      !ctx.readonly &&
      !!ctx.std.getOptional(AssetPickerProvider) &&
      getModel(ctx) !== null,
    run(ctx) {
      const model = getModel(ctx);
      if (!model) return;
      pickAndReplaceImage(ctx.std, model).catch(console.error);
    },
  };
}
