import {
  type ChromeWording,
  translateKey,
} from '@labre/affine-shared/services';
import { IS_MOBILE } from '@labre/global/env';
import { SignalWatcher, WithDisposable } from '@labre/global/lit';
import { PlusIcon } from '@blocksuite/icons/lit';
import { type BlockStdScope, ShadowlessElement, stdContext } from '@labre/std';
import { consume } from '@lit/context';
import { css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';

import type { DataViewRootUILogic } from '../../core/data-view.js';
import {
  canAddView,
  popAddViewMenu,
} from '../../core/view-manager/add-view.js';
import {
  DATA_VIEW_NO_VIEW,
  DATA_VIEW_NO_VIEW_HINT,
  VIEWS_BAR_ADD_VIEW,
} from '../../translations.js';
import {
  activateOnEnterOrSpace,
  keyboardOpener,
  popupTargetReturningFocus,
} from '../tools/keyboard.js';
import { VIEWS_BAR_TOUCH_TARGET } from '../views-bar/views-view.js';

/**
 * What a database draws when it holds no view at all (ADR 0035 amendment of
 * 2026-11-20, product owner's acceptance report: deleting the only view left
 * no tab bar, no "+", no table, nothing to get a view back with but Ctrl+Z).
 * The root renderer draws it in place of the view (`DataViewRootUI`), under
 * what of its header the block still draws (`noViewHeader`), so the inline
 * database, the full page and the canvas share it. The `affine:data-view`
 * block never reaches it: it draws its own placeholder instead of the root
 * renderer (#745, ADR 0035 amendment of 2026-11-24).
 *
 * - A status ("No view", the only live region), never an invisible block:
 *   `views: []` is also the schema default of both blocks, so it arrives
 *   from a store, an undo, a peer or a paste. Derived at each render,
 *   nothing is written.
 * - Where a view may be added (`canAddView`: writable, view creation on),
 *   the hint and one button that is the views bar's "+" itself
 *   (`popAddViewMenu`): the `core-database` bundle's sources when it is
 *   there, the creatable presets otherwise. Where "+" is absent the button
 *   is too: a read-only document, or a source whose host switched creation
 *   off (`ViewCreationOffKey`, which the database block sets under
 *   `{ database: false }`). The bundle adds creation, core never does more
 *   than "+" did (§1).
 * - The button is a named control in the tab order, activated by Enter and
 *   Space, ringed like the toolbar's (#678). It, else the status, is where
 *   the keyboard focus lands when a removal leaves no view and nothing holds
 *   the focus (`data-view-focus-fallback`, `DataViewRootUI.restoreFocus`).
 *
 * Styles mirror the block's "Connect a source" notice
 * (`databaseSourceMissingStyles`) and the toolbar's focus ring.
 */
export class DataViewNoView extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  static override styles = css`
    data-view-no-view {
      display: block;
    }
    .dv-no-view {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
      margin: 8px 0;
      padding: 12px;
      border-radius: 8px;
      font-size: 14px;
      line-height: 22px;
      color: var(--affine-text-primary-color);
      background-color: var(--affine-hover-color);
    }
    .dv-no-view-status:focus-visible {
      outline: 2px solid
        var(--affine-focus-ring-color, var(--affine-primary-color));
      outline-offset: 2px;
      border-radius: 4px;
    }
    .dv-no-view-hint {
      color: var(--affine-text-secondary-color);
    }
    .dv-no-view data-view-component-button:focus-visible {
      outline: 2px solid
        var(--affine-focus-ring-color, var(--affine-primary-color));
      outline-offset: -2px;
    }
    data-view-no-view.mobile data-view-component-button {
      min-height: ${VIEWS_BAR_TOUCH_TARGET}px;
    }
  `;

  // Absent outside an editor host (a standalone mount): wordings fall back.
  @consume({ context: stdContext })
  accessor std!: BlockStdScope;

  @property({ attribute: false })
  accessor root!: DataViewRootUILogic;

  private wording(wording: ChromeWording) {
    return this.std ? translateKey(this.std, ...wording) : wording[1];
  }

  private readonly addView = (event: MouseEvent) => {
    const button = event.currentTarget as HTMLElement;
    const { dataSource, eventTrace } = this.root.config;
    popAddViewMenu(popupTargetReturningFocus(button, keyboardOpener(event)), {
      std: this.std,
      dataSource,
      eventTrace,
      onAdded: id => this.root.config.onChangeView?.(id),
    });
  };

  override connectedCallback() {
    super.connectedCallback();
    this.classList.toggle('mobile', IS_MOBILE);
  }

  override render() {
    const canAdd = canAddView(this.root.config.dataSource);
    const label = this.wording(VIEWS_BAR_ADD_VIEW);
    // The live region is the status alone: a button inside one is announced
    // with it. It holds no `tabindex`, so a click in the frame never takes
    // the focus; `restoreFocus` lends it one when it is the target.
    return html`<div class="dv-no-view" data-testid="database-no-view">
      <div
        class="dv-no-view-status"
        data-testid="database-no-view-status"
        role="status"
        ?data-view-focus-fallback="${!canAdd}"
      >
        ${this.wording(DATA_VIEW_NO_VIEW)}
      </div>
      ${canAdd
        ? html`<div class="dv-no-view-hint">
              ${this.wording(DATA_VIEW_NO_VIEW_HINT)}
            </div>
            <data-view-component-button
              data-testid="database-no-view-add"
              data-view-focus-fallback
              role="button"
              tabindex="0"
              aria-haspopup="menu"
              hoverType="border"
              @keydown="${activateOnEnterOrSpace}"
              .onClick="${this.addView}"
              .icon="${PlusIcon()}"
              .text="${label}"
            ></data-view-component-button>`
        : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'data-view-no-view': DataViewNoView;
  }
}
