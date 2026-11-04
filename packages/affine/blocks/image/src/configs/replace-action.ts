import type { ImageBlockModel } from '@labre/affine-model';
import type {
  ToolbarAction,
  ToolbarContext,
} from '@labre/affine-shared/services';
import { ReplaceIcon } from '@blocksuite/icons/lit';

import { pickAndReplaceImage } from '../replace/replace-model.js';
import { IMAGE_TOOLBAR_REPLACE } from '../translations.js';

/**
 * "Replace" on the PAGE image toolbar (`pickAndReplaceImage`), from the host's
 * asset dialog in `replace` mode when there is one, from the system file chooser
 * otherwise, so it is offered without a host too. Whatever comes back takes this
 * image's frame (ADR 0044, amendments of 2026-10-27 and 2026-11-04). Hidden on a
 * read-only document. The canvas toolbar has a « Replace » MENU instead
 * (`replace/toolbar.ts`), which reaches the same picking helper through
 * `canvas.image.replaceWithImage`.
 */
export function imageReplaceToolbarAction(
  getModel: (ctx: ToolbarContext) => ImageBlockModel | null
): ToolbarAction {
  return {
    id: 'a.replace',
    tooltip: 'Replace',
    tooltipWording: IMAGE_TOOLBAR_REPLACE,
    icon: ReplaceIcon(),
    when: ctx => !ctx.readonly && getModel(ctx) !== null,
    run(ctx) {
      const model = getModel(ctx);
      if (!model) return;
      pickAndReplaceImage(ctx.std, model).catch(console.error);
    },
  };
}
