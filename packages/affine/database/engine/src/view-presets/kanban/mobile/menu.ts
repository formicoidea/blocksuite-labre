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

import { groupTraitKey } from '../../../core/group-by/trait.js';
import type { MobileKanbanViewUILogic } from './kanban-view-ui-logic.js';
import {
  DATA_VIEW_CARD_EXPAND,
  DATA_VIEW_CARD_MOVE_TO,
  DATA_VIEW_ROW_INSERT_BEFORE,
  DATA_VIEW_ROW_INSERT_AFTER,
  DATA_VIEW_CARD_DELETE,
  DATA_VIEW_UNGROUPED,
} from '../../../translations.js';
import { wordingFrom } from '../../../core/utils/wording.js';

export const popCardMenu = (
  ele: PopupTarget,
  groupKey: string,
  cardId: string,
  kanbanViewLogic: MobileKanbanViewUILogic
) => {
  const groupTrait = kanbanViewLogic.view.traitGet(groupTraitKey);
  if (!groupTrait) {
    return;
  }
  popFilterableSimpleMenu(ele, [
    menu.group({
      items: [
        menu.action({
          name: wordingFrom(ele.element)(DATA_VIEW_CARD_EXPAND),
          prefix: ExpandFullIcon(),
          select: () => {
            kanbanViewLogic.root.openDetailPanel({
              view: kanbanViewLogic.view,
              rowId: cardId,
            });
          },
        }),
      ],
    }),
    menu.group({
      items: [
        menu.subMenu({
          name: wordingFrom(ele.element)(DATA_VIEW_CARD_MOVE_TO),
          prefix: ArrowRightBigIcon(),
          options: {
            items:
              groupTrait.groupsDataList$.value
                ?.filter(v => {
                  return v.key !== groupKey;
                })
                .map(group => {
                  return menu.action({
                    name:
                      group.value != null
                        ? group.name$.value
                        : wordingFrom(ele.element)(DATA_VIEW_UNGROUPED),
                    select: () => {
                      groupTrait.moveCardTo(
                        cardId,
                        groupKey,
                        group.key,
                        'start'
                      );
                    },
                  });
                }) ?? [],
          },
        }),
      ],
    }),
    menu.group({
      name: '',
      items: [
        menu.action({
          name: wordingFrom(ele.element)(DATA_VIEW_ROW_INSERT_BEFORE),
          prefix: html` <div
            style="transform: rotate(90deg);display:flex;align-items:center;"
          >
            ${MoveLeftIcon()}
          </div>`,
          select: () => {
            kanbanViewLogic.view.addCard(
              { before: true, id: cardId },
              groupKey
            );
            kanbanViewLogic.ui$.value?.requestUpdate();
          },
        }),
        menu.action({
          name: wordingFrom(ele.element)(DATA_VIEW_ROW_INSERT_AFTER),
          prefix: html` <div
            style="transform: rotate(90deg);display:flex;align-items:center;"
          >
            ${MoveRightIcon()}
          </div>`,
          select: () => {
            kanbanViewLogic.view.addCard(
              { before: false, id: cardId },
              groupKey
            );
            kanbanViewLogic.ui$.value?.requestUpdate();
          },
        }),
      ],
    }),
    menu.group({
      items: [
        menu.action({
          name: wordingFrom(ele.element)(DATA_VIEW_CARD_DELETE),
          class: {
            'delete-item': true,
          },
          prefix: DeleteIcon(),
          select: () => {
            kanbanViewLogic.view.rowsDelete([cardId]);
            kanbanViewLogic.ui$.value?.requestUpdate();
          },
        }),
      ],
    }),
  ]);
};
