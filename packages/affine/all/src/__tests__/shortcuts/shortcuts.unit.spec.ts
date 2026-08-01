import { coreCommands } from '@labre/affine-block-root';
import {
  resolveKeymap,
  toShortcutDescriptor,
  type BlockStdScope,
  type CommandDescriptor,
} from '@labre/std';
import { describe, expect, test } from 'vitest';

import { buildCommandRegistry, getCommands } from '../../commands.js';
import { getShortcutManifest } from '../../shortcuts.js';

const command = (
  id: string,
  owner: CommandDescriptor['owner']
): CommandDescriptor => ({
  id,
  owner,
  kind: 'action',
  labelKey: `label.${id}`,
  surfaces: [],
  scope: 'global',
  defaultKeys: { mac: ['Mod-k'], other: ['Mod-k'] },
  run: () => {},
});

describe('getShortcutManifest', () => {
  test('always includes core shortcuts (undo/redo) without handlers', () => {
    const ids = getShortcutManifest().map(e => e.id);
    expect(ids).toContain('undo');
    expect(ids).toContain('redo');
    // Manifest entries carry metadata only.
    expect(getShortcutManifest()[0]).not.toHaveProperty('handler');
  });

  test('stays about shortcuts: no catalogue metadata leaks in', () => {
    // ADR 0008 § Icons — `iconKey` and `category` live on
    // `CommandManifestEntry`, never here.
    for (const entry of getShortcutManifest()) {
      expect(entry).not.toHaveProperty('iconKey');
      expect(entry).not.toHaveProperty('category');
      expect(entry).not.toHaveProperty('when');
    }
  });

  test('exposes the edgeless duplicate and apply-last-style shortcuts', () => {
    const byId = new Map(getShortcutManifest().map(e => [e.id, e]));

    const dup = byId.get('duplicate');
    expect(dup?.scope).toBe('edgeless');
    expect(dup?.owner).toBe('core');
    expect(dup?.defaultKeys).toEqual({ mac: ['Mod-d'], other: ['Mod-d'] });

    const applyLastStyle = byId.get('applyLastStyle');
    expect(applyLastStyle?.scope).toBe('edgeless');
    expect(applyLastStyle?.owner).toBe('core');
    expect(applyLastStyle?.defaultKeys).toEqual({
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

  /**
   * The reason `toShortcutDescriptor` returns a descriptor rather than `null`
   * for keyless commands: `resolveKeymap` only iterates REGISTERED descriptors,
   * so dropping them would leave Settings › Shortcuts unable to bind precisely
   * the commands a user most wants to bind (ADR 0008 § Mapping).
   */
  test('is TOTAL over the registry — every command is bindable', () => {
    const manifestIds = getShortcutManifest().map(e => e.id);
    expect(manifestIds).toEqual(getCommands().map(c => c.id));

    const keyless = getShortcutManifest().filter(
      e => !e.defaultKeys.mac.length && !e.defaultKeys.other.length
    );
    // Before PF3 exactly one entry was keyless (`redo-windows` on mac only);
    // the promoted artefacts make this the majority of the panel.
    expect(keyless.length).toBeGreaterThan(40);
  });

  test('an override on a keyless command actually binds', () => {
    const descriptors = getCommands().map(toShortcutDescriptor);
    const { keymap } = resolveKeymap(
      descriptors,
      { 'edgy.addBoard': ['g', 'b'] },
      'edgeless',
      {} as BlockStdScope
    );
    expect(Object.keys(keymap)).toContain('g b');
  });
});

describe('coreCommands bindings', () => {
  const std = {} as BlockStdScope;
  const descriptors = coreCommands.map(toShortcutDescriptor);

  test('duplicate/apply-last-style bind in the edgeless scope, not the global one', () => {
    const edgeless = resolveKeymap(descriptors, {}, 'edgeless', std);
    expect(edgeless.conflicts).toEqual([]);
    expect(Object.keys(edgeless.keymap)).toEqual(
      expect.arrayContaining(['Mod-d', 'Mod-y'])
    );

    // They are edgeless-scoped, so the global keymap (undo/redo/redo-windows)
    // never binds them — Ctrl+Y = redo keeps working outside edgeless.
    const global = resolveKeymap(descriptors, {}, 'global', std);
    expect(Object.keys(global.keymap)).not.toContain('Mod-d');
    expect(Object.keys(global.keymap)).not.toContain('Mod-y');
    expect(global.conflicts).toEqual([]);
  });
});

describe('buildCommandRegistry', () => {
  const core = [command('undo', 'core')];
  const groups = [
    { owner: 'wardley' as const, commands: [command('wardley.addNode', 'wardley')] },
  ];

  test('includes an enabled framework’s commands', () => {
    const ids = buildCommandRegistry(core, groups, {}).map(c => c.id);
    expect(ids).toEqual(['undo', 'wardley.addNode']);
  });

  test('excludes a disabled framework’s commands', () => {
    const ids = buildCommandRegistry(core, groups, { wardley: false }).map(
      c => c.id
    );
    expect(ids).toEqual(['undo']);
  });

  test('defaults to enabled when no flags given', () => {
    const ids = buildCommandRegistry(core, groups).map(c => c.id);
    expect(ids).toContain('wardley.addNode');
  });
});
