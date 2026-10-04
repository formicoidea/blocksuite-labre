import type { BlockStdScope } from '@labre/std';
import { describe, expect, test, vi } from 'vitest';

import { coreCommands } from '../keyboard/commands.js';

/**
 * Ctrl+Y must redo on Windows AND Linux, and stay unbound on mac (issue #415,
 * upstream AFFiNE #15623).
 *
 * The `redo-windows` alias was gated on `IS_WINDOWS` alone, so on Linux the
 * keystroke resolved to the alias, `when` went false and nothing redid. The
 * keymap golden (`packages/affine/all/src/__tests__/shortcuts/`) could not see
 * it: it replaces every handler and never calls `when`. This spec calls the
 * REAL descriptor's `when` under each platform.
 *
 * The platform is a set of module constants of `@labre/global/env`, fixed by
 * whichever OS runs the suite, so the env module is mocked with getters over a
 * platform this spec switches per case.
 */
type Platform = { IS_MAC: boolean; IS_WINDOWS: boolean; IS_LINUX: boolean };

const MAC: Platform = { IS_MAC: true, IS_WINDOWS: false, IS_LINUX: false };
const WINDOWS: Platform = { IS_MAC: false, IS_WINDOWS: true, IS_LINUX: false };
const LINUX: Platform = { IS_MAC: false, IS_WINDOWS: false, IS_LINUX: true };

const current = vi.hoisted(() => ({
  platform: undefined as Platform | undefined,
}));

vi.mock('@labre/global/env', async importOriginal => {
  const actual = await importOriginal<typeof import('@labre/global/env')>();
  const read = (key: keyof Platform) => current.platform?.[key] ?? actual[key];
  return {
    ...actual,
    get IS_MAC() {
      return read('IS_MAC');
    },
    get IS_WINDOWS() {
      return read('IS_WINDOWS');
    },
    get IS_LINUX() {
      return read('IS_LINUX');
    },
  };
});

// `when` reads only the platform constants; it never touches the scope.
const std = {} as BlockStdScope;

function redoAliasOn(platform: Platform) {
  current.platform = platform;
  const alias = coreCommands.find(c => c.id === 'redo-windows');
  if (!alias?.when) throw new Error('the `redo-windows` alias lost its `when`');
  return { alias, fires: alias.when(std) };
}

describe('the Ctrl+Y redo alias', () => {
  test('fires on Linux', () => {
    expect(redoAliasOn(LINUX).fires).toBe(true);
  });

  test('fires on Windows', () => {
    expect(redoAliasOn(WINDOWS).fires).toBe(true);
  });

  test('is inert on mac, where it ships no chord either', () => {
    const { alias, fires } = redoAliasOn(MAC);
    expect(fires).toBe(false);
    expect(alias.defaultKeys.mac).toEqual([]);
    expect(alias.defaultKeys.other).toEqual(['Control-y']);
  });
});
