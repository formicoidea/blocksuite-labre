/* oxlint-disable @typescript-eslint/no-non-null-assertion */
import {
  DefaultTool,
  EdgelessLegacySlotIdentifier,
} from '@labre/affine-block-surface';
import {
  type MenuHandler,
  popMenu,
  popupTargetFromElement,
} from '@labre/affine-components/context-menu';
import {
  darkToolbarStyles,
  lightToolbarStyles,
} from '@labre/affine-components/toolbar';
import { ColorScheme, type RootBlockModel } from '@labre/affine-model';
import {
  EditPropsStore,
  ThemeProvider,
  translateKey,
} from '@labre/affine-shared/services';
import { stopPropagation } from '@labre/affine-shared/utils';
import {
  EDGELESS_TOOLBAR_MORE_TOOLS,
  EDGELESS_TOOLBAR_NAME,
  EDGELESS_TOOLBAR_NEXT_TOOLS,
  EDGELESS_TOOLBAR_PREVIOUS_TOOLS,
} from './translations.js';
import {
  ArrowLeftSmallIcon,
  ArrowRightSmallIcon,
  MoreHorizontalIcon,
} from '@blocksuite/icons/lit';
import { WidgetComponent, WidgetViewExtension } from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import { autoPlacement, offset } from '@floating-ui/dom';
import { ContextProvider } from '@lit/context';
import { computed } from '@preact/signals-core';
import { baseTheme, cssVar } from '@toeverything/theme';
import {
  css,
  html,
  nothing,
  type PropertyValues,
  type ReactiveElement,
  unsafeCSS,
} from 'lit';
import { query, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { literal, unsafeStatic } from 'lit/static-html.js';
import debounce from 'lodash-es/debounce';
import { Subject } from 'rxjs';

import { EdgelessToolIconButton } from './button/tool-icon-button.js';
import {
  edgelessToolbarContext,
  type EdgelessToolbarSlots,
  edgelessToolbarSlotsContext,
  edgelessToolbarThemeContext,
} from './context.js';
import type { MenuPopper } from './create-popper.js';
import {
  QuickToolIdentifier,
  type SeniorTool,
  SeniorToolIdentifier,
} from './extension/index.js';
import { EdgelessCommandMenu } from './menu/command-menu.js';
import {
  stepToolbarHighlight,
  type ToolbarHighlight,
} from './toolbar-highlight.js';

const TOOLBAR_PADDING_X = 12;
const TOOLBAR_HEIGHT = 64;
const QUICK_TOOLS_GAP = 10;
const QUICK_TOOL_SIZE = 36;
const QUICK_TOOL_MORE_SIZE = 20;
const SENIOR_TOOLS_GAP = 0;
const SENIOR_TOOL_WIDTH = 96;
const SENIOR_TOOL_NAV_SIZE = 20;
const DIVIDER_WIDTH = 8;
const DIVIDER_SPACE = 8;
const SAFE_AREA_WIDTH = 64;

// Cap the whole toolbar width so the centered senior sub-menus land close to
// the buttons. The ResizeObserver reads the host width, so the senior-tool
// scroll adapts to this cap; on viewports narrower than it, it has no effect.
const TOOLBAR_MAX_WIDTH = 900;

export const EDGELESS_TOOLBAR_WIDGET = 'edgeless-toolbar-widget';
export class EdgelessToolbarWidget extends WidgetComponent<RootBlockModel> {
  static override styles = css`
    :host {
      font-family: ${unsafeCSS(baseTheme.fontSansFamily)};
      position: absolute;
      z-index: 1;
      left: calc(50%);
      transform: translateX(-50%);
      bottom: 0;
      -webkit-user-select: none;
      user-select: none;
      width: 100%;
      /* cap + center the toolbar so centered senior sub-menus stay near the buttons */
      max-width: ${unsafeCSS(TOOLBAR_MAX_WIDTH)}px;
      pointer-events: none;
    }
    .edgeless-toolbar-wrapper {
      width: 100%;
      display: flex;
      justify-content: center;
    }
    ${unsafeCSS(lightToolbarStyles('.edgeless-toolbar-wrapper'))}
    ${unsafeCSS(darkToolbarStyles('.edgeless-toolbar-wrapper'))}

    .edgeless-toolbar-toggle-control {
      pointer-events: auto;
      padding-bottom: 16px;
      width: fit-content;
      max-width: calc(100% - ${unsafeCSS(SAFE_AREA_WIDTH)}px * 2);
      min-width: 264px;
    }
    .edgeless-toolbar-toggle-control[data-enable='true'] {
      transition: 0.23s ease;
      padding-top: 100px;
      transform: translateY(100px);
    }
    .edgeless-toolbar-toggle-control[data-enable='true']:hover {
      padding-top: 0;
      transform: translateY(0);
    }

    .edgeless-toolbar-smooth-corner {
      display: block;
      width: fit-content;
      max-width: 100%;
    }
    .edgeless-toolbar-container {
      position: relative;
      display: flex;
      align-items: center;
      padding: 0 ${unsafeCSS(TOOLBAR_PADDING_X)}px;
      height: ${unsafeCSS(TOOLBAR_HEIGHT)}px;
    }
    :host([disabled]) .edgeless-toolbar-container {
      pointer-events: none;
    }
    .edgeless-toolbar-container[level='second'] {
      position: absolute;
      bottom: 8px;
      transform: translateY(-100%);
    }
    .edgeless-toolbar-container[hidden] {
      display: none;
    }
    .quick-tools {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: ${unsafeCSS(QUICK_TOOLS_GAP)}px;
    }
    .full-divider {
      width: ${unsafeCSS(DIVIDER_WIDTH)}px;
      height: 100%;
      margin: 0 ${unsafeCSS(DIVIDER_SPACE)}px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .full-divider::after {
      content: '';
      display: block;
      width: 1px;
      height: 100%;
      background-color: var(--affine-border-color);
    }
    .pen-and-eraser {
      display: flex;
      height: 100%;
      gap: 4px;
      justify-content: center;
    }
    .senior-tools {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: ${unsafeCSS(SENIOR_TOOLS_GAP)}px;
      height: 100%;
      min-width: ${unsafeCSS(SENIOR_TOOL_WIDTH)}px;
    }
    .quick-tool-item {
      width: ${unsafeCSS(QUICK_TOOL_SIZE)}px;
      height: ${unsafeCSS(QUICK_TOOL_SIZE)}px;
      display: flex;
      justify-content: center;
      align-items: center;
      flex-shrink: 0;
    }
    .quick-tool-more {
      width: 0;
      height: ${unsafeCSS(QUICK_TOOL_SIZE)}px;
      flex-shrink: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      transition: all 0.23s ease;
      overflow: hidden;
    }
    [data-dense-quick='true'] .quick-tool-more {
      width: ${unsafeCSS(QUICK_TOOL_MORE_SIZE)}px;
      margin-left: ${unsafeCSS(DIVIDER_SPACE)}px;
    }
    .quick-tool-more-button {
      padding: 0;
    }

    .senior-tool-item {
      width: ${unsafeCSS(SENIOR_TOOL_WIDTH)}px;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      flex-shrink: 0;
    }
    .senior-nav-button-wrapper {
      flex-shrink: 0;
      width: 0px;
      height: ${unsafeCSS(SENIOR_TOOL_NAV_SIZE)}px;
      transition: width 0.23s ease;
      overflow: hidden;
    }
    .senior-nav-button {
      padding: 0;
    }
    .senior-nav-button svg {
      width: 20px;
      height: 20px;
    }
    [data-dense-senior='true'] .senior-nav-button-wrapper {
      width: ${unsafeCSS(SENIOR_TOOL_NAV_SIZE)}px;
    }
    [data-dense-senior='true'] .senior-nav-button-wrapper.prev {
      margin-right: ${unsafeCSS(DIVIDER_SPACE)}px;
    }
    [data-dense-senior='true'] .senior-nav-button-wrapper.next {
      margin-left: ${unsafeCSS(DIVIDER_SPACE)}px;
    }
    /* The keyboard highlight (Alt+←/→): an opaque 2px ring, the focus ring's
       weight, so it reads on both themes. The same ring marks keyboard focus
       on the toolbar's own icon buttons (ADR 0054); the tool buttons draw it
       in their own shadow tree (toolButtonFocusRing). */
    [data-keyboard-highlight],
    .quick-tool-more-button:focus-visible,
    .senior-nav-button:focus-visible {
      outline: 2px solid var(--affine-primary-color);
      outline-offset: -2px;
      border-radius: 8px;
    }
    .transform-button svg {
      transition: 0.3s ease-in-out;
    }
    .transform-button:hover svg {
      transform: scale(1.15);
    }
  `;

  private readonly _appTheme$ = computed(() => {
    return this.std.get(ThemeProvider).app$.value;
  });

  private _moreQuickToolsMenu: MenuHandler | null = null;

  private _moreQuickToolsMenuRef: HTMLElement | null = null;

  @state()
  accessor containerWidth = 1920;

  private readonly _onContainerResize = debounce(
    ({ w }: { w: number }) => {
      if (!this.isConnected) return;

      this.slots.resize.next({ w, h: TOOLBAR_HEIGHT });
      // The highlight is a position in the row, and a new width re-deals the
      // row (dense mode, quick tools folded into "more"): the same index
      // would point at another button.
      if (w !== this.containerWidth) this.clearHighlight();
      this.containerWidth = w;

      if (this._denseSeniorTools) {
        this.scrollSeniorToolIndex = Math.min(
          this._seniorTools.length - this.scrollSeniorToolSize,
          this.scrollSeniorToolIndex
        );
      } else {
        this.scrollSeniorToolIndex = 0;
      }

      if (
        this._denseQuickTools &&
        this._moreQuickToolsMenu &&
        this._moreQuickToolsMenuRef
      ) {
        this._moreQuickToolsMenu.close();
        this._openMoreQuickToolsMenu({
          currentTarget: this._moreQuickToolsMenuRef,
        });
      }
      if (!this._denseQuickTools && this._moreQuickToolsMenu) {
        this._moreQuickToolsMenu.close();
        this._moreQuickToolsMenu = null;
      }
    },
    300,
    { leading: true }
  );

  private _resizeObserver: ResizeObserver | null = null;

  private readonly _slotsProvider = new ContextProvider(this, {
    context: edgelessToolbarSlotsContext,
    initialValue: { resize: new Subject() } satisfies EdgelessToolbarSlots,
  });

  private readonly _themeProvider = new ContextProvider(this, {
    context: edgelessToolbarThemeContext,
    initialValue: ColorScheme.Light,
  });

  private readonly _toolbarProvider = new ContextProvider(this, {
    context: edgelessToolbarContext,
    initialValue: this,
  });

  activePopper: MenuPopper<HTMLElement> | null = null;

  /**
   * Which toolbar button the keyboard points at, `-1` for none. Walked with
   * Alt+←/→ when no sub-menu is open (`edgeless-keyboard.ts`); the plain
   * arrows belong to the canvas. A highlight, not DOM focus: a shortcut FROM
   * the canvas, which keeps the keystrokes for the canvas dispatcher, and the
   * open sub-menu already walks its row the same way. A user who chooses the
   * toolbar Tabs into it and gets real focus instead (ADR 0054), which clears
   * this highlight.
   */
  @state()
  accessor keyboardHighlight = -1;

  private get _walkableQuickToolSize() {
    return Math.min(this._quickTools.length, this._visibleQuickToolSize);
  }

  /**
   * Step the keyboard highlight along the toolbar by one button, and say
   * whether there was a row to walk. There is none while the presentation
   * toolbar replaces it or while a readonly board hides it, and the caller
   * then leaves the keystroke to the browser.
   */
  walkHighlight(dir: 1 | -1): boolean {
    if (this.isPresentMode || this.store.readonly) return false;
    const { index, scroll } = stepToolbarHighlight(
      this.keyboardHighlight,
      dir,
      {
        quick: this._walkableQuickToolSize,
        senior: this._seniorTools.length,
        scroll: this.scrollSeniorToolIndex,
        size: this.scrollSeniorToolSize,
      }
    );
    this.keyboardHighlight = index;
    this.scrollSeniorToolIndex = scroll;
    return index >= 0;
  }

  clearHighlight() {
    if (this.keyboardHighlight < 0) return false;
    this.keyboardHighlight = -1;
    return true;
  }

  /**
   * Press the highlighted button, and say whether there was one.
   *
   * The click lands on whatever is drawn at the button's centre, the element a
   * pointer would hit: each tool button binds its click deep in its own shadow
   * tree (a wrapper div, an inner icon button), so clicking the item's host
   * would reach none of them.
   */
  activateHighlight(): boolean {
    if (this.keyboardHighlight < 0) return false;
    const item =
      this.shadowRoot?.querySelector<HTMLElement>(
        '[data-keyboard-highlight]'
      ) ?? null;
    this.keyboardHighlight = -1;
    if (!item) return false;
    const target = deepElementAtCentre(item);
    if (!target) return false;
    // Dispatched rather than `.click()`: what is drawn there is often an SVG
    // shape of the icon, which has no `click()`.
    target.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        composed: true,
      })
    );
    return true;
  }

  private readonly _onContainerPointerDown = (event: Event) => {
    this.clearHighlight();
    stopPropagation(event);
  };

  // calculate all the width manually
  private get _availableWidth() {
    return this.containerWidth - 2 * SAFE_AREA_WIDTH;
  }

  private get _cachedPresentHideToolbar() {
    return !!this.std.get(EditPropsStore).getStorage('presentHideToolbar');
  }

  private get _denseQuickTools() {
    return (
      this._availableWidth -
        this._seniorToolNavWidth -
        1 * SENIOR_TOOL_WIDTH -
        2 * TOOLBAR_PADDING_X <
      this._quickToolsWidthTotal
    );
  }

  private get _denseSeniorTools() {
    return (
      this._availableWidth -
        this._quickToolsWidthTotal -
        this._spaceWidthTotal <
      this._seniorToolsWidthTotal
    );
  }

  /**
   * When enabled, the toolbar will auto-hide when the mouse is not over it.
   */
  private get _enableAutoHide() {
    return (
      this.isPresentMode &&
      this._cachedPresentHideToolbar &&
      !this.presentSettingMenuShow &&
      !this.presentFrameMenuShow
    );
  }

  private get _hiddenQuickTools() {
    return this._quickTools
      .slice(this._visibleQuickToolSize)
      .filter(tool => !!tool.menu);
  }

  private get _quickTools() {
    const block = this.block;
    if (!block) {
      return [];
    }
    const quickTools = Array.from(
      this.std.provider.getAll(QuickToolIdentifier).values()
    );
    const gfx = this.std.get(GfxControllerIdentifier);
    return quickTools
      .map(tool =>
        tool({ block, gfx, toolbarContainer: this.toolbarContainer })
      )
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
      .filter(({ enable = true }) => enable);
  }

  private get _quickToolsWidthTotal() {
    return (
      this._quickTools.length * (QUICK_TOOL_SIZE + QUICK_TOOLS_GAP) -
      QUICK_TOOLS_GAP
    );
  }

  /**
   * The wording shown for a senior tool. A framework declares an i18n key and
   * the host catalogue answers it; `name` is the English fallback, and the only
   * thing the core tools have.
   */
  private _seniorToolLabel(tool?: SeniorTool) {
    if (!tool) return '';
    return tool.labelKey
      ? translateKey(this.std, tool.labelKey, tool.name)
      : tool.name;
  }

  private get _seniorNextTooltip() {
    if (this._seniorScrollNextDisabled) return '';
    return this._seniorToolLabel(
      this._seniorTools[this.scrollSeniorToolIndex + this.scrollSeniorToolSize]
    );
  }

  private get _seniorPrevTooltip() {
    if (this._seniorScrollPrevDisabled) return '';
    return this._seniorToolLabel(
      this._seniorTools[this.scrollSeniorToolIndex - 1]
    );
  }

  private get _seniorScrollNextDisabled() {
    return (
      this.scrollSeniorToolIndex + this.scrollSeniorToolSize >=
      this._seniorTools.length
    );
  }

  private get _seniorScrollPrevDisabled() {
    return this.scrollSeniorToolIndex === 0;
  }

  private get _seniorToolNavWidth() {
    return this._denseSeniorTools
      ? (SENIOR_TOOL_NAV_SIZE + DIVIDER_SPACE) * 2
      : 0;
  }

  private get _seniorTools() {
    const block = this.block;
    if (!block) {
      return [];
    }
    const seniorTools = Array.from(
      this.std.provider.getAll(SeniorToolIdentifier).values()
    );
    const gfx = this.std.get(GfxControllerIdentifier);
    return seniorTools
      .map(tool =>
        tool({ block, gfx, toolbarContainer: this.toolbarContainer })
      )
      .filter(({ enable = true }) => enable)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  private get _seniorToolsWidthTotal() {
    return (
      this._seniorTools.length * (SENIOR_TOOL_WIDTH + SENIOR_TOOLS_GAP) -
      SENIOR_TOOLS_GAP
    );
  }

  private get _spaceWidthTotal() {
    return DIVIDER_WIDTH + DIVIDER_SPACE * 2 + TOOLBAR_PADDING_X * 2;
  }

  private get _visibleQuickToolSize() {
    if (!this._denseQuickTools) return this._quickTools.length;
    const availableWidth =
      this._availableWidth -
      this._seniorToolNavWidth -
      this._spaceWidthTotal -
      SENIOR_TOOL_WIDTH;
    return Math.max(
      1,
      Math.floor(
        (availableWidth - QUICK_TOOL_MORE_SIZE - DIVIDER_SPACE) /
          (QUICK_TOOL_SIZE + QUICK_TOOLS_GAP)
      )
    );
  }

  get edgelessTool() {
    return this.gfx.tool.currentToolName$.value;
  }

  get gfx() {
    return this.std.get(GfxControllerIdentifier);
  }

  get isPresentMode() {
    return this.edgelessTool === 'frameNavigator';
  }

  get scrollSeniorToolSize() {
    if (this._denseQuickTools) return 1;
    const seniorAvailableWidth =
      this._availableWidth - this._quickToolsWidthTotal - this._spaceWidthTotal;
    if (seniorAvailableWidth >= this._seniorToolsWidthTotal)
      return this._seniorTools.length;
    return (
      Math.floor(
        (seniorAvailableWidth - (SENIOR_TOOL_NAV_SIZE + DIVIDER_SPACE) * 2) /
          SENIOR_TOOL_WIDTH
      ) || 1
    );
  }

  get slots() {
    return this._slotsProvider.value;
  }

  constructor() {
    super();
  }

  private _onSeniorNavNext() {
    if (this._seniorScrollNextDisabled) return;
    this.scrollSeniorToolIndex = Math.min(
      this._seniorTools.length - this.scrollSeniorToolSize,
      this.scrollSeniorToolIndex + this.scrollSeniorToolSize
    );
  }

  private _onSeniorNavPrev() {
    if (this._seniorScrollPrevDisabled) return;
    this.scrollSeniorToolIndex = Math.max(
      0,
      this.scrollSeniorToolIndex - this.scrollSeniorToolSize
    );
  }

  private _openMoreQuickToolsMenu(e: { currentTarget: HTMLElement }) {
    if (!this._hiddenQuickTools.length) return;

    this._moreQuickToolsMenuRef = e.currentTarget;
    this._moreQuickToolsMenu = popMenu(
      popupTargetFromElement(e.currentTarget as HTMLElement),
      {
        middleware: [
          autoPlacement({
            allowedPlacements: ['top'],
          }),
          offset({
            mainAxis: (TOOLBAR_HEIGHT - QUICK_TOOL_MORE_SIZE) / 2 + 8,
          }),
        ],
        options: {
          onClose: () => {
            this._moreQuickToolsMenu = null;
            this._moreQuickToolsMenuRef = null;
          },
          items: this._hiddenQuickTools.map(tool => tool.menu!),
        },
      }
    );
  }

  private _renderContent() {
    return html`
      <div class="quick-tools">
        ${this._quickTools
          .slice(0, this._visibleQuickToolSize)
          .map(
            (tool, index) =>
              html`<div
                class="quick-tool-item"
                ?data-keyboard-highlight=${index === this.keyboardHighlight}
              >
                ${tool.content}
              </div>`
          )}
      </div>
      <div class="quick-tool-more">
        <icon-button
          ?disabled=${!this._denseQuickTools}
          .size=${20}
          class="quick-tool-more-button"
          aria-label=${translateKey(this.std, ...EDGELESS_TOOLBAR_MORE_TOOLS)}
          @click=${this._openMoreQuickToolsMenu}
          ?active=${this._quickTools
            .slice(this._visibleQuickToolSize)
            .some(tool => tool.type === this.edgelessTool)}
        >
          ${MoreHorizontalIcon({ width: '20px', height: '20px' })}
          <affine-tooltip tip-position="top" .offset=${25}>
            ${translateKey(this.std, ...EDGELESS_TOOLBAR_MORE_TOOLS)}
          </affine-tooltip>
        </icon-button>
      </div>
      <div class="full-divider"></div>
      <div class="senior-nav-button-wrapper prev">
        <icon-button
          .size=${20}
          class="senior-nav-button"
          aria-label=${translateKey(
            this.std,
            ...EDGELESS_TOOLBAR_PREVIOUS_TOOLS
          )}
          ?disabled=${this._seniorScrollPrevDisabled}
          @click=${this._onSeniorNavPrev}
        >
          ${ArrowLeftSmallIcon({ width: '20px', height: '20px' })}
          ${pagerTooltip(this._seniorPrevTooltip)}
        </icon-button>
      </div>
      <div class="senior-tools">
        ${this._seniorTools
          .slice(
            this.scrollSeniorToolIndex,
            this.scrollSeniorToolIndex + this.scrollSeniorToolSize
          )
          .map(
            (tool, index) =>
              html`<div
                class="senior-tool-item"
                data-senior-index=${this.scrollSeniorToolIndex + index}
                ?data-keyboard-highlight=${this._walkableQuickToolSize +
                  this.scrollSeniorToolIndex +
                  index ===
                this.keyboardHighlight}
              >
                ${tool.content}
              </div>`
          )}
      </div>
      <div class="senior-nav-button-wrapper next">
        <icon-button
          .size=${20}
          class="senior-nav-button"
          aria-label=${translateKey(this.std, ...EDGELESS_TOOLBAR_NEXT_TOOLS)}
          ?disabled=${this._seniorScrollNextDisabled}
          @click=${this._onSeniorNavNext}
        >
          ${ArrowRightSmallIcon({ width: '20px', height: '20px' })}
          ${pagerTooltip(this._seniorNextTooltip)}
        </icon-button>
      </div>
    `;
  }

  override connectedCallback() {
    super.connectedCallback();
    this._toolbarProvider.setValue(this);
    this._resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        this._onContainerResize({ w: width });
      }
    });
    this._resizeObserver.observe(this);
    // The highlight only stands while the keyboard is on the toolbar. Left
    // standing, it hijacks the next Enter: Alt+→, a click on a shape, Enter
    // to edit its text, and the toolbar button got pressed instead. Capture,
    // because the canvas and the toolbar both stop the pointer's propagation.
    this.disposables.addFromEvent(
      document,
      'pointerdown',
      () => this.clearHighlight(),
      { capture: true }
    );
    this.disposables.add(
      this.gfx.selection.slots.updated.subscribe(() => this.clearHighlight())
    );
    this.disposables.add(
      this.std
        .get(ThemeProvider)
        .theme$.subscribe(mode => this._themeProvider.setValue(mode))
    );
    if (!this.block) {
      return;
    }
    this._disposables.add(
      this.block.bindHotKey(
        {
          Escape: () => {
            if (this.gfx.selection.editing) return;
            this.clearHighlight();
            if (this.edgelessTool === 'frameNavigator') return;
            if (this.edgelessTool === 'default') {
              if (this.activePopper) {
                this.activePopper.dispose();
                this.activePopper = null;
              }
              return;
            }
            this.gfx.tool.setTool(DefaultTool);
          },
        },
        { global: true }
      )
    );
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
    }
  }

  /**
   * Syncs the row only when what it draws changed: another page of the senior
   * row, another width, the row shown again after presentation or readonly.
   * The toolbar re-renders on every viewport update, so syncing on each one
   * ran the senior factories and walked the tools' shadow trees on every frame
   * of a pan or a zoom (review of #679). A tool's own state (`active`) needs
   * no sync: its button reflects it.
   */
  override updated(changed: PropertyValues<this>) {
    super.updated(changed);
    const signature = this._drawnRowSignature();
    if (signature === this._rowSignature) return;
    this._rowSignature = signature;
    this._syncRow().catch(console.error);
  }

  /** The drawn row as of the last sync, item by item. */
  private _rowSignature = '';

  private _drawnRowSignature() {
    const items =
      this.shadowRoot?.querySelectorAll<HTMLElement>(
        '.quick-tool-item, .senior-tool-item'
      ) ?? [];
    return Array.from(
      items,
      (item, index) =>
        `${item.dataset.seniorIndex ?? `q${index}`}:${item.firstElementChild?.localName ?? ''}`
    ).join('|');
  }

  /** Bumped by every sync of the row, so an older one still waiting stops. */
  private _rowSyncs = 0;

  /** The row as last read: what the keyboard walks (ADR 0054). */
  private _rowStops: ToolbarRowEntry[] = [];

  /** "More tools" is on the row only while it holds tools. */
  private get _showsMoreTools() {
    return this._denseQuickTools && this._hiddenQuickTools.length > 0;
  }

  /** Items the row puts before the senior tools: quick tools, "More tools". */
  private get _fixedItemCount() {
    const quick =
      this.shadowRoot?.querySelectorAll('.quick-tool-item').length ?? 0;
    return quick + (this._showsMoreTools ? 1 : 0);
  }

  /**
   * The row's buttons in order, each with the item that draws it: the quick
   * tools on show, "More tools" when it holds any, then the senior tools on
   * show. `at` is the item's place in the whole row, paged-out senior tools
   * included — the index `stepToolbarHighlight` walks. A tool's own component
   * draws its button an update after this row, so this waits for them.
   */
  private async _rowEntries(): Promise<ToolbarRowEntry[]> {
    const isMore = (item: HTMLElement) =>
      item.classList.contains('quick-tool-more-button');
    const items = Array.from(
      this.shadowRoot?.querySelectorAll<HTMLElement>(
        '.quick-tool-item, .quick-tool-more-button, .senior-tool-item'
      ) ?? []
    ).filter(item => !isMore(item) || this._showsMoreTools);
    const fixed = items.filter(
      item => item.dataset.seniorIndex === undefined
    ).length;
    const buttons = await Promise.all(
      items.map(
        async (item): Promise<HTMLElement[]> =>
          isMore(item) ? [item] : rowButtonsIn(item)
      )
    );
    return items.flatMap((item, index) => {
      const { seniorIndex } = item.dataset;
      const senior = seniorIndex === undefined ? null : Number(seniorIndex);
      return buttons[index].map(button => ({
        button,
        at: senior === null ? index : fixed + senior,
        senior,
        alone: buttons[index].length === 1,
      }));
    });
  }

  /**
   * What the row's buttons tell assistive technology (#679). Each announces
   * its state; a senior tool drawn as one button is named by the label its
   * tool declares — a framework's display name, from its descriptor's key —
   * rather than by its tooltip, which its menu empties while open. The pen
   * and eraser share one senior tool and name themselves. Then the one Tab
   * stop: the focused button while the keyboard is in the row.
   */
  private async _syncRow(): Promise<ToolbarRowEntry[]> {
    const sync = ++this._rowSyncs;
    const entries = await this._rowEntries();
    if (sync !== this._rowSyncs || !this.isConnected) return entries;
    const seniors = this._seniorTools;
    entries.forEach(({ button, senior, alone }) => {
      if (!(button instanceof EdgelessToolIconButton)) return;
      button.onToolbarRow = true;
      if (senior !== null && alone) {
        button.label = this._seniorToolLabel(seniors[senior]);
      }
    });
    this._rowStops = entries;
    const focused = deepActiveElement();
    this._setTabStop(entries.find(({ button }) => button === focused)?.button);
    return entries;
  }

  /**
   * The row's one Tab stop (ADR 0054): `stop` when given, else the active
   * tool, else the first button. The pager arrows are never one: the arrow
   * keys page the row as they walk it.
   */
  private _setTabStop(stop?: HTMLElement) {
    const stops = this._rowStops.map(({ button }) => button);
    const target =
      stop ??
      stops.find(
        button =>
          button instanceof EdgelessToolIconButton && button.active === true
      ) ??
      stops[0];
    const others = Array.from(
      this.shadowRoot?.querySelectorAll<HTMLElement>(
        '.senior-nav-button, .quick-tool-more-button'
      ) ?? []
    );
    new Set([...stops, ...others]).forEach(button => {
      const index = button === target ? 0 : -1;
      if (button.tabIndex !== index) button.tabIndex = index;
    });
  }

  private _focusStop(stop: HTMLElement) {
    this._setTabStop(stop);
    stop.focus();
  }

  private _focusCanvas() {
    this.std.host.focus({ preventScroll: true });
  }

  /**
   * The toolbar's keys, on a button the keyboard focused (ADR 0054). A button
   * a pointer click focused leaves every key to the canvas, as before; and
   * keys the row does not use go on to the canvas dispatcher, which listens on
   * `document` — those it does use stop here, or the canvas would also move
   * the selection, pan on Space, or reset the tool on Escape.
   */
  private readonly _onRowKeydown = (event: KeyboardEvent) => {
    const origin = event.composedPath()[0];
    const here = this._rowStops.find(({ button }) => button === origin);
    if (!here || event.isComposing || event.ctrlKey || event.metaKey) return;
    if (!here.button.matches(':focus-visible')) return;
    const consume = () => {
      event.preventDefault();
      event.stopPropagation();
    };
    switch (event.key) {
      case 'Tab':
        // The browser's: the row is one stop. Kept from the canvas, whose
        // Tab adds a sibling to a selected mind map node.
        event.stopPropagation();
        return;
      case 'ArrowLeft':
      case 'ArrowRight':
        // With a sub-menu open, Alt+←/→ walk it, as on the canvas.
        if (event.altKey && this.activePopper) return;
        consume();
        this._walkFocus(here, event.key === 'ArrowRight' ? 1 : -1).catch(
          console.error
        );
        return;
      case 'Home':
      case 'End':
        consume();
        this._walkFrom(-1, event.key === 'Home' ? 1 : -1).catch(console.error);
        return;
      case 'ArrowUp':
      case 'ArrowDown':
        consume();
        return;
      case 'Enter':
      case ' ':
        consume();
        if (!event.repeat) this._press(here.button);
        return;
      case 'Escape':
        consume();
        this._escape();
        return;
    }
  };

  private readonly _onRowFocusIn = (event: FocusEvent) => {
    const origin = event.composedPath()[0];
    const here = this._rowStops.find(({ button }) => button === origin);
    if (!here) return;
    // The keyboard is in the row: the Alt+←/→ highlight would be a second
    // ring.
    this.clearHighlight();
    this._setTabStop(here.button);
  };

  private readonly _onRowFocusOut = (event: FocusEvent) => {
    const next = event.relatedTarget;
    if (next instanceof Node && this.toolbarContainer?.contains(next)) return;
    // Out of the row: its stop goes back to the active tool.
    this._setTabStop();
  };

  /** One button along, its own item's next button first (pen, eraser). */
  private async _walkFocus(here: ToolbarRowEntry, dir: 1 | -1) {
    const stops = this._rowStops;
    const next = stops[stops.indexOf(here) + dir];
    if (next && next.at === here.at) {
      this._focusStop(next.button);
      return;
    }
    await this._walkFrom(here.at, dir);
  }

  /**
   * Step along the row's items from `at` (`-1`: from outside, so forwards is
   * the first and backwards the last), paging the senior row as the Alt+←/→
   * highlight does, and focus the item's first button — its last when going
   * back. An item that draws no button is stepped over.
   */
  private async _walkFrom(at: number, dir: 1 | -1) {
    const row = () => ({
      quick: this._fixedItemCount,
      senior: this._seniorTools.length,
      scroll: this.scrollSeniorToolIndex,
      size: this.scrollSeniorToolSize,
    });
    let from = at;
    const total = row().quick + row().senior;
    for (let step = 0; step < total; step++) {
      const target = stepToolbarHighlight(from, dir, row());
      if (await this._focusItem(target, dir)) return;
      from = target.index;
    }
  }

  private async _focusItem(
    { index, scroll }: ToolbarHighlight,
    dir: 1 | -1
  ): Promise<boolean> {
    if (index < 0) return false;
    if (scroll !== this.scrollSeniorToolIndex) {
      this.scrollSeniorToolIndex = scroll;
      await this.updateComplete;
    }
    this._rowStops = await this._syncRow();
    const buttons = this._rowStops.filter(({ at }) => at === index);
    const stop = dir === 1 ? buttons[0] : buttons[buttons.length - 1];
    if (!stop) return false;
    this._focusStop(stop.button);
    return true;
  }

  /**
   * Press the focused button where a pointer would (see `activateHighlight`).
   * A press that picks a tool gives the canvas the keyboard back; one that
   * opens a framework's sub-menu keeps the focus on its button, for Escape to
   * close it; anything else (undo, the layers pane) leaves the focus here.
   */
  private _press(button: HTMLElement) {
    const menu = this.activePopper?.element;
    // A command the open sub-menu highlights (Alt+←/→) is what Enter runs,
    // as on the canvas.
    if (menu instanceof EdgelessCommandMenu && menu.activate()) {
      this._focusCanvas();
      return;
    }
    const tool = this.gfx.tool.currentToolName$.peek();
    const popper = this.activePopper;
    const target =
      (button instanceof EdgelessToolIconButton &&
        deepElementAtCentre(button)) ||
      button;
    target.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        composed: true,
      })
    );
    const opened = this.activePopper;
    const subMenu =
      opened !== popper && opened?.element instanceof EdgelessCommandMenu;
    if (subMenu) return;
    if (this.gfx.tool.currentToolName$.peek() !== tool) this._focusCanvas();
  }

  /** Escape closes the open sub-menu, else gives the canvas the keyboard. */
  private _escape() {
    const popper = this.activePopper;
    if (popper) {
      popper.dispose();
      this.activePopper = null;
      return;
    }
    this._focusCanvas();
  }

  override firstUpdated() {
    const { _disposables, block, gfx } = this;
    if (!block) return;

    const slots = this.std.get(EdgelessLegacySlotIdentifier);
    const editPropsStore = this.std.get(EditPropsStore);

    _disposables.add(
      gfx.viewport.viewportUpdated.subscribe(() => this.requestUpdate())
    );
    _disposables.add(
      slots.readonlyUpdated.subscribe(() => {
        this.requestUpdate();
      })
    );
    _disposables.add(
      slots.toolbarLocked.subscribe(disabled => {
        this.toggleAttribute('disabled', disabled);
      })
    );
    // This state from `editPropsStore` is not reactive,
    // if the value is updated outside of this component, it will not be reflected.
    _disposables.add(
      editPropsStore.slots.storageUpdated.subscribe(({ key }) => {
        if (key === 'presentHideToolbar') {
          this.requestUpdate();
        }
      })
    );
  }

  override render() {
    const type = this.edgelessTool;
    if (this.store.readonly && type !== 'frameNavigator') {
      return nothing;
    }

    return html`
      <div
        class="edgeless-toolbar-wrapper"
        data-app-theme=${this._appTheme$.value}
      >
        <div
          class="edgeless-toolbar-toggle-control"
          data-enable=${this._enableAutoHide}
        >
          <smooth-corner
            class="edgeless-toolbar-smooth-corner"
            .borderRadius=${16}
            .smooth=${0.7}
            .borderWidth=${1}
            .bgColor=${'var(--affine-background-overlay-panel-color)'}
            .borderColor=${'var(--affine-border-color)'}
            style="filter: drop-shadow(${cssVar('toolbarShadow')})"
          >
            <div
              class="edgeless-toolbar-container"
              role="toolbar"
              aria-label=${translateKey(this.std, ...EDGELESS_TOOLBAR_NAME)}
              @keydown=${this._onRowKeydown}
              @focusin=${this._onRowFocusIn}
              @focusout=${this._onRowFocusOut}
              data-dense-quick=${this._denseQuickTools &&
              this._hiddenQuickTools.length > 0}
              data-dense-senior=${this._denseSeniorTools}
              @dblclick=${stopPropagation}
              @mousedown=${stopPropagation}
              @pointerdown=${this._onContainerPointerDown}
            >
              ${this.isPresentMode
                ? html`<presentation-toolbar
                    .edgeless=${this.block}
                    .settingMenuShow=${this.presentSettingMenuShow}
                    .frameMenuShow=${this.presentFrameMenuShow}
                    .setSettingMenuShow=${(show: boolean) =>
                      (this.presentSettingMenuShow = show)}
                    .setFrameMenuShow=${(show: boolean) =>
                      (this.presentFrameMenuShow = show)}
                    .containerWidth=${this.containerWidth}
                  ></presentation-toolbar>`
                : nothing}
              ${this.isPresentMode ? nothing : this._renderContent()}
            </div>
          </smooth-corner>
        </div>
      </div>
    `;
  }

  @state()
  accessor presentFrameMenuShow = false;

  @state()
  accessor presentSettingMenuShow = false;

  @state()
  accessor scrollSeniorToolIndex = 0;

  @query('.edgeless-toolbar-container')
  accessor toolbarContainer!: HTMLElement;
}

interface ToolbarRowEntry {
  /** A tool's button, or the toolbar's own "More tools". */
  button: HTMLElement;
  /** The place of the item that draws it in the whole row. */
  at: number;
  /** The senior tool's index among all of them; `null` for a quick tool. */
  senior: number | null;
  /** Whether it is its item's only button. */
  alone: boolean;
}

/**
 * The buttons a toolbar item puts on the row. A tool's component draws its
 * button first in its shadow tree; what it appends after — the popper of its
 * menu, a panel — is not on the row, so the walk stops at the first button of
 * each shadow tree. A plain wrapper (the pen and the eraser side by side) gives
 * every component it holds.
 */
async function rowButtonsIn(root: Element): Promise<EdgelessToolIconButton[]> {
  if (root instanceof EdgelessToolIconButton) return [root];
  await (root as Partial<ReactiveElement>).updateComplete;
  const shadow = root.shadowRoot;
  if (!shadow) {
    const found = await Promise.all(Array.from(root.children, rowButtonsIn));
    return found.flat();
  }
  for (const child of Array.from(shadow.children)) {
    const found = await rowButtonsIn(child);
    if (found.length > 0) return found;
  }
  return [];
}

/** Where the focus is, through every shadow root. */
function deepActiveElement(): Element | null {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }
  return active;
}

/**
 * A pager arrow's tooltip: the senior tool it brings in. Keyed by that name
 * because a tooltip shows a copy of its content taken when the pointer came
 * in: after a page turn under a still pointer, the arrow went on showing the
 * tool it had just brought in (#679). A new name is a new tooltip, and the old
 * one leaves with its popup.
 */
function pagerTooltip(label: string) {
  if (!label) return nothing;
  return keyed(
    label,
    html`<affine-tooltip tip-position="top" .offset=${4}>
      ${label}
    </affine-tooltip>`
  );
}

/**
 * The innermost element drawn at an element's centre, across shadow roots:
 * what a pointer pressed there would hit. `null` when that is not inside
 * `element` (something floats over it).
 */
function deepElementAtCentre(element: HTMLElement): Element | null {
  // Hit-testing only sees what is on screen: a host page taller than the
  // window can leave the toolbar below the fold.
  const box = element.getBoundingClientRect();
  if (
    box.top < 0 ||
    box.left < 0 ||
    box.bottom > window.innerHeight ||
    box.right > window.innerWidth
  ) {
    element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  const rect = element.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  let target = document.elementFromPoint(x, y);
  while (target?.shadowRoot) {
    const inner = target.shadowRoot.elementFromPoint(x, y);
    if (!inner || inner === target) break;
    target = inner;
  }
  if (!target) return null;
  let node: Node | null = target;
  while (node && node !== element) {
    node = node.parentNode ?? (node as ShadowRoot).host ?? null;
  }
  return node === element ? target : null;
}

export const edgelessToolbarWidget = WidgetViewExtension(
  'affine:page',
  EDGELESS_TOOLBAR_WIDGET,
  literal`${unsafeStatic(EDGELESS_TOOLBAR_WIDGET)}`
);
