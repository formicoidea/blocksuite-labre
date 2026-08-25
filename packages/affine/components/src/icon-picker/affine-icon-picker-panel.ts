import { SearchIcon } from '@blocksuite/icons/lit';
import { css, html, LitElement, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';

import { RECENT_GROUP_NAME } from './emoji-data.js';
import {
  DEFAULT_ICON_COLOR,
  filterIcons,
  getIcons,
  ICON_COLORS,
  type PickerIcon,
  renderAffineIcon,
} from './icon-data.js';
import { pushRecent, readRecent, RECENT_ICONS_KEY } from './recent-store.js';
import { panelStyles } from './styles.js';
import { IconType } from './types.js';

/**
 * The icon half of the picker: a filter box, a colour menu, a recents row and
 * the full `@blocksuite/icons` set.
 */
export class AffineIconPickerPanel extends LitElement {
  static override styles = [
    panelStyles,
    css`
      :host {
        display: block;
        height: 100%;
        min-height: 0;
      }

      .picker-swatch {
        display: block;
        width: 16px;
        height: 16px;
        border-radius: 50%;
      }
    `,
  ];

  @state()
  private accessor _keyword = '';

  @state()
  private accessor _colorMenuOpen = false;

  @state()
  private accessor _recent: string[] = [];

  /**
   * The tint applied to a picked icon. Exposed so a host can open the picker
   * on the colour the block already wears.
   */
  @property({ attribute: false })
  accessor color: string = DEFAULT_ICON_COLOR;

  @property({ attribute: false })
  accessor rememberRecent = true;

  get icons(): PickerIcon[] {
    return filterIcons(getIcons(), this._keyword);
  }

  override firstUpdated() {
    if (this.rememberRecent) this._recent = readRecent(RECENT_ICONS_KEY);
  }

  private readonly _select = (name: string) => {
    if (this.rememberRecent) {
      this._recent = pushRecent(RECENT_ICONS_KEY, name);
    }

    this.dispatchEvent(
      new CustomEvent('select', {
        detail: { type: IconType.AffineIcon, name, color: this.color },
        bubbles: true,
        composed: true,
      })
    );
  };

  private _renderGroup(name: string, iconNames: string[]) {
    return html`
      <div class="picker-group">
        <div class="picker-group-name" data-group-name=${name}>${name}</div>
        <div class="picker-group-grid">
          ${repeat(
            iconNames,
            iconName => iconName,
            iconName => html`
              <button
                class="picker-cell"
                type="button"
                title=${iconName}
                data-icon-name=${iconName}
                style=${styleMap({ color: this.color })}
                @click=${() => this._select(iconName)}
              >
                ${renderAffineIcon(iconName)}
              </button>
            `
          )}
        </div>
      </div>
    `;
  }

  override render() {
    const icons = this.icons;

    return html`
      <div class="picker-panel">
        <header class="picker-search">
          <label class="picker-search-input">
            ${SearchIcon()}
            <input
              type="text"
              placeholder="Filter..."
              .value=${this._keyword}
              @input=${(e: Event) => {
                this._keyword = (e.target as HTMLInputElement).value;
              }}
            />
          </label>
          <button
            class="picker-trigger"
            type="button"
            data-testid="icon-color-trigger"
            @click=${() => (this._colorMenuOpen = !this._colorMenuOpen)}
          >
            <span
              class="picker-swatch"
              style=${styleMap({ background: this.color })}
            ></span>
          </button>
        </header>

        ${this._colorMenuOpen
          ? html`
              <div class="picker-search">
                <div class="picker-popup" data-testid="icon-color-menu">
                  ${repeat(
                    ICON_COLORS,
                    swatch => swatch.name,
                    swatch => html`
                      <button
                        class="picker-cell"
                        type="button"
                        title=${swatch.name}
                        data-color-name=${swatch.name}
                        @click=${() => {
                          this.color = swatch.value;
                          this._colorMenuOpen = false;
                        }}
                      >
                        <span
                          class="picker-swatch"
                          style=${styleMap({ background: swatch.value })}
                        ></span>
                      </button>
                    `
                  )}
                </div>
              </div>
            `
          : nothing}

        <div class="picker-scroll">
          ${this._recent.length && !this._keyword
            ? this._renderGroup(RECENT_GROUP_NAME, this._recent)
            : nothing}
          ${icons.length
            ? this._renderGroup(
                'Icons',
                icons.map(icon => icon.name)
              )
            : html`<div class="picker-empty">No icon found</div>`}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-icon-picker-panel': AffineIconPickerPanel;
  }
}
