import type { Color, ColorScheme, Palette } from '@labre/affine-model';
import { DefaultTheme, resolveColor } from '@labre/affine-model';
import type { ColorEvent } from '@labre/affine-shared/utils';
import { WithDisposable } from '@labre/global/lit';
import type { BlockStdScope } from '@labre/std';
import { html, LitElement, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { choose } from 'lit/directives/choose.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { styleMap } from 'lit/directives/style-map.js';
import { when } from 'lit-html/directives/when.js';

import type { EditorMenuButton } from '../toolbar/menu-button';
import type { PaletteGroup } from './framework-palette.js';
import {
  paletteCarouselStyles,
  renderPaletteCarousel,
} from './palette-carousel.js';
import type { PickColorEvent } from './types';
import {
  calcCustomButtonStyle,
  keepColor,
  packColorsWith,
  preprocessColor,
  rgbaToHex8,
} from './utils.js';

type Type = 'normal' | 'custom';

export class EdgelessColorPickerButton extends WithDisposable(LitElement) {
  static override styles = paletteCarouselStyles;

  readonly #select = (e: ColorEvent) => {
    e.stopPropagation();
    this.#pick(e.detail);
  };

  switchToCustomTab = (e: MouseEvent) => {
    e.stopPropagation();

    this.tabType = 'custom';
    // refresh menu's position
    this.menuButton.show(true);
  };

  get colorWithoutAlpha() {
    return keepColor(
      this.color.startsWith('--')
        ? rgbaToHex8(
            preprocessColor(window.getComputedStyle(this))({
              type: 'normal',
              value: this.color,
            }).rgba
          )
        : this.color
    );
  }

  get customButtonStyle() {
    return calcCustomButtonStyle(this.color, this.isCustomColor, this);
  }

  /**
   * The page of {@link paletteGroups} currently on screen — the one the caller
   * asked for until the user pages away from it, and never reset by a re-render
   * (a toolbar rebuilds `paletteGroups` on every update, so reading the prop
   * back would undo the click that moved the carousel).
   */
  get groupIndex(): number {
    if (this.pickedGroupIndex !== undefined) return this.pickedGroupIndex;
    const asked = this.paletteGroups.findIndex(
      group => group.key === this.activeGroupKey
    );
    return asked < 0 ? 0 : asked;
  }

  /**
   * The swatches on screen: the carousel's current page — unless there is no
   * carousel. A single page means no framework offered hues, and then the
   * caller's own {@link palettes} wins: that is how a Wardley node keeps its
   * notation swatches when the Wardley flag is off, its node toolbar being
   * always-on while its palette is not (`docs/adr/0009`).
   */
  get activePalettes(): readonly Palette[] {
    if (this.paletteGroups.length < 2) return this.palettes;
    return this.paletteGroups[this.groupIndex]?.palettes ?? this.palettes;
  }

  /**
   * "Custom" is measured against the UNION of the pages, not the one on screen:
   * a Wardley blue is one of the offered swatches whichever page is showing,
   * and paging to `Default` must not make the element look custom-coloured.
   */
  get isCustomColor() {
    const offered =
      this.paletteGroups.length > 1
        ? this.paletteGroups.flatMap(group => group.palettes)
        : this.palettes;
    return !offered
      .map(({ value }) => resolveColor(value, this.theme))
      .includes(this.color);
  }

  get tabContentPadding() {
    return `${this.tabType === 'custom' ? 0 : 8}px`;
  }

  #pick(detail: Palette) {
    this.pick?.({ type: 'start' });
    this.pick?.({ type: 'pick', detail });
    this.pick?.({ type: 'end' });
  }

  /**
   * A NEW selection re-opens on ITS framework: the page the user paged to
   * belongs to the element they were recolouring, not to the next one. Only a
   * change of {@link activeGroupKey} clears it, so paging survives the
   * re-render the click itself provokes.
   */
  override willUpdate(changed: PropertyValues) {
    if (changed.has('activeGroupKey')) this.pickedGroupIndex = undefined;
  }

  override firstUpdated() {
    this.disposables.addFromEvent(
      this.menuButton,
      'toggle',
      (e: CustomEvent<boolean>) => {
        const opened = e.detail;
        if (!opened && this.tabType !== 'normal') {
          this.tabType = 'normal';
        }
      }
    );
  }

  override render() {
    return html`
      <editor-menu-button
        .contentPadding=${this.tabContentPadding}
        .button=${html`
          <editor-icon-button
            aria-label=${this.label}
            .tooltip=${this.tooltip || this.label}
          >
            ${when(
              this.isText,
              () => html`
                <edgeless-text-color-icon
                  .color=${this.colorWithoutAlpha}
                ></edgeless-text-color-icon>
              `,
              () => html`
                <edgeless-color-button
                  .color=${this.colorWithoutAlpha}
                  .hollowCircle=${this.hollowCircle}
                ></edgeless-color-button>
              `
            )}
          </editor-icon-button>
        `}
      >
        ${choose(this.tabType, [
          [
            'normal',
            () => html`
              <div data-orientation="vertical">
                <slot name="other"></slot>
                <slot name="separator"></slot>
                ${renderPaletteCarousel({
                  groups: this.paletteGroups,
                  index: this.groupIndex,
                  onPage: index => (this.pickedGroupIndex = index),
                  std: this.std,
                })}
                <edgeless-color-panel
                  role="listbox"
                  class=${ifDefined(this.colorPanelClass)}
                  .value=${this.color}
                  .theme=${this.theme}
                  .palettes=${this.activePalettes}
                  .hollowCircle=${this.hollowCircle}
                  .hasTransparent=${false}
                  .std=${this.std}
                  @select=${this.#select}
                >
                  ${when(
                    this.enableCustomColor,
                    () => html`
                      <edgeless-color-custom-button
                        slot="custom"
                        style=${styleMap(this.customButtonStyle)}
                        ?active=${this.isCustomColor}
                        @click=${this.switchToCustomTab}
                      ></edgeless-color-custom-button>
                    `
                  )}
                </edgeless-color-panel>
              </div>
            `,
          ],
          [
            'custom',
            () => {
              const packed = packColorsWith(
                this.theme,
                this.color,
                this.originalColor
              );
              const type = packed.type === 'palette' ? 'normal' : packed.type;
              const modes = packed.colors.map(
                preprocessColor(window.getComputedStyle(this))
              );

              return html`
                <edgeless-color-picker
                  class="custom"
                  .pick=${this.pick}
                  .colors=${{ type, modes }}
                ></edgeless-color-picker>
              `;
            },
          ],
        ])}
      </editor-menu-button>
    `;
  }

  @property()
  accessor originalColor!: Color;

  @property()
  accessor color!: string;

  @property()
  accessor colorPanelClass: string | undefined = undefined;

  @property({ attribute: false })
  accessor hollowCircle: boolean = false;

  @property({ attribute: false })
  accessor isText!: boolean;

  @property()
  accessor label!: string;

  @query('editor-menu-button')
  accessor menuButton!: EditorMenuButton;

  @property({ attribute: false })
  accessor palettes: Palette[] = DefaultTheme.Palettes;

  /**
   * The carousel's pages, base palette first (`docs/adr/0027`). Empty — every
   * call site that has not opted in — falls back to {@link palettes} and draws
   * no header, which is exactly the panel this component rendered before.
   */
  @property({ attribute: false })
  accessor paletteGroups: readonly PaletteGroup[] = [];

  /** The page to open on: the framework of the selected element, usually. */
  @property({ attribute: false })
  accessor activeGroupKey: string | undefined = undefined;

  /**
   * Component state only, never persisted: which page the user paged TO.
   * `undefined` means "still on the one the caller asked for".
   */
  @state()
  accessor pickedGroupIndex: number | undefined = undefined;

  @property({ attribute: false })
  accessor pick!: (event: PickColorEvent) => void;

  /**
   * Optional, forwarded to the nested `edgeless-color-panel` — see
   * `EdgelessColorPanel.std` (`color-panel.ts`) for what it changes.
   */
  @property({ attribute: false })
  accessor std: BlockStdScope | undefined = undefined;

  @state()
  accessor tabType: Type = 'normal';

  @property({ attribute: false })
  accessor theme!: ColorScheme;

  @property()
  accessor tooltip: string | undefined = undefined;

  @property()
  accessor enableCustomColor: boolean = true;
}
