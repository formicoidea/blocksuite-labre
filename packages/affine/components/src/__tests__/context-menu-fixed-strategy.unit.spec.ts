/**
 * What this would have caught: the labre recette of 2.4 (2026-10-31). On a
 * narrow window the view settings' "Source" list and "+ view" (288px wide)
 * opened partly under the host's left sidebar.
 *
 * A popup's modal hangs inside the editor (`getDefaultModalRoot`), and a page
 * editor sits in its own scroller, `.affine-page-viewport`. Placed `absolute`,
 * the menu was clipped by that scroller, so whatever crossed its left edge
 * disappeared under the sidebar beside it; whatever crossed its right edge
 * widened the scroll area, the search field's focus scrolled it sideways, and
 * the whole database slid under the sidebar too. Placed `fixed`, the menu is
 * neither clipped nor counted in the scroll area, and `shift` keeps it inside
 * the window. The first placement also ran on a popup not yet in the page,
 * which measures zero.
 *
 * Fixed is not enough inside a box that contains or masks its content (the
 * database full page's viewport: `container-type`, `mask`): such a box cuts
 * a fixed descendant too. It names a root outside itself
 * (`POPUP_ROOT_ATTR`), where the popup gets the editor's `std` from its modal.
 *
 * There is no layout engine here, so this holds the contract (the strategy
 * given to floating-ui, the position written on the element, the popup in the
 * page when it is first placed), not the geometry.
 */
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

const { calls } = vi.hoisted(() => ({
  calls: [] as Array<{
    strategy: string | undefined;
    connected: boolean;
  }>,
}));

vi.mock('@floating-ui/dom', async importOriginal => {
  const actual = await importOriginal<typeof import('@floating-ui/dom')>();
  return {
    ...actual,
    autoUpdate: (
      _reference: unknown,
      _floating: unknown,
      update: () => void
    ) => {
      update();
      return () => {};
    },
    computePosition: (
      _reference: unknown,
      floating: HTMLElement,
      options?: { strategy?: string }
    ) => {
      calls.push({
        strategy: options?.strategy,
        connected: floating.isConnected,
      });
      return Promise.resolve({
        x: 0,
        y: 0,
        placement: 'bottom-start' as const,
        strategy: options?.strategy ?? 'absolute',
        middlewareData: {},
      });
    },
  };
});

import { type BlockStdScope, stdContext } from '@labre/std';
import { ContextEvent, ContextProvider } from '@lit/context';

import { effects } from '../context-menu/index.js';
import { Menu } from '../context-menu/menu.js';
import {
  createPopup,
  getDefaultModalRoot,
  POPUP_ROOT_ATTR,
  POPUP_STRATEGY,
  popupTargetFromElement,
} from '../context-menu/menu-renderer.js';
import {
  MenuSubMenu,
  nestedSubMenuPosition,
} from '../context-menu/sub-menu.js';

beforeAll(() => {
  effects();
});

beforeEach(() => {
  calls.length = 0;
  document.body.replaceChildren();
});

const anchor = () => {
  const element = document.createElement('div');
  document.body.append(element);
  return element;
};

test('a popup is placed against the window', () => {
  expect(POPUP_STRATEGY).toBe('fixed');
});

describe('createPopup', () => {
  test('places the popup fixed, with the strategy floating-ui computes for', () => {
    const content = document.createElement('div');
    const close = createPopup(popupTargetFromElement(anchor()), content);

    expect(content.style.position).toBe('fixed');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.strategy).toBe('fixed');

    close();
  });

  test('measures the popup in the page, not detached', () => {
    const content = document.createElement('div');
    const close = createPopup(popupTargetFromElement(anchor()), content);

    expect(calls[0]?.connected).toBe(true);

    close();
  });
});

describe('a popup root declared outside the editor', () => {
  // A host that clips what it holds names a root outside the clipping box
  // (the database full page): a fixed popup in a box that contains or masks
  // it is still cut there.
  const mount = () => {
    const root = document.createElement('div');
    root.setAttribute(POPUP_ROOT_ATTR, '');
    const host = document.createElement('editor-host');
    const element = document.createElement('button');
    host.append(element);
    root.append(host);
    document.body.append(root);
    const std = { marker: 'std' } as unknown as BlockStdScope;
    new ContextProvider(host, { context: stdContext, initialValue: std });
    return { root, element, std };
  };

  test('hangs the popup from the declared root, before the editor host', () => {
    const { root, element } = mount();

    expect(getDefaultModalRoot(element)).toBe(root);
  });

  test("gives the popup the editor's std, which nothing provides there", () => {
    const { root, element, std } = mount();
    const content = document.createElement('div');
    const close = createPopup(popupTargetFromElement(element), content);

    expect(content.closest('editor-host')).toBeNull();
    expect(root.contains(content)).toBe(true);
    let received: unknown;
    content.dispatchEvent(
      new ContextEvent(stdContext, content, value => {
        received = value;
      })
    );
    expect(received).toBe(std);

    close();
  });
});

describe('MenuSubMenu', () => {
  test('places a sub-menu fixed beside its fixed parent', async () => {
    const menu = new Menu({ items: [] });
    document.body.append(menu.menuElement);

    const subMenu = new MenuSubMenu();
    subMenu.menu = menu;
    subMenu.data = {
      content: () => undefined as never,
      options: { items: [] },
    };
    menu.menuElement.append(subMenu);
    await subMenu.updateComplete;

    subMenu.openSubMenu();

    const opened = menu.menuElement.parentElement?.lastElementChild as
      | HTMLElement
      | undefined;
    expect(opened).not.toBe(menu.menuElement);
    expect(opened?.style.position).toBe('fixed');
    expect(calls.at(-1)?.strategy).toBe('fixed');

    subMenu.remove();
  });

  test('computes a nested position with the same strategy', () => {
    expect(nestedSubMenuPosition('right').strategy).toBe('fixed');
    expect(nestedSubMenuPosition('left').strategy).toBe('fixed');
  });
});
