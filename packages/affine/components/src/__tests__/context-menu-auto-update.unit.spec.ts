import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

const { cleanups } = vi.hoisted(() => ({
  cleanups: [] as Array<{ called: number }>,
}));

vi.mock('@floating-ui/dom', async importOriginal => {
  const actual = await importOriginal<typeof import('@floating-ui/dom')>();
  return {
    ...actual,
    // A positioning loop that is never stopped is exactly the leak under test,
    // so the loop is replaced by a bookkeeping stub.
    autoUpdate: () => {
      const record = { called: 0 };
      cleanups.push(record);
      return () => {
        record.called++;
      };
    },
    computePosition: () =>
      Promise.resolve({
        x: 0,
        y: 0,
        placement: 'bottom' as const,
        strategy: 'absolute' as const,
        middlewareData: {},
      }),
  };
});

import { effects } from '../context-menu/index.js';
import { Menu } from '../context-menu/menu.js';
import {
  createPopup,
  popupTargetFromElement,
} from '../context-menu/menu-renderer.js';
import { MenuSubMenu } from '../context-menu/sub-menu.js';

beforeAll(() => {
  effects();
});

beforeEach(() => {
  cleanups.length = 0;
  document.body.replaceChildren();
});

const anchor = () => {
  const element = document.createElement('div');
  document.body.append(element);
  return element;
};

describe('createPopup', () => {
  test('stops the positioning loop when the popup closes', () => {
    const content = document.createElement('div');
    const close = createPopup(popupTargetFromElement(anchor()), content);

    expect(cleanups).toHaveLength(1);
    expect(cleanups[0].called).toBe(0);

    close();

    expect(cleanups[0].called).toBe(1);
  });
});

describe('MenuSubMenu', () => {
  const openSubMenu = async () => {
    const menu = new Menu({ items: [] });
    document.body.append(menu.menuElement);

    const subMenu = new MenuSubMenu();
    subMenu.menu = menu;
    subMenu.data = { content: () => undefined as never, options: { items: [] } };
    menu.menuElement.append(subMenu);
    await subMenu.updateComplete;

    subMenu.openSubMenu();
    expect(cleanups).toHaveLength(1);

    return subMenu;
  };

  test('stops the positioning loop when the sub-menu is closed', async () => {
    const subMenu = await openSubMenu();

    subMenu.menu.closeSubMenu();

    expect(cleanups[0].called).toBeGreaterThanOrEqual(1);
  });

  test('stops the positioning loop when removed while still open', async () => {
    const subMenu = await openSubMenu();

    // The sub-menu is never closed: only the owning element goes away.
    subMenu.remove();

    expect(cleanups[0].called).toBe(1);
  });
});
