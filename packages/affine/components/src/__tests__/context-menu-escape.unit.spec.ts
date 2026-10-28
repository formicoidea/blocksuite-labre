/**
 * GUARD — Escape closes the newest open popup, wherever the focus is.
 *
 * What it would have caught (product owner, 2026-10-28): a menu's only
 * Escape handler lived on its search input, focused when the menu opened. A
 * menu that keeps itself open on a click (the conditional colours editor and
 * its swatches, "Add a condition", the filter editor's own popups) lost the
 * focus with that click, and neither Escape nor anything else closed it any
 * more; the popups piled up. `createPopup` now keeps the open popups and a
 * document listener closes the newest.
 */
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('@floating-ui/dom', async importOriginal => {
  const actual = await importOriginal<typeof import('@floating-ui/dom')>();
  return {
    ...actual,
    autoUpdate: () => () => {},
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
import {
  createPopup,
  popupTargetFromElement,
} from '../context-menu/menu-renderer.js';

beforeAll(() => {
  effects();
});

beforeEach(() => {
  document.body.replaceChildren();
});

const anchor = () => {
  const element = document.createElement('div');
  document.body.append(element);
  return element;
};

const escape = (target: EventTarget = document.body) =>
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
  );

const open = () => {
  const content = document.createElement('div');
  const closed = { count: 0 };
  const close = createPopup(popupTargetFromElement(anchor()), content, {
    onClose: () => closed.count++,
  });
  return { content, closed, close };
};

describe('Escape on an open popup', () => {
  test('closes it when the focus is nowhere in particular', () => {
    const { content, closed } = open();
    expect(content.isConnected).toBe(true);

    escape();

    expect(content.isConnected).toBe(false);
    expect(closed.count).toBe(1);
  });

  test('closes the newest first, then the one below', () => {
    const first = open();
    const second = open();

    escape();
    expect(second.content.isConnected).toBe(false);
    expect(first.content.isConnected).toBe(true);

    escape();
    expect(first.content.isConnected).toBe(false);
  });

  test('does nothing once every popup was closed another way', () => {
    const { closed, close } = open();
    // The popup's own close (a click outside, a selection): the stack must
    // forget it, and a later Escape must not close it twice.
    close();
    expect(closed.count).toBe(1);

    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(closed.count).toBe(1);
  });

  test('leaves an Escape a child already handled and stopped', () => {
    const { content } = open();
    const input = document.createElement('input');
    content.append(input);
    input.addEventListener('keydown', e => e.stopPropagation());

    escape(input);

    expect(content.isConnected).toBe(true);
  });
});
