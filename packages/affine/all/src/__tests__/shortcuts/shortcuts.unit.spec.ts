import type { ShortcutDescriptor } from '@labre/std';
import { describe, expect, test } from 'vitest';

import { buildShortcutManifest, getShortcutManifest } from '../../shortcuts.js';

const desc = (id: string, owner: string): ShortcutDescriptor => ({
  id,
  labelKey: `label.${id}`,
  defaultKeys: { mac: ['Mod', 'k'], other: ['Mod', 'k'] },
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
