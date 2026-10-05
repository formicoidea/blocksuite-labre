/**
 * Filtering and ordering of the filterable list — issue #416, upstream
 * AFFiNE#15593.
 *
 * The code block's language picker is the list's only consumer. Two defects
 * lived in `_filterItems`: only the query was lowercased and the display label
 * was never matched, so "Plain Text" or "JavaScript" could not be found by what
 * the user reads on screen; and with an empty query `.sort()` reordered the
 * caller's own array in place, which is the language button's most-recently-
 * used list. These specs pin the matching, the ranking (id and alias hits
 * before label-only hits, the active item still first) and the copy.
 */
import { describe, expect, it } from 'vitest';

import { FilterableListComponent } from '../filterable-list/index.js';
import type { FilterableListItem } from '../filterable-list/types.js';

/** The slice of the component `_filterItems` reads. */
function filter(
  items: FilterableListItem[],
  query: string,
  active?: (item: FilterableListItem) => boolean
): string[] {
  const self = {
    options: { items, active, onSelect: () => {} },
    _filterText: query,
    listFilter: undefined,
  };
  const filterItems = FilterableListComponent.prototype['_filterItems'];
  return filterItems.call(self as never).map(item => item.name);
}

const items: FilterableListItem[] = [
  { name: 'labelonly', label: 'Python-ish' },
  { name: 'python', label: 'Python', aliases: ['py'] },
  { name: 'ObjC', label: 'Objective-C', aliases: ['OBJ'] },
  { name: 'rust', label: 'Rust' },
];

describe('filterable list filtering', () => {
  it('matches the display label, not only the name and aliases', () => {
    expect(filter(items, 'objective')).toEqual(['ObjC']);
  });

  it('matches case-insensitively on both sides', () => {
    expect(filter(items, 'objc')).toEqual(['ObjC']);
    expect(filter(items, 'obj')).toEqual(['ObjC']);
    expect(filter(items, 'RUST')).toEqual(['rust']);
  });

  it('keeps prefix semantics', () => {
    expect(filter(items, 'ust')).toEqual([]);
  });

  it('ranks a name or alias hit before a label-only hit', () => {
    expect(filter(items, 'py')).toEqual(['python', 'labelonly']);
  });

  it('still puts the active item first, the rank only breaks ties', () => {
    expect(filter(items, 'py', item => item.name === 'labelonly')).toEqual([
      'labelonly',
      'python',
    ]);
  });

  it('does not reorder the caller array', () => {
    const own = [...items];
    const before = own.map(item => item.name);

    const shown = filter(own, '', item => item.name === 'rust');

    expect(shown[0]).toBe('rust');
    expect(own.map(item => item.name)).toEqual(before);
  });
});
