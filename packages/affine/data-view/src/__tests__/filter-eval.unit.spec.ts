/**
 * Reading back a stored filter.
 *
 * A condition is persisted as a function NAME — `is`, `contains` — and nothing
 * else: the column type it was built for is not written down. Resolution took
 * the first function answering to that name, whatever type it belonged to, so
 * a name shared by two types resolved to the wrong implementation. Its
 * argument then failed validation and the condition silently reported `true`,
 * which lets every row through: the filter looked as if it had been ignored.
 *
 * The candidates are now all tried, and the first one that can actually decide
 * answers. A condition no candidate can apply still lets the row through,
 * rather than hiding everything.
 */
import { describe, expect, it, vi } from 'vitest';

import { evalFilter } from '../core/filter/eval.js';
import type { Filter } from '../core/filter/types.js';

const registry = vi.hoisted(() => ({
  filters: [] as {
    name: string;
    args: { valueValidate: (value: unknown) => boolean }[];
    impl: (self: unknown, ...args: unknown[]) => boolean;
  }[],
}));

vi.mock('../core/filter/filter-fn/matcher.js', () => ({
  filterMatcher: {
    getFilterByName: (name?: string) =>
      name ? registry.filters.find(f => f.name === name) : undefined,
    getFiltersByName: (name?: string) =>
      name ? registry.filters.filter(f => f.name === name) : [],
  },
}));

const takes = (check: (value: unknown) => boolean) => ({
  valueValidate: check,
});
const isString = takes(v => typeof v === 'string');
const isNumber = takes(v => typeof v === 'number');

/** `is` as the string type declares it — it only ever sees strings. */
const stringIs = {
  name: 'is',
  args: [isString],
  impl: (self: unknown, arg: unknown) => self === arg,
};

/** `is` as the number type declares it. Same name, other type. */
const numberIs = {
  name: 'is',
  args: [isNumber],
  impl: (self: unknown, arg: unknown) => self === arg,
};

const condition = (fn: string, arg: unknown): Filter => ({
  type: 'filter',
  left: { type: 'ref', name: 'v' },
  function: fn,
  args: [{ type: 'literal', value: arg }],
});

describe('evalFilter', () => {
  it('picks the homonym whose argument fits, not the first one declared', () => {
    // The string flavour is declared first, so it used to win every lookup.
    registry.filters = [stringIs, numberIs];

    expect(evalFilter(condition('is', 3), { v: 3 })).toBe(true);
    expect(evalFilter(condition('is', 3), { v: 4 })).toBe(false);
  });

  it('answers the same whichever order the homonyms are declared in', () => {
    registry.filters = [numberIs, stringIs];

    expect(evalFilter(condition('is', 'a'), { v: 'a' })).toBe(true);
    expect(evalFilter(condition('is', 'a'), { v: 'b' })).toBe(false);
  });

  it('lets the row through when no candidate can apply', () => {
    registry.filters = [stringIs, numberIs];

    // Nothing declares `is` over a boolean argument.
    expect(evalFilter(condition('is', true), { v: 'a' })).toBe(true);
  });

  it('lets the row through when the function is unknown', () => {
    registry.filters = [stringIs];

    expect(evalFilter(condition('sounds-like', 'a'), { v: 'b' })).toBe(true);
  });

  it('moves past a candidate that throws', () => {
    const throwingIs = {
      name: 'is',
      args: [isNumber],
      impl: () => {
        throw new Error('boom');
      },
    };
    registry.filters = [throwingIs, numberIs];
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      expect(evalFilter(condition('is', 3), { v: 4 })).toBe(false);
    } finally {
      errors.mockRestore();
    }
  });

  it('still combines a group with and / or', () => {
    registry.filters = [numberIs];
    const one = condition('is', 1);
    const two = condition('is', 2);

    expect(
      evalFilter({ type: 'group', op: 'and', conditions: [one, two] }, { v: 1 })
    ).toBe(false);
    expect(
      evalFilter({ type: 'group', op: 'or', conditions: [one, two] }, { v: 1 })
    ).toBe(true);
  });
});
