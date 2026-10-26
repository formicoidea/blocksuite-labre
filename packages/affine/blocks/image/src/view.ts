import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';
import { CommandExtension } from '@labre/std';

import { EdgelessClipboardImageConfig } from './edgeless-clipboard-config';
import { effects } from './effects';
import { ImageEdgelessBlockInteraction } from './image-edgeless-block';
import { ImageBlockSpec } from './image-spec';
import { imageReplaceCommands } from './replace/commands.js';
import { shapeReplaceWithImageToolbarExtension } from './replace/toolbar.js';

export class ImageViewExtension extends ViewExtensionProvider {
  override name = 'affine-image-block';

  override effect() {
    super.effect();
    effects();
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register(ImageBlockSpec);
    if (this.isEdgeless(context.scope)) {
      context.register(EdgelessClipboardImageConfig);
      context.register(ImageEdgelessBlockInteraction);
      // « Replace with image / with shape » (ADR 0044): the shape toolbar's
      // entry is a second module on the shape flavour, owned by this package.
      context.register(shapeReplaceWithImageToolbarExtension);
      context.register(CommandExtension(imageReplaceCommands));
    }
  }
}
