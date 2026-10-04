import { PAGE_HEADER_HEIGHT } from '@labre/affine-shared/consts';
import { translateKey } from '@labre/affine-shared/services';
import { WithDisposable } from '@labre/global/lit';
import { DoneIcon, SearchIcon } from '@blocksuite/icons/lit';
import type { BlockStdScope } from '@labre/std';
import { stdContext } from '@labre/std';
import { autoPlacement, offset, type Placement, size } from '@floating-ui/dom';
import { consume } from '@lit/context';
import { html, LitElement, nothing } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

import { type AdvancedPortalOptions, createLitPortal } from '../portal';
import { filterableListStyles } from './styles.js';
import { FILTERABLE_LIST_SEARCH_PLACEHOLDER } from '../translations.js';
import type { FilterableListItem, FilterableListOptions } from './types.js';

export * from './types.js';

export class FilterableListComponent<Props = unknown> extends WithDisposable(
  LitElement
) {
  static override styles = filterableListStyles;

  @consume({ context: stdContext })
  accessor std!: BlockStdScope;

  private _buildContent(items: FilterableListItem<Props>[]) {
    return items.map((item, idx) => {
      const focussed = this._curFocusIndex === idx;

      return html`
        <icon-button
          class=${classMap({
            'filterable-item': true,
            focussed,
          })}
          @mouseover=${() => (this._curFocusIndex = idx)}
          @click=${() => this._select(item)}
          hover=${focussed}
          width="100%"
          height="32px"
        >
          ${item.icon ?? nothing} ${item.label ?? item.name}
          <div slot="suffix">
            ${this.options.active?.(item) ? DoneIcon() : nothing}
          </div>
        </icon-button>
      `;
    });
  }

  private _filterItems() {
    const query = this._filterText.toLowerCase();
    // A copy: the caller's array is its own state (the language button keeps
    // its most-recently-used order in it), so sorting must not reorder it.
    const ranked = this.options.items
      .map(item => ({ item, rank: matchRank(item, query) }))
      .filter(entry => entry.rank !== -1);
    return ranked
      .sort((a, b) => {
        const isActiveA = this.options.active?.(a.item);
        const isActiveB = this.options.active?.(b.item);

        if (isActiveA && !isActiveB) return -1;
        if (!isActiveA && isActiveB) return 1;
        if (a.rank !== b.rank) return a.rank - b.rank;

        return this.listFilter?.(a.item, b.item) ?? 0;
      })
      .map(entry => entry.item);
  }

  private _scrollFocusedItemIntoView() {
    this.updateComplete
      .then(() => {
        this._focussedItem?.scrollIntoView({
          block: 'nearest',
          inline: 'start',
        });
      })
      .catch(console.error);
  }

  private _select(item: FilterableListItem) {
    this.abortController?.abort();
    this.options.onSelect(item);
  }

  override connectedCallback() {
    super.connectedCallback();
    requestAnimationFrame(() => {
      this._filterInput.focus();
    });
  }

  override render() {
    const filteredItems = this._filterItems();
    const content = this._buildContent(filteredItems);
    const isFlip = !!this.placement?.startsWith('top');

    const _handleInputKeydown = (ev: KeyboardEvent) => {
      ev.stopPropagation();
      switch (ev.key) {
        case 'ArrowUp': {
          ev.preventDefault();
          this._curFocusIndex =
            (this._curFocusIndex + content.length - 1) % content.length;
          this._scrollFocusedItemIntoView();
          break;
        }
        case 'ArrowDown': {
          ev.preventDefault();
          this._curFocusIndex = (this._curFocusIndex + 1) % content.length;
          this._scrollFocusedItemIntoView();
          break;
        }
        case 'Enter': {
          if (ev.isComposing) break;
          ev.preventDefault();
          const item = filteredItems[this._curFocusIndex];
          if (!item) return;
          this._select(item);
          break;
        }
        case 'Escape': {
          ev.preventDefault();
          this.abortController?.abort();
          break;
        }
      }
    };

    return html`
      <div
        class=${classMap({ 'affine-filterable-list': true, flipped: isFlip })}
      >
        <div class="input-wrapper">
          ${SearchIcon()}
          <input
            id="filter-input"
            type="text"
            placeholder=${this.options?.placeholder ??
            (this.std
              ? translateKey(this.std, ...FILTERABLE_LIST_SEARCH_PLACEHOLDER)
              : FILTERABLE_LIST_SEARCH_PLACEHOLDER[1])}
            @input="${() => {
              this._filterText = this._filterInput?.value;
              this._curFocusIndex = 0;
            }}"
            @keydown="${_handleInputKeydown}"
          />
        </div>

        <editor-toolbar-separator
          data-orientation="horizontal"
        ></editor-toolbar-separator>
        <div class="items-container">${content}</div>
      </div>
    `;
  }

  @state()
  private accessor _curFocusIndex = 0;

  @query('#filter-input')
  private accessor _filterInput!: HTMLInputElement;

  @state()
  private accessor _filterText = '';

  @query('.filterable-item.focussed')
  private accessor _focussedItem!: HTMLElement | null;

  @property({ attribute: false })
  accessor abortController: AbortController | null = null;

  @property({ attribute: false })
  accessor listFilter:
    | ((a: FilterableListItem<Props>, b: FilterableListItem<Props>) => number)
    | undefined = undefined;

  @property({ attribute: false })
  accessor options!: FilterableListOptions<Props>;

  @property({ attribute: false })
  accessor placement: Placement | undefined = undefined;
}

/**
 * Prefix match on both sides lowercased: 0 for a name or alias hit, 1 for a
 * hit on the display label only (it sorts after an id hit), -1 for no match.
 * An empty query matches everything at rank 0.
 */
function matchRank(item: FilterableListItem<unknown>, query: string): number {
  if (!query) return 0;
  const hits = (value: string | undefined) =>
    !!value && value.toLowerCase().startsWith(query);
  if (hits(item.name) || item.aliases?.some(hits)) return 0;
  if (hits(item.label)) return 1;
  return -1;
}

export function showPopFilterableList({
  options,
  filter,
  abortController = new AbortController(),
  referenceElement,
  container,
  maxHeight = 440,
  portalStyles,
}: {
  options: FilterableListComponent['options'];
  referenceElement: Element;
  container?: Element;
  abortController?: AbortController;
  filter?: FilterableListComponent['listFilter'];
  maxHeight?: number;
  portalStyles?: AdvancedPortalOptions['portalStyles'];
}) {
  const portalPadding = {
    top: PAGE_HEADER_HEIGHT + 12,
    bottom: 12,
  } as const;

  const list = new FilterableListComponent();
  list.options = options;
  list.listFilter = filter;
  list.abortController = abortController;

  createLitPortal({
    closeOnClickAway: true,
    template: ({ positionSlot }) => {
      positionSlot.subscribe(({ placement }) => {
        list.placement = placement;
      });

      return list;
    },
    container,
    portalStyles,
    computePosition: {
      referenceElement,
      placement: 'bottom-start',
      middleware: [
        offset(4),
        autoPlacement({
          allowedPlacements: ['top-start', 'bottom-start'],
          padding: portalPadding,
        }),
        size({
          padding: portalPadding,
          apply({ availableHeight, elements, placement }) {
            Object.assign(elements.floating.style, {
              height: '100%',
              maxHeight: `${Math.min(maxHeight, availableHeight)}px`,
              pointerEvents: 'none',
              ...(placement.startsWith('top')
                ? {
                    display: 'flex',
                    alignItems: 'flex-end',
                  }
                : {
                    display: null,
                    alignItems: null,
                  }),
            });
          },
        }),
      ],
      autoUpdate: {
        // fix the lang list position incorrectly when scrolling
        animationFrame: true,
      },
    },
    abortController,
  });
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-filterable-list': FilterableListComponent;
  }
}
