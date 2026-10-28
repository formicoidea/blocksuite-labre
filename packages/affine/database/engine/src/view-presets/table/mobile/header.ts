import { unsafeCSSVarV2 } from '@labre/affine-shared/theme';
import { SignalWatcher, WithDisposable } from '@labre/global/lit';
import { PlusIcon } from '@blocksuite/icons/lit';
import { type BlockStdScope, ShadowlessElement, stdContext } from '@labre/std';
import { consume } from '@lit/context';
import { css, nothing, type TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { html } from 'lit/static-html.js';

import { wordingOf } from '../../../core/utils/wording.js';
import { DATA_VIEW_NEW_PROPERTY } from '../../../translations.js';
import { cellDivider } from '../styles.js';
import type { TableSingleView } from '../table-view-manager.js';
import type { MobileTableColumnHeader } from './column-header.js';
import { mobileStickyTitle } from './table-view-style.js';

export class MobileTableHeader extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  static override styles = css`
    .mobile-table-add-column {
      font-size: 18px;
      color: ${unsafeCSSVarV2('icon/primary')};
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 44px;
      min-height: 44px;
      cursor: pointer;
    }
  `;

  /** Absent outside an editor host: the wordings read English. */
  @consume({ context: stdContext })
  accessor std!: BlockStdScope;

  /**
   * "+" adds a property and opens ITS "Property settings" sheet. Up to 0.54
   * the last header was looked up in the same tick, before the header had
   * drawn the new column, so the sheet opened on the previous last property.
   */
  private readonly _onAddColumn = () => {
    if (this.readonly) return;
    const id = this.tableViewManager.propertyAdd('end');
    if (!id) return;
    this.updateComplete
      .then(() => {
        Array.from(
          this.querySelectorAll<MobileTableColumnHeader>(
            'mobile-table-column-header'
          )
        )
          .find(header => header.column.id === id)
          ?.editTitle();
      })
      .catch(console.error);
  };

  private get readonly() {
    return this.tableViewManager.readonly$.value;
  }

  override render() {
    return html`
      ${this.renderGroupHeader?.()}
      <div class="mobile-table-header mobile-table-row">
        ${repeat(
          this.tableViewManager.properties$.value,
          column => column.id,
          (column, index) => {
            const style = styleMap({
              width: `${column.width$.value}px`,
              border: index === 0 ? 'none' : undefined,
            });
            const isTitle =
              this.tableViewManager.mainProperties$.value.titleColumn ===
              column.id;
            return html`
              <div
                class="${isTitle ? mobileStickyTitle : ''}"
                style="display: flex;"
              >
                <mobile-table-column-header
                  style="${style}"
                  data-column-id="${column.id}"
                  data-column-index="${index}"
                  class="mobile-table-cell"
                  .column="${column}"
                  .tableViewManager="${this.tableViewManager}"
                ></mobile-table-column-header>
                <div class="${cellDivider}" style="height: auto;"></div>
              </div>
            `;
          }
        )}
        ${this.readonly
          ? nothing
          : html`<div
              @click="${this._onAddColumn}"
              class="mobile-table-add-column"
              data-testid="dv-table-add-property"
              role="button"
              aria-label="${wordingOf(this.std)(DATA_VIEW_NEW_PROPERTY)}"
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
  accessor tableViewManager!: TableSingleView;
}

declare global {
  interface HTMLElementTagNameMap {
    'mobile-table-header': MobileTableHeader;
  }
}
