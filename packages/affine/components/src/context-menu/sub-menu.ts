import { IS_MOBILE } from '@labre/global/env';
import { ArrowRightSmallIcon } from '@blocksuite/icons/lit';
import {
  autoPlacement,
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
} from '@floating-ui/dom';
import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';

import { MenuFocusable } from './focusable.js';
import { Menu, type MenuOptions, type SubMenuSide } from './menu.js';
import { popMenu, popupTargetFromElement } from './menu-renderer.js';
import type { MenuItemRender } from './types.js';

export type MenuSubMenuData = {
  content: () => TemplateResult;
  options: MenuOptions;
  select?: () => void;
  class?: string;
  /** Names the entry itself; `options.testId` names the menu it opens. */
  testId?: string;
};
export const subMenuOffset = offset({
  mainAxis: 16,
  crossAxis: -8.5,
});
export const subMenuPlacements = autoPlacement({
  allowedPlacements: ['right-start', 'left-start', 'right-end', 'left-end'],
});
export const subMenuMiddleware = [subMenuOffset, subMenuPlacements];

/**
 * Where a nested sub-menu opens: on the side its parent opened on, right for
 * a menu's first sub-menu, the other side only when it does not fit there.
 * `autoPlacement` took the side with the most room, so a third level drawn
 * from a menu sitting right of the page's middle went left, back over the
 * first menu, instead of beside the second (#571).
 */
export function nestedSubMenuPosition(parentSide: SubMenuSide | undefined) {
  const side = parentSide ?? 'right';
  const other = side === 'right' ? 'left' : 'right';
  return {
    placement: `${side}-start` as const,
    middleware: [
      subMenuOffset,
      flip({
        fallbackPlacements: [`${other}-start`, `${side}-end`, `${other}-end`],
      }),
      shift({ padding: 8 }),
    ],
  };
}

export class MenuSubMenu extends MenuFocusable {
  createTime = 0;

  override connectedCallback() {
    super.connectedCallback();
    this.createTime = Date.now();
    this.disposables.addFromEvent(this, 'mouseenter', this.onMouseEnter);
    this.disposables.addFromEvent(this, 'click', e => {
      e.preventDefault();
      e.stopPropagation();
      if (this.data.select) {
        this.data.select();
        this.menu.close();
      } else {
        this.openSubMenu();
      }
    });
  }

  onMouseEnter() {
    if (Date.now() - this.createTime > 100) {
      this.openSubMenu();
    }
  }

  override onPressEnter() {
    this.onMouseEnter();
  }

  openSubMenu() {
    const focus = this.menu.currentFocused$.value;
    const menu = new Menu({
      ...this.data.options,
      // An entry picked at any depth completes the whole chain: this menu's
      // own completion runs too, so a pick two levels down closes the root
      // as a pick one level down always did (#571: "Link an existing source"
      // → database → source left the creation popover open, and the next
      // click only closed it).
      onComplete: () => {
        this.menu.options.onComplete?.();
        this.menu.close();
      },
      onClose: () => {
        menu.menuElement.remove();
        this.menu.focusTo(focus);
        this.data.options.onClose?.();
        unsub();
      },
    });
    this.menu.menuElement.parentElement?.append(menu.menuElement);
    const position = nestedSubMenuPosition(this.menu.side);
    const unsub = autoUpdate(this, menu.menuElement, () => {
      computePosition(this, menu.menuElement, position)
        .then(({ x, y, placement }) => {
          menu.side = placement.startsWith('left') ? 'left' : 'right';
          menu.menuElement.style.left = `${x}px`;
          menu.menuElement.style.top = `${y}px`;
        })
        .catch(err => console.error(err));
    });
    this.menu.openSubMenu(menu);
    // The sub-menu can still be open when this component is removed: without
    // this the `autoUpdate` listeners outlive the element and leak.
    this.disposables.add(unsub);
  }

  protected override render(): unknown {
    const classString = classMap({
      [this.data.class ?? '']: true,
      'affine-menu-button': true,
      focused: this.isFocused$.value,
    });
    return html` <div
      class="${classString}"
      data-testid=${ifDefined(this.data.testId)}
    >
      ${this.data.content()}
    </div>`;
  }

  @property({ attribute: false })
  accessor data!: MenuSubMenuData;
}

export class MobileSubMenu extends MenuFocusable {
  override connectedCallback() {
    super.connectedCallback();
    this.disposables.addFromEvent(this, 'click', e => {
      e.preventDefault();
      e.stopPropagation();
      this.openSubMenu();
    });
  }

  onMouseEnter() {
    this.openSubMenu();
  }

  override onPressEnter() {
    this.onMouseEnter();
  }

  openSubMenu() {
    const { menu } = popMenu(popupTargetFromElement(this), {
      options: {
        ...this.data.options,
        onComplete: () => {
          this.menu.close();
        },
        onClose: () => {
          menu.menuElement.remove();
          this.data.options.onClose?.();
        },
      },
    });
    this.menu.openSubMenu(menu);
  }

  protected override render(): unknown {
    const classString = classMap({
      [this.data.class ?? '']: true,
      'mobile-menu-button': true,
      focused: this.isFocused$.value,
    });
    return html` <div
      class="${classString}"
      data-testid=${ifDefined(this.data.testId)}
    >
      ${this.data.content()}
    </div>`;
  }

  @property({ attribute: false })
  accessor data!: MenuSubMenuData;
}

export const renderSubMenu = (data: MenuSubMenuData, menu: Menu) => {
  if (IS_MOBILE) {
    return html` <mobile-sub-menu
      .data="${data}"
      .menu="${menu}"
    ></mobile-sub-menu>`;
  }
  return html` <affine-menu-sub-menu
    .data="${data}"
    .menu="${menu}"
  ></affine-menu-sub-menu>`;
};

export const subMenuItems = {
  subMenu:
    (config: {
      name: string;
      label?: () => TemplateResult;
      select?: () => void;
      isSelected?: boolean;
      postfix?: TemplateResult;
      prefix?: TemplateResult;
      class?: string;
      testId?: string;
      options: MenuOptions;
      disableArrow?: boolean;
      hide?: () => boolean;
    }) =>
    menu => {
      if (config.hide?.() || !menu.search(config.name)) {
        return;
      }
      const data: MenuSubMenuData = {
        content: () =>
          html`${config.prefix}
            <div class="affine-menu-action-text">
              ${config.label?.() ?? config.name}
            </div>
            ${config.postfix}
            ${config.disableArrow ? nothing : ArrowRightSmallIcon()} `,
        class: config.class,
        testId: config.testId,
        options: config.options,
      };
      return renderSubMenu(data, menu);
    },
} satisfies Record<string, MenuItemRender<never>>;
