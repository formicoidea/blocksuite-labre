import { ColorScheme, NoteShadow } from '@labre/affine-model';
import {
  type ChromeWording,
  translateKey,
} from '@labre/affine-shared/services';
import { WithDisposable } from '@labre/global/lit';
import type { BlockStdScope } from '@labre/std';
import { css, html, LitElement } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';

import {
  GFX_NOTE_SHADOW_FLOATION,
  NOTE_SHADOW_BOX,
  NOTE_SHADOW_FILM,
  NOTE_SHADOW_NONE,
  NOTE_SHADOW_PAPER,
  NOTE_SHADOW_STICKER,
} from '../translations.js';
import { NoteNoShadowIcon, NoteShadowSampleIcon } from './icons';

const SHADOWS: {
  type: NoteShadow;
  styles: { light: string; dark: string };
  tooltipWording: ChromeWording;
}[] = [
  {
    type: NoteShadow.None,
    styles: {
      light: '',
      dark: '',
    },
    tooltipWording: NOTE_SHADOW_NONE,
  },
  {
    type: NoteShadow.Box,
    styles: {
      light:
        '0px 0.2px 4.8px 0px rgba(66, 65, 73, 0.2), 0px 0px 1.6px 0px rgba(66, 65, 73, 0.2)',
      dark: '0px 0.2px 6px 0px rgba(0, 0, 0, 0.44), 0px 0px 2px 0px rgba(0, 0, 0, 0.66)',
    },
    tooltipWording: NOTE_SHADOW_BOX,
  },
  {
    type: NoteShadow.Sticker,
    styles: {
      light:
        '0px 9.6px 10.4px -4px rgba(66, 65, 73, 0.07), 0px 10.4px 7.2px -8px rgba(66, 65, 73, 0.22)',
      dark: '0px 9.6px 10.4px -4px rgba(0, 0, 0, 0.66), 0px 10.4px 7.2px -8px rgba(0, 0, 0, 0.44)',
    },
    tooltipWording: NOTE_SHADOW_STICKER,
  },
  {
    type: NoteShadow.Paper,
    styles: {
      light:
        '0px 0px 0px 4px rgba(255, 255, 255, 1), 0px 1.2px 2.4px 4.8px rgba(66, 65, 73, 0.16)',
      dark: '0px 1.2px 2.4px 4.8px rgba(0, 0, 0, 0.36), 0px 0px 0px 3.4px rgba(75, 75, 75, 1)',
    },
    tooltipWording: NOTE_SHADOW_PAPER,
  },
  {
    type: NoteShadow.Float,
    styles: {
      light:
        '0px 5.2px 12px 0px rgba(66, 65, 73, 0.13), 0px 0px 0.4px 1px rgba(0, 0, 0, 0.06)',
      dark: '0px 5.2px 12px 0px rgba(0, 0, 0, 0.66), 0px 0px 0.4px 1px rgba(0, 0, 0, 0.44)',
    },
    tooltipWording: GFX_NOTE_SHADOW_FLOATION,
  },
  {
    type: NoteShadow.Film,
    styles: {
      light:
        '0px 0px 0px 1.4px rgba(0, 0, 0, 1), 2.4px 2.4px 0px 1px rgba(0, 0, 0, 1)',
      dark: '0px 0px 0px 1.4px rgba(178, 178, 178, 1), 2.4px 2.4px 0px 1px rgba(178, 178, 178, 1)',
    },
    tooltipWording: NOTE_SHADOW_FILM,
  },
];

export class EdgelessNoteShadowPanel extends WithDisposable(LitElement) {
  static override styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .item {
      padding: 8px;
      border-radius: 4px;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
    }

    .item-icon {
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .item:hover {
      background-color: var(--affine-hover-color);
    }
  `;

  override render() {
    const { std } = this;
    return repeat(
      SHADOWS,
      shadow => shadow,
      (shadow, index) =>
        html`<style>
            .item-icon svg rect:first-of-type {
              fill: ${this.background.startsWith('--')
                ? `var(${this.background})`
                : this.background};
            }
          </style>
          <div
            class="item"
            @click=${() => this.onSelect(shadow.type)}
            style=${styleMap({
              border:
                this.value === shadow.type
                  ? '1px solid var(--affine-brand-color)'
                  : 'none',
            })}
          >
            <edgeless-tool-icon-button
              class="item-icon"
              data-testid=${shadow.type.replace('--', '')}
              .tooltip=${std
                ? translateKey(std, ...shadow.tooltipWording)
                : shadow.tooltipWording[1]}
              .tipPosition=${'bottom'}
              .iconContainerPadding=${0}
              style=${styleMap({
                boxShadow: `${this.theme === ColorScheme.Dark ? shadow.styles.dark : shadow.styles.light}`,
              })}
            >
              ${index === 0 ? NoteNoShadowIcon : NoteShadowSampleIcon}
            </edgeless-tool-icon-button>
          </div>`
    );
  }

  @property({ attribute: false })
  accessor background!: string;

  @property({ attribute: false })
  accessor onSelect!: (value: string) => void;

  @property({ attribute: false })
  accessor theme!: ColorScheme;

  @property({ attribute: false })
  accessor value!: string;

  /**
   * Optional: no renderer in this repo currently instantiates
   * `edgeless-note-shadow-panel` (registered in `../effects.ts`, but unused
   * elsewhere) — so there is no call site yet to thread `std` from. Without
   * one the English fallback keeps showing, same as before this wording
   * existed.
   */
  @property({ attribute: false })
  accessor std: BlockStdScope | undefined = undefined;
}
