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
 *
 * The header is the PANEL'S TITLE, not a bar bolted on top of it: a compact,
 * content-width trigger whose name starts on the very x the section labels
 * ("Fill color", "Border color") and the swatch grid start on. Its hit area
 * comes from padding cancelled by an equal negative margin, so the hover pill
 * bleeds outward while the text itself stays on the panel's left grid line.
 */
import { ColorScheme, resolveColor } from '@labre/affine-model';
import { translateKey } from '@labre/affine-shared/services';
import {
  reducedMotionStyle,
  springDuration,
  springEasing,
} from '@labre/affine-shared/styles';
import { unsafeCSSVarV2 } from '@labre/affine-shared/theme';
import type { BlockStdScope } from '@labre/std';
import { ArrowDownSmallIcon, DoneIcon } from '@blocksuite/icons/lit';
import { css, html, nothing, type TemplateResult } from 'lit';
import { keyed } from 'lit/directives/keyed.js';

import { PALETTE_GROUP_CHOOSE } from '../translations.js';
import type { PaletteGroup } from './framework-palette.js';

/** Include in the host component's `static styles`. */
export const paletteCarouselStyles = css`
  .palette-carousel {
    display: flex;
    align-items: center;
    align-self: stretch;
    padding-bottom: 4px;
  }

  .palette-carousel-name {
    display: inline-flex;
    /* Content width, not the panel's: a title, not a bar. */
    flex: 0 0 auto;
    align-items: center;
    gap: 2px;
    max-width: 100%;
    min-width: 0;
    /* The hover pill bleeds out by exactly what the padding pushed in, so the
     * name starts on the same x as "Fill color" and as the swatch grid. */
    /* 4px, not the popup's whole 8px gutter: the pill keeps a 4px gap to the popup
     * edge, so its 4px radius stays concentric with the popup's 8px corner. */
    margin: -2px -4px;
    padding: 2px 4px;
    border: none;
    border-radius: 4px;
    background: transparent;
    /* The panel's own type, one step stronger: this names the whole panel. */
    font-family: inherit;
    font-size: inherit;
    font-weight: 500;
    line-height: 22px;
    color: ${unsafeCSSVarV2('text/primary')};
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
    /* The name travels with the swatches it names — same keys, same curve. */
    animation: palette-carousel-settle ${springDuration} ${springEasing};
  }

  .palette-carousel-name > .label[data-direction='next'] {
    animation-name: palette-carousel-next;
  }

  .palette-carousel-name > .label[data-direction='prev'] {
    animation-name: palette-carousel-prev;
  }

  .palette-carousel-chevron {
    display: flex;
    flex: 0 0 auto;
    color: ${unsafeCSSVarV2('icon/primary')};
    transition: transform ${springDuration} ${springEasing};
  }

  .palette-carousel-chevron svg {
    width: 16px;
    height: 16px;
  }

  .palette-carousel-name[aria-expanded='true'] .palette-carousel-chevron {
    transform: rotate(180deg);
  }

  .palette-carousel-list {
    display: flex;
    flex-direction: column;
    align-self: stretch;
    box-sizing: content-box;
    /* As wide as whatever it stands in for — the panel measures itself on the
     * way in, see rememberPanelWidth — plus the two gutters its rows bleed
     * into, so the popup never resizes under the cursor. The fallback is the
     * 9-column swatch grid (9 × 20px + 8 × 4px). */
    min-width: calc(var(--palette-panel-width, 212px) + 8px);
    /* Full-bleed rows: the list reaches the popup's padding edge, and its rows
     * put their names back on the panel's grid line with their own padding. */
    margin: 0 -4px;
    /* Nine pages fit without scrolling; the cap is a seatbelt for a tenth. */
    max-height: 280px;
    overflow-y: auto;
    /* Same trap as the popup box that holds this list (issue #392, see
     * toolbar/menu-button.ts): an overflow-y of its own makes the other axis
     * scrollable too, and this list is one long page name — a translation, or
     * a tenth page — away from overflowing it. */
    overflow-x: hidden;
    overscroll-behavior: contain;
    animation: palette-carousel-settle ${springDuration} ${springEasing};
  }

  .palette-carousel-option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px;
    border: none;
    border-radius: 4px;
    background: transparent;
    font-family: inherit;
    font-size: inherit;
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
    /* Always the same slot, ticked or not, so the dots line up down the list. */
    flex: 0 0 16px;
    height: 16px;
    color: inherit;
  }

  .palette-carousel-tick svg {
    width: 16px;
    height: 16px;
  }

  /* The swatches of ONE page. Re-keyed on the page index, so a page change
   * builds a new box and its entry animation starts from scratch — a burst of
   * wheel events never queues, it replaces. */
  .palette-carousel-page {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    animation: palette-carousel-settle ${springDuration} ${springEasing};
  }

  .palette-carousel-page[data-direction='next'] {
    animation-name: palette-carousel-next;
  }

  .palette-carousel-page[data-direction='prev'] {
    animation-name: palette-carousel-prev;
  }

  /* The easing overshoots (easeOutBack), so each of these travels a little
   * past its resting place and springs back — the "elastic" of the recette. */
  @keyframes palette-carousel-next {
    from {
      transform: translateX(14px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes palette-carousel-prev {
    from {
      transform: translateX(-14px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes palette-carousel-settle {
    from {
      transform: scale(0.97);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  ${reducedMotionStyle('.palette-carousel')}
  ${reducedMotionStyle('.palette-carousel-list')}
  ${reducedMotionStyle('.palette-carousel-page')}
`;

/**
 * One page per wheel GESTURE, not per time slice. A trackpad flick streams
 * events for a second or more (the inertia tail), so a fixed throttle paged
 * four or five times per flick. A gesture ends when the wheel has been quiet
 * for {@link WHEEL_QUIET_MS}; within one, a further page is granted only to a
 * deliberate, still-strong scroll — never to the fading tail. Module-level
 * stamps are enough because only one picker is ever open.
 *
 * ponytail: hand-tuned thresholds; if they need per-device tuning, accumulate
 * delta into page-sized steps instead.
 */
const WHEEL_QUIET_MS = 160;
const WHEEL_REPEAT_MS = 650;
const WHEEL_REPEAT_MIN_DELTA = 40;
let lastWheelEventAt = 0;
let lastWheelPageAt = 0;

/** How many swatches of a page are shown beside its name, for recognition. */
const PREVIEW_DOTS = 5;

/**
 * Where the new page comes FROM. `settle` is "from nowhere in particular": the
 * first paint of a panel, and the list closing on the page it opened on.
 */
export type PaletteCarouselDirection = 'next' | 'prev' | 'settle';

type CarouselOptions = {
  groups: readonly PaletteGroup[];
  index: number;
  onPage: (index: number, direction: PaletteCarouselDirection) => void;
  /** Whether the inline list of pages is showing instead of the swatch grid. */
  open?: boolean;
  /** Where the page on screen came from, for the entry animation. */
  direction?: PaletteCarouselDirection;
};

/**
 * The wheel handler each host binds on its own PANEL container — the header and
 * the swatch grids alike, because "the mouse has to be on the name" was the
 * second half of the recette's failure.
 *
 * Wrap-around in both directions: the pages are a ring, not a list, and the
 * base palette is always one of them. The direction is the wheel's own sign,
 * never the index delta, so wrapping from the last page to the first still
 * comes in from the right.
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
    const newGesture = now - lastWheelEventAt > WHEEL_QUIET_MS;
    lastWheelEventAt = now;
    const sustained =
      now - lastWheelPageAt > WHEEL_REPEAT_MS &&
      Math.abs(delta) >= WHEEL_REPEAT_MIN_DELTA;
    if (!newGesture && !sustained) return;
    lastWheelPageAt = now;
    const forward = delta > 0;
    onPage(
      (index + (forward ? 1 : -1) + groups.length) % groups.length,
      forward ? 'next' : 'prev'
    );
  };
}

/**
 * The swatches of the page on screen, wrapped so that paging slides them in.
 * The host passes its own grid (both of them, in the shape picker, each in its
 * own wrapper — same key, same timing, so the two move together).
 *
 * `keyed` is the whole mechanism: the wrapper is torn down and rebuilt on a
 * page change, which restarts the CSS animation and, by the same token, cancels
 * the one in flight. No JS animation, nothing to queue, and the swatches stay
 * clickable throughout (a CSS animation never takes the pointer).
 */
export function paletteCarouselPage(
  options: {
    groups: readonly PaletteGroup[];
    index: number;
    direction?: PaletteCarouselDirection;
  },
  content: TemplateResult
) {
  const { groups, index, direction = 'settle' } = options;
  // No carousel, no page: the grid of a picker with a single palette keeps the
  // exact DOM it had before any of this existed.
  if (groups.length < 2) return content;
  return keyed(
    index,
    html`<div class="palette-carousel-page" data-direction=${direction}>
      ${content}
    </div>`
  );
}

/**
 * The popup must not resize under the cursor when the list takes the grid's
 * place, and a list has no way to know how wide the thing it replaces was — so
 * the panel is measured on the way IN and hands the number down as a custom
 * property. Read from the header's own container, which is the flex column the
 * grid, the section labels and the list all share.
 */
function rememberPanelWidth(trigger: HTMLElement) {
  const panel = trigger.closest<HTMLElement>('[data-orientation]');
  if (!panel) return;
  const { width } = panel.getBoundingClientRect();
  if (width > 0) panel.style.setProperty('--palette-panel-width', `${width}px`);
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
  const {
    groups,
    index,
    onPage,
    onToggle,
    open = false,
    direction = 'settle',
    std,
    theme,
  } = options;
  if (groups.length < 2) return nothing;

  const group = groups[index];
  if (!group) return nothing;

  const choose = std
    ? translateKey(std, ...PALETTE_GROUP_CHOOSE)
    : PALETTE_GROUP_CHOOSE[1];

  // Every handler below stops the click: the header lives inside an open
  // popper, and `createButtonPopper` hides the menu on any document click whose
  // composed path misses the TRIGGER (`button-popper.ts`).
  //
  // Closing the list re-states the page it was opened on, which changes no
  // page at all and only clears the direction: the grid comes back where it
  // left, without replaying the slide of the last page change.
  const toggle = (e: Event) => {
    e.stopPropagation();
    if (open) onPage(index, 'settle');
    else rememberPanelWidth(e.currentTarget as HTMLElement);
    onToggle(!open);
  };

  const pick = (to: number) => (e: Event) => {
    e.stopPropagation();
    // A row names its page, so here the index delta IS the direction.
    onPage(to, to === index ? 'settle' : to > index ? 'next' : 'prev');
    onToggle(false);
  };

  // Escape closes the LIST, not the menu: `editor-menu-button` hides the whole
  // popper on an Escape that reaches it, which would be a surprising way out of
  // a list the user only meant to dismiss.
  const keydown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || !open) return;
    e.stopPropagation();
    onPage(index, 'settle');
    onToggle(false);
  };

  return html`
    <div class="palette-carousel" @keydown=${keydown}>
      <button
        type="button"
        class="palette-carousel-name"
        aria-label=${choose}
        aria-expanded=${open}
        @click=${toggle}
      >
        ${keyed(
          index,
          html`<span class="label" data-direction=${direction}
            >${group.label}</span
          >`
        )}
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
