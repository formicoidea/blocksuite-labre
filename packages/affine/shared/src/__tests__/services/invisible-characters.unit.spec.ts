/**
 * `InvisibleCharacters`, the viewer's "show special characters" choice
 * (`text.invisibles.toggle`): the viewer's own toggle wins over the host's
 * `showInvisibles` default, which wins over off; the toggle is kept per
 * viewer and writes nothing to the document; `v-text` finds it through the
 * identifier `@labre/std/inline` declares; the host attribute that draws
 * the line ends follows the state and is dropped on unmount.
 */
import { Container } from '@labre/global/di';
import { type BlockStdScope, StdIdentifier } from '@labre/std';
import {
  InvisibleCharactersDisplayIdentifier,
  SHOW_INVISIBLES_ATTR,
} from '@labre/std/inline';
import { signal } from '@preact/signals-core';
import { describe, expect, test } from 'vitest';

import { EditPropsStore } from '../../services/edit-props-store.js';
import { EditorSettingProvider } from '../../services/editor-setting-service.js';
import { InvisibleCharacters } from '../../services/invisible-characters.js';

function setup(hostDefault?: boolean, stored?: boolean) {
  const storage = new Map<string, unknown>();
  if (stored !== undefined) storage.set('showInvisibles', stored);
  const setting$ = signal(
    hostDefault === undefined ? {} : { showInvisibles: hostDefault }
  );
  const host = document.createElement('div');
  const services = new Map<unknown, unknown>([
    [
      EditPropsStore,
      {
        getStorage: (key: string) => storage.get(key),
        setStorage: (key: string, value: unknown) => storage.set(key, value),
      },
    ],
    [EditorSettingProvider, { setting$ }],
  ]);
  const std = {
    host,
    getOptional: (identifier: unknown) => services.get(identifier) ?? null,
  } as unknown as BlockStdScope;
  const display = new InvisibleCharacters(std);
  display.mounted();
  return { display, storage, setting$, host };
}

describe('InvisibleCharacters', () => {
  test('off by default', () => {
    expect(setup().display.visible$.value).toBe(false);
  });

  test("the host's default applies until the viewer toggles", () => {
    const { display, setting$ } = setup(true);
    expect(display.visible$.value).toBe(true);
    expect(display.toggle()).toBe(false);
    setting$.value = { showInvisibles: true };
    expect(display.visible$.value).toBe(false);
  });

  test("the viewer's stored choice wins at mount, and a toggle is stored", () => {
    const { display, storage } = setup(false, true);
    expect(display.visible$.value).toBe(true);
    display.toggle();
    expect(storage.get('showInvisibles')).toBe(false);
  });

  test('the host attribute follows the state, and leaves on unmount', () => {
    const { display, host } = setup();
    expect(host.hasAttribute(SHOW_INVISIBLES_ATTR)).toBe(false);
    display.toggle();
    expect(host.hasAttribute(SHOW_INVISIBLES_ATTR)).toBe(true);
    display.unmounted();
    display.toggle();
    expect(host.hasAttribute(SHOW_INVISIBLES_ATTR)).toBe(true);
  });

  test('v-text reaches it through the std/inline identifier', () => {
    const container = new Container();
    const std = { getOptional: () => null } as unknown as BlockStdScope;
    container.addValue(StdIdentifier, std);
    InvisibleCharacters.setup(container);
    const provider = container.provider();
    expect(provider.get(InvisibleCharactersDisplayIdentifier)).toBe(
      provider.get(InvisibleCharacters)
    );
  });
});
