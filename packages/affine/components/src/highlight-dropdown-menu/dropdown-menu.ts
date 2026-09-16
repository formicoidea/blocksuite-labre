import { translateKey } from '@labre/affine-shared/services';
import type { AffineTextStyleAttributes } from '@labre/affine-shared/types';
import type { BlockStdScope } from '@labre/std';
import { PropTypes, requiredProperties, stdContext } from '@labre/std';
import { consume } from '@lit/context';
import { LitElement } from 'lit';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { html } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';

import { EditorChevronDown } from '../toolbar';
import {
  COLOR_LABEL,
  COLOR_NAME_WORDINGS,
  HIGHLIGHT_BACKGROUND_LABEL,
  HIGHLIGHT_DEFAULT_BACKGROUND,
  HIGHLIGHT_DEFAULT_FOREGROUND,
  HIGHLIGHT_LABEL,
} from '../translations.js';

const colors = [
  'default',
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'purple',
  'grey',
] as const;

export type HighlightType = Pick<
  AffineTextStyleAttributes,
  'color' | 'background'
>;

// TODO(@fundon): these recent settings should be added to the dropdown menu
// tests/blocksutie/e2e/format-bar.spec.ts#253
//
// let latestHighlightColor: string | null = null;
// let latestHighlightType: HighlightType = 'background';

@requiredProperties({
  updateHighlight: PropTypes.instanceOf(Function),
})
export class HighlightDropdownMenu extends LitElement {
  @consume({ context: stdContext })
  accessor std!: BlockStdScope;

  @property({ attribute: false })
  accessor updateHighlight!: (styles: HighlightType) => void;

  private readonly _update = (style: HighlightType) => {
    // latestHighlightColor = value;
    // latestHighlightType = type;

    this.updateHighlight(style);
  };

  private _colorLabel(color: string, background: boolean): string {
    if (color === 'default') {
      const wording = background
        ? HIGHLIGHT_DEFAULT_BACKGROUND
        : HIGHLIGHT_DEFAULT_FOREGROUND;
      return this.std ? translateKey(this.std, ...wording) : wording[1];
    }
    const wording = COLOR_NAME_WORDINGS[color];
    if (!wording) return color;
    return this.std ? translateKey(this.std, ...wording) : wording[1];
  }

  override render() {
    const prefix = '--affine-text-highlight';
    const label = this.std
      ? translateKey(this.std, ...HIGHLIGHT_LABEL)
      : HIGHLIGHT_LABEL[1];
    const backgroundLabel = this.std
      ? translateKey(this.std, ...HIGHLIGHT_BACKGROUND_LABEL)
      : HIGHLIGHT_BACKGROUND_LABEL[1];
    const colorLabel = this.std
      ? translateKey(this.std, ...COLOR_LABEL)
      : COLOR_LABEL[1];

    return html`
      <editor-menu-button
        .contentPadding="${'8px'}"
        .button=${html`
          <editor-icon-button aria-label="${label}" .tooltip="${label}">
            <affine-highlight-duotone-icon
              style=${styleMap({
                '--color':
                  // latestHighlightColor ?? 'var(--affine-text-primary-color)',
                  'var(--affine-text-primary-color)',
              })}
            ></affine-highlight-duotone-icon>
            ${EditorChevronDown}
          </editor-icon-button>
        `}
      >
        <div data-size="large" data-orientation="vertical">
          <div class="highlight-heading">${colorLabel}</div>
          ${repeat(colors, color => {
            const isDefault = color === 'default';
            const value = isDefault
              ? null
              : `var(${prefix}-foreground-${color})`;
            return html`
              <editor-menu-action
                data-testid="foreground-${color}"
                @click=${() => this._update({ color: value })}
              >
                <affine-text-duotone-icon
                  style=${styleMap({
                    '--color': value ?? 'var(--affine-text-primary-color)',
                  })}
                ></affine-text-duotone-icon>
                <span class="label capitalize"
                  >${this._colorLabel(color, false)}</span
                >
              </editor-menu-action>
            `;
          })}

          <div class="highlight-heading">${backgroundLabel}</div>
          ${repeat(colors, color => {
            const isDefault = color === 'default';
            const value = isDefault ? null : `var(${prefix}-${color})`;
            return html`
              <editor-menu-action
                data-testid="background-${color}"
                @click=${() => this._update({ background: value })}
              >
                <affine-text-duotone-icon
                  style=${styleMap({
                    '--color': 'var(--affine-text-primary-color)',
                    '--background': value ?? 'transparent',
                  })}
                ></affine-text-duotone-icon>

                <span class="label capitalize"
                  >${this._colorLabel(color, true)}</span
                >
              </editor-menu-action>
            `;
          })}
        </div>
      </editor-menu-button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-highlight-dropdown-menu': HighlightDropdownMenu;
  }
}
