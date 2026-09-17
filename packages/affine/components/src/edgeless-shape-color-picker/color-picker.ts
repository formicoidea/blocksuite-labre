import {
  type Color,
  type ColorScheme,
  DefaultTheme,
  type LineWidth,
  type Palette,
  resolveColor,
  type ShapeProps,
  type StrokeStyle,
} from '@labre/affine-model';
import {
  BOARD_BORDER_STYLE_LABEL,
  translateKey,
} from '@labre/affine-shared/services';
import { unsafeCSSVarV2 } from '@labre/affine-shared/theme';
import { type ColorEvent, stopPropagation } from '@labre/affine-shared/utils';
import { SignalWatcher, WithDisposable } from '@labre/global/lit';
import type { BlockStdScope } from '@labre/std';
import { stdContext } from '@labre/std';
import { consume } from '@lit/context';
import { batch, signal } from '@preact/signals-core';
import { css, html, LitElement, nothing, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { choose } from 'lit-html/directives/choose.js';
import { repeat } from 'lit-html/directives/repeat.js';
import { styleMap } from 'lit-html/directives/style-map.js';
import { when } from 'lit-html/directives/when.js';

import {
  calcCustomButtonStyle,
  keepColor,
  packColorsWith,
  type PaletteGroup,
  paletteCarouselStyles,
  paletteCarouselWheel,
  type PickColorEvent,
  preprocessColor,
  renderPaletteCarousel,
  rgbaToHex8,
} from '../color-picker';
import type { LineDetailType } from '../edgeless-line-styles-panel';
import type { EditorMenuButton } from '../toolbar';
import {
  BORDER_COLOR_LABEL,
  COLOR_LABEL,
  FILL_COLOR_LABEL,
} from '../translations.js';

type TabType = 'normal' | 'custom';

type ColorType = Extract<keyof ShapeProps, 'fillColor' | 'strokeColor'>;

type PickerType = {
  label: string;
  type: ColorType;
  value: string;
  hollowCircle: boolean;
  onPick: (e: ColorEvent) => void;
};

export class EdgelessShapeColorPicker extends WithDisposable(
  SignalWatcher(LitElement)
) {
  @consume({ context: stdContext })
  accessor std!: BlockStdScope;

  static override styles = css`
    .pickers {
      display: flex;
      align-self: stretch;
      gap: 12px;
    }

    .picker {
      display: flex;
      align-self: stretch;
      gap: 8px;
    }

    .picker-label {
      color: ${unsafeCSSVarV2('text/secondary')};
      font-weight: 400;
    }

    ${paletteCarouselStyles}
  `;

  tabType$ = signal<TabType>('normal');

  colorType$ = signal<ColorType>('fillColor');

  readonly #pickFillColor = (e: ColorEvent) => {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent<PickColorEvent>('pickFillColor', {
        detail: {
          type: 'pick',
          detail: e.detail,
        },
        bubbles: true,
        composed: true,
        cancelable: true,
      })
    );
  };

  readonly #pickStrokeColor = (e: ColorEvent) => {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent<PickColorEvent>('pickStrokeColor', {
        detail: {
          type: 'pick',
          detail: e.detail,
        },
        bubbles: true,
        composed: true,
        cancelable: true,
      })
    );
  };

  readonly #pickColor = (detail: PickColorEvent) => {
    const type =
      this.colorType$.peek() === 'fillColor'
        ? 'pickFillColor'
        : 'pickStrokeColor';
    this.dispatchEvent(
      new CustomEvent<PickColorEvent>(type, {
        detail,
        bubbles: true,
        composed: true,
        cancelable: true,
      })
    );
  };

  readonly #pickStrokeStyle = (e: CustomEvent<LineDetailType>) => {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('pickStrokeStyle', {
        detail: e.detail,
        bubbles: true,
        composed: true,
        cancelable: true,
      })
    );
  };

  #calcCustomButtonStyle(color: string, isCustomColor: boolean) {
    return calcCustomButtonStyle(color, isCustomColor, this);
  }

  /**
   * The page of {@link paletteGroups} on screen — see the twin getter on
   * `edgeless-color-picker-button` for why a click wins over the prop.
   */
  get groupIndex(): number {
    if (this.pickedGroupIndex !== undefined) return this.pickedGroupIndex;
    const asked = this.paletteGroups.findIndex(
      group => group.key === this.activeGroupKey
    );
    return asked < 0 ? 0 : asked;
  }

  /** The page on screen, or the caller's own list when there is no carousel. */
  get activePalettes(): readonly Palette[] {
    if (this.paletteGroups.length < 2) return this.palettes;
    return this.paletteGroups[this.groupIndex]?.palettes ?? this.palettes;
  }

  /**
   * A new selection re-opens on ITS framework — see the twin on
   * `edgeless-color-picker-button`.
   */
  override willUpdate(changed: PropertyValues) {
    if (changed.has('activeGroupKey')) {
      this.pickedGroupIndex = undefined;
      this.paletteListOpen = false;
    }
  }

  /** Measured against the UNION of the pages, for the reason the twin states. */
  #calcCustomButtonState(color: string, theme: ColorScheme) {
    const offered =
      this.paletteGroups.length > 1
        ? this.paletteGroups.flatMap(group => group.palettes)
        : this.palettes;
    return !offered
      .map(({ value }) => resolveColor(value, theme))
      .includes(color);
  }

  #switchToCustomWith(type: ColorType) {
    batch(() => {
      this.tabType$.value = 'custom';
      this.colorType$.value = type;
    });
  }

  get fillColorWithoutAlpha() {
    const { fillColor } = this.payload;
    return keepColor(
      fillColor.startsWith('--')
        ? rgbaToHex8(
            preprocessColor(window.getComputedStyle(this))({
              type: 'normal',
              value: fillColor,
            }).rgba
          )
        : fillColor
    );
  }

  override firstUpdated() {
    this.disposables.addFromEvent(
      this.menuButton,
      'toggle',
      (e: CustomEvent<boolean>) => {
        const opened = e.detail;
        // A re-opened picker shows its swatches, never the list it was left on.
        this.paletteListOpen = false;
        if (!opened && this.tabType$.peek() === 'custom') {
          this.tabType$.value = 'normal';
        }
      }
    );
  }

  override render() {
    const {
      tabType$: { value: tabType },
      colorType$: { value: colorType },
      activePalettes,
      fillColorWithoutAlpha,
      payload: {
        fillColor,
        strokeColor,
        strokeWidth,
        strokeStyle,
        originalFillColor,
        originalStrokeColor,
        theme,
        enableCustomColor,
      },
    } = this;

    return html`
      <editor-menu-button
        .contentPadding="${tabType === 'normal' ? '8px' : '0px'}"
        @click=${stopPropagation}
        .button=${html`
          <editor-icon-button
            aria-label="${this.std
              ? translateKey(this.std, ...COLOR_LABEL)
              : COLOR_LABEL[1]}"
            .tooltip="${this.std
              ? translateKey(this.std, ...COLOR_LABEL)
              : COLOR_LABEL[1]}"
          >
            <edgeless-color-button
              .color=${fillColorWithoutAlpha}
            ></edgeless-color-button>
          </editor-icon-button>
        `}
      >
        <div
          class="pickers"
          data-orientation="vertical"
          @wheel=${paletteCarouselWheel({
            groups: this.paletteGroups,
            index: this.groupIndex,
            onPage: index => (this.pickedGroupIndex = index),
            open: this.paletteListOpen,
          })}
        >
          ${choose(tabType, [
            [
              'normal',
              () => {
                return html`
                  ${renderPaletteCarousel({
                    groups: this.paletteGroups,
                    index: this.groupIndex,
                    onPage: index => (this.pickedGroupIndex = index),
                    onToggle: open => (this.paletteListOpen = open),
                    open: this.paletteListOpen,
                    std: this.std,
                    theme,
                  })}
                  ${this.paletteListOpen
                    ? nothing
                    : html`${repeat(
                          [
                            {
                              label: this.std
                                ? translateKey(this.std, ...FILL_COLOR_LABEL)
                                : FILL_COLOR_LABEL[1],
                              type: 'fillColor',
                              value: fillColor,
                              hollowCircle: false,
                              onPick: this.#pickFillColor,
                            },
                            {
                              label: this.std
                                ? translateKey(this.std, ...BORDER_COLOR_LABEL)
                                : BORDER_COLOR_LABEL[1],
                              type: 'strokeColor',
                              value: strokeColor,
                              hollowCircle: true,
                              onPick: this.#pickStrokeColor,
                            },
                          ] satisfies PickerType[],
                          item => item.type,
                          ({
                            label,
                            type,
                            value,
                            onPick,
                            hollowCircle,
                          }) => html`
                            <div class="picker-label">${label}</div>
                            <edgeless-color-panel
                              aria-label="${label}"
                              role="listbox"
                              .hasTransparent=${false}
                              .hollowCircle=${hollowCircle}
                              .value=${value}
                              .theme=${theme}
                              .palettes=${activePalettes}
                              .std=${this.std}
                              @select=${onPick}
                            >
                              ${when(enableCustomColor, () => {
                                const isCustomColor =
                                  this.#calcCustomButtonState(value, theme);
                                const styleInfo = this.#calcCustomButtonStyle(
                                  value,
                                  isCustomColor
                                );
                                return html`
                                  <edgeless-color-custom-button
                                    slot="custom"
                                    style=${styleMap(styleInfo)}
                                    ?active=${isCustomColor}
                                    @click=${() =>
                                      this.#switchToCustomWith(type)}
                                  ></edgeless-color-custom-button>
                                `;
                              })}
                            </edgeless-color-panel>
                          `
                        )}
                        <div class="picker-label">
                          ${this.std
                            ? translateKey(
                                this.std,
                                ...BOARD_BORDER_STYLE_LABEL
                              )
                            : BOARD_BORDER_STYLE_LABEL[1]}
                        </div>
                        <edgeless-line-styles-panel
                          class="picker"
                          .lineSize=${strokeWidth}
                          .lineStyle=${strokeStyle}
                          @select=${this.#pickStrokeStyle}
                        ></edgeless-line-styles-panel>`}
                `;
              },
            ],
            [
              'custom',
              () => {
                const isFillColor = colorType === 'fillColor';
                const packed = packColorsWith(
                  theme,
                  isFillColor ? fillColor : strokeColor,
                  isFillColor ? originalFillColor : originalStrokeColor
                );
                const type = packed.type === 'palette' ? 'normal' : packed.type;
                const modes = packed.colors.map(
                  preprocessColor(window.getComputedStyle(this))
                );

                return html`
                  <edgeless-color-picker
                    class="custom"
                    .pick=${this.#pickColor}
                    .colors=${{ type, modes }}
                  ></edgeless-color-picker>
                `;
              },
            ],
          ])}
        </div>
      </editor-menu-button>
    `;
  }

  @property({ attribute: false })
  accessor payload!: {
    fillColor: string;
    strokeColor: string;
    strokeWidth: LineWidth;
    strokeStyle: StrokeStyle;
    originalFillColor: Color;
    originalStrokeColor: Color;
    theme: ColorScheme;
    enableCustomColor: boolean;
  };

  @property({ attribute: false })
  accessor palettes: Palette[] = DefaultTheme.Palettes;

  /**
   * The carousel's pages, base palette first (`docs/adr/0027`). Empty falls
   * back to {@link palettes} and draws no header — the panel as it was.
   */
  @property({ attribute: false })
  accessor paletteGroups: readonly PaletteGroup[] = [];

  /** The page to open on: the framework of the selected element, usually. */
  @property({ attribute: false })
  accessor activeGroupKey: string | undefined = undefined;

  /** Component state only, never persisted: which page the user paged TO. */
  @state()
  accessor pickedGroupIndex: number | undefined = undefined;

  /**
   * View state too: whether the header's list of pages is showing IN PLACE of
   * the two grids and the line styles — see the twin on
   * `edgeless-color-picker-button`.
   */
  @state()
  accessor paletteListOpen = false;

  @query('editor-menu-button')
  accessor menuButton!: EditorMenuButton;
}
