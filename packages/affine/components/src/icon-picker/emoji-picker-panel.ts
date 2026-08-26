import { SearchIcon } from '@blocksuite/icons/lit';
import { css, html, LitElement, nothing } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';

import {
  type EmojiGroup,
  emojiUnicode,
  filterEmojiGroups,
  getEmojiGroups,
  RECENT_GROUP_NAME,
  SKIN_TONES,
} from './emoji-data.js';
import { pushRecent, readRecent, RECENT_EMOJIS_KEY } from './recent-store.js';
import { panelStyles } from './styles.js';
import { IconType } from './types.js';

/**
 * The emoji half of the picker: a filter box, a skin-tone menu, a recents row
 * and the eight emoji groups, with a footer that jumps to a group.
 */
export class AffineEmojiPickerPanel extends LitElement {
  static override styles = [
    panelStyles,
    css`
      :host {
        display: block;
        height: 100%;
        min-height: 0;
      }
    `,
  ];

  @state()
  private accessor _keyword = '';

  @state()
  private accessor _skin: number | undefined = undefined;

  @state()
  private accessor _skinMenuOpen = false;

  @state()
  private accessor _recent: string[] = [];

  @state()
  private accessor _activeGroup: string = RECENT_GROUP_NAME;

  @query('.picker-scroll')
  private accessor _scroll!: HTMLElement | null;

  /**
   * Whether picked emojis are remembered in `localStorage`. Hosts that must
   * not write to it (or tests) can turn this off.
   */
  @property({ attribute: false })
  accessor rememberRecent = true;

  get groups(): EmojiGroup[] {
    return filterEmojiGroups(getEmojiGroups(), this._keyword);
  }

  override firstUpdated() {
    if (this.rememberRecent) this._recent = readRecent(RECENT_EMOJIS_KEY);
  }

  private readonly _select = (unicode: string) => {
    if (this.rememberRecent) {
      this._recent = pushRecent(RECENT_EMOJIS_KEY, unicode);
    }

    this.dispatchEvent(
      new CustomEvent('select', {
        detail: { type: IconType.Emoji, unicode },
        bubbles: true,
        composed: true,
      })
    );
  };

  private readonly _jumpTo = (groupName: string) => {
    this._activeGroup = groupName;
    const target = [
      ...(this._scroll?.querySelectorAll<HTMLElement>('[data-group-name]') ??
        []),
    ].find(heading => heading.dataset.groupName === groupName);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  private readonly _syncActiveGroup = () => {
    const scroll = this._scroll;
    if (!scroll) return;

    const headings = [
      ...scroll.querySelectorAll<HTMLElement>('[data-group-name]'),
    ];
    // The last heading that has already passed the top of the viewport wins.
    let active = headings[0]?.dataset.groupName;
    for (const heading of headings) {
      if (heading.offsetTop - scroll.scrollTop > 8) break;
      active = heading.dataset.groupName;
    }
    if (active && active !== this._activeGroup) this._activeGroup = active;
  };

  private _renderGroup(name: string, unicodes: string[]) {
    return html`
      <div class="picker-group">
        <div class="picker-group-name" data-group-name=${name}>${name}</div>
        <div class="picker-group-grid">
          ${repeat(
            unicodes,
            unicode => unicode,
            unicode => html`
              <button
                class="picker-cell"
                type="button"
                title=${unicode}
                @click=${() => this._select(unicode)}
              >
                ${unicode}
              </button>
            `
          )}
        </div>
      </div>
    `;
  }

  override render() {
    const groups = this.groups;
    const skinSymbol =
      SKIN_TONES.find(tone => tone.value === this._skin)?.unicode ??
      SKIN_TONES[0].unicode;

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
            data-testid="skin-tone-trigger"
            @click=${() => (this._skinMenuOpen = !this._skinMenuOpen)}
          >
            ${skinSymbol}
          </button>
        </header>

        ${this._skinMenuOpen
          ? html`
              <div class="picker-search">
                <div class="picker-popup" data-testid="skin-tone-menu">
                  ${repeat(
                    SKIN_TONES,
                    tone => tone.unicode,
                    tone => html`
                      <button
                        class="picker-cell"
                        type="button"
                        @click=${() => {
                          this._skin = tone.value;
                          this._skinMenuOpen = false;
                        }}
                      >
                        ${tone.unicode}
                      </button>
                    `
                  )}
                </div>
              </div>
            `
          : nothing}

        <div class="picker-scroll" @scroll=${this._syncActiveGroup}>
          ${this._recent.length && !this._keyword
            ? this._renderGroup(RECENT_GROUP_NAME, this._recent)
            : nothing}
          ${groups.length
            ? repeat(
                groups,
                group => group.id,
                group =>
                  this._renderGroup(
                    group.name,
                    group.emojis.map(emoji => emojiUnicode(emoji, this._skin))
                  )
              )
            : html`<div class="picker-empty">No emoji found</div>`}
        </div>

        <footer class="picker-footer">
          ${repeat(
            [
              { name: RECENT_GROUP_NAME, symbol: '🕘' },
              ...getEmojiGroups().map(group => ({
                name: group.name,
                symbol: group.symbol,
              })),
            ],
            group => group.name,
            group => html`
              <button
                type="button"
                title=${group.name}
                data-active=${this._activeGroup === group.name}
                @click=${() => this._jumpTo(group.name)}
              >
                ${group.symbol}
              </button>
            `
          )}
        </footer>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-emoji-picker-panel': AffineEmojiPickerPanel;
  }
}
