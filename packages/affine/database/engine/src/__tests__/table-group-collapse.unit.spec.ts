import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  getCollapsedState,
  setCollapsedState,
} from '../view-presets/table/collapsed-state.js';
import { mobileEffects } from '../view-presets/table/mobile/effect.js';
import type { MobileTableGroup } from '../view-presets/table/mobile/group.js';
import { pcEffects } from '../view-presets/table/pc/effect.js';
import type { TableGroup } from '../view-presets/table/pc/group.js';

/** @vitest-environment happy-dom */

type Collapsible = {
  collapsed$: { value: boolean };
  _toggleCollapse: () => void;
};

const toggle = (element: unknown) => {
  (element as unknown as Collapsible)._toggleCollapse();
};

/**
 * The fold of a group is personal and per device (ADR 0035 B8, PRD
 * REQ-DB-16): `localStorage` since 0.49, never the document. The table's
 * `getCollapsedState` / `setCollapsedState` read the shared store of every
 * preset. Each case uses its own view id: the store keeps one signal per key.
 *
 * What it would have caught: the fold kept per tab (`sessionStorage`) or
 * written into the view data; a corrupted entry or a throwing storage
 * breaking the table instead of reading as unfolded.
 */
describe('collapsed-state', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('an unknown group reads as expanded', () => {
    expect(getCollapsedState('view-unknown', 'group-a')).toBe(false);
  });

  test('a stored state comes back for its own group only', () => {
    setCollapsedState('view-1', 'group-a', true);
    expect(getCollapsedState('view-1', 'group-a')).toBe(true);
    expect(getCollapsedState('view-1', 'group-b')).toBe(false);
    expect(getCollapsedState('view-2', 'group-a')).toBe(false);
  });

  test('a fold is kept in localStorage, an unfold removes it', () => {
    setCollapsedState('view-3', 'group-a', true);
    const key = 'labre:data-view:group-collapsed:view-3:group-a';
    expect(localStorage.getItem(key)).toBe('1');
    expect(sessionStorage.length).toBe(0);
    setCollapsedState('view-3', 'group-a', false);
    expect(localStorage.getItem(key)).toBeNull();
  });

  test('a corrupted entry reads as expanded rather than throwing', () => {
    localStorage.setItem(
      'labre:data-view:group-collapsed:view-4:group-a',
      'not json'
    );
    expect(getCollapsedState('view-4', 'group-a')).toBe(false);
  });

  test('a storage that throws keeps the fold for the session', () => {
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('blocked');
      });
    try {
      setCollapsedState('view-5', 'group-a', true);
      expect(getCollapsedState('view-5', 'group-a')).toBe(true);
    } finally {
      setItem.mockRestore();
    }
  });
});

describe('TableGroup collapse', () => {
  test('toggle collapse on pc', () => {
    pcEffects();
    const group = document.createElement(
      'affine-data-view-table-group'
    ) as TableGroup;

    expect(group.collapsed$.value).toBe(false);
    toggle(group);
    expect(group.collapsed$.value).toBe(true);
    toggle(group);
    expect(group.collapsed$.value).toBe(false);
  });

  test('toggle collapse on mobile', () => {
    mobileEffects();
    const group = document.createElement(
      'mobile-table-group'
    ) as MobileTableGroup;

    expect(group.collapsed$.value).toBe(false);
    toggle(group);
    expect(group.collapsed$.value).toBe(true);
    toggle(group);
    expect(group.collapsed$.value).toBe(false);
  });
});
