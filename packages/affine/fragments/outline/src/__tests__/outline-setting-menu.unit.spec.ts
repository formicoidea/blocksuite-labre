/**
 * The outline settings menu's "Show type icon" switch must write the value the
 * switch reports, not the negation of the value captured at the last render.
 *
 * The handler used to write `!showPreviewIcon`, read when the menu rendered.
 * Two flips landing before the menu re-renders (the re-render is a microtask
 * away) both wrote the same negation: the switch showed the icons back on
 * while the stored setting stayed off, and every later click kept them
 * apart. This spec flips the real `toggle-switch` twice in one task and
 * asserts the switch and the stored signal still agree.
 */
import { ToggleSwitch } from '@labre/affine-components/toggle-switch';
import type { EditorHost } from '@labre/std';
import { ContextProvider } from '@lit/context';
import { signal } from '@preact/signals-core';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { type TocContext, tocContext } from '../config.js';
import {
  AFFINE_OUTLINE_NOTE_PREVIEW_SETTING_MENU,
  OutlineNotePreviewSettingMenu,
} from '../header/outline-setting-menu.js';

// The vanilla-extract stylesheet needs its Vite plugin, which this package's
// suite does not load; class names play no part in what is asserted here.
vi.mock('../header/outline-setting-menu.css', () => ({
  notePreviewSettingMenuContainer: 'container',
  notePreviewSettingMenuItem: 'item',
  settingLabel: 'setting-label',
  action: 'action',
  actionLabel: 'action-label',
  toggleButton: 'toggle-button',
}));

if (!customElements.get('toggle-switch')) {
  customElements.define('toggle-switch', ToggleSwitch);
}
if (!customElements.get(AFFINE_OUTLINE_NOTE_PREVIEW_SETTING_MENU)) {
  customElements.define(
    AFFINE_OUTLINE_NOTE_PREVIEW_SETTING_MENU,
    OutlineNotePreviewSettingMenu
  );
}

const mountMenu = async (showIcons: boolean) => {
  const context: TocContext = {
    // No translation provider: the labels read their English fallback.
    editor$: signal({
      std: { getOptional: () => null },
    } as unknown as EditorHost),
    enableSorting$: signal(false),
    showIcons$: signal(showIcons),
    fitPadding$: signal([0, 0, 0, 0]),
  };
  const host = document.createElement('div');
  new ContextProvider(host, { context: tocContext, initialValue: context });
  const menu = document.createElement(AFFINE_OUTLINE_NOTE_PREVIEW_SETTING_MENU);
  host.append(menu);
  document.body.append(host);
  await menu.updateComplete;
  const toggle = menu.querySelector('toggle-switch');
  if (!toggle) throw new Error('the menu rendered no toggle-switch');
  await toggle.updateComplete;
  const input = toggle.shadowRoot?.querySelector('input');
  if (!input) throw new Error('the toggle-switch rendered no input');
  return { context, menu, toggle, input };
};

afterEach(() => {
  document.body.replaceChildren();
});

describe('outline settings menu, "Show type icon" switch', () => {
  test('one click per render: switch and stored setting stay equal', async () => {
    const { context, menu, toggle, input } = await mountMenu(false);
    for (const expected of [true, false, true]) {
      input.click();
      await menu.updateComplete;
      await toggle.updateComplete;
      expect(toggle.on).toBe(expected);
      expect(context.showIcons$.value).toBe(expected);
    }
  });

  test('two clicks before the menu re-renders: they still agree', async () => {
    const { context, menu, toggle, input } = await mountMenu(false);
    input.click();
    input.click();
    expect(toggle.on).toBe(false);
    expect(context.showIcons$.value).toBe(toggle.on);
    await menu.updateComplete;
    await toggle.updateComplete;
    // A third click after the re-render must not leave them apart either.
    input.click();
    expect(toggle.on).toBe(true);
    expect(context.showIcons$.value).toBe(true);
  });
});
