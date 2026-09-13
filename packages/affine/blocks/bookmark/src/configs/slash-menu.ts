import { DefaultTool } from '@labre/affine-block-surface';
import { toggleEmbedCardCreateModal } from '@labre/affine-components/embed-card-modal';
import { BookmarkBlockSchema } from '@labre/affine-model';
import { translateKey } from '@labre/affine-shared/services';
import {
  type SlashMenuConfig,
  SlashMenuConfigIdentifier,
} from '@labre/affine-widget-slash-menu';
import { LinkIcon } from '@blocksuite/icons/lit';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import type { ExtensionType } from '@labre/store';

import {
  BOOKMARK_MODAL_DESCRIPTION,
  BOOKMARK_MODAL_TITLE,
  BOOKMARK_SLASH_DESCRIPTION,
  BOOKMARK_SLASH_NAME,
} from '../translations';
import { LinkTooltip } from './tooltips';

const bookmarkSlashMenuConfig: SlashMenuConfig = {
  items: [
    {
      name: 'Link',
      nameWording: BOOKMARK_SLASH_NAME,
      description: 'Add a bookmark for reference.',
      descriptionWording: BOOKMARK_SLASH_DESCRIPTION,
      icon: LinkIcon(),
      tooltip: {
        figure: LinkTooltip,
        caption: 'Link',
        captionWording: BOOKMARK_SLASH_NAME,
      },
      group: '4_Content & Media@2',
      when: ({ model }) =>
        model.store.schema.flavourSchemaMap.has('affine:bookmark'),
      action: ({ std, model }) => {
        const { host } = std;
        const parentModel = host.store.getParent(model);
        if (!parentModel) {
          return;
        }
        const index = parentModel.children.indexOf(model) + 1;
        toggleEmbedCardCreateModal(
          host,
          translateKey(std, ...BOOKMARK_MODAL_TITLE),
          translateKey(std, ...BOOKMARK_MODAL_DESCRIPTION),
          { mode: 'page', parentModel, index },
          ({ mode }) => {
            if (mode === 'edgeless') {
              const gfx = std.get(GfxControllerIdentifier);
              gfx.tool.setTool(DefaultTool);
            }
          }
        )
          .then(() => {
            if (model.text?.length === 0) {
              model.store.deleteBlock(model);
            }
          })
          .catch(console.error);
      },
    },
  ],
};

export const BookmarkSlashMenuConfigIdentifier = SlashMenuConfigIdentifier(
  BookmarkBlockSchema.model.flavour
);

export const BookmarkSlashMenuConfigExtension: ExtensionType = {
  setup: di => {
    di.addImpl(BookmarkSlashMenuConfigIdentifier, bookmarkSlashMenuConfig);
  },
};
