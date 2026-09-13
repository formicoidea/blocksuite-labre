import { toast } from '@labre/affine-components/toast';
import type { ListBlockModel, ParagraphBlockModel } from '@labre/affine-model';
import { insertContent } from '@labre/affine-rich-text';
import {
  ArrowDownBigIcon,
  ArrowUpBigIcon,
  CopyIcon,
  DeleteIcon,
  DualLinkIcon,
  NowIcon,
  TodayIcon,
  TomorrowIcon,
  YesterdayIcon,
} from '@blocksuite/icons/lit';
import { type DeltaInsert, Slice, Text } from '@labre/store';
import {
  TOAST_COPIED_TO_CLIPBOARD,
  translateKey,
} from '@labre/affine-shared/services';

import { slashMenuToolTips } from './tooltips';
import {
  SLASH_MENU_COPY,
  SLASH_MENU_COPY_DESCRIPTION,
  SLASH_MENU_DELETE,
  SLASH_MENU_DELETE_DESCRIPTION,
  SLASH_MENU_DUPLICATE,
  SLASH_MENU_DUPLICATE_DESCRIPTION,
  SLASH_MENU_MOVE_DOWN,
  SLASH_MENU_MOVE_DOWN_DESCRIPTION,
  SLASH_MENU_MOVE_UP,
  SLASH_MENU_MOVE_UP_DESCRIPTION,
  SLASH_MENU_NOW,
  SLASH_MENU_TODAY,
  SLASH_MENU_TOMORROW,
  SLASH_MENU_YESTERDAY,
} from './translations';
import type { SlashMenuConfig } from './types';
import { formatDate, formatTime } from './utils';

export const defaultSlashMenuConfig: SlashMenuConfig = {
  items: () => {
    const now = new Date();
    const tomorrow = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return [
      {
        name: 'Today',
        nameWording: SLASH_MENU_TODAY,
        icon: TodayIcon(),
        tooltip: slashMenuToolTips['Today'],
        description: formatDate(now),
        group: '6_Date@0',
        action: ({ std, model }) => {
          insertContent(std, model, formatDate(now));
        },
      },
      {
        name: 'Tomorrow',
        nameWording: SLASH_MENU_TOMORROW,
        icon: TomorrowIcon(),
        tooltip: slashMenuToolTips['Tomorrow'],
        description: formatDate(tomorrow),
        group: '6_Date@1',
        action: ({ std, model }) => {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          insertContent(std, model, formatDate(tomorrow));
        },
      },
      {
        name: 'Yesterday',
        nameWording: SLASH_MENU_YESTERDAY,
        icon: YesterdayIcon(),
        tooltip: slashMenuToolTips['Yesterday'],
        description: formatDate(yesterday),
        group: '6_Date@2',
        action: ({ std, model }) => {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          insertContent(std, model, formatDate(yesterday));
        },
      },
      {
        name: 'Now',
        nameWording: SLASH_MENU_NOW,
        icon: NowIcon(),
        tooltip: slashMenuToolTips['Now'],
        description: formatTime(now),
        group: '6_Date@3',
        action: ({ std, model }) => {
          insertContent(std, model, formatTime(now));
        },
      },
      {
        name: 'Move Up',
        nameWording: SLASH_MENU_MOVE_UP,
        description: 'Shift this line up.',
        descriptionWording: SLASH_MENU_MOVE_UP_DESCRIPTION,
        icon: ArrowUpBigIcon(),
        tooltip: slashMenuToolTips['Move Up'],
        group: '8_Actions@0',
        action: ({ std, model }) => {
          const { host } = std;
          const previousSiblingModel = host.store.getPrev(model);
          if (!previousSiblingModel) return;

          const parentModel = host.store.getParent(previousSiblingModel);
          if (!parentModel) return;

          host.store.moveBlocks(
            [model],
            parentModel,
            previousSiblingModel,
            true
          );
        },
      },
      {
        name: 'Move Down',
        nameWording: SLASH_MENU_MOVE_DOWN,
        description: 'Shift this line down.',
        descriptionWording: SLASH_MENU_MOVE_DOWN_DESCRIPTION,
        icon: ArrowDownBigIcon(),
        tooltip: slashMenuToolTips['Move Down'],
        group: '8_Actions@1',
        action: ({ std, model }) => {
          const { host } = std;
          const nextSiblingModel = host.store.getNext(model);
          if (!nextSiblingModel) return;

          const parentModel = host.store.getParent(nextSiblingModel);
          if (!parentModel) return;

          host.store.moveBlocks([model], parentModel, nextSiblingModel, false);
        },
      },
      {
        name: 'Copy',
        nameWording: SLASH_MENU_COPY,
        description: 'Copy this line to clipboard.',
        descriptionWording: SLASH_MENU_COPY_DESCRIPTION,
        icon: CopyIcon(),
        tooltip: slashMenuToolTips['Copy'],
        group: '8_Actions@2',
        action: ({ std, model }) => {
          const slice = Slice.fromModels(std.store, [model]);

          std.clipboard
            .copy(slice)
            .then(() => {
              toast(std.host, translateKey(std, ...TOAST_COPIED_TO_CLIPBOARD));
            })
            .catch(e => {
              console.error(e);
            });
        },
      },
      {
        name: 'Duplicate',
        nameWording: SLASH_MENU_DUPLICATE,
        description: 'Create a duplicate of this line.',
        descriptionWording: SLASH_MENU_DUPLICATE_DESCRIPTION,
        icon: DualLinkIcon(),
        tooltip: slashMenuToolTips['Copy'],
        group: '8_Actions@3',
        action: ({ std, model }) => {
          if (!model.text || !(model.text instanceof Text)) {
            console.error("Can't duplicate a block without text");
            return;
          }
          const { host } = std;
          const parent = host.store.getParent(model);
          if (!parent) {
            console.error(
              'Failed to duplicate block! Parent not found: ' +
                model.id +
                '|' +
                model.flavour
            );
            return;
          }
          const index = parent.children.indexOf(model);

          // FIXME: this clone is not correct
          host.store.addBlock(
            model.flavour,
            {
              type: (model as ParagraphBlockModel).props.type,
              text: new Text(
                (
                  model as ParagraphBlockModel
                ).props.text.toDelta() as DeltaInsert[]
              ),
              checked: (model as ListBlockModel).props.checked,
            },
            host.store.getParent(model),
            index
          );
        },
      },
      {
        name: 'Delete',
        nameWording: SLASH_MENU_DELETE,
        description: 'Remove this line permanently.',
        descriptionWording: SLASH_MENU_DELETE_DESCRIPTION,
        searchAlias: ['remove'],
        icon: DeleteIcon(),
        tooltip: slashMenuToolTips['Delete'],
        group: '8_Actions@4',
        action: ({ std, model }) => {
          std.host.store.deleteBlock(model);
        },
      },
    ];
  },
};
