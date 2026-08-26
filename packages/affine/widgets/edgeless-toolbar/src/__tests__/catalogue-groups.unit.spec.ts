import type { AnyCommandDescriptor } from '@labre/std';
import { describe, expect, test } from 'vitest';

import {
  groupCommandsByCategory,
  humanizeCategory,
} from '../catalogue/catalogue-groups.js';
import { formatChord } from '../catalogue/chord-format.js';

/**
 * The pure half of the artefact catalogue sidepanel: how a surface's commands
 * become the sections a reader scrolls, and how the wordings the panel falls
 * back on are spelled.
 *
 * The rendering half is covered end to end by
 * `integration-test/src/__tests__/edgeless/artefact-catalogue.spec.ts`, which
 * needs a real editor; everything below needs nothing at all, which is exactly
 * why it lives in its own module.
 */

const command = (
  id: string,
  category?: string
): AnyCommandDescriptor =>
  ({
    id,
    owner: 'wardley',
    kind: 'artefact',
    labelKey: `com.labre.commands.${id}`,
    category,
    surfaces: ['catalogue'],
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
    run: () => {},
  }) as AnyCommandDescriptor;

describe('groupCommandsByCategory', () => {
  test('groups appear in the order their category is first met', () => {
    const groups = groupCommandsByCategory([
      command('a', 'backgrounds'),
      command('b', 'nodes'),
      command('c', 'backgrounds'),
      command('d', 'connectors'),
    ]);

    expect(groups.map(g => g.category)).toEqual([
      'backgrounds',
      'nodes',
      'connectors',
    ]);
    // Declaration order is the framework's order — `getCommandsForSurface` has
    // already applied `CommandDescriptor.order`, and grouping must not reorder.
    expect(groups[0].commands.map(c => c.id)).toEqual(['a', 'c']);
  });

  test('commands with no category form ONE trailing group', () => {
    const groups = groupCommandsByCategory([
      command('loose'),
      command('a', 'nodes'),
      command('alsoLoose'),
    ]);

    expect(groups.map(g => g.category)).toEqual(['nodes', null]);
    expect(groups[1].commands.map(c => c.id)).toEqual(['loose', 'alsoLoose']);
  });

  test('no trailing group when every command declares a category', () => {
    const groups = groupCommandsByCategory([command('a', 'nodes')]);
    expect(groups).toHaveLength(1);
    expect(groups[0].category).toBe('nodes');
  });

  test('a framework whose commands are all uncategorised gets one group', () => {
    const groups = groupCommandsByCategory([command('a'), command('b')]);
    expect(groups).toEqual([
      { category: null, commands: expect.any(Array) },
    ]);
    expect(groups[0].commands).toHaveLength(2);
  });

  test('an empty surface renders no groups at all', () => {
    expect(groupCommandsByCategory([])).toEqual([]);
  });
});

describe('humanizeCategory', () => {
  test('sentence case, not title case', () => {
    expect(humanizeCategory('backgrounds')).toBe('Backgrounds');
    expect(humanizeCategory('change-arrows')).toBe('Change arrows');
    expect(humanizeCategory('value_flow')).toBe('Value flow');
  });

  test('camelCase and PascalCase boundaries are separators too', () => {
    expect(humanizeCategory('boundedContext')).toBe('Bounded context');
    expect(humanizeCategory('BoundedContext')).toBe('Bounded context');
  });

  test('a category it cannot respell comes back unchanged', () => {
    expect(humanizeCategory('')).toBe('');
    expect(humanizeCategory('-')).toBe('-');
  });
});

describe('formatChord', () => {
  test('a chord is its keystrokes, separated by a space', () => {
    expect(formatChord(['w', 'c'], false)).toBe('W C');
    expect(formatChord(['w', 'c'], true)).toBe('W C');
  });

  test('modifiers are spelled the way the platform spells them', () => {
    expect(formatChord(['Mod-Shift-z'], true)).toBe('⌘⇧Z');
    expect(formatChord(['Mod-Shift-z'], false)).toBe('Ctrl+Shift+Z');
  });

  test('a multi-character key keeps its name', () => {
    expect(formatChord(['Alt-ArrowUp'], false)).toBe('Alt+ArrowUp');
  });

  test('a literal dash survives being the separator', () => {
    expect(formatChord(['Mod--'], false)).toBe('Ctrl+-');
  });

  test('no keys, no chord', () => {
    expect(formatChord([], false)).toBe('');
  });
});
