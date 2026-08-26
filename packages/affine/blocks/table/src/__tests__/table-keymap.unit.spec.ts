import type { BlockStdScope, UIEventStateContext } from '@labre/std';
import { describe, expect, it, vi } from 'vitest';

import { tableTextFormatKeymap } from '../table-keymap.js';

/**
 * A table cell never carries a `TextSelection` — the selection controller
 * installs a `TableSelection` instead — so `selection.find` returning nothing
 * is the situation every format hotkey has to survive.
 */
function createStdStub({ readonly = false } = {}) {
  const run = vi.fn(() => [true]);
  const chain = { pipe: () => chain, run } as unknown;
  const host = {
    std: { command: { chain: () => chain } },
  };
  return {
    run,
    std: {
      host,
      store: { readonly },
      selection: { find: () => undefined },
    } as unknown as BlockStdScope,
  };
}

function createKeyboardCtx() {
  const raw = {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  };
  return {
    raw,
    ctx: {
      get: (name: string) => {
        if (name !== 'keyboardState') throw new Error(`unexpected ${name}`);
        return { raw };
      },
    } as unknown as UIEventStateContext,
  };
}

describe('table text format keymap', () => {
  it('binds the format hotkeys', () => {
    const { std } = createStdStub();
    expect(Object.keys(tableTextFormatKeymap(std))).toContain('Mod-b');
  });

  it('formats without a document text selection', () => {
    const { std, run } = createStdStub();
    const { ctx, raw } = createKeyboardCtx();

    const handled = tableTextFormatKeymap(std)['Mod-b']?.(ctx);

    expect(handled).toBe(true);
    expect(run).toHaveBeenCalled();
    // The keystroke is answered here and goes no further.
    expect(raw.preventDefault).toHaveBeenCalled();
    expect(raw.stopPropagation).toHaveBeenCalled();
  });

  it('does nothing on a readonly document', () => {
    const { std, run } = createStdStub({ readonly: true });
    const { ctx, raw } = createKeyboardCtx();

    const handled = tableTextFormatKeymap(std)['Mod-b']?.(ctx);

    expect(handled).toBeUndefined();
    expect(run).not.toHaveBeenCalled();
    expect(raw.preventDefault).not.toHaveBeenCalled();
  });
});
