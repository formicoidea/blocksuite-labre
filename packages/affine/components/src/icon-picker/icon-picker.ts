import type { TranslationService } from '@labre/affine-shared/services';
import { unsafeCSSVarV2 } from '@labre/affine-shared/theme';
import type { BlockStdScope } from '@labre/std';
import { stdContext } from '@labre/std';
import { consume } from '@lit/context';
import { css, html, LitElement, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';

import { DEFAULT_ICON_COLOR } from './icon-data.js';
import type { IconPickerTab } from './types.js';
import { iconPickerWording } from './wording.js';
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
 * The library's one emoji + icon picker: emoji-mart's picker on the Emoji tab
 * (the one the callout block always opened, issue 636 follow-up: the PO chose
 * it over the emoji grid this element first shipped with) and the
 * `@blocksuite/icons` set on the Icons tab, ported from upstream.
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
 *
 * It mounts outside an editor too (a host's settings panel, issue #636):
 * `std` then stays undefined and the words come from {@link translation} if
 * the host hands one, else from their English fallback. To open it anchored to
 * an element and await the choice, use `openIconPicker`.
 */
export class AffineIconPicker extends LitElement {
  @consume({ context: stdContext })
  accessor std!: BlockStdScope;

  static override styles = css`
    /*
     * The frame is sized on emoji-mart's own picker (nine 36px cells plus its
     * padding and scrollbar gutter, 435px high), so switching tabs never
     * resizes the popup.
     */
    :host {
      display: flex;
      flex-direction: column;
      width: 352px;
      height: 435px;
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

    /*
     * One tab and no Remove: nothing to frame, emoji-mart draws its own box
     * exactly as the callout's emoji menu did.
     */
    :host([data-bare]) {
      width: auto;
      height: auto;
      border: none;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
      overflow: visible;
    }
  `;

  /**
   * The panel currently shown. Upstream opens on Icons; a host may set another
   * tab up front, and clicking a tab writes back here. A tab left out of
   * {@link tabs} falls back to the first one offered.
   */
  @property({ attribute: false })
  accessor activeTab: IconPickerTab = 'icons';

  /**
   * The tint the icon panel starts on.
   */
  @property({ attribute: false })
  accessor color: string = DEFAULT_ICON_COLOR;

  /**
   * The tabs offered, in their order. A host whose model stores only an emoji
   * (the callout's `emoji` prop) passes `['emoji']`; with one tab the tab bar
   * is not drawn, and with Remove hidden too neither is the frame.
   */
  @property({ attribute: false })
  accessor tabs: readonly IconPickerTab[] = ['emoji', 'icons'];

  /**
   * Hides the "Remove" affordance for hosts where an icon is mandatory.
   */
  @property({ attribute: false })
  accessor showRemove = true;

  /** See `OpenIconPickerOptions.rememberRecent`. */
  @property({ attribute: false })
  accessor rememberRecent = true;

  /**
   * The host's translation service, for a picker mounted with no editor
   * around: the same object it registers with `TranslationExtension`. Handed
   * down to both panels; absent, the words are the English fallbacks.
   */
  @property({ attribute: false })
  accessor translation: TranslationService | undefined = undefined;

  private readonly _remove = () => {
    this.dispatchEvent(
      new CustomEvent('select', {
        detail: null,
        bubbles: true,
        composed: true,
      })
    );
  };

  private get _offered() {
    const offered = TABS.filter(tab => this.tabs.includes(tab.value));
    return offered.length ? offered : TABS;
  }

  private get _shownTab(): IconPickerTab {
    const offered = this._offered;
    return offered.some(tab => tab.value === this.activeTab)
      ? this.activeTab
      : offered[0].value;
  }

  private get _bare() {
    return this._offered.length < 2 && !this.showRemove;
  }

  override willUpdate(changed: PropertyValues<this>) {
    super.willUpdate(changed);
    this.toggleAttribute('data-bare', this._bare);
  }

  private _renderHeader() {
    if (this._bare) return null;
    const offered = this._offered;
    const shown = this._shownTab;
    return html`
      <header class="icon-picker-header">
        <div class="icon-picker-tabs">
          ${offered.length < 2
            ? null
            : offered.map(
                tab => html`
                  <button
                    type="button"
                    data-tab=${tab.value}
                    data-active=${shown === tab.value}
                    @click=${() => (this.activeTab = tab.value)}
                  >
                    ${iconPickerWording(this, tab.wording)}
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
                ${iconPickerWording(this, ICON_PICKER_REMOVE)}
              </button>
            `
          : null}
      </header>
    `;
  }

  override render() {
    return html`
      ${this._renderHeader()}
      <main class="icon-picker-body">
        ${this._shownTab === 'emoji'
          ? html`<affine-emoji-picker-panel
              .rememberRecent=${this.rememberRecent}
              .translation=${this.translation}
              ?framed=${!this._bare}
            ></affine-emoji-picker-panel>`
          : html`<affine-icon-picker-panel
              .color=${this.color}
              .rememberRecent=${this.rememberRecent}
              .translation=${this.translation}
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
