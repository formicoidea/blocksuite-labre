import { PlusIcon } from '@blocksuite/icons/lit';
import { cssVarV2 } from '@toeverything/theme/v2';
import { css, html, nothing, unsafeCSS } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';

import { groupToggleStyles } from '../../core/group-by/group-visibility.js';
import { createUniComponentFromWebComponent } from '../../core/utils/uni-component/uni-component.js';
import {
  ROW_COLOR_PROPERTY,
  rowColorStyle,
  viewRowColor,
} from '../../core/view/color-rules.js';
import { DATA_VIEW_NEW_PAGE } from '../../translations.js';
import {
  flatGroupStyles,
  flatOpenButtonStyles,
  FlatViewUI,
  FlatViewUILogic,
} from '../flat/flat-view-ui.js';
import type { GallerySingleView } from './define.js';

/**
 * The gallery preset (ADR 0035 §1, B6): one card per row, its title then its
 * visible properties, each drawn by the cell a table draws. A card is a
 * kanban card out of its column, flat as every document surface is (DESIGN.md,
 * the Flat-Page Rule): a hairline, no shadow.
 *
 * ponytail: no cover image on the card. The product asks for none in v2.0
 * (PRD REQ-DB-1 to 16); the upgrade is a stored `header.coverColumn`, as the
 * kanban's, drawn above the title with the image property's renderer.
 */
export class GalleryViewUILogic extends FlatViewUILogic<GallerySingleView> {
  renderer = createUniComponentFromWebComponent(GalleryViewUI);
}

export class GalleryViewUI extends FlatViewUI<GalleryViewUILogic> {
  static override styles = [
    flatOpenButtonStyles,
    flatGroupStyles,
    groupToggleStyles,
    css`
      dv-gallery-view-ui {
        display: block;
      }

      .dv-gallery {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 12px;
        padding: 4px 0 8px;
      }

      .dv-gallery-card {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
        min-height: 72px;
        padding: 8px;
        box-sizing: border-box;
        border: 1px solid ${unsafeCSS(cssVarV2.layer.insideBorder.border)};
        border-radius: 8px;
        background-color: var(
          ${unsafeCSS(ROW_COLOR_PROPERTY)},
          var(--affine-background-primary-color)
        );
        cursor: pointer;
      }

      .dv-gallery-card-title {
        padding: 2px 32px 4px 4px;
        font-weight: 500;
        font-size: var(--data-view-cell-text-size);
        line-height: var(--data-view-cell-text-line-height);
        overflow: hidden;
      }

      .dv-gallery-card-property {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 28px;
        padding: 0 4px;
        border-radius: 4px;
        overflow: hidden;
      }

      .dv-gallery-card-property-icon {
        display: flex;
        flex-shrink: 0;
        color: var(--affine-icon-color);
      }

      .dv-gallery-card-property-icon svg {
        width: 16px;
        height: 16px;
      }

      .dv-gallery-card-property dv-standalone-cell {
        flex: 1;
      }

      .dv-gallery-card:focus-within .dv-flat-open {
        visibility: visible;
      }

      .dv-gallery-new {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        min-height: 72px;
        border: 1px dashed ${unsafeCSS(cssVarV2.layer.insideBorder.border)};
        border-radius: 8px;
        background: transparent;
        color: var(--affine-text-secondary-color);
        font-family: inherit;
        font-size: var(--data-view-cell-text-size);
        cursor: pointer;
      }

      .dv-gallery-new svg {
        width: 16px;
        height: 16px;
      }

      @media (hover: hover) {
        .dv-gallery-card:hover,
        .dv-gallery-new:hover,
        .dv-gallery-card-property:hover {
          background-color: var(--affine-hover-color);
        }

        .dv-gallery-card:hover .dv-flat-open {
          visibility: visible;
        }
      }

      @media (pointer: coarse) {
        .dv-gallery-card-property {
          min-height: 44px;
        }
      }
    `,
  ];

  override connectedCallback() {
    super.connectedCallback();
    this.dataset.testid = 'dv-gallery-view';
  }

  private renderCard(rowId: string) {
    const view = this.view;
    const title = view.titleProperty$.value;
    return html`<div
      class="dv-gallery-card"
      data-testid="dv-gallery-card"
      data-row-id="${rowId}"
      style=${styleMap(rowColorStyle(viewRowColor(view, rowId)))}
      @click="${this.onRowClick}"
    >
      ${title
        ? html`<div class="dv-gallery-card-title">
            ${this.renderCell(title, rowId, true)}
          </div>`
        : nothing}
      ${repeat(
        view.bodyProperties$.value,
        property => property.id,
        property =>
          html`<div class="dv-gallery-card-property">
            <uni-lit
              class="dv-gallery-card-property-icon"
              .uni="${property.icon}"
            ></uni-lit>
            ${this.renderCell(property, rowId)}
          </div>`
      )}
      ${this.renderOpenButton(rowId)}
    </div>`;
  }

  private renderNewCard(groupKey?: string) {
    if (this.view.readonly$.value) return nothing;
    return html`<button
      class="dv-gallery-new"
      data-testid="dv-flat-new"
      @click="${() => this.logic.addRow('end', groupKey)}"
    >
      ${PlusIcon()}<span>${this.wording(DATA_VIEW_NEW_PAGE)}</span>
    </button>`;
  }

  override render() {
    return html`${this.renderHeaderWidget()}
    ${this.renderGrouped(
      (rows, group) =>
        html`<div class="dv-gallery">
          ${repeat(
            rows,
            row => row.rowId,
            row => this.renderCard(row.rowId)
          )}
          ${this.renderNewCard(group?.key)}
        </div>`
    )}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'dv-gallery-view-ui': GalleryViewUI;
  }
}
