import { EdgelessLegacySlotIdentifier } from '@labre/affine-block-surface';
import {
  type AttachmentBlockModel,
  AttachmentBlockSchema,
  AttachmentBlockStyles,
} from '@labre/affine-model';
import {
  EMBED_CARD_HEIGHT,
  EMBED_CARD_WIDTH,
} from '@labre/affine-shared/consts';
import { toGfxBlockComponent } from '@labre/std';
import { GfxViewInteractionExtension } from '@labre/std/gfx';
import { styleMap } from '@labre/global/lit';

import { AttachmentBlockComponent } from './attachment-block.js';
import { isHtmlAttachment } from './html-attachment.js';
import { HTML_VIEW_MIN_HEIGHT, HTML_VIEW_MIN_WIDTH } from './html-view.js';

export class AttachmentEdgelessBlockComponent extends toGfxBlockComponent(
  AttachmentBlockComponent
) {
  override blockDraggable = false;

  get slots() {
    return this.std.get(EdgelessLegacySlotIdentifier);
  }

  override onClick(_: MouseEvent) {
    return;
  }

  override renderGfxBlock() {
    const { style$, embed$ } = this.model.props;
    const cardStyle = style$.value ?? AttachmentBlockStyles[1];
    if (embed$.value && isHtmlAttachment(this.model.props)) {
      // The box itself, not a scale: width and height change on their own, and a
      // page is laid out in its box instead of being stretched.
      const box = this.model.elementBound;
      this.containerStyleMap = styleMap({
        width: `${box.w}px`,
        height: `${box.h}px`,
        overflow: 'hidden',
      });
      return this.renderPageContent();
    }
    const width = EMBED_CARD_WIDTH[cardStyle];
    const height = EMBED_CARD_HEIGHT[cardStyle];
    const bound = this.model.elementBound;
    // Contained, in the middle of the box: a « Replace » leaves a card in a frame of
    // any proportions (ADR 0044, amendment of 2026-11-04), and stretched words read
    // badly. A card resized by hand keeps its ratio, so this is its old scale.
    const scale = Math.min(bound.w / width, bound.h / height);
    const left = (bound.w - width * scale) / 2;
    const top = (bound.h - height * scale) / 2;

    this.containerStyleMap = styleMap({
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${left}px, ${top}px) scale(${scale})`,
      transformOrigin: '0 0',
      overflow: 'hidden',
    });

    return this.renderPageContent();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-edgeless-attachment': AttachmentEdgelessBlockComponent;
  }
}

export const AttachmentBlockInteraction = GfxViewInteractionExtension(
  AttachmentBlockSchema.model.flavour,
  {
    resizeConstraint: {
      lockRatio: true,
    },
    handleResize: ({ model }) => ({
      beforeResize: context => {
        const { props } = model as AttachmentBlockModel;
        if (!props.embed || !isHtmlAttachment(props)) return;
        context.set({
          lockRatio: false,
          minWidth: HTML_VIEW_MIN_WIDTH,
          minHeight: HTML_VIEW_MIN_HEIGHT,
        });
      },
    }),
    handleRotate: () => {
      return {
        beforeRotate: context => {
          context.set({
            rotatable: false,
          });
        },
      };
    },
  }
);
