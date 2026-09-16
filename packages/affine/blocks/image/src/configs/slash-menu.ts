import { getSelectedModelsCommand } from '@labre/affine-shared/commands';
import { type SlashMenuConfig } from '@labre/affine-widget-slash-menu';
import { ImageIcon } from '@blocksuite/icons/lit';

import { insertImagesCommand } from '../commands';
import {
  IMAGE_LABEL,
  IMAGE_SLASH_DESCRIPTION,
  IMAGE_SLASH_PHOTO_CAPTION,
} from '../translations';
import { PhotoTooltip } from './tooltips';

export const imageSlashMenuConfig: SlashMenuConfig = {
  items: [
    {
      name: 'Image',
      nameWording: IMAGE_LABEL,
      description: 'Insert an image.',
      descriptionWording: IMAGE_SLASH_DESCRIPTION,
      icon: ImageIcon(),
      tooltip: {
        figure: PhotoTooltip,
        caption: 'Photo',
        captionWording: IMAGE_SLASH_PHOTO_CAPTION,
      },
      group: '4_Content & Media@1',
      when: ({ model }) =>
        model.store.schema.flavourSchemaMap.has('affine:image'),
      action: ({ std }) => {
        const [success, ctx] = std.command
          .chain()
          .pipe(getSelectedModelsCommand)
          .pipe(insertImagesCommand, { removeEmptyLine: true })
          .run();

        if (success) ctx.insertedImageIds.catch(console.error);
      },
    },
  ],
};
