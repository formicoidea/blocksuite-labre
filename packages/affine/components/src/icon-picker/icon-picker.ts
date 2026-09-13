import { translateKey } from '@labre/affine-shared/services';
import { unsafeCSSVarV2 } from '@labre/affine-shared/theme';
import type { BlockStdScope } from '@labre/std';
import { stdContext } from '@labre/std';
import { consume } from '@lit/context';
import { css, html, LitElement } from 'lit';
import { property } from 'lit/decorators.js';

import { DEFAULT_ICON_COLOR } from './icon-data.js';
import type { IconPickerTab } from './types.js';
import {
  ICON_PICKER_ICONS_GROUP,
  ICON_PICKER_REMOVE,
  ICON_PICKER_TAB_EMOJI,
} from '../translations.js';

const TABS: ReadonlyArray<{
  value: IconPickerTab;
  wording: readonly [string, string];
}> = [
  { value: 'emoji', wording: ICON_PICKER_TAB_EMOJI },
  { value: 'icons', wording: ICON_PICKER_ICONS_GROUP },
];

/**
 * A standalone emoji + icon picker, ported from upstream's React component.
 *
 * It is deliberately wired to nothing: it dispatches a bubbling, composed
 * `select` event carrying an `IconData` (or `null` when the user asks to
 * remove the current icon) and lets the host decide what that means.
 *
 * ```ts
 * html`<affine-icon-picker
 *   @select=${(e: CustomEvent<IconPickerSelectDetail>) => apply(e.detail)}
 * ></affine-icon-picker>`
 * ```
 */
export class AffineIconPicker extends LitElement {
  @consume({ context: stdContext })
  accessor std!: BlockStdScope;

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      width: 340px;
      height: 400px;
      border-radius: 8px;
      border: 1px solid ${unsafeCSSVarV2('layer/insideBorder/border')};
      background: ${unsafeCSSVarV2('layer/background/overlayPanel')};
      box-shadow: var(--affine-shadow-2);
      overflow: hidden;
      font-family: var(--affine-font-family);
      color: ${unsafeCSSVarV2('text/primary')};
    }

    .icon-picker-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex: none;
      padding: 10px 12px 0;
      border-bottom: 1px solid ${unsafeCSSVarV2('layer/insideBorder/border')};
    }

    .icon-picker-tabs {
      display: flex;
      gap: 12px;
    }

    .icon-picker-tabs button {
      position: relative;
      padding: 0 0 8px;
      border: none;
      background: transparent;
      cursor: pointer;
      font-family: inherit;
      font-size: var(--affine-font-sm);
      font-weight: 500;
      color: ${unsafeCSSVarV2('text/secondary')};
    }

    .icon-picker-tabs button[data-active='true'] {
      color: ${unsafeCSSVarV2('text/primary')};
    }

    .icon-picker-tabs button[data-active='true']::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 2px;
      background: ${unsafeCSSVarV2('button/primary')};
    }

    .icon-picker-remove {
      padding: 0 0 8px;
      border: none;
      background: transparent;
      cursor: pointer;
      font-family: inherit;
      font-size: var(--affine-font-sm);
      font-weight: 500;
      color: ${unsafeCSSVarV2('text/secondary')};
    }

    .icon-picker-body {
      flex: 1;
      min-height: 0;
    }
  `;

  /**
   * The panel currently shown. Upstream opens on Icons; a host may set another
   * tab up front, and clicking a tab writes back here.
   */
  @property({ attribute: false })
  accessor activeTab: IconPickerTab = 'icons';

  /**
   * The tint the icon panel starts on.
   */
  @property({ attribute: false })
  accessor color: string = DEFAULT_ICON_COLOR;

  /**
   * Hides the "Remove" affordance for hosts where an icon is mandatory.
   */
  @property({ attribute: false })
  accessor showRemove = true;

  @property({ attribute: false })
  accessor rememberRecent = true;

  private readonly _remove = () => {
    this.dispatchEvent(
      new CustomEvent('select', {
        detail: null,
        bubbles: true,
        composed: true,
      })
    );
  };

  override render() {
    return html`
      <header class="icon-picker-header">
        <div class="icon-picker-tabs">
          ${TABS.map(
            tab => html`
              <button
                type="button"
                data-tab=${tab.value}
                data-active=${this.activeTab === tab.value}
                @click=${() => (this.activeTab = tab.value)}
              >
                ${this.std
                  ? translateKey(this.std, ...tab.wording)
                  : tab.wording[1]}
              </button>
            `
          )}
        </div>
        ${this.showRemove
          ? html`
              <button
                class="icon-picker-remove"
                type="button"
                data-testid="icon-picker-remove"
                @click=${this._remove}
              >
                ${this.std
                  ? translateKey(this.std, ...ICON_PICKER_REMOVE)
                  : ICON_PICKER_REMOVE[1]}
              </button>
            `
          : null}
      </header>
      <main class="icon-picker-body">
        ${this.activeTab === 'emoji'
          ? html`<affine-emoji-picker-panel
              .rememberRecent=${this.rememberRecent}
            ></affine-emoji-picker-panel>`
          : html`<affine-icon-picker-panel
              .color=${this.color}
              .rememberRecent=${this.rememberRecent}
            ></affine-icon-picker-panel>`}
      </main>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-icon-picker': AffineIconPicker;
  }
}
