import {
  menu,
  type MenuConfig,
  popMenu,
  popupTargetFromElement,
} from '@labre/affine-components/context-menu';
import { unsafeCSSVarV2 } from '@labre/affine-shared/theme';
import { SignalWatcher, WithDisposable } from '@labre/global/lit';
import {
  InsertLeftIcon,
  InsertRightIcon,
  MoveLeftIcon,
  MoveRightIcon,
} from '@blocksuite/icons/lit';
import { type BlockStdScope, ShadowlessElement, stdContext } from '@labre/std';
import { consume } from '@lit/context';
import { css } from 'lit';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { html } from 'lit/static-html.js';

import { propertyMenuItems } from '../../../core/common/property-menu.js';
import { wordingOf } from '../../../core/utils/wording.js';
import type { Property } from '../../../core/view-manager/property.js';
import { numberFormats } from '../../../property-presets/number/utils/formats.js';
import {
  DATA_VIEW_INSERT_LEFT,
  DATA_VIEW_INSERT_RIGHT,
  DATA_VIEW_PROPERTY_SETTINGS,
  VIEWS_BAR_MOVE_LEFT,
  VIEWS_BAR_MOVE_RIGHT,
  DATA_VIEW_NUMBER_FORMAT,
} from '../../../translations.js';
import { MOBILE_TOUCH_TARGET } from '../consts.js';
import type { TableProperty, TableSingleView } from '../table-view-manager.js';

export class MobileTableColumnHeader extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  static override styles = css`
    .mobile-table-column-header {
      display: flex;
      padding: 6px;
      gap: 6px;
      align-items: center;
    }

    .mobile-table-column-header-icon {
      font-size: 18px;
      color: ${unsafeCSSVarV2('database/textSecondary')};
      display: flex;
      align-items: center;
    }

    .mobile-table-column-header-name {
      font-weight: 500;
      font-size: 14px;
      color: ${unsafeCSSVarV2('database/textSecondary')};
    }
  `;

  private readonly _clickColumn = () => {
    if (this.tableViewManager.readonly$.value) {
      return;
    }
    this.popMenu();
  };

  editTitle = () => {
    this._clickColumn();
  };

  private popMenu(ele?: HTMLElement) {
    const enableNumberFormatting =
      this.tableViewManager.featureFlags$.value.enable_number_formatting;
    const wording = wordingOf(this.std);

    popMenu(popupTargetFromElement(ele ?? this), {
      options: {
        title: {
          text: wording(DATA_VIEW_PROPERTY_SETTINGS),
        },
        items: propertyMenuItems(this.column, {
          wording,
          afterType: enableNumberFormatting
            ? [
                menu.subMenu({
                  name: wording(DATA_VIEW_NUMBER_FORMAT),
                  hide: () =>
                    !this.column.dataUpdate ||
                    this.column.type$.value !== 'number',
                  options: {
                    title: {
                      text: wording(DATA_VIEW_NUMBER_FORMAT),
                    },
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
                          name: wording(format.labelWording),
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
            : [],
          beforeOperations: [
            menu.group({
              items: [
                menu.action({
                  name: wording(DATA_VIEW_INSERT_LEFT),
                  hide: () => this.tableViewManager.propertiesLocked$.value,
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
                        if (pre instanceof MobileTableColumnHeader) {
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
                  name: wording(DATA_VIEW_INSERT_RIGHT),
                  hide: () => this.tableViewManager.propertiesLocked$.value,
                  prefix: InsertRightIcon(),
                  select: () => {
                    this.tableViewManager.propertyAdd({
                      id: this.column.id,
                      before: false,
                    });
                    Promise.resolve()
                      .then(() => {
                        const next =
                          this.nextElementSibling?.nextElementSibling;
                        if (next instanceof MobileTableColumnHeader) {
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
                  name: wording(VIEWS_BAR_MOVE_LEFT),
                  prefix: MoveLeftIcon(),
                  hide: () => this.column.isFirst$.value,
                  select: () => {
                    const pre = this.column.prev$.value;
                    if (!pre) {
                      return;
                    }
                    this.column.move({
                      id: pre.id,
                      before: true,
                    });
                  },
                }),
                menu.action({
                  name: wording(VIEWS_BAR_MOVE_RIGHT),
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
        }),
      },
    });
  }

  override render() {
    const column = this.column;
    const style = styleMap({
      height: MOBILE_TOUCH_TARGET + 'px',
    });
    return html`
      <div
        style=${style}
        class="mobile-table-column-header"
        @click="${this._clickColumn}"
      >
        <uni-lit
          class="mobile-table-column-header-icon"
          .uni="${column.icon}"
        ></uni-lit>
        <div class="mobile-table-column-header-name">${column.name$.value}</div>
      </div>
    `;
  }

  /** Absent outside an editor host: the menu reads English. */
  @consume({ context: stdContext })
  accessor std!: BlockStdScope;

  @property({ attribute: false })
  accessor column!: TableProperty;

  @property({ attribute: false })
  accessor tableViewManager!: TableSingleView;
}

function numberFormatConfig(column: Property): MenuConfig {
  return () =>
    html` <affine-database-number-format-bar
      .column="${column}"
    ></affine-database-number-format-bar>`;
}

declare global {
  interface HTMLElementTagNameMap {
    'mobile-table-column-header': MobileTableColumnHeader;
  }
}
