import { unsafeCSSVarV2 } from '@labre/affine-shared/theme';
import { IS_MOBILE } from '@labre/global/env';
import { ArrowDownSmallIcon, PlusIcon } from '@blocksuite/icons/lit';
import { css, html } from 'lit';

import { NewRowMenuOpenerKey } from '../../../../core/view-manager/new-row-menu-opener.js';
import { WidgetBase } from '../../../../core/widget/widget-base.js';

const styles = css`
  .new-record {
    font-weight: 500;
  }

  .new-record svg {
    font-size: 20px;
    color: ${unsafeCSSVarV2('icon/primary')};
  }

  /* A split button only when the host offers a menu beside "New"
     (NewRowMenuOpenerKey): without it, the single button above. */
  .new-record-split {
    display: flex;
    align-items: stretch;
  }

  .new-record-split .new-record {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  .new-record-split .new-record-more {
    border-left: none;
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
    padding: 4px;
  }

  @media (pointer: coarse) {
    .new-record-split .new-record,
    .new-record-split .new-record-more {
      min-height: 44px;
    }

    .new-record-split .new-record-more {
      min-width: 44px;
      justify-content: center;
    }
  }
`;

export class DataViewHeaderToolsAddRow extends WidgetBase {
  static override styles = styles;

  private readonly onAddNewRecord = () => {
    if (this.readonly$.value) return;
    this.dataViewLogic.addRow?.('start');
  };

  private readonly onOpenMenu = (event: MouseEvent) => {
    event.stopPropagation();
    if (this.readonly$.value) return;
    this.view
      .serviceGet(NewRowMenuOpenerKey)
      ?.open(event.currentTarget as HTMLElement, this.view.id);
  };

  private get readonly$() {
    return this.view.readonly$;
  }

  override render() {
    if (this.readonly$.value) {
      return;
    }
    const button = html` <data-view-component-button
      class="affine-database-toolbar-item new-record"
      .onClick="${this.onAddNewRecord}"
      .icon="${PlusIcon()}"
      .text="${IS_MOBILE
        ? html`<span style="font-weight: 500">New</span>`
        : html`<span style="font-weight: 500">New Record</span>`}"
    >
    </data-view-component-button>`;
    const opener = this.view.serviceGet(NewRowMenuOpenerKey);
    if (!opener) return button;
    const label = opener.label();
    return html`<div class="new-record-split">
      ${button}
      <data-view-component-button
        class="affine-database-toolbar-item new-record-more"
        data-testid="database-new-record-more"
        role="button"
        aria-haspopup="menu"
        aria-label="${label}"
        title="${label}"
        .onClick="${this.onOpenMenu}"
        .icon="${ArrowDownSmallIcon()}"
      >
      </data-view-component-button>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'data-view-header-tools-add-row': DataViewHeaderToolsAddRow;
  }
}
