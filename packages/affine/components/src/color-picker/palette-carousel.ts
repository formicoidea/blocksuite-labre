/**
 * The palette header a colour picker draws above its swatch grid when more than
 * one palette is on offer (`docs/adr/0027`): the page's name, opening a
 * drop-down of every page, and a wheel over it still pages like a carousel.
 *
 * A render helper and a stylesheet rather than a custom element: the two
 * pickers that show it (`edgeless-color-picker-button` and
 * `edgeless-shape-color-picker`) live in different shadow roots and already own
 * their own `render()`, and a third element registered in `effects()` would buy
 * nothing but a tag name.
 */
import { translateKey } from '@labre/affine-shared/services';
import { unsafeCSSVarV2 } from '@labre/affine-shared/theme';
import { stopPropagation } from '@labre/affine-shared/utils';
import type { BlockStdScope } from '@labre/std';
import { ArrowDownSmallIcon } from '@blocksuite/icons/lit';
import { css, html, nothing, type TemplateResult } from 'lit';

import { PALETTE_GROUP_CHOOSE } from '../translations.js';
import type { PaletteGroup } from './framework-palette.js';

/** Include in the host component's `static styles`. */
export const paletteCarouselStyles = css`
  .palette-carousel {
    display: flex;
    align-items: center;
    justify-content: center;
    align-self: stretch;
    padding-bottom: 4px;
  }

  .palette-carousel-picker {
    position: relative;
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    border-radius: 4px;
    color: ${unsafeCSSVarV2('icon/primary')};
  }

  .palette-carousel-picker:hover {
    background: var(--affine-hover-color);
  }

  .palette-carousel-name {
    appearance: none;
    -webkit-appearance: none;
    max-width: 100%;
    margin: 0;
    padding: 2px 20px;
    border: none;
    border-radius: 4px;
    background: transparent;
    font-family: inherit;
    font-size: var(--affine-font-xs);
    color: ${unsafeCSSVarV2('text/secondary')};
    text-align: center;
    text-align-last: center;
    cursor: pointer;
    outline: none;
  }

  .palette-carousel-name:focus-visible {
    outline: 1px solid var(--affine-primary-color);
    outline-offset: -1px;
  }

  .palette-carousel-chevron {
    position: absolute;
    right: 4px;
    display: flex;
    /* The chevron sits in the select's own right padding: a click on it is a
       click on the select, which is the only thing that opens the list. */
    pointer-events: none;
  }

  .palette-carousel-chevron svg {
    width: 12px;
    height: 12px;
  }
`;

/**
 * One page per wheel burst. A trackpad fires a dozen events for a single flick
 * and nine pages would spin past; a module-level stamp is enough because only
 * one picker is ever open.
 */
const WHEEL_THROTTLE_MS = 200;
let lastWheelPageAt = 0;

/**
 * The header row, or `nothing` when there is nothing to page through — which
 * is what every call site that passes no groups at all gets, so a picker with
 * one palette renders exactly as it did before this existed.
 *
 * Wrap-around in both directions: the pages are a ring, not a list, and the
 * base palette is always one of them.
 */
export function renderPaletteCarousel(options: {
  groups: readonly PaletteGroup[];
  index: number;
  onPage: (index: number) => void;
  std?: BlockStdScope;
}): TemplateResult | typeof nothing {
  const { groups, index, onPage, std } = options;
  if (groups.length < 2) return nothing;

  const group = groups[index];
  if (!group) return nothing;

  const choose = std
    ? translateKey(std, ...PALETTE_GROUP_CHOOSE)
    : PALETTE_GROUP_CHOOSE[1];

  const select = (e: Event) => {
    // The header lives inside an open menu; choosing must not close it.
    e.stopPropagation();
    const target = e.target as HTMLSelectElement;
    onPage(Number(target.value));
  };

  const wheel = (e: WheelEvent) => {
    // ctrl+wheel is the pinch-zoom gesture the edgeless board claims on
    // `document` in capture (`edgeless/utils/pinch-zoom.ts`) — not ours.
    if (e.ctrlKey) return;
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

  // ponytail: a native `<select>`, so the option list is the OS's own — no
  // branded rows, no icons, no swatch preview beside a page name. The upgrade
  // path is the repo's own menu component, at the price of a popover nested
  // inside the popper menu (and of re-earning the keyboard and the a11y tree
  // the platform hands us here for free).
  return html`
    <div class="palette-carousel" @wheel=${wheel}>
      <div class="palette-carousel-picker">
        <select
          class="palette-carousel-name"
          aria-label=${choose}
          title=${choose}
          @click=${stopPropagation}
          @keydown=${stopPropagation}
          @change=${select}
        >
          ${groups.map(
            (item, i) => html`
              <option value=${i} .selected=${i === index}>${item.label}</option>
            `
          )}
        </select>
        <span class="palette-carousel-chevron">${ArrowDownSmallIcon()}</span>
      </div>
    </div>
  `;
}
