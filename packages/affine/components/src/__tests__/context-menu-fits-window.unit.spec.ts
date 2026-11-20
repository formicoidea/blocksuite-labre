/**
 * What this would have caught: the product owner's acceptance of the
 * database work. "The menu is in overflow-hidden mode when the number of rows
 * in the base is not large enough": a column menu opened on a base of three
 * rows, on its full page, ran past the bottom of the window, and "Duplicate"
 * and "Delete" could not be reached.
 *
 * A menu is placed `fixed` against the window (`POPUP_STRATEGY`). On a tall
 * page the reader scrolled the anchor up and the menu with it; on a short
 * one nothing scrolled. Every menu, with the default placement or a caller's
 * own middleware, and every nested sub-menu, ends its middleware with
 * `fitToWindowHeight`: capped at the room on its side, it scrolls inside
 * itself.
 *
 * There is no layout engine here, so this holds the contract (the middleware
 * given to floating-ui, the cap it writes on the panel); the geometry, a
 * real short window and a real click on the last entry, is the integration
 * spec's job: `database-menu-fits-viewport.spec.ts`.
 */
import { offset } from '@floating-ui/dom';
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

const { calls } = vi.hoisted(() => ({
  calls: [] as Array<{ middleware: Array<{ name: string }> }>,
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
      _floating: unknown,
      options?: { middleware?: Array<{ name: string }> }
    ) => {
      calls.push({ middleware: options?.middleware ?? [] });
      return Promise.resolve({
        x: 0,
        y: 0,
        placement: 'bottom-start' as const,
        strategy: 'fixed',
        middlewareData: {},
      });
    },
  };
});

import { effects } from '../context-menu/index.js';
import {
  fitToWindowHeight,
  popMenu,
  popupTargetFromElement,
} from '../context-menu/menu-renderer.js';
import { nestedSubMenuPosition } from '../context-menu/sub-menu.js';

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

/** A caller's own gap to its anchor. */
const CALLER_GAP = 4;
/** Room measured on the menu's side, with a fraction to round down. */
const ROOM = 312.6;
/** Room a menu squeezed past the window's edge would read. */
const NO_ROOM = -20;

const lastName = (middleware: Array<{ name: string }>) =>
  middleware.at(-1)?.name;

describe('a menu', () => {
  test('ends its default placement with the cap to the window', () => {
    const { close } = popMenu(popupTargetFromElement(anchor()), {
      options: { items: [] },
    });
    expect(lastName(calls[0]!.middleware)).toBe('size');
    close();
  });

  test("ends a caller's own middleware with it too", () => {
    const { close } = popMenu(popupTargetFromElement(anchor()), {
      options: { items: [] },
      middleware: [offset(CALLER_GAP)],
    });
    expect(calls[0]!.middleware.map(item => item.name)).toEqual([
      'offset',
      'size',
    ]);
    close();
  });

  test('a nested sub-menu ends with it', () => {
    expect(lastName(nestedSubMenuPosition('right').middleware)).toBe('size');
  });
});

describe('the cap to the window', () => {
  test('writes the room on its side as the panel height, and lets it scroll', () => {
    const panel = document.createElement('div');
    const middleware = fitToWindowHeight() as unknown as {
      options: {
        apply: (state: {
          availableHeight: number;
          elements: { floating: HTMLElement };
        }) => void;
      };
    };
    middleware.options.apply({
      availableHeight: ROOM,
      elements: { floating: panel },
    });
    expect(panel.style.maxHeight).toBe('312px');
    expect(panel.style.overflowY).toBe('auto');
    expect(panel.style.overflowX, 'never sideways').toBe('hidden');

    middleware.options.apply({
      availableHeight: NO_ROOM,
      elements: { floating: panel },
    });
    expect(panel.style.maxHeight, 'never negative').toBe('0px');
  });
});
