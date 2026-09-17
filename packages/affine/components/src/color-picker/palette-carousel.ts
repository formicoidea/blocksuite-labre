/**
 * The palette header a colour picker draws above its swatch grid when more than
 * one palette is on offer (`docs/adr/0027`): the page's name, opening an inline
 * list of every page IN PLACE of the grid, and a wheel over the panel paging
 * like a carousel.
 *
 * A render helper and a stylesheet rather than a custom element: the two
 * pickers that show it (`edgeless-color-picker-button` and
 * `edgeless-shape-color-picker`) live in different shadow roots and already own
 * their own `render()`, and a third element registered in `effects()` would buy
 * nothing but a tag name.
 *
 * Everything here is driven by `click`, never by a default action.
 * `editor-toolbar` cancels every `pointerdown` in its subtree — popper menus
 * included — to keep the canvas selection and the focus where they are
 * (`toolbar/toolbar.ts`), and a cancelled `pointerdown` suppresses the
 * compatibility `mousedown` whose default action is the only thing that opens a
 * native `<select>`. `click` survives that policy untouched, which is why the
 * list is ours and not the platform's.
 */
import { ColorScheme, resolveColor } from '@labre/affine-model';
import { translateKey } from '@labre/affine-shared/services';
import { unsafeCSSVarV2 } from '@labre/affine-shared/theme';
import type { BlockStdScope } from '@labre/std';
import { ArrowDownSmallIcon, DoneIcon } from '@blocksuite/icons/lit';
import { css, html, nothing, type TemplateResult } from 'lit';

import { PALETTE_GROUP_CHOOSE } from '../translations.js';
import type { PaletteGroup } from './framework-palette.js';

/** Include in the host component's `static styles`. */
export const paletteCarouselStyles = css`
  .palette-carousel {
    display: flex;
    align-self: stretch;
    padding-bottom: 4px;
  }

  .palette-carousel-name {
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    min-width: 0;
    margin: 0;
    padding: 2px 4px 2px 8px;
    border: none;
    border-radius: 4px;
    background: transparent;
    font-family: inherit;
    font-size: var(--affine-font-xs);
    color: ${unsafeCSSVarV2('text/secondary')};
    cursor: pointer;
    outline: none;
  }

  .palette-carousel-name:hover {
    background: var(--affine-hover-color);
  }

  .palette-carousel-name:focus-visible {
    outline: 1px solid var(--affine-primary-color);
    outline-offset: -1px;
  }

  .palette-carousel-name > .label {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .palette-carousel-chevron {
    display: flex;
    flex: 0 0 auto;
    color: ${unsafeCSSVarV2('icon/primary')};
  }

  .palette-carousel-chevron svg {
    width: 12px;
    height: 12px;
  }

  .palette-carousel-list {
    display: flex;
    flex-direction: column;
    align-self: stretch;
    /* Nine pages fit without scrolling; the cap is a seatbelt for a tenth. */
    max-height: 280px;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .palette-carousel-option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    border: none;
    border-radius: 4px;
    background: transparent;
    font-family: inherit;
    font-size: var(--affine-font-sm);
    color: var(--affine-text-primary-color);
    text-align: left;
    white-space: nowrap;
    cursor: pointer;
  }

  .palette-carousel-option:hover {
    background: var(--affine-hover-color);
  }

  .palette-carousel-option:focus-visible {
    outline: 1px solid var(--affine-primary-color);
    outline-offset: -1px;
  }

  .palette-carousel-option[aria-current='true'] {
    color: var(--affine-primary-color);
  }

  .palette-carousel-option > .label {
    flex: 1 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .palette-carousel-dots {
    display: flex;
    flex: 0 0 auto;
    gap: 2px;
  }

  .palette-carousel-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    box-sizing: border-box;
    border: 0.5px solid ${unsafeCSSVarV2('layer/insideBorder/blackBorder')};
  }

  .palette-carousel-tick {
    display: flex;
    flex: 0 0 auto;
    color: inherit;
  }

  .palette-carousel-tick svg {
    width: 16px;
    height: 16px;
  }
`;

/**
 * One page per wheel burst. A trackpad fires a dozen events for a single flick
 * and nine pages would spin past; a module-level stamp is enough because only
 * one picker is ever open.
 */
const WHEEL_THROTTLE_MS = 200;
let lastWheelPageAt = 0;

/** How many swatches of a page are shown beside its name, for recognition. */
const PREVIEW_DOTS = 5;

type CarouselOptions = {
  groups: readonly PaletteGroup[];
  index: number;
  onPage: (index: number) => void;
  /** Whether the inline list of pages is showing instead of the swatch grid. */
  open?: boolean;
};

/**
 * The wheel handler each host binds on its own PANEL container — the header and
 * the swatch grids alike, because "the mouse has to be on the name" was the
 * second half of the recette's failure.
 *
 * Wrap-around in both directions: the pages are a ring, not a list, and the
 * base palette is always one of them.
 */
export function paletteCarouselWheel(
  options: CarouselOptions
): (e: WheelEvent) => void {
  const { groups, index, onPage, open } = options;
  return (e: WheelEvent) => {
    if (groups.length < 2) return;
    // ctrl+wheel is the pinch-zoom gesture the edgeless board claims on
    // `document` in capture (`edgeless/utils/pinch-zoom.ts`) — not ours.
    if (e.ctrlKey) return;
    // While the list is open the wheel belongs to the list, which may scroll.
    if (open) return;
    const delta = e.deltaY || e.deltaX;
    if (!delta) return;
    // Neither the canvas nor the page moves under an open picker.
    e.preventDefault();
    e.stopPropagation();
    const now = Date.now();
    if (now - lastWheelPageAt < WHEEL_THROTTLE_MS) return;
    lastWheelPageAt = now;
    onPage((index + (delta > 0 ? 1 : -1) + groups.length) % groups.length);
  };
}

const dots = (group: PaletteGroup, theme: ColorScheme) =>
  group.palettes.slice(0, PREVIEW_DOTS).map(palette => {
    const value = resolveColor(palette.value, theme);
    return html`<span
      class="palette-carousel-dot"
      style="background:${value.startsWith('--') ? `var(${value})` : value}"
    ></span>`;
  });

/**
 * The header row — and, when {@link CarouselOptions.open} is set, the list of
 * pages the host draws INSTEAD of its swatch grid. `nothing` when there is
 * nothing to page through, which is what every call site that passes no groups
 * at all gets, so a picker with one palette renders exactly as it did before
 * this existed.
 */
export function renderPaletteCarousel(
  options: CarouselOptions & {
    onToggle: (open: boolean) => void;
    std?: BlockStdScope;
    theme?: ColorScheme;
  }
): TemplateResult | typeof nothing {
  const { groups, index, onPage, onToggle, open = false, std, theme } = options;
  if (groups.length < 2) return nothing;

  const group = groups[index];
  if (!group) return nothing;

  const choose = std
    ? translateKey(std, ...PALETTE_GROUP_CHOOSE)
    : PALETTE_GROUP_CHOOSE[1];

  // Every handler below stops the click: the header lives inside an open
  // popper, and `createButtonPopper` hides the menu on any document click whose
  // composed path misses the TRIGGER (`button-popper.ts`).
  const toggle = (e: Event) => {
    e.stopPropagation();
    onToggle(!open);
  };

  const pick = (to: number) => (e: Event) => {
    e.stopPropagation();
    onPage(to);
    onToggle(false);
  };

  // Escape closes the LIST, not the menu: `editor-menu-button` hides the whole
  // popper on an Escape that reaches it, which would be a surprising way out of
  // a list the user only meant to dismiss.
  const keydown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || !open) return;
    e.stopPropagation();
    onToggle(false);
  };

  return html`
    <div class="palette-carousel" @keydown=${keydown}>
      <button
        type="button"
        class="palette-carousel-name"
        aria-label=${choose}
        title=${choose}
        aria-expanded=${open}
        @click=${toggle}
      >
        <span class="label">${group.label}</span>
        <span class="palette-carousel-chevron">${ArrowDownSmallIcon()}</span>
      </button>
    </div>
    ${open
      ? html`
          <div class="palette-carousel-list" @keydown=${keydown}>
            ${groups.map((item, i) => {
              const current = i === index;
              return html`
                <button
                  type="button"
                  class="palette-carousel-option"
                  aria-current=${current ? 'true' : 'false'}
                  @click=${pick(i)}
                >
                  <span class="label">${item.label}</span>
                  <span class="palette-carousel-dots">
                    ${dots(item, theme ?? ColorScheme.Light)}
                  </span>
                  <span class="palette-carousel-tick">
                    ${current ? DoneIcon() : nothing}
                  </span>
                </button>
              `;
            })}
          </div>
        `
      : nothing}
  `;
}
