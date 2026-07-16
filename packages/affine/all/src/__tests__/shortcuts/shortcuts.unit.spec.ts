import type { ShortcutDescriptor } from '@labre/std';
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
