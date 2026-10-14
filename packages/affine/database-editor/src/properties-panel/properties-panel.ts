import { DatabaseBlockComponent } from '@labre/affine-block-database';
import {
  PropertiesPanelProvider,
  type PropertiesPanelRequest,
  translateKey,
} from '@labre/affine-shared/services';
import { panelHeaderStyles } from '@labre/affine-shared/styles';
import { dataViewCssVariable, type SingleView } from '@labre/data-view';
import { SignalWatcher, WithDisposable } from '@labre/global/lit';
import { CloseIcon } from '@blocksuite/icons/lit';
import { type BlockStdScope, ShadowlessElement } from '@labre/std';
import { signal } from '@preact/signals-core';
import { css, html, nothing, unsafeCSS } from 'lit';
import { property } from 'lit/decorators.js';

import {
  PROPERTIES_PANEL_CLOSE,
  PROPERTIES_PANEL_HIDE_ALL,
  PROPERTIES_PANEL_SHOW_ALL,
  PROPERTIES_PANEL_TITLE,
  PROPERTIES_PANEL_UNAVAILABLE,
} from '../translations.js';

export type DatabasePropertiesPanelSourceRequest = Extract<
  PropertiesPanelRequest,
  { scope: 'source' }
>;

/**
 * The view of `request` as the editor shows it, or `null` when the block is
 * not mounted in this editor (another page, not yet rendered) or has no such
 * view. Without a `viewId`, the block's current view.
 */
export function propertiesPanelView(
  std: BlockStdScope,
  request: DatabasePropertiesPanelSourceRequest
): SingleView | null {
  const block = std.view.getBlock(request.blockId);
  if (!(block instanceof DatabaseBlockComponent)) return null;
  const manager = block.dataSource.viewManager;
  const viewId = request.viewId ?? manager.currentViewId$.value;
  if (!viewId) return null;
  return manager.viewGet(viewId) ?? null;
}

/**
 * The properties panel of a database view (ADR 0035 §9b, §10, issue B10):
 * the library draws it, the host decides where (the Labre app mounts it in
 * its left sidebar when `PropertiesPanelService.open` gets a `source`
 * request). It draws nothing of its own beyond the shared side-panel header:
 * the list is the data-view's own `data-view-properties-setting`, the very
 * list the view options' "Properties" pops, so hiding, showing and
 * reordering write through the same `Property` methods, once. A row's click
 * opens the property's menu (the table header's: rename, type, duplicate,
 * delete) and "New property" adds one, both from that list.
 *
 * A host mounts it with `std` (the editor that shows the database) and
 * `request`; it follows the block as it mounts and unmounts. Read-only, the
 * list is drawn and inert.
 *
 * ponytail: the host-panels verbs of §10 (for a host that draws its own
 * panel) are not written: the Labre app mounts this element. Add them to
 * `@labre/affine/host-panels` when a host draws its own.
 */
export class DatabasePropertiesPanel extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  static override styles = [
    panelHeaderStyles,
    css`
      affine-database-properties-panel {
        ${unsafeCSS(dataViewCssVariable())}
        display: flex;
        flex-direction: column;
        min-width: 0;
        font-family: var(--affine-font-family);
        color: var(--affine-text-primary-color);
      }

      .affine-database-properties-panel-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        padding: 0;
        border: none;
        border-radius: 4px;
        background: transparent;
        cursor: pointer;
      }

      .affine-database-properties-panel-button:hover {
        background: var(--affine-hover-color);
      }

      .affine-database-properties-panel-button:focus-visible,
      .affine-database-properties-panel-toggle:focus-visible {
        outline: 2px solid var(--affine-primary-color);
        outline-offset: 1px;
      }

      .affine-database-properties-panel-bar {
        display: flex;
        justify-content: flex-end;
        padding: 0 8px 4px;
      }

      .affine-database-properties-panel-toggle {
        padding: 4px 8px;
        border: none;
        border-radius: 4px;
        background: transparent;
        font-size: 12px;
        line-height: 20px;
        font-weight: 500;
        color: var(--affine-primary-color);
        cursor: pointer;
      }

      .affine-database-properties-panel-toggle:hover {
        background: var(--affine-hover-color);
      }

      .affine-database-properties-panel-list {
        padding: 0 4px;
      }

      .affine-database-properties-panel-empty {
        padding: 8px 12px;
        font-size: 14px;
        line-height: 22px;
        color: var(--affine-text-secondary-color);
      }
    `,
  ];

  /** Bumped when a block mounts or unmounts, so the view is looked up again. */
  private readonly _mounts$ = signal(0);

  override connectedCallback() {
    super.connectedCallback();
    this.dataset.testid = 'database-properties-panel';
    const subscription = this.std.view.viewUpdated.subscribe(payload => {
      if (payload.type === 'block' && payload.id === this.request.blockId) {
        this._mounts$.value++;
      }
    });
    this._disposables.add(() => subscription.unsubscribe());
  }

  private _t(wording: readonly [string, string]) {
    return translateKey(this.std, wording[0], wording[1]);
  }

  private readonly _wording = (wording: readonly [string, string]) =>
    this._t(wording);

  private readonly _close = () => {
    this.std.getOptional(PropertiesPanelProvider)?.close();
  };

  private _renderHeader() {
    const panel = this.std.getOptional(PropertiesPanelProvider);
    const close = this._t(PROPERTIES_PANEL_CLOSE);
    return html`<div class="affine-panel-header">
      <div class="affine-panel-header-title">
        ${this._t(PROPERTIES_PANEL_TITLE)}
      </div>
      ${panel
        ? html`<button
            type="button"
            class="affine-panel-header-button affine-database-properties-panel-button"
            data-testid="database-properties-panel-close"
            aria-label=${close}
            title=${close}
            @click=${this._close}
          >
            ${CloseIcon({ width: '20px', height: '20px' })}
          </button>`
        : nothing}
    </div>`;
  }

  private _renderBody(view: SingleView) {
    const readonly = view.readonly$.value;
    const properties = view.propertiesRaw$.value;
    const allShown = properties.every(p => !p.hide$.value);
    const toggleAll = () => {
      for (const p of properties) {
        if (p.hideCanSet) p.hideSet(allShown);
      }
    };
    return html`${readonly
        ? nothing
        : html`<div class="affine-database-properties-panel-bar">
            <button
              type="button"
              class="affine-database-properties-panel-toggle"
              data-testid="database-properties-panel-toggle-all"
              @click=${toggleAll}
            >
              ${this._t(
                allShown ? PROPERTIES_PANEL_HIDE_ALL : PROPERTIES_PANEL_SHOW_ALL
              )}
            </button>
          </div>`}
      <div class="affine-database-properties-panel-list" ?inert=${readonly}>
        <data-view-properties-setting
          .view=${view}
          .wording=${this._wording}
        ></data-view-properties-setting>
      </div>`;
  }

  override render() {
    void this._mounts$.value;
    const view = propertiesPanelView(this.std, this.request);
    return html`${this._renderHeader()}
    ${view
      ? this._renderBody(view)
      : html`<div
          class="affine-database-properties-panel-empty"
          data-testid="database-properties-panel-unavailable"
        >
          ${this._t(PROPERTIES_PANEL_UNAVAILABLE)}
        </div>`}`;
  }

  @property({ attribute: false })
  accessor std!: BlockStdScope;

  @property({ attribute: false })
  accessor request!: DatabasePropertiesPanelSourceRequest;
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-database-properties-panel': DatabasePropertiesPanel;
  }
}
