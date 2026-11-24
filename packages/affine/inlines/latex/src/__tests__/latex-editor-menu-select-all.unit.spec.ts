/**
 * Ctrl/Cmd+A in the equation editor selects the whole formula — issue #741
 * (upstream toeverything/AFFiNE#15858).
 *
 * Firefox's native select-all was dropped by the inline range sync, so the
 * menu now handles Mod+A itself: it selects through the inline editor and
 * keeps the keystroke away from the page (which would otherwise select the
 * blocks around the equation). Caps Lock ("A") counts; Mod+Shift+A,
 * Mod+Alt+A and other keys are left alone.
 */
import { IS_MAC } from '@labre/global/env';
import { signal } from '@preact/signals-core';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { LatexEditorMenu } from '../latex-node/latex-editor-menu.js';

beforeAll(() => {
  if (!customElements.get('latex-editor-menu')) {
    customElements.define('latex-editor-menu', LatexEditorMenu);
  }
});

async function mountMenu() {
  const services = {
    theme: 'light',
    // A signal: `subscribe` returns its own unsubscribe function.
    theme$: { subscribe: () => () => {} },
    getSchema: () => undefined,
    getRenderer: () => undefined,
  };
  const menu = document.createElement('latex-editor-menu') as LatexEditorMenu;
  menu.std = {
    get: () => services,
    getOptional: () => null,
  } as never;
  menu.latexSignal = signal('a+b=c');
  menu.abortController = new AbortController();
  document.body.append(menu);
  await menu.updateComplete;

  const inlineEditor = {
    selectAll: vi.fn(),
    focusEnd: vi.fn(),
    render: vi.fn(),
  };
  Object.assign(menu.richText!, { inlineEditor });
  return { menu, inlineEditor };
}

function pressInside(menu: LatexEditorMenu, init: KeyboardEventInit) {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  const onPage = vi.fn();
  document.addEventListener('keydown', onPage);
  menu.richText!.dispatchEvent(event);
  document.removeEventListener('keydown', onPage);
  return { event, reachedPage: onPage.mock.calls.length > 0 };
}

describe('LatexEditorMenu select all (#741)', () => {
  it('Mod+A selects the whole formula and stays inside the menu', async () => {
    const { menu, inlineEditor } = await mountMenu();

    const { event, reachedPage } = pressInside(menu, {
      key: 'a',
      ctrlKey: !IS_MAC,
      metaKey: IS_MAC,
    });

    expect(inlineEditor.selectAll).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
    expect(reachedPage).toBe(false);
    menu.remove();
  });

  it('Mod+A with Caps Lock ("A") selects the whole formula too', async () => {
    const { menu, inlineEditor } = await mountMenu();

    const { event } = pressInside(menu, {
      key: 'A',
      ctrlKey: !IS_MAC,
      metaKey: IS_MAC,
    });

    expect(inlineEditor.selectAll).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
    menu.remove();
  });

  it.each([
    ['Mod+Shift+A', { key: 'A', shiftKey: true }],
    ['Mod+Alt+A', { key: 'a', altKey: true }],
  ] as const)('%s is left alone', async (_name, init) => {
    const { menu, inlineEditor } = await mountMenu();

    const { event, reachedPage } = pressInside(menu, {
      ...init,
      ctrlKey: !IS_MAC,
      metaKey: IS_MAC,
    });

    expect(inlineEditor.selectAll).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    expect(reachedPage).toBe(true);
    menu.remove();
  });

  it('a plain "a" is typed, not turned into a select all', async () => {
    const { menu, inlineEditor } = await mountMenu();

    const { event, reachedPage } = pressInside(menu, { key: 'a' });

    expect(inlineEditor.selectAll).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    expect(reachedPage).toBe(true);
    menu.remove();
  });
});
