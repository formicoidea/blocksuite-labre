import {
  menu,
  popFilterableSimpleMenu,
  type PopupTarget,
} from '@labre/affine-components/context-menu';
import {
  ArrowRightBigIcon,
  DeleteIcon,
  ExpandFullIcon,
  MoveLeftIcon,
  MoveRightIcon,
} from '@blocksuite/icons/lit';
import { html } from 'lit';

import type { KanbanSelectionController } from './controller/selection.js';
import type { KanbanViewUILogic } from './kanban-view-ui-logic.js';
import {
  DATA_VIEW_CARD_EXPAND,
  DATA_VIEW_CARD_MOVE_TO,
  DATA_VIEW_ROW_INSERT_BEFORE,
  DATA_VIEW_ROW_INSERT_AFTER,
  DATA_VIEW_CARD_DELETE,
  DATA_VIEW_UNGROUPED,
} from '../../../translations.js';
import { wordingFrom } from '../../../core/utils/wording.js';

export const openDetail = (
  kanbanViewLogic: KanbanViewUILogic,
  rowId: string,
  selection: KanbanSelectionController
) => {
  const old = selection.selection;
  selection.selection = undefined;
  kanbanViewLogic.root.openDetailPanel({
    view: selection.view,
    rowId: rowId,
    onClose: () => {
      selection.selection = old;
    },
  });
};

export const popCardMenu = (
  kanbanViewLogic: KanbanViewUILogic,
  ele: PopupTarget,
  rowId: string,
  selection: KanbanSelectionController
) => {
  popFilterableSimpleMenu(ele, [
    menu.action({
      name: wordingFrom(ele.element)(DATA_VIEW_CARD_EXPAND),
      prefix: ExpandFullIcon(),
      select: () => {
        openDetail(kanbanViewLogic, rowId, selection);
      },
    }),
    menu.subMenu({
      name: wordingFrom(ele.element)(DATA_VIEW_CARD_MOVE_TO),
      prefix: ArrowRightBigIcon(),
      options: {
        items:
          selection.view.groupTrait.groupsDataList$.value
            ?.filter(v => {
              const cardSelection = selection.selection;
              if (cardSelection?.selectionType === 'card') {
                return v.key !== cardSelection?.cards[0].groupKey;
              }
              return false;
            })
            .map(group => {
              return menu.action({
                name:
                  group.value != null
                    ? group.name$.value
                    : wordingFrom(ele.element)(DATA_VIEW_UNGROUPED),
                select: () => {
                  selection.moveCard(rowId, group.key);
                },
              });
            }) ?? [],
      },
    }),
    menu.group({
      name: '',
      items: [
        menu.action({
          name: wordingFrom(ele.element)(DATA_VIEW_ROW_INSERT_BEFORE),
          hide: () => selection.view.rowsLocked$.value,
          prefix: html` <div
            style="transform: rotate(90deg);display:flex;align-items:center;"
          >
            ${MoveLeftIcon()}
          </div>`,
          select: () => {
            selection.insertRowBefore();
          },
        }),
        menu.action({
          name: wordingFrom(ele.element)(DATA_VIEW_ROW_INSERT_AFTER),
          hide: () => selection.view.rowsLocked$.value,
          prefix: html` <div
            style="transform: rotate(90deg);display:flex;align-items:center;"
          >
            ${MoveRightIcon()}
          </div>`,
          select: () => {
            selection.insertRowAfter();
          },
        }),
      ],
    }),
    menu.group({
      name: '',
      items: [
        menu.action({
          name: wordingFrom(ele.element)(DATA_VIEW_CARD_DELETE),
          class: {
            'delete-item': true,
          },
          prefix: DeleteIcon(),
          select: () => {
            selection.deleteCard();
          },
        }),
      ],
    }),
  ]);
};
