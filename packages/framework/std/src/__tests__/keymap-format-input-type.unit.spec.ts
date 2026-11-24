/**
 * Reproduction for issue #743 (upstream toeverything/AFFiNE#15907, commit
 * aaf0c9f): native formatting controls, such as the iOS selection menu
 * (B / I / U), send a `beforeinput` whose `inputType` is `formatBold`,
 * `formatItalic` or `formatUnderline` and NO key event. The keymap only
 * listens to `keyDown` (and, on Android only, maps `deleteContentBackward`
 * to `Backspace` on `beforeInput`), so the `Mod-b` / `Mod-i` / `Mod-u`
 * bindings never run and the inline editor then swallows the input
 * (`inline/services/event.ts` always prevents it, `transformInput` ignores
 * `format*`): nothing happens.
 *
 * The spec mounts the real `UIEventDispatcher` and binds a keymap through
 * `bindHotkey`, the path every block keymap takes. Its bindings read
 * `ctx.get('keyboardState')`, as the real format keymap
 * (`inlines/preset/src/keymap/format.ts`) does, so a fix that runs the
 * binding without a keyboard state would still fail here.
 *
 * The first block is the reproduction; the guards must stay green before and
 * after the fix: a real Ctrl/Cmd+B keystroke runs the binding exactly once;
 * typing runs no binding and is not prevented by the keymap; a binding that
 * declines (read-only document) leaves the input unprevented, including the
 * desktop sequence "declined Ctrl/Cmd+B, then the browser's formatBold"; a
 * composition runs no binding; a format input does not consume an armed
 * chord; and the Android Backspace routing (`androidBindKeymapPatch`) is
 * unchanged and routes no format input.
 */
import { IS_MAC } from '@labre/global/env';
import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  type UIEventHandler,
  UIEventState,
  UIEventStateContext,
} from '../event/base.js';
import { UIEventDispatcher } from '../event/dispatcher.js';
import { androidBindKeymapPatch } from '../event/keymap.js';
import type { BlockStdScope } from '../scope/index.js';

const cleanups: (() => void)[] = [];

afterEach(() => {
  cleanups
    .splice(0)
    .reverse()
    .forEach(cleanup => cleanup());
});

/** A mounted dispatcher over a bare host, with no block selected. */
function mountDispatcher() {
  const host = document.createElement('div');
  document.body.append(host);

  const std = {
    host,
    dnd: { monitor: () => () => {} },
    provider: { getAll: () => [] },
    selection: { value: [] },
  } as unknown as BlockStdScope;
  Object.assign(host, { std });

  const dispatcher = new UIEventDispatcher(std);
  dispatcher.mounted();
  dispatcher.active = true;

  cleanups.push(() => {
    dispatcher.unmounted();
    host.remove();
  });

  return { dispatcher, host };
}

/** A binding shaped like the real format keymap: it needs a keyboard state. */
function formatBinding() {
  return vi.fn<UIEventHandler>(ctx => {
    const event = ctx.get('keyboardState').raw;
    event.preventDefault();
    return true;
  });
}

function bindFormatKeymap() {
  const { dispatcher, host } = mountDispatcher();
  const bindings = {
    'Mod-b': formatBinding(),
    'Mod-i': formatBinding(),
    'Mod-u': formatBinding(),
  };
  cleanups.push(dispatcher.bindHotkey(bindings));
  return { host, bindings };
}

function nativeInput(host: HTMLElement, inputType: string) {
  const event = new InputEvent('beforeinput', {
    inputType,
    bubbles: true,
    cancelable: true,
  });
  host.dispatchEvent(event);
  return event;
}

const calls = (bindings: Record<string, ReturnType<typeof formatBinding>>) =>
  Object.fromEntries(
    Object.entries(bindings).map(([key, fn]) => [key, fn.mock.calls.length])
  );

describe('native format input runs the keymap binding (#743)', () => {
  test.each([
    ['formatBold', 'Mod-b'],
    ['formatItalic', 'Mod-i'],
    ['formatUnderline', 'Mod-u'],
  ])('%s runs the %s binding and is prevented', (inputType, hotkey) => {
    const { host, bindings } = bindFormatKeymap();

    const event = nativeInput(host, inputType);

    expect(calls(bindings)).toEqual({
      'Mod-b': hotkey === 'Mod-b' ? 1 : 0,
      'Mod-i': hotkey === 'Mod-i' ? 1 : 0,
      'Mod-u': hotkey === 'Mod-u' ? 1 : 0,
    });
    expect(event.defaultPrevented).toBe(true);
  });
});

describe('guards for the keymap on beforeinput', () => {
  test('a real Ctrl/Cmd+B keystroke runs the Mod-b binding exactly once', () => {
    const { host, bindings } = bindFormatKeymap();

    host.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'b',
        ctrlKey: !IS_MAC,
        metaKey: IS_MAC,
        bubbles: true,
        cancelable: true,
      })
    );

    expect(calls(bindings)).toEqual({ 'Mod-b': 1, 'Mod-i': 0, 'Mod-u': 0 });
  });

  test('typing (insertText) runs no binding and is not prevented by the keymap', () => {
    const { host, bindings } = bindFormatKeymap();

    const event = nativeInput(host, 'insertText');

    expect(calls(bindings)).toEqual({ 'Mod-b': 0, 'Mod-i': 0, 'Mod-u': 0 });
    expect(event.defaultPrevented).toBe(false);
  });

  test('a declining binding (read-only document) leaves formatBold unprevented', () => {
    const { dispatcher, host } = mountDispatcher();
    // Shaped like the real format keymap, which returns early when read-only.
    const readonlyBold = vi.fn<UIEventHandler>(() => undefined);
    cleanups.push(dispatcher.bindHotkey({ 'Mod-b': readonlyBold }));

    const event = nativeInput(host, 'formatBold');

    expect(event.defaultPrevented).toBe(false);
  });

  test('a declined Ctrl/Cmd+B followed by the browser formatBold changes nothing', () => {
    const { dispatcher, host } = mountDispatcher();
    const declining = vi.fn<UIEventHandler>(() => false);
    cleanups.push(dispatcher.bindHotkey({ 'Mod-b': declining }));

    const keydown = new KeyboardEvent('keydown', {
      key: 'b',
      ctrlKey: !IS_MAC,
      metaKey: IS_MAC,
      bubbles: true,
      cancelable: true,
    });
    host.dispatchEvent(keydown);
    const input = nativeInput(host, 'formatBold');

    expect(keydown.defaultPrevented).toBe(false);
    expect(input.defaultPrevented).toBe(false);
  });

  test('during a composition, a format input runs no binding', () => {
    const { host, bindings } = bindFormatKeymap();

    document.dispatchEvent(new CompositionEvent('compositionstart'));
    try {
      const event = nativeInput(host, 'formatBold');

      expect(calls(bindings)).toEqual({ 'Mod-b': 0, 'Mod-i': 0, 'Mod-u': 0 });
      expect(event.defaultPrevented).toBe(false);
    } finally {
      document.dispatchEvent(new CompositionEvent('compositionend'));
    }
  });

  test('a format input does not consume an armed chord', () => {
    const { dispatcher, host } = mountDispatcher();
    const chord = vi.fn<UIEventHandler>(() => true);
    cleanups.push(
      dispatcher.bindHotkey({ 'w c': chord, 'Mod-b': formatBinding() })
    );
    const press = (key: string) =>
      host.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
      );

    press('w');
    nativeInput(host, 'formatBold');
    press('c');

    expect(chord).toHaveBeenCalledOnce();
  });
});

describe('guards for the Android Backspace routing', () => {
  const backspaceInput = (inputType: string) =>
    UIEventStateContext.from(
      new UIEventState(new InputEvent('beforeinput', { inputType }))
    );

  test('deleteContentBackward runs the Backspace binding', () => {
    const backspace = vi.fn<UIEventHandler>(() => true);
    const handler = androidBindKeymapPatch({ Backspace: backspace });

    expect(handler(backspaceInput('deleteContentBackward'))).toBe(true);
    expect(backspace).toHaveBeenCalledOnce();
  });

  test('a format input is not routed by the Android patch', () => {
    const backspace = vi.fn<UIEventHandler>(() => true);
    const bold = vi.fn<UIEventHandler>(() => true);
    const handler = androidBindKeymapPatch({
      Backspace: backspace,
      'Mod-b': bold,
    });

    expect(handler(backspaceInput('formatBold'))).toBe(false);
    expect(backspace).not.toHaveBeenCalled();
    expect(bold).not.toHaveBeenCalled();
  });
});
