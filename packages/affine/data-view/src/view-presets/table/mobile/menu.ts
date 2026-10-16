import {
  menu,
  popFilterableSimpleMenu,
  type PopupTarget,
} from '@labre/affine-components/context-menu';
import { OPEN_LABEL } from '@labre/affine-components/translations';
import { TOOLBAR_DELETE } from '@labre/affine-shared/services';
import { DeleteIcon, ExpandFullIcon } from '@blocksuite/icons/lit';

import type { SingleView } from '../../../core/index.js';
import { englishWording, type Wording } from '../../../core/utils/wording.js';
import type { MobileTableViewUILogic } from './table-view-ui-logic.js';

/** A row's menu on a phone, opened by a long press on the row. */
export const popMobileRowMenu = (
  target: PopupTarget,
  rowId: string,
  tableViewLogic: MobileTableViewUILogic,
  view: SingleView,
  wording: Wording = englishWording
) => {
  popFilterableSimpleMenu(target, [
    menu.group({
      items: [
        menu.action({
          name: wording(OPEN_LABEL),
          prefix: ExpandFullIcon(),
          select: () => {
            tableViewLogic.root.openDetailPanel({
              view: view,
              rowId: rowId,
            });
          },
        }),
      ],
    }),
    menu.group({
      name: '',
      items: [
        menu.action({
          name: wording(TOOLBAR_DELETE),
          class: { 'delete-item': true },
          prefix: DeleteIcon(),
          select: () => {
            view.rowsDelete([rowId]);
            tableViewLogic.ui$.value?.requestUpdate();
          },
        }),
      ],
    }),
  ]);
};
