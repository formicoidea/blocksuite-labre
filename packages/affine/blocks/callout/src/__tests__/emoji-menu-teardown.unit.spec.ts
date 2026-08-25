/**
 * Closing the callout's emoji menu.
 *
 * The emoji-mart picker is built imperatively in `firstUpdated` and appended
 * to the menu, so it is invisible to Lit: nothing in the component took it
 * down. It carries a document-wide click listener and a
 * `prefers-color-scheme` listener, and each time the menu was opened another
 * picker was left behind it. The picker is now unmounted with its menu.
 */
import { describe, expect, it } from 'vitest';

import { EmojiMenu } from '../emoji-menu.js';

if (!customElements.get('emoji-menu-teardown-test')) {
  customElements.define('emoji-menu-teardown-test', EmojiMenu);
}

async function anOpenEmojiMenu() {
  const menu = document.createElement(
    'emoji-menu-teardown-test'
  ) as unknown as EmojiMenu;
  document.body.append(menu);
  await menu.updateComplete;
  return menu;
}

function pickerOf(menu: EmojiMenu) {
  return menu.shadowRoot?.querySelector('em-emoji-picker') ?? null;
}

describe('callout emoji menu', () => {
  it('mounts one picker when it opens', async () => {
    const menu = await anOpenEmojiMenu();

    expect(pickerOf(menu)).not.toBeNull();

    menu.remove();
  });

  it('unmounts the picker when it closes', async () => {
    const menu = await anOpenEmojiMenu();

    menu.remove();

    expect(pickerOf(menu)).toBeNull();
  });
});
