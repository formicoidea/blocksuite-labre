import { PlusIcon } from '@blocksuite/icons/lit';
import { cssVarV2 } from '@toeverything/theme/v2';
import { css, html, nothing, unsafeCSS } from 'lit';
import { repeat } from 'lit/directives/repeat.js';

import { createUniComponentFromWebComponent } from '../../core/utils/uni-component/uni-component.js';
import { DATA_VIEW_NEW_PAGE } from '../../translations.js';
import {
  flatOpenButtonStyles,
  FlatViewUI,
  FlatViewUILogic,
} from '../flat/flat-view-ui.js';
import type { ListSingleView } from './define.js';

/**
 * The list preset (ADR 0035 §1, B7): one line per row, the title on the left
 * and the visible properties on the right, each drawn by the cell a table
 * draws, so a select is the table's tag and opens the table's tag menu. An
 * empty value draws no chip, as in Notion's list: it is set from the opened
 * row. Narrow screens wrap the chips under the title.
 */
export class ListViewUILogic extends FlatViewUILogic<ListSingleView> {
  renderer = createUniComponentFromWebComponent(ListViewUI);
}

export class ListViewUI extends FlatViewUI<ListViewUILogic> {
  static override styles = [
    flatOpenButtonStyles,
    css`
      dv-list-view-ui {
        display: block;
      }

      .dv-list {
        display: flex;
        flex-direction: column;
        padding: 4px 0 8px;
      }

      .dv-list-row {
        position: relative;
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 36px;
        padding: 2px 40px 2px 8px;
        box-sizing: border-box;
        border-bottom: 1px solid
          ${unsafeCSS(cssVarV2.layer.insideBorder.border)};
        cursor: pointer;
      }

      .dv-list-row-title {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        font-size: var(--data-view-cell-text-size);
        line-height: var(--data-view-cell-text-line-height);
      }

      .dv-list-row-properties {
        display: flex;
        flex: 0 1 auto;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
        min-width: 0;
        max-width: 60%;
        overflow: hidden;
      }

      .dv-list-row-property {
        display: flex;
        align-items: center;
        flex: 0 1 auto;
        min-width: 0;
        max-width: 200px;
        overflow: hidden;
      }

      .dv-list-row .dv-flat-open {
        top: 50%;
        transform: translateY(-50%);
      }

      .dv-list-row:focus-within .dv-flat-open {
        visibility: visible;
      }

      .dv-list-new {
        display: flex;
        align-items: center;
        gap: 4px;
        min-height: 36px;
        padding: 0 8px;
        border: none;
        background: transparent;
        color: var(--affine-text-secondary-color);
        font-family: inherit;
        font-size: var(--data-view-cell-text-size);
        text-align: start;
        cursor: pointer;
      }

      .dv-list-new svg {
        width: 16px;
        height: 16px;
      }

      @media (hover: hover) {
        .dv-list-row:hover,
        .dv-list-new:hover {
          background-color: var(--affine-hover-color);
        }

        .dv-list-row:hover .dv-flat-open {
          visibility: visible;
        }
      }

      @media (pointer: coarse) {
        .dv-list-row,
        .dv-list-new {
          min-height: 44px;
        }
      }

      @media (max-width: 640px) {
        .dv-list-row {
          flex-wrap: wrap;
          padding-top: 6px;
          padding-bottom: 6px;
        }

        .dv-list-row-title {
          flex-basis: 100%;
        }

        .dv-list-row-properties {
          flex-wrap: wrap;
          justify-content: flex-start;
          max-width: 100%;
        }
      }
    `,
  ];

  override connectedCallback() {
    super.connectedCallback();
    this.dataset.testid = 'dv-list-view';
  }

  private renderRow(rowId: string) {
    const view = this.view;
    const title = view.titleProperty$.value;
    const chips = view.bodyProperties$.value.filter(
      property => !property.cellGetOrCreate(rowId).isEmpty$.value
    );
    return html`<div
      class="dv-list-row"
      data-testid="dv-list-row"
      data-row-id="${rowId}"
      @click="${this.onRowClick}"
    >
      <div class="dv-list-row-title">
        ${title ? this.renderCell(title, rowId, true) : nothing}
      </div>
      ${chips.length
        ? html`<div class="dv-list-row-properties">
            ${repeat(
              chips,
              property => property.id,
              property =>
                html`<div class="dv-list-row-property">
                  ${this.renderCell(property, rowId)}
                </div>`
            )}
          </div>`
        : nothing}
      ${this.renderOpenButton(rowId)}
    </div>`;
  }

  private renderNewRow() {
    if (this.view.readonly$.value) return nothing;
    return html`<button
      class="dv-list-new"
      data-testid="dv-flat-new"
      @click="${() => this.logic.addRow('end')}"
    >
      ${PlusIcon()}<span>${this.wording(DATA_VIEW_NEW_PAGE)}</span>
    </button>`;
  }

  override render() {
    return html`${this.renderHeaderWidget()}
      <div class="dv-list">
        ${repeat(
          this.view.rows$.value,
          row => row.rowId,
          row => this.renderRow(row.rowId)
        )}
        ${this.renderNewRow()}
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'dv-list-view-ui': ListViewUI;
  }
}
