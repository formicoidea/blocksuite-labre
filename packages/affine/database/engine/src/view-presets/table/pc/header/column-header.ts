import { getScrollContainer } from '@labre/affine-shared/utils';
import { SignalWatcher, styleMap, WithDisposable } from '@labre/global/lit';
import { PlusIcon } from '@blocksuite/icons/lit';
import { ShadowlessElement } from '@labre/std';
import { autoUpdate } from '@floating-ui/dom';
import { nothing, type TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { html } from 'lit/static-html.js';
import { popupTargetFromElement } from '@labre/affine-components/context-menu';

import {
  popNewPropertyMenu,
  whenPropertyShown,
} from '../../../../core/common/property-menu.js';
import { wordingFrom } from '../../../../core/utils/wording.js';
import { DATA_VIEW_PROPERTY_TYPE } from '../../../../translations.js';
import { PageLayoutKey } from '../../../../core/view-manager/page-layout.js';
import { cellDivider } from '../../styles.js';
import type { TableGroup } from '../group.js';
import type { DatabaseHeaderColumn } from './database-header-column.js';
import { tableStyle } from '../table-view-style';
import { type TableViewUILogic } from '../table-view-ui-logic.js';
import { styles } from './styles.js';

export class DatabaseColumnHeader extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  static override styles = styles;

  /**
   * "+" opens the type picker; the column exists only once a type is
   * picked (Escape or a click outside creates nothing), then ITS title
   * editor opens when it is drawn, never "the last column next frame"
   * (whenPropertyShown says why).
   */
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
          this.editColumnTitle(id);
        });
      },
    });
  };

  editColumnTitle = (id: string) => {
    const column = this.querySelector<DatabaseHeaderColumn>(
      `affine-database-header-column[data-column-id="${CSS.escape(id)}"]`
    );
    column?.editTitle();
  };

  preMove = 0;

  private get readonly() {
    return this.tableViewManager.readonly$.value;
  }

  private autoSetHeaderPosition(
    group: TableGroup,
    scrollContainer: HTMLElement
  ) {
    const referenceRect = group.getBoundingClientRect();
    const floatingRect = this.getBoundingClientRect();
    const rootRect = scrollContainer.getBoundingClientRect();
    let moveX = 0;
    if (rootRect.top > referenceRect.top) {
      moveX =
        Math.min(referenceRect.bottom - floatingRect.height, rootRect.top) -
        referenceRect.top;
    }
    if (moveX === 0 && this.preMove === 0) {
      return;
    }
    this.preMove = moveX;
    this.style.transform = `translate3d(0,${moveX / this.getScale()}px,0)`;
  }

  override connectedCallback() {
    super.connectedCallback();
    const scrollContainer = getScrollContainer(
      this.closest('affine-data-view-renderer')!
    );
    const group = this.closest('affine-data-view-table-group');
    if (group) {
      const cancel = autoUpdate(group, this, () => {
        if (!scrollContainer) {
          return;
        }
        // When the views are the page (`PageLayoutKey`, ADR 0035 amendments
        // of 2026-10-26 and 2026-10-28) the header is natively sticky: this
        // translate, a frame late, would double its offset. One left from
        // before the page layout applied is dropped.
        if (this.tableViewLogic.view.serviceGet(PageLayoutKey)?.peek()) {
          if (this.preMove !== 0) {
            this.preMove = 0;
            this.style.transform = '';
          }
          return;
        }
        this.autoSetHeaderPosition(group, scrollContainer);
      });
      this.disposables.add(cancel);
    }
  }

  getScale() {
    return this.scaleDiv?.getBoundingClientRect().width ?? 1;
  }

  override render() {
    return html`
      ${this.renderGroupHeader?.()}
      <div class="affine-database-column-header database-row">
        ${this.readonly
          ? nothing
          : html`<div class="${tableStyle.leftToolBarStyle}"></div>`}
        ${repeat(
          this.tableViewManager.properties$.value,
          column => column.id,
          (column, index) => {
            const style = styleMap({
              width: `${column.width$.value}px`,
              border: index === 0 ? 'none' : undefined,
            });
            return html`
              <affine-database-header-column
                style="${style}"
                data-column-id="${column.id}"
                data-column-index="${index}"
                class="affine-database-column database-cell"
                .column="${column}"
                .tableViewLogic="${this.tableViewLogic}"
              ></affine-database-header-column>
              <div class="${cellDivider}" style="height: auto;"></div>
            `;
          }
        )}
        ${this.tableViewManager.propertiesLocked$.value
          ? // The column keeps its place, so the header stays aligned.
            html`<div class="header-add-column-button"></div>`
          : html`<div
              @click="${this._onAddColumn}"
              class="header-add-column-button dv-hover"
              data-testid="dv-table-add-column"
            >
              ${PlusIcon()}
            </div>`}
        <div class="scale-div" style="width: 1px;height: 1px;"></div>
      </div>
    `;
  }

  @property({ attribute: false })
  accessor renderGroupHeader: (() => TemplateResult) | undefined;

  @query('.scale-div')
  accessor scaleDiv!: HTMLDivElement;

  @property({ attribute: false })
  accessor tableViewLogic!: TableViewUILogic;

  get tableViewManager() {
    return this.tableViewLogic.view;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-database-column-header': DatabaseColumnHeader;
  }
}
