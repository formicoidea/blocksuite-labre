import {
  type PaletteCarouselDirection,
  paletteCarouselPage,
  paletteCarouselStyles,
  paletteCarouselWheel,
  type PaletteGroup,
  renderPaletteCarousel,
} from '@labre/affine-components/color-picker';
import { ColorScheme } from '@labre/affine-model';
import type { BlockStdScope } from '@labre/std';
import { css, html, LitElement, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';

/**
 * The database colour grid when it has more than one page (ADR 0036
 * amendment of 2026-10-14, "framework pages"): the canvas carousel's own
 * header, list and page (`renderPaletteCarousel`, `paletteCarouselPage`,
 * ADR 0027) above the same `<edgeless-color-panel>` a single page shows.
 *
 * An element, not a render helper as on the canvas: a menu entry is a
 * function the menu calls again on every render, so the page on screen and
 * the open list need a home that outlives one call. Nothing here is
 * persisted; a pick bubbles as the panel's own `select` event.
 */
export class DataViewColorCarousel extends LitElement {
  static override styles = [
    paletteCarouselStyles,
    css`
      :host {
        display: block;
      }

      .dv-color-carousel {
        display: flex;
        flex-direction: column;
        padding: 4px;
      }
    `,
  ];

  /** The page on screen: the one the user paged to, else the current colour's. */
  get pageIndex(): number {
    if (this.pickedIndex !== undefined) return this.pickedIndex;
    const holding = this.groups.findIndex(group =>
      group.palettes.some(palette => palette.value === this.current)
    );
    return Math.max(holding, 0);
  }

  private _refocusHeader = false;

  private readonly _page = (
    index: number,
    direction: PaletteCarouselDirection
  ) => {
    this.pickedIndex = index;
    this.direction = direction;
  };

  /**
   * Closing the list removes the button that had the focus; the keyboard
   * path goes on from the header, one Tab away from the new page's grid.
   */
  private readonly _toggle = (open: boolean) => {
    this._refocusHeader =
      !open && this.listOpen && !!this.shadowRoot?.activeElement;
    this.listOpen = open;
  };

  override updated() {
    if (!this._refocusHeader) return;
    this._refocusHeader = false;
    this.renderRoot
      .querySelector<HTMLElement>('.palette-carousel-name')
      ?.focus();
  }

  override render() {
    const { groups, listOpen, direction } = this;
    const index = this.pageIndex;
    const page = groups[index];
    if (!page) return nothing;
    return html`<div
      class="dv-color-carousel"
      data-orientation="vertical"
      @wheel=${paletteCarouselWheel({
        groups,
        index,
        onPage: this._page,
        open: listOpen,
      })}
    >
      ${renderPaletteCarousel({
        groups,
        index,
        onPage: this._page,
        onToggle: this._toggle,
        open: listOpen,
        direction,
        std: this.std,
        theme: ColorScheme.Light,
      })}
      ${listOpen
        ? nothing
        : paletteCarouselPage(
            { groups, index, direction },
            html`<edgeless-color-panel
              data-testid="dv-color-grid"
              .palettes=${page.palettes}
              .value=${this.current}
              .theme=${ColorScheme.Light}
              .columns=${5}
            ></edgeless-color-panel>`
          )}
    </div>`;
  }

  @property({ attribute: false })
  accessor current: string | null = null;

  @state()
  accessor direction: PaletteCarouselDirection = 'settle';

  /** The pages, the ten chip colours first (`selectOptionColorPages`). */
  @property({ attribute: false })
  accessor groups: readonly PaletteGroup[] = [];

  @state()
  accessor listOpen = false;

  @state()
  accessor pickedIndex: number | undefined = undefined;

  /** Only for the header's own wording ("Choose a palette"). */
  @property({ attribute: false })
  accessor std: BlockStdScope | undefined = undefined;
}

declare global {
  interface HTMLElementTagNameMap {
    'dv-color-carousel': DataViewColorCarousel;
  }
}
