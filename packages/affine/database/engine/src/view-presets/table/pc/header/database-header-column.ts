import {
  menu,
  type MenuConfig,
  popMenu,
  popupTargetFromElement,
} from '@labre/affine-components/context-menu';
import { SignalWatcher, WithDisposable } from '@labre/global/lit';
import {
  FilterIcon,
  InsertLeftIcon,
  InsertRightIcon,
  MoveLeftIcon,
  MoveRightIcon,
  SortIcon,
} from '@blocksuite/icons/lit';
import { type BlockStdScope, ShadowlessElement, stdContext } from '@labre/std';
import { consume } from '@lit/context';
import { css } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { styleMap } from 'lit/directives/style-map.js';
import { html } from 'lit/static-html.js';

import { popPropertyMenu } from '../../../../core/common/property-menu.js';
import { filterTraitKey } from '../../../../core/filter/trait.js';
import { firstFilterByRef } from '../../../../core/filter/utils.js';
import { renderUniLit } from '../../../../core/index.js';
import { sortTraitKey } from '../../../../core/sort/manager.js';
import { createSortUtils } from '../../../../core/sort/utils.js';
import {
  draggable,
  dragHandler,
  droppable,
} from '../../../../core/utils/wc-dnd/dnd-context.js';
import {
  wordingOf,
  propertyTypeName,
  wordingFrom,
} from '../../../../core/utils/wording.js';
import type { Property } from '../../../../core/view-manager/property.js';
import { numberFormats } from '../../../../property-presets/number/utils/formats.js';
import {
  createDefaultShowQuickSettingBar,
  ShowQuickSettingBarKey,
} from '../../../../widget-presets/quick-setting-bar/context.js';
import { DEFAULT_COLUMN_TITLE_HEIGHT } from '../../consts.js';
import type { TableProperty } from '../../table-view-manager.js';
import type { TableViewUILogic } from '../table-view-ui-logic.js';
import {
  getTableGroupRect,
  getVerticalIndicator,
  startDragWidthAdjustmentBar,
} from './vertical-indicator.js';
import {
  DATA_VIEW_NUMBER_FORMAT,
  DATA_VIEW_FILTER,
  DATA_VIEW_SORT_ASCENDING,
  DATA_VIEW_SORT_DESCENDING,
  DATA_VIEW_INSERT_LEFT,
  DATA_VIEW_INSERT_RIGHT,
  VIEWS_BAR_MOVE_LEFT,
  VIEWS_BAR_MOVE_RIGHT,
} from '../../../../translations.js';

export class DatabaseHeaderColumn extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  static override styles = css`
    affine-database-header-column {
      display: flex;
    }

    .affine-database-header-column-grabbing * {
      cursor: grabbing;
    }
  `;

  private readonly _clickColumn = () => {
    if (this.tableViewManager.readonly$.value) {
      return;
    }
    this.popMenu();
  };

  private readonly _clickTypeIcon = (event: MouseEvent) => {
    if (this.tableViewManager.readonly$.value) {
      return;
    }
    if (this.column.type$.value === 'title') {
      return;
    }
    event.stopPropagation();
    const wording = wordingFrom(this);
    popMenu(popupTargetFromElement(this), {
      options: {
        items: this.tableViewManager.propertyMetas$.value.map(config => {
          return menu.action({
            name: propertyTypeName(wording, config.config),
            isSelected: config.type === this.column.type$.value,
            prefix: renderUniLit(config.renderer.icon),
            select: () => {
              this.column.typeSet?.(config.type);
            },
          });
        }),
      },
    });
  };

  private readonly _contextMenu = (e: MouseEvent) => {
    if (this.tableViewManager.readonly$.value) {
      return;
    }
    e.preventDefault();
    this.popMenu(e.currentTarget as HTMLElement);
  };

  private readonly _enterWidthDragBar = () => {
    if (this.tableViewManager.readonly$.value) {
      return;
    }
    if (this.drawWidthDragBarTask) {
      cancelAnimationFrame(this.drawWidthDragBarTask);
      this.drawWidthDragBarTask = 0;
    }
    this.drawWidthDragBar();
  };

  private readonly _leaveWidthDragBar = () => {
    cancelAnimationFrame(this.drawWidthDragBarTask);
    this.drawWidthDragBarTask = 0;
    getVerticalIndicator().remove();
  };

  private readonly drawWidthDragBar = () => {
    const rect = getTableGroupRect(this);
    if (!rect) {
      return;
    }
    getVerticalIndicator().display(
      this.getBoundingClientRect().right,
      rect.top,
      rect.bottom - rect.top
    );
    this.drawWidthDragBarTask = requestAnimationFrame(this.drawWidthDragBar);
  };

  private drawWidthDragBarTask = 0;

  private readonly widthDragBar = createRef();

  editTitle = () => {
    this._clickColumn();
  };

  private get readonly() {
    return this.tableViewManager.readonly$.value;
  }

  private _addFilter() {
    const filterTrait = this.tableViewManager.traitGet(filterTraitKey);
    if (!filterTrait) return;

    const filter = firstFilterByRef(this.tableViewManager.vars$.value, {
      type: 'ref',
      name: this.column.id,
    });

    filterTrait.filterSet({
      type: 'group',
      op: 'and',
      conditions: [filter, ...filterTrait.filter$.value.conditions],
    });

    this._toggleQuickSettingBar();
  }

  private _addSort(desc: boolean) {
    const sortTrait = this.tableViewManager.traitGet(sortTraitKey);
    if (!sortTrait) return;

    const sortUtils = createSortUtils(
      sortTrait,
      this.tableViewLogic.eventTrace
    );
    const sortList = sortUtils.sortList$.value;
    const existingIndex = sortList.findIndex(
      sort => sort.ref.name === this.column.id
    );

    if (existingIndex !== -1) {
      sortUtils.change(existingIndex, {
        ref: { type: 'ref', name: this.column.id },
        desc,
      });
    } else {
      sortUtils.add({
        ref: { type: 'ref', name: this.column.id },
        desc,
      });
    }

    this._toggleQuickSettingBar();
  }

  private _toggleQuickSettingBar(show = true) {
    const map = this.tableViewManager.serviceGetOrCreate(
      ShowQuickSettingBarKey,
      createDefaultShowQuickSettingBar
    );
    map.value = {
      ...map.value,
      [this.tableViewManager.id]: show,
    };
  }

  private popMenu(ele?: HTMLElement) {
    const enableNumberFormatting =
      this.tableViewManager.featureFlags$.value.enable_number_formatting;

    popPropertyMenu(popupTargetFromElement(ele ?? this), this.column, {
      wording: wordingOf(this.std),
      afterType: [
        ...(enableNumberFormatting
          ? [
              menu.subMenu({
                name: wordingFrom(this)(DATA_VIEW_NUMBER_FORMAT),
                hide: () =>
                  !this.column.dataUpdate ||
                  this.column.type$.value !== 'number',
                options: {
                  items: [
                    numberFormatConfig(this.column),
                    ...numberFormats.map(format => {
                      const data = this.column.data$.value;
                      return menu.action({
                        isSelected: data.format === format.type,
                        prefix: html`<span
                          style="font-size: var(--affine-font-base); scale: 1.2;"
                          >${format.symbol}</span
                        >`,
                        name: wordingFrom(this)(format.labelWording),
                        select: () => {
                          if (data.format === format.type) return;
                          this.column.dataUpdate(() => ({
                            format: format.type,
                          }));
                        },
                      });
                    }),
                  ],
                },
              }),
            ]
          : []),
      ],
      beforeOperations: [
        menu.group({
          items: [
            menu.action({
              name: wordingFrom(this)(DATA_VIEW_FILTER),
              prefix: FilterIcon(),
              select: () => this._addFilter(),
            }),
            menu.action({
              name: wordingFrom(this)(DATA_VIEW_SORT_ASCENDING),
              prefix: SortIcon(),
              select: () => this._addSort(false),
            }),
            menu.action({
              name: wordingFrom(this)(DATA_VIEW_SORT_DESCENDING),
              prefix: SortIcon(),
              select: () => this._addSort(true),
            }),
          ],
        }),
        menu.group({
          items: [
            menu.action({
              name: wordingFrom(this)(DATA_VIEW_INSERT_LEFT),
              prefix: InsertLeftIcon(),
              select: () => {
                this.tableViewManager.propertyAdd({
                  id: this.column.id,
                  before: true,
                });
                Promise.resolve()
                  .then(() => {
                    const pre =
                      this.previousElementSibling?.previousElementSibling;
                    if (pre instanceof DatabaseHeaderColumn) {
                      pre.editTitle();
                      pre.scrollIntoView({
                        inline: 'nearest',
                        block: 'nearest',
                      });
                    }
                  })
                  .catch(console.error);
              },
            }),
            menu.action({
              name: wordingFrom(this)(DATA_VIEW_INSERT_RIGHT),
              prefix: InsertRightIcon(),
              select: () => {
                this.tableViewManager.propertyAdd({
                  id: this.column.id,
                  before: false,
                });
                Promise.resolve()
                  .then(() => {
                    const next = this.nextElementSibling?.nextElementSibling;
                    if (next instanceof DatabaseHeaderColumn) {
                      next.editTitle();
                      next.scrollIntoView({
                        inline: 'nearest',
                        block: 'nearest',
                      });
                    }
                  })
                  .catch(console.error);
              },
            }),
            menu.action({
              name: wordingFrom(this)(VIEWS_BAR_MOVE_LEFT),
              prefix: MoveLeftIcon(),
              hide: () => this.column.isFirst$.value,
              select: () => {
                const prev = this.column.prev$.value;
                if (!prev) {
                  return;
                }
                this.column.move({
                  id: prev.id,
                  before: true,
                });
              },
            }),
            menu.action({
              name: wordingFrom(this)(VIEWS_BAR_MOVE_RIGHT),
              prefix: MoveRightIcon(),
              hide: () => this.column.isLast$.value,
              select: () => {
                const next = this.column.next$.value;
                if (!next) {
                  return;
                }
                this.column.move({
                  id: next.id,
                  before: false,
                });
              },
            }),
          ],
        }),
      ],
    });
  }

  private widthDragStart(event: PointerEvent) {
    startDragWidthAdjustmentBar(
      event,
      this,
      this.getBoundingClientRect().width,
      this.column
    );
  }

  override connectedCallback() {
    super.connectedCallback();
    const table = this.closest('dv-table-view-ui');
    if (table) {
      this.disposables.add(
        table.logic.handleEvent('dragStart', context => {
          if (this.tableViewManager.readonly$.value) {
            return;
          }
          const event = context.get('pointerState').raw;
          const target = event.target;
          if (
            target instanceof Element &&
            this.widthDragBar.value?.contains(target)
          ) {
            event.preventDefault();
            event.stopPropagation();
            this.widthDragStart(event);
            return true;
          }
          return false;
        })
      );
    }
  }

  override render() {
    const column = this.column;
    const style = styleMap({
      height: DEFAULT_COLUMN_TITLE_HEIGHT + 'px',
    });
    const classes = classMap({
      'affine-database-column-move': true,
      [this.grabStatus]: true,
    });
    return html`
      <div
        style=${style}
        class="affine-database-column-content"
        @click="${this._clickColumn}"
        @contextmenu="${this._contextMenu}"
        ${dragHandler(column.id)}
        ${draggable(column.id)}
        ${droppable(column.id)}
      >
        ${this.readonly
          ? null
          : html` <button class="${classes}">
              <div class="hover-trigger"></div>
              <div class="control-h"></div>
              <div class="control-l"></div>
              <div class="control-r"></div>
            </button>`}
        <div class="affine-database-column-text ${column.type$.value}">
          <div
            class="affine-database-column-type-icon dv-hover"
            @click="${this._clickTypeIcon}"
          >
            <uni-lit .uni="${column.icon}"></uni-lit>
          </div>
          <div class="affine-database-column-text-content">
            <div class="affine-database-column-text-input">
              ${column.name$.value}
            </div>
          </div>
        </div>
      </div>
      <div
        ${ref(this.widthDragBar)}
        @mouseenter="${this._enterWidthDragBar}"
        @mouseleave="${this._leaveWidthDragBar}"
        style="width: 0;position: relative;height: 100%;z-index: 1;cursor: col-resize"
      >
        <div style="width: 8px;height: 100%;margin-left: -4px;"></div>
      </div>
    `;
  }

  @property({ attribute: false })
  accessor column!: TableProperty;

  /** Absent outside an editor (a unit test): the menu reads English. */
  @consume({ context: stdContext })
  accessor std!: BlockStdScope;

  @property({ attribute: false })
  accessor grabStatus: 'grabStart' | 'grabEnd' | 'grabbing' = 'grabEnd';

  @property({ attribute: false })
  accessor tableViewLogic!: TableViewUILogic;

  get tableViewManager() {
    return this.tableViewLogic.view;
  }
}

function numberFormatConfig(column: Property): MenuConfig {
  return () =>
    html` <affine-database-number-format-bar
      .column="${column}"
    ></affine-database-number-format-bar>`;
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-database-header-column': DatabaseHeaderColumn;
  }
}
