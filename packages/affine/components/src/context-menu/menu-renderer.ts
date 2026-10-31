import { translateKey } from '@labre/affine-shared/services';
import { unsafeCSSVar, unsafeCSSVarV2 } from '@labre/affine-shared/theme';
import { IS_MOBILE } from '@labre/global/env';
import { SignalWatcher, WithDisposable } from '@labre/global/lit';
import {
  ArrowLeftBigIcon,
  ArrowLeftSmallIcon,
  CloseIcon,
  SearchIcon,
} from '@blocksuite/icons/lit';
import type { BlockStdScope } from '@labre/std';
import { ShadowlessElement, stdContext } from '@labre/std';
import { RANGE_SYNC_EXCLUDE_ATTR } from '@labre/std/inline';
import {
  autoPlacement,
  autoUpdate,
  computePosition,
  type Middleware,
  offset,
  type Placement,
  type ReferenceElement,
  shift,
} from '@floating-ui/dom';
import { consume, ContextEvent, ContextProvider } from '@lit/context';
import { css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { styleMap } from 'lit/directives/style-map.js';

import type { MenuFocusable } from './focusable.js';
import { Menu, type MenuConfig, type MenuOptions } from './menu.js';
import type { MenuComponentInterface } from './types.js';
import { CONTEXT_MENU_DONE, CONTEXT_MENU_NO_RESULTS } from '../translations.js';

export class MenuComponent
  extends SignalWatcher(WithDisposable(ShadowlessElement))
  implements MenuComponentInterface
{
  @consume({ context: stdContext })
  accessor std!: BlockStdScope;

  static override styles = css`
    /* A menu portals out of the editor (to the body by default), so it
       carries the editor host's border box itself (std's EditorHost). */
    affine-menu,
    affine-menu *,
    affine-menu *::before,
    affine-menu *::after {
      box-sizing: border-box;
    }

    affine-menu {
      font-family: var(--affine-font-family);
      display: flex;
      flex-direction: column;
      user-select: none;
      min-width: 180px;
      box-shadow: ${unsafeCSSVar('overlayPanelShadow')};
      border-radius: 4px;
      background-color: ${unsafeCSSVarV2('layer/background/overlayPanel')};
      padding: 8px;
      position: absolute;
      z-index: 999;
      gap: 8px;
      border: 0.5px solid ${unsafeCSSVarV2('layer/insideBorder/border')};
      color: ${unsafeCSSVarV2('text/primary')};
    }

    /* A search field shown from the start carries its placeholder whole
       (labre recette of 2.3: « Rechercher ou créer une source », 212px in
       Inter 14px, was cut). The field is the menu less 66px: its padding,
       border, icon and gap, and the menu's padding. */
    affine-menu[data-search-field] {
      min-width: 288px;
    }

    .affine-menu-search-container {
      border-radius: 4px;
      display: flex;
      align-items: center;
      padding: 4px 10px;
      gap: 8px;
      border: 1px solid ${unsafeCSSVarV2('input/border/default')};
    }

    /* Shrinks with its row: an input's intrinsic width (min-width: auto)
       kept it 190px wide past the menu's edge (labre recette of 2.1). */
    .affine-menu-search {
      flex: 1;
      min-width: 0;
      width: 100%;
      outline: none;
      font-size: 14px;
      line-height: 22px;
      border: none;
      background-color: transparent;
    }

    .affine-menu-body {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .no-results {
      font-size: 12px;
      line-height: 20px;
      color: var(--affine-text-secondary-color);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: 8px;
    }
  `;

  private readonly _clickContainer = (e: MouseEvent) => {
    e.stopPropagation();
    this.focusInput();
    this.menu.closeSubMenu();
  };

  private readonly searchRef = createRef<HTMLInputElement>();

  override firstUpdated() {
    const input = this.searchRef.value;
    if (input) {
      requestAnimationFrame(() => {
        this.focusInput();
      });
      const length = input.value.length;
      input.setSelectionRange(length, length);
      this.disposables.addFromEvent(input, 'keydown', e => {
        e.stopPropagation();
        if (e.key === 'Escape') {
          this.menu.close();
          return;
        }
        const onBack = this.menu.options.title?.onBack;
        if (e.key === 'Backspace' && onBack && !this.menu.showSearch$.value) {
          this.menu.close();
          onBack(this.menu);
          return;
        }
        if (e.key === 'Enter' && !e.isComposing) {
          this.menu.pressEnter();
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.menu.focusPrev();
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.menu.focusNext();
          return;
        }
      });

      this.disposables.addFromEvent(input, 'copy', e => {
        e.stopPropagation();
      });
      this.disposables.addFromEvent(input, 'cut', e => {
        e.stopPropagation();
      });
      this.disposables.addFromEvent(this, 'click', this._clickContainer);
    }
  }

  focusInput() {
    this.searchRef.value?.focus();
  }

  focusTo(ele?: MenuFocusable) {
    this.menu.setFocusOnly(ele);
    this.focusInput();
  }

  getFirstFocusableElement(): HTMLElement | null {
    return this.querySelector('[data-focusable="true"]');
  }

  getFocusableElements(): HTMLElement[] {
    return Array.from(this.querySelectorAll('[data-focusable="true"]'));
  }

  override render() {
    const result = this.menu.renderItems(this.menu.options.items);
    return html`
      ${this.renderTitle()} ${this.renderSearch()}
      <div class="affine-menu-body">
        ${result.length === 0 && this.menu.enableSearch
          ? html` <div class="no-results">
              ${this.std
                ? translateKey(this.std, ...CONTEXT_MENU_NO_RESULTS)
                : CONTEXT_MENU_NO_RESULTS[1]}
            </div>`
          : ''}
        ${result}
      </div>
    `;
  }

  renderSearch() {
    const config = this.menu.options.search;
    this.toggleAttribute('data-search-field', Boolean(config?.placeholder));
    const showSearch = this.menu.showSearch$.value || config?.placeholder;
    const searchStyle = styleMap({
      opacity: showSearch ? '1' : '0',
      height: showSearch ? undefined : '0',
      overflow: showSearch ? undefined : 'hidden',
      position: showSearch ? undefined : 'absolute',
      pointerEvents: showSearch ? undefined : 'none',
    });
    return html` <div style=${searchStyle} class="affine-menu-search-container">
      <div
        style="font-size:20px;display:flex;align-items:center;color: var(--affine-text-secondary-color)"
      >
        ${SearchIcon()}
      </div>
      <input
        autocomplete="off"
        class="affine-menu-search"
        placeholder="${config?.placeholder ?? ''}"
        data-1p-ignore
        ${ref(this.searchRef)}
        type="text"
        value="${this.menu.searchName$.value}"
        @input="${(e: Event) =>
          (this.menu.searchName$.value = (e.target as HTMLInputElement).value)}"
      />
    </div>`;
  }

  renderTitle() {
    const title = this.menu.options.title;
    if (!title) {
      return;
    }
    return html`
      <div
        style="display:flex;align-items:center;gap: 4px;padding:3px 4px 3px 2px"
        @mouseenter="${() => this.menu.closeSubMenu()}"
      >
        ${title.onBack
          ? html` <div
              @click="${() => {
                title.onBack?.(this.menu);
                this.menu.close();
              }}"
              class="dv-icon-20 dv-hover dv-pd-2 dv-round-4"
              style="display:flex;"
            >
              ${ArrowLeftBigIcon()}
            </div>`
          : nothing}
        <div
          style="flex:1;font-weight:500;font-size: 14px;line-height: 22px;color: var(--affine-text-primary-color)"
        >
          ${title.text}
        </div>
        ${title.postfix?.()}
        ${title.onClose
          ? html` <div
              @click="${title.onClose}"
              class="dv-icon-20 dv-hover dv-pd-2 dv-round-4"
              style="display:flex;"
            >
              ${CloseIcon()}
            </div>`
          : nothing}
      </div>
    `;
  }

  @property({ attribute: false })
  accessor menu!: Menu;
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-menu': MenuComponent;
  }
}

export class MobileMenuComponent
  extends SignalWatcher(WithDisposable(ShadowlessElement))
  implements MenuComponentInterface
{
  @consume({ context: stdContext })
  accessor std!: BlockStdScope;

  static override styles = css`
    /* A bottom action sheet, not a full-screen page: the view stays visible
       above it and a tap on the scrim closes it (popMobileMenu). */
    mobile-menu {
      max-height: 85%;
      font-family: var(--affine-font-family);
      display: flex;
      flex-direction: column;
      user-select: none;
      width: 100%;
      background-color: ${unsafeCSSVarV2('layer/background/secondary')};
      padding: 8px 8px calc(8px + env(safe-area-inset-bottom, 0px)) 8px;
      position: absolute;
      left: 0;
      bottom: 0;
      border-radius: 12px 12px 0 0;
      box-shadow: var(--affine-overlay-shadow);
      z-index: 999;
      color: ${unsafeCSSVarV2('text/primary')};
    }

    .mobile-menu-body {
      display: flex;
      flex-direction: column;
      padding: 24px 16px;
      gap: 16px;
      flex: 1;
      overflow-y: auto;
    }
  `;

  onClose = () => {
    const close = this.menu.options.title?.onClose;
    if (close) {
      close();
    } else {
      this.menu.close();
    }
  };

  focusTo(ele?: MenuFocusable) {
    this.menu.setFocusOnly(ele);
  }

  getFirstFocusableElement(): HTMLElement | null {
    return this.querySelector('[data-focusable="true"]');
  }

  getFocusableElements(): HTMLElement[] {
    return Array.from(this.querySelectorAll('[data-focusable="true"]'));
  }

  override render() {
    const result = this.menu.renderItems(this.menu.options.items);
    return html`
      ${this.renderTitle()}
      <div class="mobile-menu-body">${result}</div>
    `;
  }

  /**
   * Back, title, "Done": the two ends share what the title leaves, so the
   * title stays centred, and "Done" is never cut, whatever its translation
   * ("Terminé" overflowed the 50px it had).
   */
  renderTitle() {
    const title = this.menu.options.title;
    return html`
      <div
        style="display:flex;align-items:center;height: 44px;"
        @mouseenter="${() => this.menu.closeSubMenu()}"
      >
        <div style="flex: 1 1 0;min-width: 50px;margin-left: 10px;">
          ${title?.onBack
            ? html` <div
                @click="${() => {
                  title.onBack?.(this.menu);
                  this.menu.close();
                }}"
                style="
                display:flex;
                font-size: 24px;
                align-items:center;
"
              >
                ${ArrowLeftSmallIcon()}
              </div>`
            : nothing}
        </div>
        <div
          style="
          flex: 0 1 auto;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 17px;
          font-style: normal;
          font-weight: 500;
          line-height: 22px;
          color: var(--affine-text-primary-color);
          text-align: center;
"
        >
          ${title?.text}
        </div>
        <div
          @click="${this.onClose}"
          data-testid="mobile-menu-done"
          style="
          display:flex;
          justify-content: flex-end;
          font-weight: 500;
          font-size: 17px;
          color: ${unsafeCSSVarV2('button/primary')};
          flex: 1 1 0;
          min-width: max-content;
          white-space: nowrap;
          margin-right: 10px;
         "
        >
          ${this.std
            ? translateKey(this.std, ...CONTEXT_MENU_DONE)
            : CONTEXT_MENU_DONE[1]}
        </div>
      </div>
    `;
  }

  @property({ attribute: false })
  accessor menu!: Menu;
}

declare global {
  interface HTMLElementTagNameMap {
    'mobile-menu': MobileMenuComponent;
  }
}

/**
 * Marks the element the popups opened inside it hang from, before the
 * editor host: a host that clips what it holds names an ancestor outside
 * the clipping box (the database full page, whose scroller masks and
 * contains its editor). `createPopup` gives such a popup the editor's `std`.
 */
export const POPUP_ROOT_ATTR = 'data-popup-root';

export const getDefaultModalRoot = (ele: HTMLElement) => {
  const declared = ele.closest<HTMLElement>(`[${POPUP_ROOT_ATTR}]`);
  if (declared) {
    return declared;
  }
  const host: HTMLElement | null =
    ele.closest('editor-host') ?? ele.closest('.data-view-popup-container');
  if (host) {
    return host;
  }
  return document.body;
};
export const createModal = (container: HTMLElement = document.body) => {
  const div = document.createElement('div');
  div.setAttribute(RANGE_SYNC_EXCLUDE_ATTR, 'true');
  div.style.pointerEvents = 'auto';
  div.style.position = 'absolute';
  div.style.left = '0';
  div.style.top = '0';
  div.style.width = '100%';
  div.style.height = '100%';
  div.style.zIndex = '1001';
  div.style.fontFamily = 'var(--affine-font-family)';
  container.append(div);
  return div;
};
export type PopupTarget = {
  targetRect: ReferenceElement;
  root: HTMLElement;
  popupStart: () => () => void;
  /** The element the popup opens from, when there is one. */
  element?: HTMLElement;
};
export const popupTargetFromElement = (element: HTMLElement): PopupTarget => {
  let rect = element.getBoundingClientRect();
  let count = 0;
  let isActive = false;
  return {
    targetRect: {
      getBoundingClientRect: () => {
        if (element.isConnected) {
          return (rect = element.getBoundingClientRect());
        }
        return rect;
      },
    },
    root: getDefaultModalRoot(element),
    element,
    popupStart: () => {
      if (!count) {
        isActive = element.classList.contains('active');
        if (!isActive) {
          element.classList.add('active');
        }
      }
      count++;
      return () => {
        count--;
        if (!count && !isActive) {
          element.classList.remove('active');
        }
      };
    },
  };
};
/**
 * The open popups, oldest first. Escape closes the newest, wherever the focus
 * is: a menu's own Escape lives on its search input (`MenuComponent`), so a
 * menu that keeps itself open on a click (a colour swatch, "Add a condition",
 * the filter editor's own popups) lost it with the focus, and nothing closed
 * it any more (product owner, 2026-10-28). Listened to in the bubbling phase,
 * so an input that handles Escape itself and stops it keeps its own close.
 */
const openPopups: Array<() => void> = [];

const onDocumentKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape' || event.defaultPrevented) return;
  const close = openPopups.at(-1);
  if (!close) return;
  event.preventDefault();
  close();
};

/**
 * How a desktop popup and its sub-menus are placed: against the window, not
 * the box they hang in. That box sits in a host's scroller: placed absolute,
 * a popup was cut at the scroller's edges, the part past its left edge going
 * under the host's sidebar, and the part past its right edge widened the
 * scroll area, which the search field's focus then scrolled, sliding the view
 * under the sidebar too (labre recette of 2.4, a narrow window). Fixed, it is
 * neither cut nor counted by a scroller, and `shift` keeps it inside the
 * window, as long as no ancestor of its modal contains or masks it (then the
 * clipping box names a root outside itself: `POPUP_ROOT_ATTR`).
 */
export const POPUP_STRATEGY = 'fixed' as const;

export const createPopup = (
  target: PopupTarget,
  content: HTMLElement,
  options?: {
    onClose?: () => void;
    middleware?: Array<Middleware | null | undefined | false>;
    container?: HTMLElement;
    /** Told where the popup was placed, at each placement. */
    onPlaced?: (placement: Placement) => void;
  }
) => {
  const close = () => {
    const index = openPopups.indexOf(close);
    if (index >= 0) openPopups.splice(index, 1);
    if (!openPopups.length) {
      document.removeEventListener('keydown', onDocumentKeydown);
    }
    // Removing the modal does not stop the positioning loop: without this the
    // `autoUpdate` listeners outlive the popup and leak.
    cleanup();
    modal.remove();
    options?.onClose?.();
  };
  if (!openPopups.length) {
    document.addEventListener('keydown', onDocumentKeydown);
  }
  openPopups.push(close);
  const modal = createModal(target.root);
  // A modal hung outside the editor (`POPUP_ROOT_ATTR`) asks for `std` where
  // nothing provides it: it provides the editor of the element it opens from.
  if (!target.root.closest('editor-host')) {
    const std = stdAround(target.element);
    if (std) {
      new ContextProvider(modal, { context: stdContext, initialValue: std });
    }
  }
  // Measured in the DOM: the first placement of a detached popup read a
  // zero size and picked its side from it.
  modal.append(content);
  content.style.position = POPUP_STRATEGY;
  const cleanup = autoUpdate(target.targetRect, content, () => {
    computePosition(target.targetRect, content, {
      strategy: POPUP_STRATEGY,
      middleware: options?.middleware ?? [shift({ crossAxis: true })],
    })
      .then(({ x, y, placement }) => {
        options?.onPlaced?.(placement);
        Object.assign(content.style, {
          left: `${x}px`,
          top: `${y}px`,
        });
      })
      .catch(console.error);
  });

  modal.onpointerdown = ev => {
    if (ev.target === modal) {
      close();
    }
  };

  modal.onmousedown = ev => {
    if (ev.target === modal) {
      close();
    }
  };

  modal.oncontextmenu = ev => {
    ev.preventDefault();
    if (ev.target === modal) {
      close();
    }
  };

  return close;
};

export type MenuHandler = {
  close: () => void;
  menu: Menu;
  reopen: () => void;
};

/** The editor an element sits in, asked the way a `@consume` asks. */
const stdAround = (element: HTMLElement | undefined) => {
  let std: BlockStdScope | undefined;
  element?.dispatchEvent(
    new ContextEvent(stdContext, element, value => {
      std = value;
    })
  );
  return std;
};

/**
 * A phone's sheet hangs from the body, out of the editor's DOM, where nothing
 * provides `std`: its modal provides the editor of the element it opens from,
 * so the sheet's "Done" and whatever it renders speak the host's catalogue,
 * and a sub-menu opened from it finds the same editor again.
 */
const popMobileMenu = (
  options: MenuOptions,
  target?: PopupTarget
): MenuHandler => {
  const model = createModal(document.body);
  const std = stdAround(target?.element);
  if (std) {
    new ContextProvider(model, { context: stdContext, initialValue: std });
  }
  model.style.position = 'fixed';
  model.style.background = 'var(--affine-v2-layer-background-mobile-modal)';
  model.addEventListener('click', e => {
    if (e.target === model) menu.close();
  });
  const menu = new Menu({
    ...options,
    onClose: () => {
      closePopup();
    },
  });
  model.append(menu.menuElement);
  const closePopup = () => {
    model.remove();
    options.onClose?.();
  };
  return {
    close: () => {
      menu.close();
    },
    menu,
    reopen: () => {
      menu.close();
      popMobileMenu(options, target);
    },
  };
};

export const popMenu = (
  target: PopupTarget,
  props: {
    options: MenuOptions;
    middleware?: Array<Middleware | null | undefined | false>;
    container?: HTMLElement;
  }
): MenuHandler => {
  if (IS_MOBILE) {
    return popMobileMenu(props.options, target);
  }
  const popupEnd = target.popupStart();
  const onClose = () => {
    props.options.onClose?.();
    popupEnd();
    closePopup();
  };
  const menu = new Menu({
    ...props.options,
    onClose: onClose,
  });
  const closePopup = createPopup(target, menu.menuElement, {
    onClose: () => {
      menu.close();
    },
    // A menu placed beside its anchor opens its sub-menus on that side too.
    onPlaced: placement => {
      if (placement.startsWith('left')) menu.side = 'left';
      else if (placement.startsWith('right')) menu.side = 'right';
    },
    middleware: props.middleware ?? [
      autoPlacement({
        allowedPlacements: [
          'bottom-start',
          'bottom-end',
          'top-start',
          'top-end',
        ],
      }),
      offset(4),
      // Keep the menu inside the viewport: on a constrained viewport the
      // allowed placements can all overflow, and without a shift the menu
      // simply hangs off the edge of the screen.
      shift({ padding: 8 }),
    ],
    container: props.container,
  });
  return {
    close: closePopup,
    menu,
    reopen: () => {
      popMenu(target, props);
    },
  };
};
export const popFilterableSimpleMenu = (
  target: PopupTarget,
  options: MenuConfig[],
  onClose?: () => void
) => {
  popMenu(target, {
    options: {
      items: options,
      onClose,
    },
  });
};
