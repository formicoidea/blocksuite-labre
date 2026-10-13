import {
  menu,
  type MenuConfig,
  popMenu,
  popupTargetFromElement,
} from '@labre/affine-components/context-menu';
import { DatePicker } from '@labre/affine-components/date-picker';
import { RefNodeSlotsProvider } from '@labre/affine-inline-reference';
import {
  DOC_UNTITLED,
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
import { SignalWatcher, WithDisposable } from '@labre/global/lit';
import { type BlockStdScope, ShadowlessElement } from '@labre/std';
import {
  CheckBoxCheckSolidIcon,
  CheckBoxUnIcon,
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
import { styleMap } from 'lit/directives/style-map.js';

import {
  TITLE_BAND_ADD,
  TITLE_BAND_CLEAR,
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
  chipEditorKind,
  chipOptions,
  type ChipTag,
  chipValueView,
  parseChipNumber,
} from './format.js';
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
 * included (REQ-PR-1); a click opens the editor of the property's data-view
 * type and hands the value back through `set`, showing the chip as pending
 * until the host settles it. The band never applies a value, and writes to
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

    .labre-title-band svg {
      flex: none;
      width: 16px;
      height: 16px;
    }

    .labre-title-band-icon-button {
      color: var(--affine-icon-color) !important;
      padding: 0 6px !important;
    }

    .labre-title-band-chip-name {
      color: var(--affine-text-secondary-color);
      white-space: nowrap;
    }

    .labre-title-band-chip-value {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 240px;
    }

    .labre-title-band-chip[data-empty='true'] .labre-title-band-chip-value {
      color: var(--affine-placeholder-color);
    }

    .labre-title-band-tag {
      display: inline-block;
      padding: 0 6px;
      border-radius: 4px;
      max-width: 160px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      background-color: var(--affine-tag-white);
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
      .labre-title-band button {
        transition: none;
      }
    }

    /* A 44px target under a coarse pointer, without changing the drawing. */
    @media (pointer: coarse) {
      .labre-title-band button {
        position: relative;
      }
      .labre-title-band button::after {
        content: '';
        position: absolute;
        inset: -8px 0;
      }
    }
  `;

  private _sources: BandSources | null = null;

  /** The editor menu open now, put away with the band. */
  private _menu: { close(): void } | null = null;

  private _pop(target: HTMLElement, title: string, items: MenuConfig[]) {
    this._menu?.close();
    const handler = popMenu(popupTargetFromElement(target), {
      options: {
        title: { text: title },
        items,
        onClose: () => {
          if (this._menu === handler) this._menu = null;
        },
      },
    });
    this._menu = handler;
    return handler;
  }

  /** Collapse state when the host does not remember one. */
  private readonly _localCollapsed$ = signal(false);

  /** Property ids whose `set` has not settled yet. */
  private readonly _pending$ = signal<ReadonlySet<string>>(new Set());

  /** Read inside `render` it subscribes, through `SignalWatcher`. */
  private get _readonly() {
    return this.std?.store.readonly$.value ?? true;
  }

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

  private readonly _onChip = (event: MouseEvent, prop: TitleBandProperty) => {
    event.stopPropagation();
    const target = event.currentTarget as HTMLElement;
    switch (chipEditorKind(prop)) {
      case 'toggle':
        this._write(prop, prop.value !== true);
        return;
      case 'select':
        this._popSelect(target, prop);
        return;
      case 'multi-select':
        this._popMultiSelect(target, prop);
        return;
      case 'date':
        this._popDate(target, prop);
        return;
      case 'number':
        this._popInput(target, prop, 'number');
        return;
      case 'text':
        this._popInput(target, prop, 'text');
        return;
      default:
        this._openPanel();
    }
  };

  private _tagLabel(tag: ChipTag) {
    return html`<span
      class="labre-title-band-tag"
      style=${styleMap(tag.color ? { backgroundColor: tag.color } : {})}
      >${tag.label}</span
    >`;
  }

  private _clearItem(prop: TitleBandProperty): MenuConfig {
    return menu.action({
      name: this._t(TITLE_BAND_CLEAR),
      select: () => this._write(prop, null),
    });
  }

  private _popSelect(target: HTMLElement, prop: TitleBandProperty) {
    const items: MenuConfig[] = chipOptions(prop).map(tag =>
      menu.action({
        name: tag.label,
        label: () => this._tagLabel(tag),
        isSelected: tag.id === prop.value,
        select: () => {
          if (tag.id !== prop.value) this._write(prop, tag.id);
        },
      })
    );
    if (prop.value != null) items.push(this._clearItem(prop));
    this._pop(target, prop.name, items);
  }

  private _popMultiSelect(target: HTMLElement, prop: TitleBandProperty) {
    // A draft, because the host's answer arrives later through `sheet$`: two
    // ticks in one open menu must not both start from the stale value.
    const draft$ = signal<string[]>(
      Array.isArray(prop.value)
        ? prop.value.filter((id): id is string => typeof id === 'string')
        : []
    );
    const items: MenuConfig[] = chipOptions(prop).map(tag =>
      menu.checkbox({
        name: tag.label,
        label: () => this._tagLabel(tag),
        checked: computed(() => draft$.value.includes(tag.id)),
        select: checked => {
          const next = checked
            ? draft$.peek().filter(id => id !== tag.id)
            : [...draft$.peek(), tag.id];
          draft$.value = next;
          this._write(prop, next);
          return !checked;
        },
      })
    );
    this._pop(target, prop.name, items);
  }

  private _popDate(target: HTMLElement, prop: TitleBandProperty) {
    let close = () => {};
    const picker = new DatePicker();
    picker.padding = 0;
    picker.value = typeof prop.value === 'number' ? prop.value : Date.now();
    picker.onChange = (date: Date) => {
      if (date.getTime() !== prop.value) this._write(prop, date.getTime());
      close();
    };
    picker.onClear = () => {
      this._write(prop, null);
      close();
    };
    picker.onEscape = () => close();
    const items: MenuConfig[] = [() => html`${picker}`];
    const handler = this._pop(target, prop.name, items);
    close = () => handler.close();
  }

  private _popInput(
    target: HTMLElement,
    prop: TitleBandProperty,
    kind: 'text' | 'number'
  ) {
    const initial =
      typeof prop.value === 'string' || typeof prop.value === 'number'
        ? String(prop.value)
        : '';
    this._pop(target, prop.name, [
      menu.input({
        initialValue: initial,
        onComplete: text => {
          if (text === initial) return;
          if (kind === 'number') {
            const parsed = parseChipNumber(text);
            this._write(prop, Number.isNaN(parsed) ? null : parsed);
            return;
          }
          this._write(prop, text.trim() === '' ? null : text);
        },
      }),
    ]);
  }

  private readonly _openPanel = () => {
    if (!this.std) return;
    this.std
      .getOptional(PropertiesPanelProvider)
      ?.open({ scope: 'page', docId: this.docId });
  };

  private _renderValue(prop: TitleBandProperty) {
    const view = chipValueView(prop, this._locale);
    switch (view.kind) {
      case 'checkbox':
        return view.checked ? CheckBoxCheckSolidIcon() : CheckBoxUnIcon();
      case 'tags':
        return repeat(
          view.tags,
          tag => tag.id,
          tag => this._tagLabel(tag)
        );
      case 'text':
        return view.text;
      default:
        return this._t(TITLE_BAND_EMPTY);
    }
  }

  private _renderChip(prop: TitleBandProperty, hasPanel: boolean) {
    const pending = this._pending$.value.has(prop.id);
    const editable = !this._readonly && chipEditorKind(prop) !== 'none';
    const clickable = editable || hasPanel;
    const view = chipValueView(prop, this._locale);
    return html`<button
      class="labre-title-band-chip ${clickable ? '' : 'static'}"
      data-testid="title-band-chip"
      data-property-id=${prop.id}
      data-empty=${view.kind === 'empty' ? 'true' : 'false'}
      aria-busy=${pending ? 'true' : 'false'}
      ?disabled=${pending || !clickable}
      @click=${(event: MouseEvent) => this._onChip(event, prop)}
    >
      <span class="labre-title-band-chip-name">${prop.name}</span>
      <span class="labre-title-band-chip-value"
        >${this._renderValue(prop)}</span
      >
    </button>`;
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
        prop => this._renderChip(prop, hasPanel)
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
    this._disposables.add(() => this._menu?.close());
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
