import { translateKey } from '@labre/affine-shared/services';
import { OPEN_LABEL } from '@labre/affine-components/translations';
import type { ChromeWording } from '@labre/affine-shared/services';
import type { UniComponent } from '@labre/affine-shared/types';
import type { InsertToPosition } from '@labre/affine-shared/utils';
import { CenterPeekIcon } from '@blocksuite/icons/lit';
import type { BlockStdScope } from '@labre/std';
import { stdContext } from '@labre/std';
import { consume } from '@lit/context';
import { cssVarV2 } from '@toeverything/theme/v2';
import { css, html, nothing, unsafeCSS } from 'lit';

import { renderUniLit } from '../../core/utils/uni-component/uni-component.js';
import {
  DataViewUIBase,
  DataViewUILogicBase,
} from '../../core/view/data-view-base.js';
import type { Property } from '../../core/view-manager/property.js';
import type { FlatSingleView } from './flat-view-manager.js';

/**
 * The UI logic both ungrouped presets share. Neither has a selection model of
 * its own: a cell edits through the cell host (`dv-standalone-cell`), with the
 * very renderer and popups a table cell mounts, and a click anywhere else on
 * a card or a row opens the row through the root's detail panel, the path
 * the table's and the kanban's open buttons take. Drag and drop of rows is
 * not offered (no manual order without a group, B8).
 */
export abstract class FlatViewUILogic<
  View extends FlatSingleView = FlatSingleView,
> extends DataViewUILogicBase<View> {
  clearSelection = () => {};

  focusFirstCell = () => {};

  showIndicator = (_evt: MouseEvent) => false;

  hideIndicator = () => {};

  moveTo = (_id: string, _evt: MouseEvent) => {};

  addRow = (position: InsertToPosition) => {
    if (this.view.readonly$.value) return;
    const rowId = this.view.rowAdd(position);
    if (rowId) this.openRow(rowId);
    return rowId;
  };

  abstract override renderer: UniComponent<unknown>;

  openRow = (rowId: string) => {
    this.root.openDetailPanel({ view: this.view, rowId });
  };
}

export abstract class FlatViewUI<
  Logic extends FlatViewUILogic = FlatViewUILogic,
> extends DataViewUIBase<Logic> {
  /** Absent outside an editor (a unit test): the wordings read English. */
  @consume({ context: stdContext })
  accessor std!: BlockStdScope;

  protected wording([key, fallback]: ChromeWording) {
    return this.std ? translateKey(this.std, key, fallback) : fallback;
  }

  protected get view() {
    return this.logic.view;
  }

  /**
   * One property's value, drawn and edited by the cell renderer a table cell
   * mounts. `readonly` draws the value only and lets a click through to the
   * card or row, which is how the title opens its row.
   */
  protected renderCell(property: Property, rowId: string, readonly = false) {
    const view = this.view;
    return html`<dv-standalone-cell
      data-property-id="${property.id}"
      .cell="${property.cellGetOrCreate(rowId)}"
      .readonly="${readonly ||
      view.readonly$.value ||
      property.readonly$.value}"
      .onEditingChange="${(editing: boolean) => view.lockRows(editing)}"
    ></dv-standalone-cell>`;
  }

  protected renderOpenButton(rowId: string) {
    const label = this.wording(OPEN_LABEL);
    return html`<button
      class="dv-flat-open"
      data-testid="dv-flat-open"
      aria-label="${label}"
      title="${label}"
      @click="${(event: MouseEvent) => {
        event.stopPropagation();
        this.logic.openRow(rowId);
      }}"
    >
      ${CenterPeekIcon()}
    </button>`;
  }

  protected renderHeaderWidget() {
    const headerWidget = this.logic.headerWidget;
    if (!headerWidget) return nothing;
    return renderUniLit(headerWidget, { dataViewLogic: this.logic });
  }

  protected readonly onRowClick = (event: MouseEvent) => {
    const rowId = (event.currentTarget as HTMLElement).dataset.rowId;
    if (rowId) this.logic.openRow(rowId);
  };
}

/** The open button both presets draw, shown on hover or keyboard focus. */
export const flatOpenButtonStyles = css`
  .dv-flat-open {
    position: absolute;
    top: 6px;
    right: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 1px solid ${unsafeCSS(cssVarV2.layer.insideBorder.border)};
    border-radius: 4px;
    background-color: var(--affine-background-primary-color);
    color: var(--affine-icon-color);
    cursor: pointer;
    visibility: hidden;
  }

  .dv-flat-open svg {
    width: 16px;
    height: 16px;
  }

  .dv-flat-open:focus-visible {
    visibility: visible;
    outline: 2px solid var(--affine-primary-color);
    outline-offset: 1px;
  }

  @media (hover: hover) {
    .dv-flat-open:hover {
      background-color: var(--affine-hover-color);
    }
  }
`;
