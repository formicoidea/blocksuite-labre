import { SortIcon } from '@blocksuite/icons/lit';
import { html } from 'lit';

import { sortTraitKey } from '../../../core/sort/manager.js';
import { createSortUtils } from '../../../core/sort/utils.js';
import type { DataViewWidgetProps } from '../../../core/widget/types.js';
import { popSortRoot } from './root-panel.js';
import {
  activateOnEnterOrSpace,
  keyboardOpener,
  popupTargetReturningFocus,
} from '../../tools/keyboard.js';

export const renderSortBar = (props: DataViewWidgetProps) => {
  const sortTrait = props.dataViewLogic.view.traitGet(sortTraitKey);
  if (!sortTrait) {
    return;
  }
  const count = sortTrait.sortList$.value.length;
  if (count === 0) {
    return;
  }
  const text = count === 1 ? html`1 Sort` : html`${count} Sorts`;
  const click = (event: MouseEvent) => {
    const anchor = event.currentTarget as HTMLElement;
    popSortRoot(popupTargetReturningFocus(anchor, keyboardOpener(event)), {
      sortUtils: createSortUtils(sortTrait, props.dataViewLogic.eventTrace),
    });
  };
  return html` <data-view-component-button
    class="data-view-sort-button"
    role="button"
    tabindex="0"
    aria-haspopup="menu"
    aria-expanded="false"
    @keydown="${activateOnEnterOrSpace}"
    .onClick="${click}"
    hoverType="border"
    .icon="${SortIcon()}"
    .text="${text}"
  ></data-view-component-button>`;
};
