import { coreShortcuts } from '@labre/affine-block-root';
import {
  resolveKeymap,
  type BlockStdScope,
  type ShortcutDescriptor,
} from '@labre/std';
import { describe, expect, test } from 'vitest';

import { buildShortcutManifest, getShortcutManifest } from '../../shortcuts.js';

const desc = (id: string, owner: string): ShortcutDescriptor => ({
  id,
  labelKey: `label.${id}`,
  defaultKeys: { mac: ['Mod-k'], other: ['Mod-k'] },
  scope: 'global',
  owner,
  handler: () => () => true,
});

describe('getShortcutManifest', () => {
  test('always includes core shortcuts (undo/redo) without handlers', () => {
    const ids = getShortcutManifest().map(e => e.id);
    expect(ids).toContain('undo');
    expect(ids).toContain('redo');
    // Manifest entries carry metadata only.
    expect(getShortcutManifest()[0]).not.toHaveProperty('handler');
  });

  test('exposes the edgeless duplicate and copy-style shortcuts', () => {
    const byId = new Map(getShortcutManifest().map(e => [e.id, e]));

    const dup = byId.get('duplicate');
    expect(dup?.scope).toBe('edgeless');
    expect(dup?.owner).toBe('core');
    expect(dup?.defaultKeys).toEqual({ mac: ['Mod-d'], other: ['Mod-d'] });

    const copyStyle = byId.get('copyStyle');
    expect(copyStyle?.scope).toBe('edgeless');
    expect(copyStyle?.owner).toBe('core');
    expect(copyStyle?.defaultKeys).toEqual({
      mac: ['Mod-y'],
      other: ['Mod-y'],
    });
  });

  test('lists the wardley chords when the flag is on, none when off', () => {
    const entries = getShortcutManifest();
    const wardley = entries.filter(e => e.owner === 'wardley');
    expect(wardley.map(e => e.id)).toContain('wardley.addComponent');
    expect(wardley.every(e => e.scope === 'edgeless')).toBe(true);
    // Chord sequences: prefix 'w' then the action key.
    expect(
      entries.find(e => e.id === 'wardley.addComponent')?.defaultKeys.other
    ).toEqual(['w', 'c']);

    const offIds = getShortcutManifest({ wardley: false }).map(e => e.id);
    expect(offIds.some(id => id.startsWith('wardley.'))).toBe(false);
  });
});

describe('coreShortcuts bindings', () => {
  const std = {} as BlockStdScope;

  test('duplicate/copy-style bind in the edgeless scope, not the global one', () => {
    const edgeless = resolveKeymap(coreShortcuts, {}, 'edgeless', std);
    expect(edgeless.conflicts).toEqual([]);
    expect(Object.keys(edgeless.keymap)).toEqual(
      expect.arrayContaining(['Mod-d', 'Mod-y'])
    );

    // They are edgeless-scoped, so the global keymap (undo/redo/redo-windows)
    // never binds them — Ctrl+Y = redo keeps working outside edgeless.
    const global = resolveKeymap(coreShortcuts, {}, 'global', std);
    expect(Object.keys(global.keymap)).not.toContain('Mod-d');
    expect(Object.keys(global.keymap)).not.toContain('Mod-y');
    expect(global.conflicts).toEqual([]);
  });
});

describe('buildShortcutManifest', () => {
  const core = [desc('undo', 'core')];
  const groups = [
    { owner: 'wardley' as const, shortcuts: [desc('wardley.addNode', 'wardley')] },
  ];

  test('includes an enabled framework’s shortcuts', () => {
    const ids = buildShortcutManifest(core, groups, {}).map(e => e.id);
    expect(ids).toEqual(['undo', 'wardley.addNode']);
  });

  test('excludes a disabled framework’s shortcuts', () => {
    const ids = buildShortcutManifest(core, groups, { wardley: false }).map(
      e => e.id
    );
    expect(ids).toEqual(['undo']);
  });

  test('defaults to enabled when no flags given', () => {
    const ids = buildShortcutManifest(core, groups).map(e => e.id);
    expect(ids).toContain('wardley.addNode');
  });
});
