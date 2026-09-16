import { EmbedLinkedDocBlockSchema } from '@labre/affine-model';
import { insertContent } from '@labre/affine-rich-text';
import { REFERENCE_NODE } from '@labre/affine-shared/consts';
import { createDefaultDoc } from '@labre/affine-shared/utils';
import {
  type SlashMenuConfig,
  SlashMenuConfigIdentifier,
} from '@labre/affine-widget-slash-menu';
import { LinkedPageIcon, PlusIcon } from '@blocksuite/icons/lit';
import { type ExtensionType } from '@labre/store';

import {
  EMBED_DOC_SLASH_LINKED_DOC_CAPTION,
  EMBED_DOC_SLASH_LINKED_DOC_DESCRIPTION,
  EMBED_DOC_SLASH_LINKED_DOC_NAME,
  EMBED_DOC_SLASH_NEW_DOC_DESCRIPTION,
  EMBED_DOC_SLASH_NEW_DOC_NAME,
} from '../../translations';
import { LinkDocTooltip, NewDocTooltip } from './tooltips';

const linkedDocSlashMenuConfig: SlashMenuConfig = {
  items: [
    {
      name: 'New Doc',
      nameWording: EMBED_DOC_SLASH_NEW_DOC_NAME,
      description: 'Start a new document.',
      descriptionWording: EMBED_DOC_SLASH_NEW_DOC_DESCRIPTION,
      icon: PlusIcon(),
      tooltip: {
        figure: NewDocTooltip,
        caption: 'New Doc',
        captionWording: EMBED_DOC_SLASH_NEW_DOC_NAME,
      },
      group: '3_Page@0',
      when: ({ model }) =>
        model.store.schema.flavourSchemaMap.has('affine:embed-linked-doc'),
      action: ({ std, model }) => {
        const newDoc = createDefaultDoc(std.host.store.workspace);
        insertContent(std, model, REFERENCE_NODE, {
          reference: {
            type: 'LinkedPage',
            pageId: newDoc.id,
          },
        });
      },
    },
    {
      name: 'Linked Doc',
      nameWording: EMBED_DOC_SLASH_LINKED_DOC_NAME,
      description: 'Link to another document.',
      descriptionWording: EMBED_DOC_SLASH_LINKED_DOC_DESCRIPTION,
      icon: LinkedPageIcon(),
      tooltip: {
        figure: LinkDocTooltip,
        caption: 'Link Doc',
        captionWording: EMBED_DOC_SLASH_LINKED_DOC_CAPTION,
      },
      searchAlias: ['dual link'],
      group: '3_Page@1',
      when: ({ std, model }) => {
        const root = model.store.root;
        if (!root) return false;
        const linkedDocWidget = std.view.getWidget(
          'affine-linked-doc-widget',
          root.id
        );
        if (!linkedDocWidget) return false;

        return model.store.schema.flavourSchemaMap.has(
          'affine:embed-linked-doc'
        );
      },
      action: ({ model, std }) => {
        const root = model.store.root;
        if (!root) return;
        const linkedDocWidget = std.view.getWidget(
          'affine-linked-doc-widget',
          root.id
        );
        if (!linkedDocWidget) return;
        // TODO(@L-Sun): make linked-doc-widget as extension
        // @ts-expect-error same as above
        linkedDocWidget.show({ addTriggerKey: true });
      },
    },
  ],
};

export const LinkedDocSlashMenuConfigIdentifier = SlashMenuConfigIdentifier(
  EmbedLinkedDocBlockSchema.model.flavour
);

export const LinkedDocSlashMenuConfigExtension: ExtensionType = {
  setup: di => {
    di.addImpl(LinkedDocSlashMenuConfigIdentifier, linkedDocSlashMenuConfig);
  },
};
