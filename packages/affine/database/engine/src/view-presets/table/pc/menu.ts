import {
  menu,
  popFilterableSimpleMenu,
  type PopupTarget,
} from '@labre/affine-components/context-menu';
import {
  CopyIcon,
  DeleteIcon,
  ExpandFullIcon,
  MoveLeftIcon,
  MoveRightIcon,
} from '@blocksuite/icons/lit';
import { html } from 'lit';

import { TableViewRowSelection } from '../selection';
import type { TableSelectionController } from './controller/selection.js';
import type { TableViewUILogic } from './table-view-ui-logic.js';
import {
  DATA_VIEW_ROWS_DELETE,
  DATA_VIEW_ROW_EXPAND,
  DATA_VIEW_ROW_INSERT_BEFORE,
  DATA_VIEW_ROW_INSERT_AFTER,
  DATA_VIEW_ROW_DELETE,
} from '../../../translations.js';
import { TOOLBAR_COPY } from '@labre/affine-shared/services';
import { wordingFrom } from '../../../core/utils/wording.js';

export const openDetail = (
  tableViewLogic: TableViewUILogic,
  rowId: string,
  selection: TableSelectionController,
  newTab = false
) => {
  const old = selection.selection;
  selection.selection = undefined;
  tableViewLogic.root.openDetailPanel({
    view: selection.logic.view,
    rowId: rowId,
    newTab,
    onClose: () => {
      selection.selection = old;
    },
  });
};

export const popRowMenu = (
  tableViewLogic: TableViewUILogic,
  ele: PopupTarget,
  selectionController: TableSelectionController
) => {
  const selection = selectionController.selection;
  if (!TableViewRowSelection.is(selection)) {
    return;
  }
  if (selection.rows.length > 1) {
    const rows = TableViewRowSelection.rowsIds(selection);
    popFilterableSimpleMenu(ele, [
      menu.group({
        name: '',
        items: [
          menu.action({
            name: wordingFrom(ele.element)(TOOLBAR_COPY),
            prefix: html` <div
              style="transform: rotate(90deg);display:flex;align-items:center;"
            >
              ${CopyIcon()}
            </div>`,
            select: () => {
              selectionController.logic.clipboardController.copy();
            },
          }),
        ],
      }),
      menu.group({
        name: '',
        items: [
          menu.action({
            name: wordingFrom(ele.element)(DATA_VIEW_ROWS_DELETE),
            class: {
              'delete-item': true,
            },
            prefix: DeleteIcon(),
            select: () => {
              selectionController.view.rowsDelete(rows);
              selectionController.logic.ui$.value?.requestUpdate();
            },
          }),
        ],
      }),
    ]);
    return;
  }
  const row = selection.rows[0];
  if (!row) return;
  popFilterableSimpleMenu(ele, [
    menu.action({
      name: wordingFrom(ele.element)(DATA_VIEW_ROW_EXPAND),
      prefix: ExpandFullIcon(),
      select: () => {
        openDetail(tableViewLogic, row.id, selectionController);
      },
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
            selectionController.insertRowBefore(row.groupKey, row.id);
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
            selectionController.insertRowAfter(row.groupKey, row.id);
          },
        }),
      ],
    }),
    menu.group({
      items: [
        menu.action({
          name: wordingFrom(ele.element)(DATA_VIEW_ROW_DELETE),
          class: { 'delete-item': true },
          prefix: DeleteIcon(),
          select: () => {
            selectionController.deleteRow(row.id);
          },
        }),
      ],
    }),
  ]);
};
