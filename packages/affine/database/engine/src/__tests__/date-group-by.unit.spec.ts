import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  dateGroupByConfigs,
  groupByMatchers,
} from '../core/group-by/define.js';
import { createGroupByMatcher } from '../core/group-by/matcher.js';
import type { GroupInfo } from '../core/group-by/trait.js';
import { orderGroupKeys } from '../core/group-by/trait.js';
import { t } from '../core/logical/type-presets.js';

const dateType = t.date.instance();

const configByName = (name: string) => {
  const config = dateGroupByConfigs.find(c => c.name === name);
  if (!config) throw new Error(`no date group-by config named ${name}`);
  return config;
};

const day = (value: string) => new Date(`${value}T12:00:00`).getTime();

const keysOf = (name: string, value: number | null) =>
  configByName(name)
    .valuesGroup(value, dateType)
    .map(entry => entry.key);

const labelOf = (name: string, value: number | null) =>
  configByName(name).groupName(dateType, value);

describe('date group-by configs', () => {
  it('every grain matches the date type', () => {
    for (const config of dateGroupByConfigs) {
      expect(config.matchType.name).toBe('Date');
    }
  });

  it('a date property resolves to the relative grain by default', () => {
    const matcher = createGroupByMatcher(groupByMatchers);
    expect(matcher.match(dateType)?.name).toBe('date-relative');
  });

  it('an empty date lands in the ungrouped bucket at every grain', () => {
    for (const config of dateGroupByConfigs) {
      expect(config.valuesGroup(null, dateType)).toEqual([
        { key: 'Ungroups', value: null },
      ]);
      expect(config.groupName(dateType, null)).toBe('');
    }
  });

  it('the day grain gives one bucket per calendar day', () => {
    const morning = new Date('2024-03-07T00:30:00').getTime();
    const evening = new Date('2024-03-07T23:30:00').getTime();
    const nextDay = new Date('2024-03-08T09:00:00').getTime();

    expect(keysOf('date-day', morning)).toEqual(keysOf('date-day', evening));
    expect(keysOf('date-day', morning)).not.toEqual(
      keysOf('date-day', nextDay)
    );
    expect(labelOf('date-day', morning)).toBe('Mar 7 2024');
  });

  it('the week grains differ by the day the week starts on', () => {
    // 2024-03-10 is a Sunday.
    const sunday = day('2024-03-10');
    const monday = day('2024-03-11');

    expect(keysOf('date-week-sun', sunday)).toEqual(
      keysOf('date-week-sun', monday)
    );
    expect(keysOf('date-week-mon', sunday)).not.toEqual(
      keysOf('date-week-mon', monday)
    );
    expect(labelOf('date-week-sun', day('2024-03-10'))).toBe(
      'Mar 10 2024 – Mar 16 2024'
    );
  });

  it('the month and year grains collapse the days below them', () => {
    expect(keysOf('date-month', day('2024-03-01'))).toEqual(
      keysOf('date-month', day('2024-03-31'))
    );
    expect(keysOf('date-month', day('2024-03-31'))).not.toEqual(
      keysOf('date-month', day('2024-04-01'))
    );
    expect(labelOf('date-month', day('2024-03-15'))).toBe('Mar 2024');

    expect(keysOf('date-year', day('2024-01-01'))).toEqual(
      keysOf('date-year', day('2024-12-31'))
    );
    expect(labelOf('date-year', day('2024-06-01'))).toBe('2024');
  });

  describe('the relative grain, read from a fixed today', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-03-15T10:00:00'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('names the neighbouring days', () => {
      expect(keysOf('date-relative', day('2024-03-15'))).toEqual(['today']);
      expect(labelOf('date-relative', day('2024-03-15'))).toBe('Today');

      expect(keysOf('date-relative', day('2024-03-16'))).toEqual(['tomorrow']);
      expect(labelOf('date-relative', day('2024-03-16'))).toBe('Tomorrow');

      expect(keysOf('date-relative', day('2024-03-14'))).toEqual(['yesterday']);
      expect(labelOf('date-relative', day('2024-03-14'))).toBe('Yesterday');
    });

    it('buckets the nearby past and future by window', () => {
      expect(keysOf('date-relative', day('2024-03-20'))).toEqual(['next7']);
      expect(keysOf('date-relative', day('2024-04-05'))).toEqual(['next30']);
      expect(keysOf('date-relative', day('2024-03-10'))).toEqual(['last7']);
      expect(keysOf('date-relative', day('2024-02-25'))).toEqual(['last30']);
    });

    it('falls back to the month beyond thirty days either way', () => {
      const future = keysOf('date-relative', day('2024-08-10'));
      const past = keysOf('date-relative', day('2023-08-10'));

      expect(future).toEqual([`${+new Date('2024-08-01T00:00:00')}`]);
      expect(past).toEqual([`${+new Date('2023-08-01T00:00:00')}`]);
      expect(labelOf('date-relative', day('2024-08-10'))).toBe('Aug 2024');
    });
  });
});

describe('orderGroupKeys', () => {
  const infoFor = (name: string) =>
    ({ config: configByName(name) }) as unknown as GroupInfo;

  const manualOrder = (keys: string[]) => [...keys].reverse();

  it('reads a date grouping chronologically, ignoring the manual order', () => {
    const keys = [`${day('2024-03-10')}`, `${day('2024-01-05')}`];
    expect(
      orderGroupKeys(keys, infoFor('date-day'), manualOrder, true)
    ).toEqual([`${day('2024-01-05')}`, `${day('2024-03-10')}`]);
    expect(
      orderGroupKeys(keys, infoFor('date-day'), manualOrder, false)
    ).toEqual([`${day('2024-03-10')}`, `${day('2024-01-05')}`]);
  });

  it('orders the relative buckets from the oldest window to the newest', () => {
    const keys = ['today', 'last30', 'next7', 'yesterday'];
    expect(
      orderGroupKeys(keys, infoFor('date-relative'), manualOrder, true)
    ).toEqual(['last30', 'yesterday', 'today', 'next7']);
  });

  it('leaves a non-date grouping to its manual order', () => {
    const keys = ['a', 'b', 'c'];
    const selectInfo = {
      config: groupByMatchers.find(c => c.name === 'select'),
    } as unknown as GroupInfo;
    expect(orderGroupKeys(keys, selectInfo, manualOrder, true)).toEqual([
      'c',
      'b',
      'a',
    ]);
    expect(orderGroupKeys(keys, undefined, manualOrder, true)).toEqual([
      'c',
      'b',
      'a',
    ]);
  });
});
