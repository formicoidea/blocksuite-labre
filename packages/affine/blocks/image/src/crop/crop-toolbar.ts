import type { ImageCropMask } from '@labre/affine-model';
import { EditorChevronDown } from '@labre/affine-components/toolbar';
import {
  type ChromeWording,
  type ToolbarAction,
  type ToolbarContext,
  translateKey,
} from '@labre/affine-shared/services';
import { CropIcon } from '@blocksuite/icons/lit';
import { html, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';

import {
  IMAGE_TOOLBAR_CROP,
  IMAGE_TOOLBAR_CROP_1_1,
  IMAGE_TOOLBAR_CROP_4_3,
  IMAGE_TOOLBAR_CROP_16_9,
  IMAGE_TOOLBAR_CROP_FREE,
  IMAGE_TOOLBAR_CROP_ORIGINAL,
} from '../translations.js';
import type { ImageCropController } from './crop-controller.js';

const MASK_ENTRIES: readonly (readonly [ImageCropMask, ChromeWording])[] = [
  ['free', IMAGE_TOOLBAR_CROP_FREE],
  ['16:9', IMAGE_TOOLBAR_CROP_16_9],
  ['4:3', IMAGE_TOOLBAR_CROP_4_3],
  ['1:1', IMAGE_TOOLBAR_CROP_1_1],
];

const testIdOf = (mask: ImageCropMask) =>
  `image-crop-${mask.replace(':', '-')}`;

/**
 * « Rogner » in the image toolbar (ADR 0036), page and canvas alike: the
 * toolbar's own `editor-menu-button` of `editor-menu-action`s, nothing drawn
 * anew. Hidden on a readonly page and until the picture has loaded — a preset
 * needs the source's size.
 */
export function imageCropToolbarAction(
  blockOf: (
    ctx: ToolbarContext
  ) => { cropController: ImageCropController; blobUrl?: string | null } | null
): ToolbarAction {
  return {
    id: 'b.crop',
    when: ctx => !ctx.readonly,
    content(ctx) {
      const block = blockOf(ctx);
      if (!block?.blobUrl) return null;
      const controller = block.cropController;
      const crop = controller.crop$.value;
      const current = crop ? (crop.mask ?? 'free') : null;
      const label = translateKey(ctx.std, ...IMAGE_TOOLBAR_CROP);
      const original = translateKey(ctx.std, ...IMAGE_TOOLBAR_CROP_ORIGINAL);

      return html`
        <editor-menu-button
          .contentPadding="${'8px'}"
          .button=${html`
            <editor-icon-button
              aria-label=${label}
              data-testid="image-crop-button"
              .tooltip=${label}
            >
              ${CropIcon()} ${EditorChevronDown}
            </editor-icon-button>
          `}
        >
          <div data-size="small" data-orientation="vertical">
            ${repeat(
              MASK_ENTRIES,
              ([mask]) => mask,
              ([mask, wording]) => {
                const word = translateKey(ctx.std, ...wording);
                return html`
                  <editor-menu-action
                    aria-label=${word}
                    data-testid=${testIdOf(mask)}
                    ?data-selected=${current === mask}
                    @click=${() => controller.choose(mask)}
                  >
                    <span class="label">${word}</span>
                  </editor-menu-action>
                `;
              }
            )}
            ${crop
              ? html`
                  <editor-menu-action
                    aria-label=${original}
                    data-testid="image-crop-original"
                    @click=${() => {
                      controller.restoreOriginal();
                    }}
                  >
                    <span class="label">${original}</span>
                  </editor-menu-action>
                `
              : nothing}
          </div>
        </editor-menu-button>
      `;
    },
  };
}
