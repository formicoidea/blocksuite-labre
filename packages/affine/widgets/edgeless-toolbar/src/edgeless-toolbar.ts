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

import {
  EdgelessToolIconButton,
  TOOLBAR_ROW_STATE_EVENT,
} from './button/tool-icon-button.js';
import {
  edgelessToolbarContext,
  type EdgelessToolbarSlots,
  edgelessToolbarSlotsContext,
  edgelessToolbarThemeContext,
} from './context.js';
import type { MenuPopper } from './create-popper.js';
import type { EdgelessDraggableElementController } from './draggable/draggable-element.controller.js';
import {
  QuickToolIdentifier,
  type SeniorTool,
  SeniorToolIdentifier,
} from './extension/index.js';
import { EdgelessCommandMenu } from './menu/command-menu.js';
import { groupEntry, menuGroups } from './menu/menu-keyboard.js';
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
/** How many frames a menu opened from the keyboard gets to draw its controls. */
const MENU_DRAW_FRAMES = 10;
const SAFE_AREA_WIDTH = 64;

/** A menu that picks an element up to drop on the canvas (the mind map's). */
type PickUpMenu = {
  draggableController: Pick<
    EdgelessDraggableElementController<unknown>,
    'cancel' | 'states'
  >;
};

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

  /** Press the highlighted button, and say whether there was one. */
  activateHighlight(): boolean {
    if (this.keyboardHighlight < 0) return false;
    const item =
      this.shadowRoot?.querySelector<HTMLElement>(
        '[data-keyboard-highlight]'
      ) ?? null;
    this.keyboardHighlight = -1;
    if (!item) return false;
    return this._pressLikePointer(item);
  }

  /** The key whose keydown pressed a row button, until its keyup. */
  private _pressKey: string | null = null;

  /** True while the toolbar presses a button itself (`_pressLikePointer`). */
  private _pressing = false;

  /**
   * Press `element` the way a pointer does, at its centre, and say whether
   * something was there to press.
   *
   * The tools bind their press at different depths: a click on an inner icon
   * button, a click on a wrapper, or a `mousedown` that a draggable (the shape
   * and mind map buttons) turns into a press when the `mouseup` comes without
   * a move. Only the pointer's whole sequence, on whatever is drawn at the
   * centre, reaches each of them the way a click does (#679, ADR 0054).
   * Dispatched rather than `.click()`: what is drawn there is often an SVG
   * shape of the icon, which has no `click()`.
   */
  private _pressLikePointer(element: HTMLElement): boolean {
    const target = deepElementAtCentre(element);
    if (!target) return false;
    const box = element.getBoundingClientRect();
    const at = {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: box.left + box.width / 2,
      clientY: box.top + box.height / 2,
      button: 0,
    };
    const pointer = { ...at, pointerId: 1, isPrimary: true };
    this._pressing = true;
    try {
      target.dispatchEvent(
        new PointerEvent('pointerdown', { ...pointer, buttons: 1 })
      );
      target.dispatchEvent(new MouseEvent('mousedown', { ...at, buttons: 1 }));
      target.dispatchEvent(new PointerEvent('pointerup', pointer));
      target.dispatchEvent(new MouseEvent('mouseup', at));
      target.dispatchEvent(new MouseEvent('click', at));
    } finally {
      this._pressing = false;
    }
    return true;
  }

  private readonly _onContainerPointerDown = (event: Event) => {
    this.clearHighlight();
    stopPropagation(event);
  };

  /**
   * A pointer never puts the focus on a button of the row (ADR 0054). Before
   * #679 no button could take focus, and a press in the toolbar left the
   * focus on the editor host, the nearest focusable ancestor: that is still
   * where it goes, so after a click every key is the canvas's, as it was, and
   * no ring shows under the mouse.
   *
   * Needed, not belt and braces: a click that changes the tool or the
   * selection sends the focus to the host anyway (`RangeBinding`), but one
   * that changes neither — the layers pane, Add file, Undo with nothing to
   * undo — would leave it on the button, which then took the arrows, Enter
   * and Space from the canvas (second review of #679; held by "after a click that moves
   * neither the tool nor the selection" in `edgeless-toolbar-keyboard.spec`).
   */
  private readonly _onContainerMouseDown = (event: MouseEvent) => {
    stopPropagation(event);
    if (this._pressing) return;
    const onRowControl = event
      .composedPath()
      .some(
        node =>
          !!this._rowButtonOf(node) ||
          (node instanceof HTMLElement &&
            node.classList.contains('senior-nav-button'))
      );
    if (!onRowControl) return;
    event.preventDefault();
    this._focusCanvas();
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

  /** What the "Next tools" arrow's tooltip previews: the tool it brings in. */
  private get _seniorNextTooltip() {
    if (this._seniorScrollNextDisabled || this._pagerTipClosed) return '';
    return this._seniorToolLabel(
      this._seniorTools[this.scrollSeniorToolIndex + this.scrollSeniorToolSize]
    );
  }

  private get _seniorPrevTooltip() {
    if (this._seniorScrollPrevDisabled || this._pagerTipClosed) return '';
    return this._seniorToolLabel(
      this._seniorTools[this.scrollSeniorToolIndex - 1]
    );
  }

  /**
   * A click on a pager arrow closes its preview until the pointer leaves the
   * arrow: the page has turned, and a preview rebuilt under a pointer that
   * did not move showed at once (`affine-tooltip` reads `:hover` when it
   * wires its reference) — a tool's name over the arrow, left there (#679,
   * criterion 5, seen with a real mouse). Read again when the pointer comes
   * back onto the arrow.
   */
  @state()
  private accessor _pagerTipClosed = false;

  private readonly _onPagerLeave = () => {
    this._pagerTipClosed = false;
  };

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
    this._pagerTipClosed = true;
    this.scrollSeniorToolIndex = Math.min(
      this._seniorTools.length - this.scrollSeniorToolSize,
      this.scrollSeniorToolIndex + this.scrollSeniorToolSize
    );
  }

  private _onSeniorNavPrev() {
    if (this._seniorScrollPrevDisabled) return;
    this._pagerTipClosed = true;
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
          @pointerleave=${this._onPagerLeave}
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
          @pointerleave=${this._onPagerLeave}
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
      () => {
        this.clearHighlight();
        // A pointer press ends the keyboard's session in the row; the
        // toolbar's own press (`_pressLikePointer`) is the keyboard's.
        if (this._pressing) return;
        this._kept = null;
        this._setKeyboardOwner(null);
      },
      { capture: true }
    );
    // A new key ends what the last keyboard press kept (`_kept`) and the wait
    // for its release (`_pressKey`): a release lost to a native dialog the
    // press opened (a file picker) must not swallow the next Space's release
    // on the canvas, which would leave its pan stuck. The row's own handlers,
    // further down, set both again for the press they make.
    this.disposables.addFromEvent(
      document,
      'keydown',
      (event: KeyboardEvent) => {
        if (event.repeat) return;
        this._kept = null;
        this._pressKey = null;
      },
      { capture: true }
    );
    this.disposables.addFromEvent(
      this.renderRoot,
      TOOLBAR_ROW_STATE_EVENT,
      this._onRowStateChange
    );
    this.disposables.addFromEvent(
      document,
      'focusout',
      this._onDocumentFocusOut,
      { capture: true }
    );
    // The key that pressed a row button is released after the press: its keyup
    // belongs to that press. Stopped here, the canvas never sees a keyup whose
    // keydown it did not get (a Space keyup there ends a pan).
    this.disposables.addFromEvent(
      document,
      'keyup',
      (event: KeyboardEvent) => {
        if (event.key !== this._pressKey) return;
        this._pressKey = null;
        event.preventDefault();
        event.stopPropagation();
      },
      { capture: true }
    );
    this.disposables.addFromEvent(
      this.renderRoot,
      'keydown',
      this._onMenuKeydown,
      { capture: true }
    );
    // The keyboard back on the canvas, or out of the editor: what it opened
    // from the row is no longer the row's to give the focus back to.
    this.disposables.addFromEvent(
      document,
      'focusin',
      (event: FocusEvent) => {
        const path = event.composedPath();
        const host = this.std.host;
        if (path[0] === host) {
          const kept = this._kept;
          if (kept?.isConnected) {
            queueMicrotask(() => {
              if (this._kept !== kept) return;
              // A control of an open menu takes the focus back and nothing
              // more: the row button that opened the menu stays its owner.
              if (this._rowButtonOf(kept)) this._focusStop(kept);
              else kept.focus();
            });
            return;
          }
          this._setKeyboardOwner(null);
        } else if (
          // The composed path, not `contains`: the panes the row opens (the
          // layers pane) keep their controls in shadow trees of the editor.
          !path.includes(host) &&
          // "More Tools" opens its menu in a portal outside the editor.
          !this._moreQuickToolsMenu
        ) {
          this._kept = null;
          this._setKeyboardOwner(null);
        }
      },
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
    this._setKeyboardOwner(null);
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
    // Written as an attribute: a custom element's `tabIndex` already reads -1
    // without one, and without one it takes no focus at all.
    new Set([...stops, ...others]).forEach(button => {
      const index = button === target ? '0' : '-1';
      if (button.getAttribute('tabindex') !== index) {
        button.setAttribute('tabindex', index);
      }
    });
  }

  /**
   * The row button `node` is, or `null`: listed by the last sync, or marked
   * by one (`onToolbarRow`) on a page the latest sync has not read yet.
   */
  private _rowButtonOf(node: EventTarget | undefined): HTMLElement | null {
    if (!(node instanceof HTMLElement)) return null;
    if (this._rowStops.some(({ button }) => button === node)) return node;
    if (node instanceof EdgelessToolIconButton && node.onToolbarRow) {
      return node;
    }
    const more = node.classList.contains('quick-tool-more-button');
    return more && this._showsMoreTools ? node : null;
  }

  /**
   * Give the row the keyboard: its Tab stop takes the focus. The canvas's
   * Tab calls it (ADR 0054). False when there is no row to give it to: the
   * presentation toolbar replaces it, or a readonly board hides it.
   */
  focusRow(): boolean {
    if (this.isPresentMode || this.store.readonly) return false;
    const stops = this._rowStops.map(({ button }) => button);
    const stop = stops.find(button => button.tabIndex === 0) ?? stops[0];
    if (!stop?.isConnected) return false;
    this._focusStop(stop);
    return true;
  }

  private _focusStop(stop: HTMLElement) {
    this._setTabStop(stop);
    this._setKeyboardOwner(stop);
    stop.focus();
  }

  private _focusCanvas() {
    this._kept = null;
    this._setKeyboardOwner(null);
    this.std.host.focus({ preventScroll: true });
  }

  /**
   * The row button the keyboard stands on, or stood on when it opened what
   * holds the focus now: a menu's control, the layers pane, a text being
   * edited. Cleared when the keyboard is back on the canvas, leaves the
   * editor, or a pointer presses. While it is set, a focus that drops to the
   * page's body comes back to it — to the row's stop if it is gone, to the
   * canvas if the row is — never left on the body (ADR 0054).
   */
  private _keyboardOwner: HTMLElement | null = null;

  /** The frame request of the look at the focus after a `focusout`, `0` for none. */
  private _focusWatch = 0;

  /** The menu controls the keyboard made focusable (`_focusControl`). */
  private readonly _tabbable = new Set<HTMLElement>();

  /**
   * Keyboard mode ends (a pointer press, the canvas, the menu closed): the
   * menus go back to what they were before the keyboard visited them. A
   * control left with its `tabindex` took the focus of a later click, which
   * then swallowed Tab and dropped Escape on the body (third review of #679).
   */
  private _releaseControls() {
    this._tabbable.forEach(control => control.removeAttribute('tabindex'));
    this._tabbable.clear();
  }

  private _setKeyboardOwner(owner: HTMLElement | null) {
    this._keyboardOwner = owner;
    if (!owner) this._releaseControls();
    if (!owner && this._focusWatch) {
      cancelAnimationFrame(this._focusWatch);
      this._focusWatch = 0;
    }
  }

  /**
   * The focus leaving for nothing (`focusout` with no `relatedTarget`) while
   * the keyboard came from the row. What drops it to the body — a menu or a
   * pane closing on its own Escape, the row re-dealt under a resize, a text
   * editor leaving — removes the focused element, which Chromium reports with
   * a `focusout` (checked in the second review of #679). One look, a frame
   * later, once the focus has settled; no frame runs while it rests.
   */
  private readonly _onDocumentFocusOut = (event: FocusEvent) => {
    if (!this._keyboardOwner || event.relatedTarget || this._focusWatch) return;
    this._focusWatch = requestAnimationFrame(this._watchFocus);
  };

  /** A page that lost the focus to the browser (Tab past its last stop) is left alone. */
  private readonly _watchFocus = () => {
    this._focusWatch = 0;
    if (!this._keyboardOwner || !this.isConnected) return;
    const active = document.activeElement;
    if (document.hasFocus() && (!active || active === document.body)) {
      this._restoreKeyboard().catch(console.error);
    }
  };

  private async _restoreKeyboard() {
    const owner = this._keyboardOwner;
    if (owner?.isConnected && owner.getClientRects().length > 0) {
      this._focusStop(owner);
      return;
    }
    this._rowStops = await this._syncRow();
    if (!this.focusRow()) this._focusCanvas();
  }

  /** What a press of a row button opened in its own shadow tree, if open. */
  private _opened: {
    button: HTMLElement;
    root: ShadowRoot;
    count: number;
  } | null = null;

  private _isOpen() {
    const opened = this._opened;
    return !!opened && opened.root.childElementCount > opened.count;
  }

  /**
   * The toolbar's keys, while a button of the row has the focus — which only
   * the keyboard gives it (ADR 0054). Every other key, and every key while
   * the focus is elsewhere, goes on to the canvas dispatcher, which listens on
   * `document`; the keys the row uses stop here, or the canvas would also move
   * the selection, pan on Space, or reset the tool on Escape.
   */
  private readonly _onRowKeydown = (event: KeyboardEvent) => {
    if (event.isComposing || event.ctrlKey || event.metaKey) return;
    const here = this._rowButtonOf(event.composedPath()[0]);
    if (!here) return;
    const consume = () => {
      event.preventDefault();
      event.stopPropagation();
    };
    switch (event.key) {
      case 'Tab':
        if (event.shiftKey) {
          // Back to the canvas: the browser's previous stop would be the
          // text of the last note on it.
          consume();
          this._focusCanvas();
          return;
        }
        // Forwards, the browser's way out of the row (one stop).
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
      case 'Enter':
      case ' ':
        consume();
        if (event.repeat) return;
        this._pressKey = event.key;
        this._press(here);
        return;
      case 'Escape':
        consume();
        this._escape();
        return;
    }
  };

  /** What the row opened and is still open: the popper's menu, or a panel. */
  private _openedMenu(): HTMLElement | null {
    const popper = this.activePopper?.element;
    if (popper?.isConnected) return popper;
    if (!this._isOpen()) return null;
    const last = this._opened?.root.lastElementChild;
    return last instanceof HTMLElement ? last : null;
  }

  /**
   * The menu model (#679 acceptance, ADR 0054): keys from inside what a row
   * button opened, caught on the way down — the templates panel stops every
   * keydown that bubbles out of it, and a menu's own handlers must not see a
   * key the model takes.
   *
   * Escape closes it and gives its button the focus back. While the keyboard
   * holds the menu (a keyboard press opened it), the arrows walk the controls
   * of a group (`menuGroups`), Home / End go to its ends, Tab / Shift+Tab move
   * to the next / previous group and, past the last or the first, close the
   * menu and give its button the focus back; Enter / Space press the control
   * as a click does. In a widget with its own keys (the colour grid, the
   * slider) only Tab and Escape are the model's. A menu the mouse opened
   * takes no key: the keyboard owner is cleared by any pointer press.
   */
  private readonly _onMenuKeydown = (event: KeyboardEvent) => {
    if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    const path = event.composedPath();
    if (this._rowButtonOf(path[0])) return;
    const menu = this._openedMenu();
    if (!menu || !path.includes(menu)) return;
    const consume = () => {
      event.preventDefault();
      event.stopPropagation();
    };
    if (event.key === 'Escape') {
      consume();
      this._escape();
      return;
    }
    if (!this._keyboardOwner) return;
    const target = path[0];
    const groups = menuGroups(menu);
    const at = groups.findIndex(group =>
      group.controls.some(control => control === target)
    );
    if (at < 0) {
      // A field of a panel (the templates' search): Tab is the browser's,
      // out of the canvas's reach.
      if (event.key === 'Tab') event.stopPropagation();
      return;
    }
    const group = groups[at];
    const controls = group.controls;
    const here = controls.indexOf(target as HTMLElement);
    // A key a widget handles itself (a width on the slider, a colour) can
    // change the selection too: the focus stays on the control (`_kept`).
    this._kept = controls[here];
    switch (event.key) {
      case 'Tab': {
        consume();
        const next = groups[at + (event.shiftKey ? -1 : 1)];
        if (next) this._focusControl(groupEntry(next));
        else this._escape();
        return;
      }
      case 'ArrowLeft':
      case 'ArrowUp':
      case 'ArrowRight':
      case 'ArrowDown': {
        if (group.own) return;
        consume();
        const dir =
          event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
        const length = controls.length;
        this._focusControl(controls[(here + dir + length) % length]);
        return;
      }
      case 'Home':
      case 'End':
        if (group.own) return;
        consume();
        this._focusControl(
          controls[event.key === 'Home' ? 0 : controls.length - 1]
        );
        return;
      case 'Enter':
      case ' ':
        if (group.own) return;
        consume();
        if (event.repeat) return;
        this._pressKey = event.key;
        this._pressMenuControl(menu, at, here).catch(console.error);
        return;
    }
  };

  /** Put the keyboard on a control of the open menu. */
  private _focusControl(control: HTMLElement) {
    // A button host takes the focus only with a `tabindex`; -1 keeps it out
    // of the page's Tab order, which the menu model owns. Given back when the
    // keyboard leaves (`_releaseControls`).
    if (!control.hasAttribute('tabindex')) {
      control.setAttribute('tabindex', '-1');
      this._tabbable.add(control);
    }
    const menu = this._openedMenu();
    // One current command: the sub-menu's highlight follows the focus.
    if (menu instanceof EdgelessCommandMenu) menu.point(control);
    this._kept = control;
    control.focus();
  }

  /**
   * Enter or Space on a control of the menu: pressed as a pointer presses it,
   * and what the press did to the menu decides where the keyboard goes — the
   * one rule of every menu, the way a click decides it. The menu is gone once
   * the press has settled: the canvas gets its keys back. It is still there
   * (an option: a shape type, Pen or Highlighter, a mode): the focus stays on
   * the control, or on the one drawn in its place if the menu redrew it.
   *
   * Only while the press is still the last thing that happened: a key typed
   * before it settled (Tab, Escape, an arrow), a pointer press or the focus
   * leaving the editor each clear or move `_kept`, and their move stands —
   * acted on regardless, Enter then Tab lost the Tab and Enter then Escape
   * sent the focus to the canvas (fourth review of #679).
   */
  private async _pressMenuControl(menu: HTMLElement, at: number, here: number) {
    const control = menuGroups(menu)[at]?.controls[here];
    if (!control) return;
    this._kept = control;
    this._pressLikePointer(control);
    await (menu as Partial<ReactiveElement>).updateComplete;
    await new Promise(resolve => requestAnimationFrame(resolve));
    if (this._kept !== control) return;
    if (this._openedMenu() !== menu) {
      this._focusCanvas();
      return;
    }
    const group = menuGroups(menu)[at];
    const same = control.isConnected
      ? control
      : group?.controls[Math.min(here, group.controls.length - 1)];
    if (!same) return;
    if (deepActiveElement() !== same) this._focusControl(same);
  }

  /**
   * After a keyboard press opened a menu: the keyboard goes into it, on its
   * first control, once the menu and the widgets in it have drawn.
   */
  private async _enterMenu() {
    const menu = this._openedMenu();
    if (!menu) return;
    await (menu as Partial<ReactiveElement>).updateComplete;
    // The widgets in it draw in their own updates, some a few frames later
    // (the shape menu's colour grid): bounded, never a wait on a timer.
    for (let frame = 0; frame < MENU_DRAW_FRAMES; frame++) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      if (this._openedMenu() !== menu || !this._keyboardOwner) return;
      const first = menuGroups(menu)[0];
      if (first) {
        this._focusControl(groupEntry(first));
        return;
      }
    }
  }

  private readonly _onRowFocusIn = (event: FocusEvent) => {
    const here = this._rowButtonOf(event.composedPath()[0]);
    if (!here) return;
    // The keyboard is in the row: the Alt+←/→ highlight would be a second
    // ring.
    this.clearHighlight();
    this._setTabStop(here);
    this._setKeyboardOwner(here);
  };

  private readonly _onRowFocusOut = (event: FocusEvent) => {
    const next = event.relatedTarget;
    if (next instanceof Node && this.toolbarContainer?.contains(next)) return;
    // Out of the row: its stop goes back to the active tool.
    this._setTabStop();
  };

  /**
   * A tool's state changed (`TOOLBAR_ROW_STATE_EVENT`): while the keyboard is
   * elsewhere, the row's stop follows the active tool.
   */
  private readonly _onRowStateChange = () => {
    const focused = deepActiveElement();
    if (this._rowStops.some(({ button }) => button === focused)) return;
    this._setTabStop();
  };

  /** One button along, its own item's next button first (pen, eraser). */
  private async _walkFocus(button: HTMLElement, dir: 1 | -1) {
    let here = this._rowStops.find(entry => entry.button === button);
    if (!here) {
      // A page turned under the keyboard and the row has not read it yet.
      this._rowStops = await this._syncRow();
      here = this._rowStops.find(entry => entry.button === button);
    }
    if (!here) {
      this.focusRow();
      return;
    }
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
   * Press the focused button as a pointer would (`_pressLikePointer`).
   * Whatever the press opens from the button — a framework's sub-menu, a
   * tool's options — takes the keyboard on its first control (`_enterMenu`,
   * then the menu model of `_onMenuKeydown`); Escape closes it and gives the
   * button the focus back. A press that only picks a tool gives the canvas
   * the keyboard back; anything else (undo, the layers pane, a text) leaves
   * it here.
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
    const root = button.getRootNode();
    const count = root instanceof ShadowRoot ? root.childElementCount : 0;
    this._kept = button;
    if (!this._pressLikePointer(button)) return;
    const grew = root instanceof ShadowRoot && root.childElementCount > count;
    this._opened = grew ? { button, root, count } : null;
    const popped = this.activePopper !== null && this.activePopper !== popper;
    if (popped || grew) {
      this._enterMenu().catch(console.error);
      return;
    }
    if (this.gfx.tool.currentToolName$.peek() !== tool) this._focusCanvas();
  }

  /**
   * The row button a keyboard press keeps the focus on. A press changes the
   * selection, and `RangeBinding` (`framework/std`) answers a selection with
   * no text in it by focusing the editor host — at once, or up to a hundred
   * milliseconds later through the store's selection — which took the
   * keyboard off the row as soon as a pointer had left a selection on the
   * canvas (#679, B4). Until the next key or pointer press, a focus landing
   * on the host goes back to the button; `_focusCanvas`, or the focus
   * leaving the editor, ends that at once.
   */
  private _kept: HTMLElement | null = null;

  /**
   * Escape closes what the row opened and gives its button the focus back;
   * with nothing open, it gives the canvas the keyboard.
   */
  private _escape() {
    this._releaseControls();
    const owner = this._keyboardOwner;
    const popper = this.activePopper;
    if (popper) {
      // A pick-up the menu armed (a mind map style) is dropped as the mouse's
      // Escape drops it: the drag cancelled (its own Escape listens on the
      // window, which a key taken here never reaches), the select tool back.
      const drag = (popper.element as Partial<PickUpMenu>).draggableController;
      const pickedUp = !!drag?.states.draggingElement;
      if (pickedUp) drag.cancel();
      popper.dispose();
      this.activePopper = null;
      if (pickedUp) this.gfx.tool.setTool(DefaultTool);
      if (owner?.isConnected) {
        this._kept = owner;
        this._focusStop(owner);
      }
      return;
    }
    const opened = this._opened;
    if (opened && this._isOpen() && opened.button.isConnected) {
      // Closed the way it opened: its button toggles it.
      this._opened = null;
      this._kept = opened.button;
      this._pressLikePointer(opened.button);
      this._focusStop(opened.button);
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
              @mousedown=${this._onContainerMouseDown}
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
 * A pager arrow's tooltip: a preview of the senior tool it brings in (its
 * accessible name stays "Next tools" / "Previous tools"). Keyed by that name:
 * a tooltip shows a copy of its content taken when the pointer came in, so a
 * new tool is a new tooltip. Empty while a click has closed it
 * (`_pagerTipClosed`).
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
