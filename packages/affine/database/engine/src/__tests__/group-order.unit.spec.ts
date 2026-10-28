import { describe, expect, it, vi } from 'vitest';

import { GroupTrait, reorderGroupKeys } from '../core/group-by/trait.js';

describe('reorderGroupKeys', () => {
  it('moves a group after another one', () => {
    expect(
      reorderGroupKeys(['a', 'b', 'c'], 'a', { id: 'c', before: false })
    ).toEqual(['b', 'c', 'a']);
  });

  it('moves a group before another one', () => {
    expect(
      reorderGroupKeys(['a', 'b', 'c'], 'c', { id: 'a', before: true })
    ).toEqual(['c', 'a', 'b']);
  });

  it('keeps the order when the moved group is unknown', () => {
    const keys = ['a', 'b', 'c'];
    expect(reorderGroupKeys(keys, 'ghost', { id: 'a', before: true })).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('keeps the order when the anchor is unknown', () => {
    expect(
      reorderGroupKeys(['a', 'b', 'c'], 'a', { id: 'ghost', before: true })
    ).toEqual(['a', 'b', 'c']);
  });

  it('keeps the order when a group is dropped onto itself', () => {
    expect(
      reorderGroupKeys(['a', 'b', 'c'], 'b', { id: 'b', before: true })
    ).toEqual(['a', 'b', 'c']);
  });
});

describe('GroupTrait.moveGroupTo', () => {
  const createTrait = () => ({
    view: { lockRows: vi.fn() },
    groupsDataList$: {
      value: [{ key: 'a' }, { key: 'b' }, { key: 'c' }],
    },
    changeGroupSort: vi.fn(),
  });

  it('persists the new group order', () => {
    const trait = createTrait();
    GroupTrait.prototype.moveGroupTo.call(trait as never, 'a', {
      id: 'c',
      before: false,
    });
    expect(trait.changeGroupSort).toHaveBeenCalledWith(['b', 'c', 'a']);
  });

  it('writes nothing when the drop cannot be honoured', () => {
    const trait = createTrait();
    GroupTrait.prototype.moveGroupTo.call(trait as never, 'a', {
      id: 'ghost',
      before: true,
    });
    expect(trait.changeGroupSort).not.toHaveBeenCalled();
  });

  it('writes nothing when a group is dropped where it already is', () => {
    const trait = createTrait();
    GroupTrait.prototype.moveGroupTo.call(trait as never, 'b', {
      id: 'b',
      before: true,
    });
    expect(trait.changeGroupSort).not.toHaveBeenCalled();
  });
});
