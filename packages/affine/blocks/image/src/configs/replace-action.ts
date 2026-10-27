import type { ImageBlockModel } from '@labre/affine-model';
import type {
  ToolbarAction,
  ToolbarContext,
} from '@labre/affine-shared/services';
import { ReplaceIcon } from '@blocksuite/icons/lit';

import { pickAndReplaceImage } from '../asset-picker.js';
import { IMAGE_TOOLBAR_REPLACE } from '../translations.js';

/**
 * "Replace" on the PAGE image toolbar: swaps the picture in place
 * (`pickAndReplaceImage`), from the host's asset dialog in `replace` mode when
 * there is one, from the system file chooser otherwise — so it is offered
 * without a host too (ADR 0044, amendment of 2026-10-27). Hidden on a
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
