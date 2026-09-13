import { getSelectedModelsCommand } from '@labre/affine-shared/commands';
import type { SlashMenuConfig } from '@labre/affine-widget-slash-menu';
import { EmbedIcon } from '@blocksuite/icons/lit';

import { insertEmptyEmbedIframeCommand } from '../../commands/insert-empty-embed-iframe';
import {
  EMBED_IFRAME_SLASH_DESCRIPTION,
  EMBED_IFRAME_SLASH_NAME,
} from '../../../translations';
import { EmbedIframeTooltip } from './tooltip';

export const embedIframeSlashMenuConfig: SlashMenuConfig = {
  items: [
    {
      name: 'Embed',
      nameWording: EMBED_IFRAME_SLASH_NAME,
      description: 'For Google Drive, and more.',
      descriptionWording: EMBED_IFRAME_SLASH_DESCRIPTION,
      icon: EmbedIcon(),
      tooltip: {
        figure: EmbedIframeTooltip,
        caption: 'Embed',
        captionWording: EMBED_IFRAME_SLASH_NAME,
      },
      group: '4_Content & Media@5',
      when: ({ model }) => {
        return model.store.schema.flavourSchemaMap.has('affine:embed-iframe');
      },
      action: ({ std }) => {
        std.command
          .chain()
          .pipe(getSelectedModelsCommand)
          .pipe(insertEmptyEmbedIframeCommand, {
            place: 'after',
            removeEmptyLine: true,
            linkInputPopupOptions: {
              telemetrySegment: 'slash menu',
            },
          })
          .run();
      },
    },
  ],
};
