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
  type NoViewAction,
  NoViewActionKey,
} from '../../core/view-manager/no-view-action.js';
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
 *   `{ database: false }`).
 *   The bundle adds creation, core never does more than "+" did (§1).
 * - A host's action (`NoViewActionKey`, issue #707, amendment of
 *   2026-11-24) replaces "New view" and its hint under the same status,
 *   creation off included, never on a read-only document.
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

  /**
   * The host's action, which wins over "New view" (issue #707): a host whose
   * base needs another first gesture (a source to create) offers it here,
   * so the status stays the one live region. Read from the signal while
   * drawing, so a host that learns late what to offer redraws the state.
   * Never on a read-only document.
   */
  private hostAction(): NoViewAction | null {
    const { dataSource } = this.root.config;
    if (dataSource.readonly$.value) return null;
    try {
      return dataSource.serviceGet(NoViewActionKey)?.value ?? null;
    } catch (error) {
      // A host signal that throws keeps the library's own state.
      console.error(error);
      return null;
    }
  }

  /**
   * The button's one handler, read at the click: the host may swap its
   * action while the button is drawn, and `data-view-component-button`
   * binds `onClick` once, when it connects.
   */
  private readonly runAction = (event: MouseEvent) => {
    const action = this.hostAction();
    if (action) {
      action.run(event.currentTarget as HTMLElement);
      return;
    }
    if (canAddView(this.root.config.dataSource)) this.addView(event);
  };

  /**
   * "New view" opens a menu and leaves `aria-expanded` on its button
   * (`popupTargetReturningFocus`); the same element then carrying a host
   * action that opens none would still be announced as collapsed.
   */
  override updated() {
    const button = this.querySelector(
      'data-view-component-button[data-view-focus-fallback]'
    );
    if (button && !button.hasAttribute('aria-haspopup')) {
      button.removeAttribute('aria-expanded');
    }
  }

  override render() {
    const action = this.hostAction();
    const offer = action !== null || canAddView(this.root.config.dataSource);
    const hint = action ? action.hint : this.wording(DATA_VIEW_NO_VIEW_HINT);
    const opensMenu = action ? action.menu === true : true;
    // The live region is the status alone: a button inside one is announced
    // with it. It holds no `tabindex`, so a click in the frame never takes
    // the focus; `restoreFocus` lends it one when it is the target.
    // One button whatever it offers: Lit keeps the element when the host's
    // action comes, changes or goes, so a focused button keeps the focus.
    return html`<div class="dv-no-view" data-testid="database-no-view">
      <div
        class="dv-no-view-status"
        data-testid="database-no-view-status"
        role="status"
        ?data-view-focus-fallback="${!offer}"
      >
        ${this.wording(DATA_VIEW_NO_VIEW)}
      </div>
      ${offer && hint
        ? html`<div class="dv-no-view-hint">${hint}</div>`
        : nothing}
      ${offer
        ? html`<data-view-component-button
            data-testid="${action
              ? 'database-no-view-host-action'
              : 'database-no-view-add'}"
            data-view-focus-fallback
            role="button"
            tabindex="0"
            aria-haspopup="${opensMenu ? 'menu' : nothing}"
            hoverType="border"
            @keydown="${activateOnEnterOrSpace}"
            .onClick="${this.runAction}"
            .icon="${action ? undefined : PlusIcon()}"
            .text="${action ? action.label : this.wording(VIEWS_BAR_ADD_VIEW)}"
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
