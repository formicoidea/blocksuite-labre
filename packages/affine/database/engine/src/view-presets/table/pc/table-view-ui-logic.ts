import {
  menu,
  popMenu,
  popupTargetFromElement,
} from '@labre/affine-components/context-menu';
import type { InsertToPosition } from '@labre/affine-shared/utils';
import { AddCursorIcon } from '@blocksuite/icons/lit';
import { signal } from '@preact/signals-core';
import type { TemplateResult } from 'lit';
import { ref } from 'lit/directives/ref.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { html } from 'lit/static-html.js';

import { locateRow } from '../../../core/group-by/locate-row.js';
import type { GroupTrait } from '../../../core/group-by/trait.js';
import {
  createUniComponentFromWebComponent,
  renderUniLit,
} from '../../../core/index.js';
import { PageLayoutKey } from '../../../core/view-manager/page-layout.js';
import {
  DataViewUIBase,
  DataViewUILogicBase,
} from '../../../core/view/data-view-base.js';
import {
  TableViewAreaSelection,
  type TableViewSelectionWithType,
} from '../selection';
import type { TableSingleView } from '../table-view-manager.js';
import { TableClipboardController } from './controller/clipboard.js';
import { TableDragController } from './controller/drag.js';
import { TableHotkeysController } from './controller/hotkeys.js';
import { TableSelectionController } from './controller/selection.js';
import {
  addGroupIconStyle,
  addGroupStyle,
  tableGroupsContainerStyle,
  tableScrollContainerStyle,
  tableViewStyle,
  tableWrapperStyle,
} from './table-view-style';
import { DATA_VIEW_GROUP_NEW } from '../../../translations.js';
import { wordingFrom } from '../../../core/utils/wording.js';

export class TableViewUILogic extends DataViewUILogicBase<
  TableSingleView,
  TableViewSelectionWithType
> {
  ui$ = signal<TableViewUI>();
  scrollContainer$ = signal<HTMLDivElement>();
  tableContainer$ = signal<HTMLDivElement>();

  clipboardController = new TableClipboardController(this);
  dragController = new TableDragController(this);
  hotkeysController = new TableHotkeysController(this);
  selectionController = new TableSelectionController(this);

  private get readonly() {
    return this.view.readonly$.value;
  }

  clearSelection = () => {
    this.selectionController.clear();
  };

  /**
   * "New" adds the row and puts its title in editing, as the table's own
   * "New record" footer does: it no longer opens the row (product owner,
   * recette P3-15). Nothing is written but the row.
   */
  addRow = (position: InsertToPosition) => {
    if (this.readonly) return;
    const rowId = this.view.rowAdd(position);
    if (rowId) this.editRowTitle(rowId);
    return rowId;
  };

  /** Selects the title cell of `rowId` in editing, once the row is drawn. */
  editRowTitle(rowId: string) {
    requestAnimationFrame(() => {
      const view = this.view;
      const at = locateRow(view.groupTrait, view.rows$.peek(), rowId);
      const columnIndex = view.properties$
        .peek()
        .findIndex(property => property.type$.peek() === 'title');
      if (!at || columnIndex < 0) return;
      this.selectionController.selection = TableViewAreaSelection.create({
        groupKey: at.groupKey,
        focus: { rowIndex: at.rowIndex, columnIndex },
        isEditing: true,
      });
    });
  }

  focusFirstCell = () => {
    this.selectionController.focusFirstCell();
  };

  showIndicator = (evt: MouseEvent) => {
    return this.dragController.showIndicator(evt) != null;
  };

  hideIndicator = () => {
    this.dragController.dropPreview.remove();
  };

  moveTo = (id: string, evt: MouseEvent) => {
    const result = this.dragController.getInsertPosition(evt);
    if (result) {
      const row = this.view.rowGetOrCreate(id);
      row.move(result.position, undefined, result.groupKey);
    }
  };

  onWheel = (event: WheelEvent) => {
    if (event.metaKey || event.ctrlKey) {
      return;
    }
    const ele = event.currentTarget;
    if (ele instanceof HTMLElement) {
      if (ele.scrollWidth === ele.clientWidth) {
        return;
      }
      event.stopPropagation();
    }
  };

  renderAddGroup = (groupHelper: GroupTrait) => {
    const addGroup = groupHelper.addGroup;
    if (!addGroup) {
      return;
    }
    const add = (e: MouseEvent) => {
      const ele = e.currentTarget as HTMLElement;
      popMenu(popupTargetFromElement(ele), {
        options: {
          items: [
            menu.input({
              onComplete: text => {
                const column = groupHelper.property$.value;
                if (column) {
                  column.dataUpdate(() =>
                    addGroup({
                      text,
                      oldData: column.data$.value,
                      dataSource: this.view.manager.dataSource,
                    })
                  );
                }
              },
            }),
          ],
        },
      });
    };
    return html` <div style="display:flex;">
      <div class="${addGroupStyle}" @click="${add}">
        <div class="${addGroupIconStyle}">${AddCursorIcon()}</div>
        <div>${wordingFrom(this.ui$.value)(DATA_VIEW_GROUP_NEW)}</div>
      </div>
    </div>`;
  };

  renderer = createUniComponentFromWebComponent(TableViewUI);
}

export class TableViewUI extends DataViewUIBase<TableViewUILogic> {
  override connectedCallback(): void {
    super.connectedCallback();
    this.logic.ui$.value = this;
    this.logic.clipboardController.hostConnected();
    this.logic.dragController.hostConnected();
    this.logic.hotkeysController.hostConnected();
    this.logic.selectionController.hostConnected();
    this.classList.add('affine-database-table', tableViewStyle);
    this.dataset['testid'] = 'dv-table-view';
  }

  private renderTable() {
    const groups = this.logic.view.groupTrait.visibleGroups$.value;
    if (groups) {
      return html`
        <div class="${tableGroupsContainerStyle}">
          ${repeat(
            groups,
            v => v.key,
            group => {
              return html` <affine-data-view-table-group
                data-group-key="${group.key}"
                .tableViewLogic="${this.logic}"
                .group="${group}"
              ></affine-data-view-table-group>`;
            }
          )}
          ${this.logic.renderAddGroup(this.logic.view.groupTrait)}
          <dv-hidden-groups
            .groupTrait="${this.logic.view.groupTrait}"
          ></dv-hidden-groups>
        </div>
      `;
    }
    return html` <affine-data-view-table-group
      .tableViewLogic="${this.logic}"
    ></affine-data-view-table-group>`;
  }

  override render(): TemplateResult {
    // Read in the render, so the table follows the block's measure.
    this.toggleAttribute(
      'data-page-layout',
      !!this.logic.view.serviceGet(PageLayoutKey)?.value
    );
    const vPadding = this.logic.root.config.virtualPadding$.value;
    const wrapperStyle = styleMap({
      marginLeft: `-${vPadding}px`,
      marginRight: `-${vPadding}px`,
    });
    const containerStyle = styleMap({
      paddingLeft: `${vPadding}px`,
      paddingRight: `${vPadding}px`,
    });
    return html`
      ${this.logic.headerWidget
        ? renderUniLit(this.logic.headerWidget, {
            dataViewLogic: this.logic,
          })
        : ''}
      <div
        class="${tableWrapperStyle} dv-table-wrapper"
        style="${wrapperStyle}"
      >
        <div
          ${ref(this.logic.scrollContainer$)}
          class="${tableScrollContainerStyle} dv-table-scroll-container"
          @wheel="${this.logic.onWheel}"
        >
          <div
            ${ref(this.logic.tableContainer$)}
            class="affine-database-table-container"
            style="${containerStyle}"
          >
            ${this.renderTable()}
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'dv-table-view-ui': TableViewUI;
  }
}
