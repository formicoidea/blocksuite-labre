import { unsafeCSSVarV2 } from '@labre/affine-shared/theme';
import { CloseIcon, SearchIcon } from '@blocksuite/icons/lit';
import { type BlockStdScope, stdContext } from '@labre/std';
import { consume } from '@lit/context';
import { baseTheme } from '@toeverything/theme';
import { css, html, unsafeCSS } from 'lit';
import { query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';

import { stopPropagation } from '../../../../core/utils/event.js';
import { wordingOf } from '../../../../core/utils/wording.js';
import { WidgetBase } from '../../../../core/widget/widget-base.js';
import type { KanbanViewUILogic } from '../../../../view-presets/kanban/pc/kanban-view-ui-logic.js';
import type { VirtualTableViewUILogic } from '../../../../view-presets/table/pc-virtual/table-view-ui-logic.js';
import {
  DATA_VIEW_SEARCH_CLEAR_HINT,
  DATA_VIEW_SEARCH_PLACEHOLDER,
} from '../../../../translations.js';

const styles = css`
  .affine-database-search-container {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    width: 24px;
    height: 24px;
    border-radius: 4px;
    transition: width 0.3s ease;
    overflow: hidden;
  }

  .search-container-expand {
    overflow: visible;
    width: 138px;
    background-color: var(--affine-hover-color);
  }

  .search-input-container {
    display: flex;
    align-items: center;
  }

  .close-icon {
    display: flex;
    align-items: center;
    padding-right: 8px;
    height: 100%;
    cursor: pointer;
  }

  .affine-database-search-input-icon {
    position: absolute;
    left: 0;
    font-size: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    cursor: pointer;
    padding: 2px;
    border-radius: 4px;
    color: ${unsafeCSSVarV2('icon/primary')};
  }

  .affine-database-search-input-icon:hover {
    background: var(--affine-hover-color);
  }

  .search-container-expand .affine-database-search-input-icon {
    left: 4px;
    pointer-events: none;
  }

  .affine-database-search-input {
    flex: 1;
    width: 100%;
    padding: 0 2px 0 30px;
    border: none;
    font-family: ${unsafeCSS(baseTheme.fontSansFamily)};
    font-size: var(--affine-font-sm);
    box-sizing: border-box;
    color: inherit;
    background: transparent;
    outline: none;
  }

  .affine-database-search-input::placeholder {
    color: var(--affine-placeholder-color);
    font-size: var(--affine-font-sm);
  }

  /* A finger needs 44px: the host's touch-target floor (P7). */
  @media (pointer: coarse) {
    .affine-database-search-container {
      width: 44px;
      height: 44px;
    }
    .search-container-expand {
      width: 160px;
    }
    .affine-database-search-container .affine-database-search-input-icon {
      left: 10px;
    }
    .affine-database-search-input {
      padding-left: 40px;
    }
  }
`;

export class DataViewHeaderToolsSearch extends WidgetBase<
  VirtualTableViewUILogic | KanbanViewUILogic
> {
  static override styles = styles;

  private readonly _clearSearch = () => {
    this._searchInput.value = '';
    this.dataViewLogic.view.setSearch('');
    this.preventBlur = true;
    setTimeout(() => {
      this.preventBlur = false;
    });
  };

  private readonly _clickSearch = (e: MouseEvent) => {
    e.stopPropagation();
    this.showSearch = true;
  };

  private readonly _onSearch = (event: InputEvent) => {
    const el = event.target as HTMLInputElement;
    const inputValue = el.value.trim();
    this.dataViewLogic.view.setSearch(inputValue);
  };

  private readonly _onSearchBlur = () => {
    if (this._searchInput.value || this.preventBlur) {
      return;
    }
    this.showSearch = false;
  };

  private readonly _onSearchKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      if (this._searchInput.value) {
        this._searchInput.value = '';
        this.dataViewLogic.view.setSearch('');
      } else {
        this.showSearch = false;
      }
    }
  };

  preventBlur = false;

  /** Absent outside an editor host: the wordings read English. */
  @consume({ context: stdContext })
  accessor std!: BlockStdScope;

  override connectedCallback() {
    super.connectedCallback();
    // Filter and sort reach a phone through the view menu; search has no
    // other door, so it stays in the toolbar there too.
    this.style.display = 'flex';
  }

  override render() {
    const searchToolClassMap = classMap({
      'affine-database-search-container': true,
      'search-container-expand': this.showSearch,
      active: this.showSearch,
    });
    return html`
      <label class="${searchToolClassMap}" @click="${this._clickSearch}">
        <div class="affine-database-search-input-icon">${SearchIcon()}</div>
        <input
          placeholder="${wordingOf(this.std)(DATA_VIEW_SEARCH_PLACEHOLDER)}"
          class="affine-database-search-input"
          @input="${this._onSearch}"
          @click="${(event: MouseEvent) => event.stopPropagation()}"
          @keydown="${this._onSearchKeydown}"
          @pointerdown="${stopPropagation}"
          @blur="${this._onSearchBlur}"
        />
        <div class="close-icon" @mousedown="${this._clearSearch}">
          ${CloseIcon()}
          <affine-tooltip>
            <span
              style=${styleMap({
                display: 'flex',
                alignItems: 'center',
                boxSizing: 'border-box',
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'var(--affine-white-10)',
              })}
              >Esc</span
            >
            ${wordingOf(this.std)(DATA_VIEW_SEARCH_CLEAR_HINT)}
          </affine-tooltip>
        </div>
      </label>
    `;
  }

  @query('.affine-database-search-input')
  private accessor _searchInput!: HTMLInputElement;

  @state()
  private accessor showSearch = false;
}

declare global {
  interface HTMLElementTagNameMap {
    'data-view-header-tools-search': DataViewHeaderToolsSearch;
  }
}
