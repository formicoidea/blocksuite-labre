import {
  popFilterableSimpleMenu,
  popupTargetFromElement,
} from '@labre/affine-components/context-menu';
import { translateKey } from '@labre/affine-shared/services';
import { OPEN_LABEL } from '@labre/affine-components/translations';
import type { ChromeWording } from '@labre/affine-shared/services';
import type { UniComponent } from '@labre/affine-shared/types';
import type { InsertToPosition } from '@labre/affine-shared/utils';
import { IS_MOBILE } from '@labre/global/env';
import { CenterPeekIcon } from '@blocksuite/icons/lit';
import type { BlockStdScope } from '@labre/std';
import { stdContext } from '@labre/std';
import { consume } from '@lit/context';
import { cssVarV2 } from '@toeverything/theme/v2';
import { css, html, nothing, unsafeCSS } from 'lit';
import { repeat } from 'lit/directives/repeat.js';

import { renderCellStatus } from '../../core/component/cell-status/cell-status.js';
import { GroupTitle } from '../../core/group-by/group-title.js';
import {
  hideGroupAction,
  renderGroupToggle,
} from '../../core/group-by/group-visibility.js';
import type { Group } from '../../core/group-by/trait.js';
import { isNewTabClick } from '../../core/utils/new-tab-click.js';
import { renderUniLit } from '../../core/utils/uni-component/uni-component.js';
import {
  DataViewUIBase,
  DataViewUILogicBase,
} from '../../core/view/data-view-base.js';
import type { Property } from '../../core/view-manager/property.js';
import type { Row } from '../../core/view-manager/row.js';
import type { FlatSingleView } from './flat-view-manager.js';

/**
 * The UI logic both ungrouped presets share. Neither has a selection model of
 * its own: a cell edits through the cell host (`dv-standalone-cell`), with the
 * very renderer and popups a table cell mounts, and a click anywhere else on
 * a card or a row opens the row through the root's detail panel, the path
 * the table's and the kanban's open buttons take. Grouped (B8), each group
 * draws under the table's group header; drag and drop of rows between groups
 * is not offered: a row changes group by editing its value.
 */
export abstract class FlatViewUILogic<
  View extends FlatSingleView = FlatSingleView,
> extends DataViewUILogicBase<View> {
  clearSelection = () => {};

  focusFirstCell = () => {};

  showIndicator = (_evt: MouseEvent) => false;

  hideIndicator = () => {};

  moveTo = (_id: string, _evt: MouseEvent) => {};

  addRow = (position: InsertToPosition, groupKey?: string) => {
    if (this.view.readonly$.value) return;
    const rowId = this.view.rowAdd(position, groupKey);
    if (rowId) this.openRow(rowId);
    return rowId;
  };

  abstract override renderer: UniComponent<unknown>;

  /** A Ctrl/Cmd click asks the host for a new tab (ADR 0035 §9a). */
  openRow = (rowId: string, newTab = false) => {
    this.root.openDetailPanel({ view: this.view, rowId, newTab });
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
   * card or row, which is how the title opens its row. On a phone every value
   * is drawn so: a tap on a card or a row opens it, its values are edited in
   * the row page (P7, after Notion's phone gallery and list).
   */
  protected renderCell(property: Property, rowId: string, readonly = false) {
    const view = this.view;
    const cell = property.cellGetOrCreate(rowId);
    // As a table cell: a value not yet hydrated mounts no renderer, so nothing
    // can be edited over it (ADR 0035 §9e).
    const status = renderCellStatus(cell);
    if (status) {
      return html`<span data-property-id="${property.id}">${status}</span>`;
    }
    return html`<dv-standalone-cell
      data-property-id="${property.id}"
      .cell="${cell}"
      .readonly="${readonly ||
      IS_MOBILE ||
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
        this.logic.openRow(rowId, isNewTabClick(event));
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

  /**
   * The view's rows through `renderBody`: once, or once per visible group
   * under its header, then the hidden groups (B8, PRD REQ-DB-13 and 16). A
   * folded group keeps its header only.
   */
  protected renderGrouped(renderBody: (rows: Row[], group?: Group) => unknown) {
    const trait = this.view.groupTrait;
    const groups = trait.visibleGroups$.value;
    if (!groups) return renderBody(this.view.rows$.value);
    return html`${repeat(
        groups,
        group => group.key,
        group => this.renderGroup(group, renderBody)
      )} <dv-hidden-groups .groupTrait="${trait}"></dv-hidden-groups>`;
  }

  private renderGroup(
    group: Group,
    renderBody: (rows: Row[], group?: Group) => unknown
  ) {
    const collapsed = group.manager.collapsed$(group.key).value;
    const wording = (pair: ChromeWording) => this.wording(pair);
    return html`<section
      class="dv-flat-group"
      data-testid="dv-flat-group"
      data-group-key="${group.key}"
    >
      <div class="dv-flat-group-header">
        ${renderGroupToggle(group, wording)}
        <div class="dv-flat-group-title">
          ${GroupTitle(group, {
            readonly: this.view.readonly$.value,
            clickAdd: () => this.logic.addRow('start', group.key),
            clickOps: (event: MouseEvent) => {
              popFilterableSimpleMenu(
                popupTargetFromElement(event.currentTarget as HTMLElement),
                [hideGroupAction(group, wording)]
              );
            },
          })}
        </div>
      </div>
      ${collapsed ? nothing : renderBody(group.rows, group)}
    </section>`;
  }

  protected readonly onRowClick = (event: MouseEvent) => {
    const rowId = (event.currentTarget as HTMLElement).dataset.rowId;
    if (rowId) this.logic.openRow(rowId, isNewTabClick(event));
  };
}

/** The group header both presets draw, the table's title and count. */
export const flatGroupStyles = css`
  .dv-flat-group {
    display: flex;
    flex-direction: column;
    padding-top: 8px;
  }

  .dv-flat-group-header {
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 32px;
  }

  .dv-flat-group-title {
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    gap: 8px;
    min-width: 0;
    overflow: hidden;
  }

  .dv-flat-group-header:hover .group-header-op,
  .dv-flat-group-header:focus-within .group-header-op {
    visibility: visible;
    opacity: 1;
  }

  @media (pointer: coarse) {
    .dv-flat-group-header {
      min-height: 44px;
    }
  }
`;

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
