/**
 * The `‹ Label ›` header row a colour picker draws above its swatch grid when
 * more than one palette is on offer (`docs/adr/0027`).
 *
 * A render helper and a stylesheet rather than a custom element: the two
 * pickers that show it (`edgeless-color-picker-button` and
 * `edgeless-shape-color-picker`) live in different shadow roots and already own
 * their own `render()`, and a third element registered in `effects()` would buy
 * nothing but a tag name.
 */
import { translateKey } from '@labre/affine-shared/services';
import { unsafeCSSVarV2 } from '@labre/affine-shared/theme';
import type { BlockStdScope } from '@labre/std';
import { ArrowLeftSmallIcon, ArrowRightSmallIcon } from '@blocksuite/icons/lit';
import { css, html, nothing, type TemplateResult } from 'lit';

import { PALETTE_GROUP_NEXT, PALETTE_GROUP_PREVIOUS } from '../translations.js';
import type { PaletteGroup } from './framework-palette.js';

/** Include in the host component's `static styles`. */
export const paletteCarouselStyles = css`
  .palette-carousel {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    align-self: stretch;
    padding-bottom: 4px;
  }

  .palette-carousel-name {
    flex: 1;
    text-align: center;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: var(--affine-font-xs);
    color: ${unsafeCSSVarV2('text/secondary')};
  }

  .palette-carousel-nav {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: ${unsafeCSSVarV2('icon/primary')};
    cursor: pointer;
  }

  .palette-carousel-nav:hover {
    background: var(--affine-hover-color);
  }

  .palette-carousel-nav svg {
    width: 16px;
    height: 16px;
  }
`;

/**
 * The header row, or `nothing` when there is nothing to page through — which
 * is what every call site that passes no groups at all gets, so a picker with
 * one palette renders exactly as it did before this existed.
 *
 * Wrap-around in both directions: three pages are a ring, not a list, and the
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

  const step = (delta: number) => (e: MouseEvent) => {
    // The header lives inside an open menu; paging must not close it.
    e.stopPropagation();
    onPage((index + delta + groups.length) % groups.length);
  };

  const previousLabel = std
    ? translateKey(std, ...PALETTE_GROUP_PREVIOUS)
    : PALETTE_GROUP_PREVIOUS[1];
  const nextLabel = std
    ? translateKey(std, ...PALETTE_GROUP_NEXT)
    : PALETTE_GROUP_NEXT[1];

  return html`
    <div class="palette-carousel">
      <button
        class="palette-carousel-nav"
        type="button"
        aria-label=${previousLabel}
        title=${previousLabel}
        @click=${step(-1)}
      >
        ${ArrowLeftSmallIcon()}
      </button>
      <span class="palette-carousel-name">${group.label}</span>
      <button
        class="palette-carousel-nav"
        type="button"
        aria-label=${nextLabel}
        title=${nextLabel}
        @click=${step(1)}
      >
        ${ArrowRightSmallIcon()}
      </button>
    </div>
  `;
}
