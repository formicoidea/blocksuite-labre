import { translateKey } from '@labre/affine-shared/services';
import { unsafeCSSVarV2 } from '@labre/affine-shared/theme';
import { WithDisposable } from '@labre/global/lit';
import { ToggleDownIcon, ToggleRightIcon } from '@blocksuite/icons/lit';
import type { BlockStdScope } from '@labre/std';
import { ShadowlessElement, stdContext } from '@labre/std';
import { consume } from '@lit/context';
import { css, unsafeCSS } from 'lit';
import { property } from 'lit/decorators.js';
import { html } from 'lit-html';

import { TOGGLE_COLLAPSE_ARIA, TOGGLE_EXPAND_ARIA } from '../translations.js';

export const TOGGLE_BUTTON_PARENT_CLASS = 'blocksuite-toggle-button-parent';

export class ToggleButton extends WithDisposable(ShadowlessElement) {
  @consume({ context: stdContext })
  accessor std!: BlockStdScope;

  static override styles = css`
    .toggle-icon {
      display: flex;
      align-items: start;
      justify-content: start;
      position: absolute;
      padding: 0;
      border: 0;
      color: inherit;
      background: transparent;
      font: inherit;
      width: 16px;
      height: 16px;
      top: calc((1em - 16px) / 2 + 5px);
      left: 0;
      transform: translateX(-100%);
      border-radius: 4px;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s ease-in-out;
    }

    .toggle-icon:hover {
      background: var(--affine-hover-color);
    }

    .toggle-icon:focus-visible {
      opacity: 1;
      outline: 1px solid var(--affine-primary-color);
    }

    .toggle-icon[data-collapsed='true'] {
      opacity: 1;
    }

    .${unsafeCSS(TOGGLE_BUTTON_PARENT_CLASS)}:hover .toggle-icon {
      opacity: 1;
    }

    .with-drag-handle .toggle-icon {
      opacity: 1;
    }
    .with-drag-handle .affine-block-children-container .toggle-icon {
      opacity: 0;
    }

    .toggle-icon {
      svg {
        color: ${unsafeCSSVarV2('icon/primary', '#77757D')};
      }
    }
  `;

  private _ariaLabel(): string {
    const wording = this.collapsed ? TOGGLE_EXPAND_ARIA : TOGGLE_COLLAPSE_ARIA;
    return this.std ? translateKey(this.std, ...wording) : wording[1];
  }

  override render() {
    return html`
      <button
        type="button"
        contenteditable="false"
        class="toggle-icon"
        data-collapsed=${this.collapsed}
        aria-label=${this._ariaLabel()}
        aria-expanded=${!this.collapsed}
        aria-controls=${this.controls}
        @click=${() => this.updateCollapsed(!this.collapsed)}
      >
        ${(this.collapsed ? ToggleRightIcon : ToggleDownIcon)({
          width: '16px',
          height: '16px',
        })}
      </button>
    `;
  }

  @property({ attribute: false })
  accessor collapsed!: boolean;

  @property({ attribute: false })
  accessor updateCollapsed!: (collapsed: boolean) => void;

  /**
   * Id of the children container this button expands and collapses,
   * exposed to assistive technologies through `aria-controls`.
   */
  @property({ attribute: false })
  accessor controls!: string;
}

declare global {
  interface HTMLElementTagNameMap {
    'blocksuite-toggle-button': ToggleButton;
  }
}
