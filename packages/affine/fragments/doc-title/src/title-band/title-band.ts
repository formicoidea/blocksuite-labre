import { RefNodeSlotsProvider } from '@labre/affine-inline-reference';
import {
  DOC_UNTITLED,
  FeatureFlagService,
  formatLocale,
  PropertiesPanelProvider,
  type TitleBandNotShownPage,
  type TitleBandProperty,
  TitleBandProvider,
  type TitleBandService,
  type TitleBandSheetState,
  translateKey,
} from '@labre/affine-shared/services';
import { stopPropagation } from '@labre/affine-shared/utils';
import {
  type Cell,
  createStandaloneCell,
  type DatabaseFlags,
  type StandaloneCellHost,
  StandaloneCellMetaProvider,
} from '@labre/data-view';
import { SignalWatcher, WithDisposable } from '@labre/global/lit';
import { type BlockStdScope, ShadowlessElement } from '@labre/std';
import {
  LinkedPageIcon,
  PlusIcon,
  SidebarIcon,
  ToggleDownIcon,
  ToggleRightIcon,
} from '@blocksuite/icons/lit';
import { computed, type ReadonlySignal, signal } from '@preact/signals-core';
import { css, html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';

import {
  TITLE_BAND_ADD,
  TITLE_BAND_COLLAPSE,
  TITLE_BAND_EMPTY,
  TITLE_BAND_EXPAND,
  TITLE_BAND_LABEL,
  TITLE_BAND_LOADING,
  TITLE_BAND_NOT_SHOWN,
  TITLE_BAND_OPEN_PANEL,
  TITLE_BAND_SHOW_HERE,
} from '../translations.js';
import {
  bandCellData,
  bandCellMeta,
  bandCellValue,
  bandWriteValue,
  isBandReadonlyType,
  sameBandValue,
} from './band-cell.js';
import { formatPropertyValue, isPropertyValueEmpty } from './format.js';
import { showPageHere } from './show-here.js';

export const LABRE_TITLE_BAND = 'labre-title-band';

const NO_PAGES: readonly TitleBandNotShownPage[] = [];

/** The host's signals for one document, asked once per (service, document). */
interface BandSources {
  service: TitleBandService;
  docId: string;
  sheet$: ReadonlySignal<TitleBandSheetState>;
  collapsed$: ReadonlySignal<boolean> | null;
  notShown$: ReadonlySignal<readonly TitleBandNotShownPage[]> | null;
  /** One cell per chip, kept across sheet updates so an open editor stays. */
  cells: Map<string, { type: string; cell: Cell }>;
}

/**
 * The band of property chips under the page title and at the head of the
 * page's note on the canvas (ADR 0035 §11, REQ-PR-1 and PR-7).
 *
 * One component for both views: `<doc-title>` mounts it under the title
 * (`surface="page"`), `edgeless-page-block-title` at the head of the page's
 * note (`surface="canvas"`). On the canvas it sits inside the note's own DOM,
 * so it follows the zoom like the rest of the note (REQ-PR-7), and it is
 * interactive when the note is, i.e. once the note is being edited.
 *
 * Fed by `TitleBandProvider` alone (§9d): no provider, nothing at all. The
 * chips are the sheet's visible properties in the host's order, an empty one
 * included (REQ-PR-1). Each value is drawn and edited by the cell the inline
 * table mounts for its data-view type (`<dv-standalone-cell>`, ADR 0035
 * §11 amended 2026-10-13): the checkbox, the tag menu of a select, the date
 * picker, the number, text and link inputs, with the table's own styles. The
 * value the cell commits goes back through `set`, the chip shows pending
 * until the host settles it, and a type with no cell keeps a plain-text
 * reading that opens the properties panel. The band never applies a value, and writes to
 * the document only the card "Show here" inserts. The "+" is drawn when the
 * host passes `add`; the panel button when a `PropertiesPanelProvider` is
 * registered. The "Not shown on this page" row is drawn in both views
 * from the host's `notShown$` (ADR 0035 §9d, amended 2026-10-13): each page
 * opens through the linked-document path, and "Show here" inserts a card of
 * it into this document; the host then drops the page from its list.
 */
export class TitleBand extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  static override styles = css`
    labre-title-band {
      display: block;
    }

    .labre-title-band {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-family: var(--affine-font-family);
      font-size: var(--affine-font-sm);
      line-height: 20px;
      color: var(--affine-text-primary-color);
    }

    .labre-title-band[data-surface='canvas'] {
      padding-bottom: 12px;
    }

    .labre-title-band-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px;
      min-height: 28px;
    }

    .labre-title-band button {
      all: unset;
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 28px;
      max-width: 100%;
      padding: 0 8px;
      border-radius: 6px;
      cursor: pointer;
      color: inherit;
      transition: background-color 150ms;
    }

    .labre-title-band button:hover {
      background-color: var(--affine-hover-color);
    }

    .labre-title-band button:focus-visible {
      outline: 2px solid var(--affine-primary-color);
      outline-offset: 1px;
    }

    .labre-title-band button[disabled] {
      cursor: progress;
      opacity: 0.6;
    }

    .labre-title-band button.static {
      cursor: default;
    }

    .labre-title-band button.static:hover {
      background-color: transparent;
    }

    .labre-title-band button > svg {
      flex: none;
      width: 16px;
      height: 16px;
    }

    .labre-title-band-icon-button {
      color: var(--affine-icon-color) !important;
      padding: 0 6px !important;
    }

    .labre-title-band-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 28px;
      max-width: 100%;
      padding: 0 8px;
      border-radius: 6px;
      transition: background-color 150ms;
    }

    .labre-title-band-chip[data-clickable='true'] {
      cursor: pointer;
    }

    .labre-title-band-chip[data-clickable='true']:hover {
      background-color: var(--affine-hover-color);
    }

    .labre-title-band-chip[aria-busy='true'] {
      cursor: progress;
      opacity: 0.6;
    }

    .labre-title-band-chip:focus-visible,
    .labre-title-band-chip dv-standalone-cell:focus-visible {
      outline: 2px solid var(--affine-primary-color);
      outline-offset: 1px;
      border-radius: 4px;
    }

    .labre-title-band-chip-name {
      color: var(--affine-text-secondary-color);
      white-space: nowrap;
    }

    /* Room only: what is inside is the cell's own drawing. */
    .labre-title-band-chip-value {
      max-width: 240px;
      overflow: hidden;
    }

    .labre-title-band-chip-text {
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .labre-title-band-chip-text[data-empty='true'] {
      color: var(--affine-placeholder-color);
    }

    .labre-title-band-skeleton {
      display: inline-block;
      width: 96px;
      height: 20px;
      border-radius: 6px;
      background-color: var(--affine-hover-color);
    }

    .labre-title-band-not-shown-label {
      color: var(--affine-text-secondary-color);
      padding-right: 4px;
    }

    /* Layout only: the buttons are the band's own, no drawing of their own. */
    .labre-title-band-not-shown-item {
      display: inline-flex;
      align-items: center;
      max-width: 100%;
    }

    @media (prefers-reduced-motion: reduce) {
      .labre-title-band button,
      .labre-title-band-chip {
        transition: none;
      }
    }

    /* A 44px target under a coarse pointer, without changing the drawing. */
    @media (pointer: coarse) {
      .labre-title-band button,
      .labre-title-band-chip {
        position: relative;
      }
      .labre-title-band button::after,
      .labre-title-band-chip::after {
        content: '';
        position: absolute;
        inset: -8px 0;
      }
    }
  `;

  private _sources: BandSources | null = null;

  /** Collapse state when the host does not remember one. */
  private readonly _localCollapsed$ = signal(false);

  /** Property ids whose `set` has not settled yet. */
  private readonly _pending$ = signal<ReadonlySet<string>>(new Set());

  /** Read inside `render` it subscribes, through `SignalWatcher`. */
  private get _readonly() {
    return this.std?.store.readonly$.value ?? true;
  }

  /** The table's own flags, so a number reads as it does in a cell. */
  private readonly _featureFlags$ = computed<DatabaseFlags>(() => ({
    enable_number_formatting:
      this.std
        ?.getOptional(FeatureFlagService)
        ?.getFlag('enable_database_number_formatting') ?? false,
    enable_table_virtual_scroll: false,
  }));

  private get _locale() {
    return this.std ? formatLocale(this.std) : 'en-US';
  }

  private _t(wording: readonly [string, string], count?: number) {
    if (!this.std) return wording[1];
    return translateKey(
      this.std,
      wording[0],
      wording[1],
      count === undefined ? undefined : { count }
    );
  }

  private _getSources(service: TitleBandService): BandSources {
    const cached = this._sources;
    if (cached && cached.service === service && cached.docId === this.docId) {
      return cached;
    }
    const docId = this.docId;
    const sources: BandSources = {
      service,
      docId,
      sheet$: service.sheet$(docId),
      collapsed$: service.collapsed$?.(docId) ?? null,
      notShown$: service.notShown$?.(docId) ?? null,
      cells: new Map(),
    };
    this._sources = sources;
    return sources;
  }

  private _isCollapsed(sources: BandSources) {
    return sources.collapsed$?.value ?? this._localCollapsed$.value;
  }

  private _setCollapsed(sources: BandSources, collapsed: boolean) {
    this._localCollapsed$.value = collapsed;
    sources.service.setCollapsed?.(sources.docId, collapsed);
  }

  private _write(property: TitleBandProperty, value: unknown) {
    const sources = this._sources;
    if (!sources || property.readonly || this.std?.store.readonly !== false)
      return;
    if (this._pending$.peek().has(property.id)) return;

    const { id } = property;
    const settle = () => {
      const next = new Set(this._pending$.peek());
      next.delete(id);
      this._pending$.value = next;
    };
    this._pending$.value = new Set([...this._pending$.peek(), id]);

    let written: Promise<void>;
    try {
      written = sources.service.set(sources.docId, id, value);
    } catch (error) {
      settle();
      console.error('[title-band] set threw', error);
      return;
    }
    // The host reports and rolls back a refused write; the band only stops
    // showing it as pending.
    Promise.resolve(written).then(settle, (error: unknown) => {
      settle();
      console.error('[title-band] set was refused', error);
    });
  }

  /** A value a cell commits: unchanged, nothing is written. */
  private _commit(prop: TitleBandProperty, cellType: string, value: unknown) {
    if (sameBandValue(cellType, prop.value, value)) return;
    this._write(prop, bandWriteValue(value));
  }

  /** Neither the property nor the document can be written, or the type. */
  private _isReadonlyChip(prop: TitleBandProperty | undefined) {
    return (
      !prop || prop.readonly || this._readonly || isBandReadonlyType(prop.type)
    );
  }

  /**
   * The cell that draws `prop`, built once per property and type: its value,
   * name and config are read from the sheet, so a new sheet updates the cell
   * in place and an editor open in it stays open.
   */
  private _cellFor(sources: BandSources, prop: TitleBandProperty) {
    const std = this.std;
    if (!std) return null;
    const meta = bandCellMeta(prop.type, cellType =>
      std.getOptional(StandaloneCellMetaProvider(cellType))
    );
    if (!meta) return null;
    const cached = sources.cells.get(prop.id);
    if (cached?.type === prop.type) return cached.cell;

    const { id, type } = prop;
    const cellType = meta.type;
    const current$ = computed(() => {
      const state = sources.sheet$.value;
      if (state.status !== 'ready') return undefined;
      return state.properties.find(p => p.id === id && p.type === type);
    });
    const cell = createStandaloneCell(meta, {
      propertyId: id,
      name$: computed(() => current$.value?.name ?? ''),
      data$: computed(() => {
        const current = current$.value;
        return current ? bandCellData(cellType, current) : {};
      }),
      value$: computed(() => bandCellValue(cellType, current$.value?.value)),
      readonly$: computed(() => this._isReadonlyChip(current$.value)),
      valueSet: value => {
        const current = current$.peek();
        if (current) this._commit(current, cellType, value);
      },
      featureFlags$: this._featureFlags$,
      serviceGet: key => std.getOptional(key),
    });
    sources.cells.set(id, { type, cell });
    return cell;
  }

  private readonly _openPanel = () => {
    if (!this.std) return;
    this.std
      .getOptional(PropertiesPanelProvider)
      ?.open({ scope: 'page', docId: this.docId });
  };

  private readonly _onChip = (event: Event, editable: boolean) => {
    event.stopPropagation();
    const chip = event.currentTarget as HTMLElement;
    if (editable) {
      chip.querySelector<StandaloneCellHost>('dv-standalone-cell')?.edit();
      return;
    }
    this._openPanel();
  };

  private _renderFallback(prop: TitleBandProperty) {
    const text = formatPropertyValue(prop, this._locale);
    return html`<span
      class="labre-title-band-chip-value labre-title-band-chip-text"
      data-empty=${text ? 'false' : 'true'}
      >${text || this._t(TITLE_BAND_EMPTY)}</span
    >`;
  }

  private _renderChip(
    sources: BandSources,
    prop: TitleBandProperty,
    hasPanel: boolean
  ) {
    const pending = this._pending$.value.has(prop.id);
    const cell = this._cellFor(sources, prop);
    const editable = !!cell && !this._isReadonlyChip(prop);
    const clickable = editable || hasPanel;
    // Without a cell the chip itself is what a keyboard reaches.
    const focusable = !cell && hasPanel;
    return html`<div
      class="labre-title-band-chip"
      data-testid="title-band-chip"
      data-property-id=${prop.id}
      data-empty=${isPropertyValueEmpty(prop) ? 'true' : 'false'}
      data-clickable=${clickable ? 'true' : 'false'}
      aria-busy=${pending ? 'true' : 'false'}
      role=${focusable ? 'button' : nothing}
      tabindex=${focusable ? '0' : nothing}
      @click=${(event: MouseEvent) => {
        if (clickable) this._onChip(event, editable);
      }}
      @keydown=${(event: KeyboardEvent) => {
        if (!focusable || event.target !== event.currentTarget) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        this._onChip(event, false);
      }}
    >
      <span class="labre-title-band-chip-name">${prop.name}</span>
      ${cell
        ? html`<dv-standalone-cell
            class="labre-title-band-chip-value"
            data-testid="title-band-cell"
            role=${editable ? 'button' : nothing}
            aria-label=${prop.name}
            .cell=${cell}
            .readonly=${!editable}
            .placeholder=${this._t(TITLE_BAND_EMPTY)}
          ></dv-standalone-cell>`
        : this._renderFallback(prop)}
    </div>`;
  }

  private _renderTools(sources: BandSources, hasPanel: boolean) {
    const canAdd = !!sources.service.add && !this._readonly;
    return html`${canAdd
      ? html`<button
          class="labre-title-band-icon-button"
          data-testid="title-band-add"
          aria-label=${this._t(TITLE_BAND_ADD)}
          title=${this._t(TITLE_BAND_ADD)}
          @click=${(event: MouseEvent) => {
            event.stopPropagation();
            sources.service.add?.(sources.docId);
          }}
        >
          ${PlusIcon()}
        </button>`
      : nothing}
    ${hasPanel
      ? html`<button
          class="labre-title-band-icon-button"
          data-testid="title-band-open-panel"
          aria-label=${this._t(TITLE_BAND_OPEN_PANEL)}
          title=${this._t(TITLE_BAND_OPEN_PANEL)}
          @click=${(event: MouseEvent) => {
            event.stopPropagation();
            this._openPanel();
          }}
        >
          ${SidebarIcon()}
        </button>`
      : nothing}`;
  }

  private _renderSheet(sources: BandSources): TemplateResult | typeof nothing {
    const state = sources.sheet$.value;
    if (state.status === 'loading') {
      return html`<div
        class="labre-title-band-row"
        role="status"
        aria-busy="true"
        aria-label=${this._t(TITLE_BAND_LOADING)}
        data-testid="title-band-loading"
      >
        <span class="labre-title-band-skeleton"></span>
        <span class="labre-title-band-skeleton"></span>
      </div>`;
    }
    if (state.status !== 'ready') return nothing;

    const hasPanel = !!this.std?.getOptional(PropertiesPanelProvider);
    const { properties } = state;
    const canAdd = !!sources.service.add && !this._readonly;
    if (properties.length === 0 && !canAdd && !hasPanel) return nothing;

    if (properties.length > 0 && this._isCollapsed(sources)) {
      return html`<div
        class="labre-title-band-row"
        role="group"
        aria-label=${this._t(TITLE_BAND_LABEL)}
      >
        <button
          data-testid="title-band-expand"
          aria-expanded="false"
          @click=${(event: MouseEvent) => {
            event.stopPropagation();
            this._setCollapsed(sources, false);
          }}
        >
          ${ToggleRightIcon()}
          <span class="labre-title-band-chip-name"
            >${this._t(TITLE_BAND_EXPAND, properties.length)}</span
          >
        </button>
        ${this._renderTools(sources, hasPanel)}
      </div>`;
    }

    return html`<div
      class="labre-title-band-row"
      role="group"
      aria-label=${this._t(TITLE_BAND_LABEL)}
    >
      ${properties.length > 0
        ? html`<button
            class="labre-title-band-icon-button"
            data-testid="title-band-collapse"
            aria-expanded="true"
            aria-label=${this._t(TITLE_BAND_COLLAPSE)}
            title=${this._t(TITLE_BAND_COLLAPSE)}
            @click=${(event: MouseEvent) => {
              event.stopPropagation();
              this._setCollapsed(sources, true);
            }}
          >
            ${ToggleDownIcon()}
          </button>`
        : nothing}
      ${repeat(
        properties,
        prop => prop.id,
        prop => this._renderChip(sources, prop, hasPanel)
      )}
      ${this._renderTools(sources, hasPanel)}
    </div>`;
  }

  private _renderNotShown(sources: BandSources) {
    const pages = sources.notShown$?.value ?? NO_PAGES;
    const std = this.std;
    const slots = std?.getOptional(RefNodeSlotsProvider);
    // A link that opens nothing is a lie: no linked-document path, no row.
    if (!std || !slots || pages.length === 0) return nothing;
    const label = this._t(TITLE_BAND_NOT_SHOWN);
    const showHere = this._readonly ? null : this._t(TITLE_BAND_SHOW_HERE);
    return html`<div
      class="labre-title-band-row"
      role="group"
      aria-label=${label}
      data-testid="title-band-not-shown"
    >
      <span class="labre-title-band-not-shown-label" aria-hidden="true"
        >${label}</span
      >
      ${repeat(
        pages,
        page => page.docId,
        page => {
          const title =
            page.title.trim() === '' ? this._t(DOC_UNTITLED) : page.title;
          // A group named after the page, so a screen reader hears which
          // page each "Show here" belongs to without a second wording.
          return html`<span
            class="labre-title-band-not-shown-item"
            role="group"
            aria-label=${title}
          >
            <button
              data-testid="title-band-not-shown-page"
              data-doc-id=${page.docId}
              @click=${(event: MouseEvent) => {
                event.stopPropagation();
                slots.docLinkClicked.next({
                  pageId: page.docId,
                  host: std.host,
                  event,
                });
              }}
            >
              ${LinkedPageIcon()}
              <span class="labre-title-band-chip-value">${title}</span>
            </button>
            ${showHere
              ? html`<button
                  data-testid="title-band-show-here"
                  data-doc-id=${page.docId}
                  @click=${(event: MouseEvent) => {
                    event.stopPropagation();
                    showPageHere(std, this.surface, page.docId);
                  }}
                >
                  ${showHere}
                </button>`
              : nothing}
          </span>`;
        }
      )}
    </div>`;
  }

  override connectedCallback() {
    super.connectedCallback();
    // The band lives inside the title and inside the note: a key or a press
    // on one of its buttons is the band's, not the title editor's (Enter would
    // split the title) nor the canvas's (a press would start a drag).
    this._disposables.addFromEvent(this, 'keydown', stopPropagation);
    this._disposables.addFromEvent(this, 'pointerdown', stopPropagation);
  }

  override render() {
    const std = this.std;
    if (!std || !this.docId) return nothing;
    const service = std.getOptional(TitleBandProvider);
    if (!service) return nothing;

    const sources = this._getSources(service);
    const sheet = this._renderSheet(sources);
    const notShown = this._renderNotShown(sources);
    if (sheet === nothing && notShown === nothing) return nothing;

    return html`<div
      class="labre-title-band"
      data-testid="title-band"
      data-surface=${this.surface}
    >
      ${sheet} ${notShown}
    </div>`;
  }

  @property({ attribute: false })
  accessor std: BlockStdScope | null = null;

  @property({ attribute: false })
  accessor docId = '';

  /** Where the band is drawn: where "Show here" puts the card. */
  @property({ attribute: false })
  accessor surface: 'page' | 'canvas' = 'page';
}
