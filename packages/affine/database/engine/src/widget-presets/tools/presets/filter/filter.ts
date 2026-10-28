import { popupTargetFromElement } from '@labre/affine-components/context-menu';
import { FilterIcon } from '@blocksuite/icons/lit';
import { computed } from '@preact/signals-core';
import { cssVarV2 } from '@toeverything/theme/v2';
import { type BlockStdScope, stdContext } from '@labre/std';
import { consume } from '@lit/context';
import { css, html, nothing } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';

import { popCreateFilter } from '../../../../core/filter/add-filter.js';
import { filterTraitKey } from '../../../../core/filter/trait.js';
import type { FilterGroup } from '../../../../core/filter/types.js';
import { emptyFilterGroup } from '../../../../core/filter/utils.js';
import { wordingOf } from '../../../../core/utils/wording.js';
import { WidgetBase } from '../../../../core/widget/widget-base.js';
import { DATA_VIEW_FILTER } from '../../../../translations.js';
import {
  createDefaultShowQuickSettingBar,
  ShowQuickSettingBarKey,
} from '../../../quick-setting-bar/context.js';

const styles = css`
  .affine-database-filter-button {
    display: flex;
    align-items: center;
    gap: 6px;
    line-height: 20px;
    padding: 2px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 20px;
  }

  .affine-database-filter-button:hover,
  .affine-database-filter-button.active {
    background-color: var(--affine-hover-color);
  }

  /* Shown on a phone too, its menus as sheets: 44px for a finger (P7). */
  @media (pointer: coarse) {
    .affine-database-filter-button {
      min-width: 44px;
      min-height: 44px;
      justify-content: center;
    }
  }
`;

export class DataViewHeaderToolsFilter extends WidgetBase {
  static override styles = styles;

  hasFilter = computed(() => {
    return this.filterTrait?.hasFilter$.value ?? false;
  });

  private get _filter(): FilterGroup {
    return this.filterTrait?.filter$.value ?? emptyFilterGroup;
  }

  private set _filter(filter: FilterGroup) {
    this.filterTrait?.filterSet(filter);
  }

  get filterTrait() {
    return this.view.traitGet(filterTraitKey);
  }

  private get readonly() {
    return this.view.readonly$.value;
  }

  private clickFilter(event: MouseEvent) {
    if (this.hasFilter.value) {
      this.toggleShowFilter();
      return;
    }
    popCreateFilter(
      popupTargetFromElement(event.currentTarget as HTMLElement),
      {
        vars: this.view.vars$,
        onSelect: filter => {
          this._filter = {
            ...this._filter,
            conditions: [filter],
          };
          this.toggleShowFilter(true);
          this.dataViewLogic.eventTrace('CreateDatabaseFilter', {});
        },
      }
    );
    return;
  }

  /** Absent outside an editor host: the wordings read English. */
  @consume({ context: stdContext })
  accessor std!: BlockStdScope;

  override connectedCallback() {
    super.connectedCallback();
    this.style.display = 'flex';
  }

  override render() {
    if (this.readonly) return nothing;
    const style = styleMap({
      color: this.hasFilter.value
        ? cssVarV2('text/emphasis')
        : cssVarV2('icon/primary'),
    });
    return html` <div
      @click="${this.clickFilter}"
      style="${style}"
      class="affine-database-filter-button"
      data-testid="dv-tools-filter"
      role="button"
      aria-label="${wordingOf(this.std)(DATA_VIEW_FILTER)}"
    >
      ${FilterIcon()}
    </div>`;
  }

  toggleShowFilter(show?: boolean) {
    const map = this.view.serviceGetOrCreate(
      ShowQuickSettingBarKey,
      createDefaultShowQuickSettingBar
    );
    map.value = {
      ...map.value,
      [this.view.id]: show ?? !map.value[this.view.id],
    };
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'data-view-header-tools-filter': DataViewHeaderToolsFilter;
  }
}
