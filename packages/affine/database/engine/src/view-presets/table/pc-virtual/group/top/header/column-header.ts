import { popupTargetFromElement } from '@labre/affine-components/context-menu';
import { SignalWatcher, styleMap, WithDisposable } from '@labre/global/lit';
import { PlusIcon } from '@blocksuite/icons/lit';
import { ShadowlessElement } from '@labre/std';
import { css } from '@labre/affine-shared/styles';
import { nothing } from 'lit';
import { property, query } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { html } from 'lit/static-html.js';

import { LEFT_TOOL_BAR_WIDTH } from '../../../../consts';
import { cellDivider } from '../../../../styles';
import type { VirtualTableViewUILogic } from '../../../table-view-ui-logic';
import * as styles from './column-header-css';
import {
  popNewPropertyMenu,
  whenPropertyShown,
} from '../../../../../../core/common/property-menu.js';
import { wordingFrom } from '../../../../../../core/utils/wording.js';
import { DATA_VIEW_PROPERTY_TYPE } from '../../../../../../translations.js';
const leftBarStyle = css({
  width: LEFT_TOOL_BAR_WIDTH,
});
export class VirtualTableHeader extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  /** "+" as the classic table draws it (`DatabaseColumnHeader`). */
  private readonly _onAddColumn = (e: MouseEvent) => {
    if (this.readonly || this.tableViewManager.propertiesLocked$.value) return;
    const ele = e.currentTarget as HTMLElement;
    const wording = wordingFrom(ele);
    popNewPropertyMenu(popupTargetFromElement(ele), this.tableViewManager, {
      title: wording(DATA_VIEW_PROPERTY_TYPE),
      wording,
      onAdd: id => {
        whenPropertyShown(this.tableViewManager, id, () => {
          ele.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          this.openPropertyMenuById(id);
        });
      },
    });
  };

  openPropertyMenuById = (id: string) => {
    const column = this.querySelectorAll('virtual-database-header-column');
    for (const item of column) {
      if (item.dataset.columnId === id) {
        item.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        item.editTitle();
        return;
      }
    }
  };

  private get readonly() {
    return this.tableViewManager.readonly$.value;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.classList.add(styles.columnHeaderContainer);
  }

  override render() {
    return html`
      <div class="${styles.columnHeader} database-row">
        ${this.readonly ? nothing : html` <div class="${leftBarStyle}"></div>`}
        ${repeat(
          this.tableViewManager.properties$.value,
          column => column.id,
          (column, index) => {
            const style = styleMap({
              width: `${column.width$.value}px`,
              border: index === 0 ? 'none' : undefined,
            });
            return html`
              <virtual-database-header-column
                style="${style}"
                data-column-id="${column.id}"
                data-column-index="${index}"
                class="${styles.column} ${styles.cell}"
                .column="${column}"
                .tableViewLogic="${this.tableViewLogic}"
              ></virtual-database-header-column>
              <div class="${cellDivider}" style="height: auto;"></div>
            `;
          }
        )}
        ${this.tableViewManager.propertiesLocked$.value
          ? // The column keeps its place, so the header stays aligned.
            html`<div class="${styles.headerAddColumnButton}"></div>`
          : html`<div
              @click="${this._onAddColumn}"
              class="${styles.headerAddColumnButton}"
              data-testid="dv-table-add-column"
            >
              ${PlusIcon()}
            </div>`}
        <div class="scale-div" style="width: 1px;height: 1px;"></div>
      </div>
    `;
  }

  @query('.scale-div')
  accessor scaleDiv!: HTMLDivElement;

  @property({ attribute: false })
  accessor tableViewLogic!: VirtualTableViewUILogic;

  get tableViewManager() {
    return this.tableViewLogic.view;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'virtual-table-header': VirtualTableHeader;
  }
}
