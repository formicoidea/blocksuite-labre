import { beforeEach, describe, expect, test } from 'vitest';

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

describe('collapsed-state', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  test('an unknown group reads as expanded', () => {
    expect(getCollapsedState('view-1', 'group-a')).toBe(false);
  });

  test('a stored state comes back for its own group only', () => {
    setCollapsedState('view-1', 'group-a', true);
    expect(getCollapsedState('view-1', 'group-a')).toBe(true);
    expect(getCollapsedState('view-1', 'group-b')).toBe(false);
    expect(getCollapsedState('view-2', 'group-a')).toBe(false);
  });

  test('a corrupted entry reads as expanded rather than throwing', () => {
    sessionStorage.setItem(
      'affine:table-group:view-1:group-a:collapsed',
      'not json'
    );
    expect(getCollapsedState('view-1', 'group-a')).toBe(false);

    sessionStorage.setItem('affine:table-group:view-1:group-b:collapsed', '42');
    expect(getCollapsedState('view-1', 'group-b')).toBe(false);
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
