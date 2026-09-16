import {
  formatBlockCommand,
  type TextFormatConfig,
  textFormatConfigs,
} from '@labre/affine-inline-preset';
import {
  type TextConversionConfig,
  textConversionConfigs,
} from '@labre/affine-rich-text';
import { isInsideBlockByFlavour } from '@labre/affine-shared/utils';
import {
  type SlashMenuActionItem,
  type SlashMenuConfig,
  SlashMenuConfigExtension,
  type SlashMenuItem,
} from '@labre/affine-widget-slash-menu';
import { HeadingsIcon } from '@blocksuite/icons/lit';
import { BlockSelection } from '@labre/std';

import { updateBlockType } from '../commands';
import { tooltips } from './tooltips';
import {
  NOTE_OTHER_HEADINGS,
  NOTE_SLASH_ITEM_NAME_WORDINGS,
} from '../translations.js';

let basicIndex = 0;
const noteSlashMenuConfig: SlashMenuConfig = {
  items: [
    ...textConversionConfigs
      .filter(i => i.type && ['h1', 'h2', 'h3', 'text'].includes(i.type))
      .map(config => createConversionItem(config, `0_Basic@${basicIndex++}`)),
    {
      name: 'Other Headings',
      nameWording: NOTE_OTHER_HEADINGS,
      icon: HeadingsIcon(),
      group: `0_Basic@${basicIndex++}`,
      subMenu: textConversionConfigs
        .filter(i => i.type && ['h4', 'h5', 'h6'].includes(i.type))
        .map(config => createConversionItem(config)),
    },
    ...textConversionConfigs
      .filter(i => i.flavour === 'affine:code')
      .map(config => createConversionItem(config, `0_Basic@${basicIndex++}`)),

    ...textConversionConfigs
      .filter(i => i.type && ['divider', 'quote'].includes(i.type))
      .map(
        config =>
          ({
            ...createConversionItem(config, `0_Basic@${basicIndex++}`),
            when: ({ model }) =>
              model.store.schema.flavourSchemaMap.has(config.flavour) &&
              !isInsideBlockByFlavour(
                model.store,
                model,
                'affine:edgeless-text'
              ),
          }) satisfies SlashMenuActionItem
      ),

    ...textConversionConfigs
      .filter(i => i.flavour === 'affine:list')
      .map((config, index) =>
        createConversionItem(config, `1_List@${index++}`)
      ),

    ...textFormatConfigs
      .filter(i => !['Code', 'Link'].includes(i.name))
      .map((config, index) =>
        createTextFormatItem(config, `2_Style@${index++}`)
      ),
  ],
};

/**
 * `TextConversionConfig.name` / `TextFormatConfig.name` are borrowed from
 * `@labre/affine-rich-text` / `@labre/affine-inline-preset` — both outside
 * this lot's packages, so their English literal is out of scope to key. The
 * NAME each produces, though, is one this package already has a wording for
 * (the shared block-type names, or this file's own format names), looked up
 * by the borrowed string in `NOTE_SLASH_ITEM_NAME_WORDINGS`.
 */
function createConversionItem(
  config: TextConversionConfig,
  group?: SlashMenuItem['group']
): SlashMenuActionItem {
  const { name, description, icon, flavour, type } = config;
  return {
    name,
    nameWording: config.nameWording ?? NOTE_SLASH_ITEM_NAME_WORDINGS[name],
    group,
    description,
    descriptionWording: config.descriptionWording,
    icon,
    tooltip: tooltips[name],
    when: ({ model }) => model.store.schema.flavourSchemaMap.has(flavour),
    action: ({ std }) => {
      std.command.exec(updateBlockType, {
        flavour,
        props: { type },
      });
    },
  };
}

function createTextFormatItem(
  config: TextFormatConfig,
  group?: SlashMenuItem['group']
): SlashMenuActionItem {
  const { name, icon, id, action } = config;
  return {
    name,
    nameWording: config.nameWording ?? NOTE_SLASH_ITEM_NAME_WORDINGS[name],
    icon,
    group,
    tooltip: tooltips[name],
    action: ({ std, model }) => {
      const { host } = std;

      if (model.text?.length !== 0) {
        std.command.exec(formatBlockCommand, {
          blockSelections: [
            std.selection.create(BlockSelection, {
              blockId: model.id,
            }),
          ],
          styles: { [id]: true },
        });
      } else {
        // like format bar when the line is empty
        action(host);
      }
    },
  };
}

export const NoteSlashMenuConfigExtension = SlashMenuConfigExtension(
  'affine:note',
  noteSlashMenuConfig
);
