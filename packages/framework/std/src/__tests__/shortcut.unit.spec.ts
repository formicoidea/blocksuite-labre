import { describe, expect, test, vi } from 'vitest';

import {
  canonicalCombo,
  resolveKeymap,
  type ShortcutDescriptor,
} from '../extension/shortcut.js';
import type { BlockStdScope } from '../scope/std-scope.js';

const std = {} as BlockStdScope;

const desc = (
  id: string,
  keys: string[],
  extra: Partial<ShortcutDescriptor> = {}
): ShortcutDescriptor => ({
  id,
  labelKey: `label.${id}`,
  defaultKeys: { mac: keys, other: keys },
  scope: 'global',
  owner: 'core',
  handler: () => () => true,
  ...extra,
});

describe('canonicalCombo', () => {
  test('treats equivalent modifier spellings as equal', () => {
    expect(canonicalCombo(['Cmd-z'])).toBe(canonicalCombo(['Meta-z']));
    expect(canonicalCombo(['Control-c'])).toBe(canonicalCombo(['Ctrl-c']));
  });

  test('is order-independent for modifiers and lowercases the key', () => {
    expect(canonicalCombo(['Shift-Ctrl-Z'])).toBe(
      canonicalCombo(['Ctrl-Shift-z'])
    );
  });

  test('canonicalizes each keystroke of a sequence', () => {
    expect(canonicalCombo(['w', 'C'])).toBe(canonicalCombo(['w', 'c']));
    expect(canonicalCombo(['w', 'Cmd-k'])).toBe(canonicalCombo(['w', 'Meta-k']));
    // A sequence is distinct from a single keystroke with the same letters.
    expect(canonicalCombo(['w', 'c'])).not.toBe(canonicalCombo(['w-c']));
  });
});

describe('resolveKeymap', () => {
  test('binds default keystrokes for the matching scope', () => {
    const { keymap, conflicts } = resolveKeymap(
      [desc('undo', ['Mod-z']), desc('redo', ['Shift-Mod-z'])],
      {},
      'global',
      std
    );
    expect(Object.keys(keymap).sort()).toEqual(['Mod-z', 'Shift-Mod-z']);
    expect(conflicts).toEqual([]);
  });

  test('binds a keystroke sequence as a space-separated chord', () => {
    const { keymap, conflicts } = resolveKeymap(
      [desc('wardley.addComponent', ['w', 'c'], { scope: 'edgeless' })],
      {},
      'edgeless',
      std
    );
    expect(Object.keys(keymap)).toEqual(['w c']);
    expect(conflicts).toEqual([]);
  });

  test('an override changes the effective binding', () => {
    const { keymap } = resolveKeymap(
      [desc('undo', ['Mod-z'])],
      { undo: ['Ctrl-Shift-Z'] },
      'global',
      std
    );
    expect(keymap['Mod-z']).toBeUndefined();
    expect(keymap['Ctrl-Shift-Z']).toBeDefined();
  });

  test('an override can rebind a single keystroke to a sequence', () => {
    const { keymap } = resolveKeymap(
      [desc('undo', ['Mod-z'])],
      { undo: ['u', 'z'] },
      'global',
      std
    );
    expect(keymap['Mod-z']).toBeUndefined();
    expect(keymap['u z']).toBeDefined();
  });

  test("'disabled' removes the binding", () => {
    const { keymap } = resolveKeymap(
      [desc('undo', ['Mod-z'])],
      { undo: 'disabled' },
      'global',
      std
    );
    expect(Object.keys(keymap)).toEqual([]);
  });

  test('skips descriptors of other scopes', () => {
    const { keymap } = resolveKeymap(
      [desc('zoom', ['Mod-='], { scope: 'edgeless' })],
      {},
      'global',
      std
    );
    expect(Object.keys(keymap)).toEqual([]);
  });

  test('reports a conflict and binds only the first descriptor', () => {
    const first = vi.fn(() => true);
    const second = vi.fn(() => true);
    const { keymap, conflicts } = resolveKeymap(
      [
        desc('undo', ['Mod-z'], { handler: () => first }),
        desc('other', ['Mod-z'], { handler: () => second }),
      ],
      {},
      'global',
      std
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].ids).toEqual(['undo', 'other']);
    // Only one binding exists, and it is the first descriptor's handler.
    expect(Object.keys(keymap)).toEqual(['Mod-z']);
    keymap['Mod-z']({} as never);
    expect(first).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();
  });

  test('reports a conflict between identical sequences', () => {
    const { keymap, conflicts } = resolveKeymap(
      [
        desc('a', ['w', 'c'], { scope: 'edgeless' }),
        desc('b', ['w', 'C'], { scope: 'edgeless' }),
      ],
      {},
      'edgeless',
      std
    );
    expect(conflicts).toHaveLength(1);
    expect(Object.keys(keymap)).toEqual(['w c']);
  });
});
