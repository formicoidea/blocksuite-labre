import hash from '@emotion/hash';
import {
  addDays,
  differenceInCalendarDays,
  format as fmt,
  isToday,
  isTomorrow,
  isYesterday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns';

import type { TypeInstance } from '../logical/type.js';
import { t } from '../logical/type-presets.js';
import { createUniComponentFromWebComponent } from '../utils/uni-component/uni-component.js';
import { BooleanGroupView } from './renderer/boolean-group.js';
import { DateGroupView } from './renderer/date-group.js';
import { NumberGroupView } from './renderer/number-group.js';
import { SelectGroupView } from './renderer/select-group.js';
import { StringGroupView } from './renderer/string-group.js';
import type { GroupByConfig } from './types.js';

export const createGroupByConfig = <
  Data extends Record<string, unknown>,
  MatchType extends TypeInstance,
  GroupValue = unknown,
>(
  config: GroupByConfig<Data, MatchType, GroupValue>
): GroupByConfig => {
  return config as never as GroupByConfig;
};
export const ungroups = {
  key: 'Ungroups',
  value: null,
};

const WEEK_OPTS_MON = { weekStartsOn: 1 } as const;
const WEEK_OPTS_SUN = { weekStartsOn: 0 } as const;

const rangeLabel = (a: Date, b: Date) =>
  `${fmt(a, 'MMM d yyyy')} – ${fmt(b, 'MMM d yyyy')}`;

/**
 * A date property can be read at several grains — relative to today, by day,
 * by week, by month, by year. Each grain is its own group-by config, named so
 * that a stored `groupBy.name` can pick the grain back up on reload.
 */
const buildDateCfg = (
  name: string,
  grouper: (ms: number | null) => { key: string; value: number | null }[],
  groupName: (v: number | null) => string
): GroupByConfig =>
  createGroupByConfig({
    name,
    matchType: t.date.instance(),
    groupName: (_t, v: number | null) => groupName(v),
    defaultKeys: _t => [ungroups],
    valuesGroup: (v: number | null, _t) => grouper(v),
    addToGroup: (group: number | null, _old: number | null) => group,
    view: createUniComponentFromWebComponent(DateGroupView),
  });

const dateRelativeCfg = buildDateCfg(
  'date-relative',
  v => {
    if (v == null) return [ungroups];
    const day = startOfDay(new Date(v));
    const daysDiff = differenceInCalendarDays(day, startOfDay(new Date()));

    if (isToday(day)) return [{ key: 'today', value: +day }];
    if (isTomorrow(day)) return [{ key: 'tomorrow', value: +day }];
    if (isYesterday(day)) return [{ key: 'yesterday', value: +day }];

    if (daysDiff > 0) {
      if (daysDiff <= 7) return [{ key: 'next7', value: +day }];
      if (daysDiff <= 30) return [{ key: 'next30', value: +day }];
      const month = startOfMonth(day);
      return [{ key: `${+month}`, value: +month }];
    }

    const daysAgo = -daysDiff;
    if (daysAgo <= 7) return [{ key: 'last7', value: +day }];
    if (daysAgo <= 30) return [{ key: 'last30', value: +day }];
    const month = startOfMonth(day);
    return [{ key: `${+month}`, value: +month }];
  },
  v => {
    if (v == null) return '';
    const day = startOfDay(new Date(v));
    const daysDiff = differenceInCalendarDays(day, startOfDay(new Date()));

    if (isToday(day)) return 'Today';
    if (isTomorrow(day)) return 'Tomorrow';
    if (isYesterday(day)) return 'Yesterday';

    if (daysDiff > 0) {
      if (daysDiff <= 7) return 'Next 7 days';
      if (daysDiff <= 30) return 'Next 30 days';
      return fmt(new Date(v), 'MMM yyyy');
    }

    const daysAgo = -daysDiff;
    if (daysAgo <= 7) return 'Last 7 days';
    if (daysAgo <= 30) return 'Last 30 days';
    return fmt(new Date(v), 'MMM yyyy');
  }
);

const dateDayCfg = buildDateCfg(
  'date-day',
  v => {
    if (v == null) return [ungroups];
    const day = startOfDay(new Date(v));
    return [{ key: `${+day}`, value: +day }];
  },
  v => (v ? fmt(new Date(v), 'MMM d yyyy') : '')
);

const dateWeekSunCfg = buildDateCfg(
  'date-week-sun',
  v => {
    if (v == null) return [ungroups];
    const week = startOfWeek(new Date(v), WEEK_OPTS_SUN);
    return [{ key: `${+week}`, value: +week }];
  },
  v => (v ? rangeLabel(new Date(v), addDays(new Date(v), 6)) : '')
);

const dateWeekMonCfg = buildDateCfg(
  'date-week-mon',
  v => {
    if (v == null) return [ungroups];
    const week = startOfWeek(new Date(v), WEEK_OPTS_MON);
    return [{ key: `${+week}`, value: +week }];
  },
  v => (v ? rangeLabel(new Date(v), addDays(new Date(v), 6)) : '')
);

const dateMonthCfg = buildDateCfg(
  'date-month',
  v => {
    if (v == null) return [ungroups];
    const month = startOfMonth(new Date(v));
    return [{ key: `${+month}`, value: +month }];
  },
  v => (v ? fmt(new Date(v), 'MMM yyyy') : '')
);

const dateYearCfg = buildDateCfg(
  'date-year',
  v => {
    if (v == null) return [ungroups];
    const year = startOfYear(new Date(v));
    return [{ key: `${+year}`, value: +year }];
  },
  v => (v ? fmt(new Date(v), 'yyyy') : '')
);

/**
 * The grains a date property offers, in the order the picker shows them. The
 * first one is what `matcher.match` returns for a date property that has no
 * grain stored yet.
 */
export const dateGroupByConfigs = [
  dateRelativeCfg,
  dateDayCfg,
  dateWeekSunCfg,
  dateWeekMonCfg,
  dateMonthCfg,
  dateYearCfg,
];

export const groupByMatchers: GroupByConfig[] = [
  createGroupByConfig({
    name: 'select',
    matchType: t.tag.instance(),
    groupName: (type, value: string | null) => {
      if (t.tag.is(type) && type.data) {
        return type.data.find(v => v.id === value)?.value ?? '';
      }
      return '';
    },
    defaultKeys: type => {
      if (t.tag.is(type) && type.data) {
        return [
          ungroups,
          ...type.data.map(v => ({
            key: v.id,
            value: v.id,
          })),
        ];
      }
      return [ungroups];
    },
    valuesGroup: (value, _type) => {
      if (value == null) {
        return [ungroups];
      }
      return [
        {
          key: `${value}`,
          value: value.toString(),
        },
      ];
    },
    addToGroup: v => v,
    view: createUniComponentFromWebComponent(SelectGroupView),
  }),
  createGroupByConfig({
    name: 'multi-select',
    matchType: t.array.instance(t.tag.instance()),
    groupName: (type, value: string | null) => {
      if (t.array.is(type) && t.tag.is(type.element) && type.element.data) {
        return type.element.data.find(v => v.id === value)?.value ?? '';
      }
      return '';
    },
    defaultKeys: type => {
      if (t.array.is(type) && t.tag.is(type.element) && type.element.data) {
        return [
          ungroups,
          ...type.element.data.map(v => ({
            key: v.id,
            value: v.id,
          })),
        ];
      }
      return [ungroups];
    },
    valuesGroup: (value, _type) => {
      if (value == null) {
        return [ungroups];
      }
      if (Array.isArray(value) && value.length) {
        return value.map(id => ({
          key: `${id}`,
          value: id,
        }));
      }
      return [ungroups];
    },
    addToGroup: (value, old) => {
      if (value == null) {
        return old;
      }
      return Array.isArray(old) ? [...old, value] : [value];
    },
    removeFromGroup: (value, old) => {
      if (Array.isArray(old)) {
        return old.filter(v => v !== value);
      }
      return old;
    },
    view: createUniComponentFromWebComponent(SelectGroupView),
  }),
  createGroupByConfig({
    name: 'text',
    matchType: t.string.instance(),
    groupName: (_type, value: string | null) => {
      return `${value ?? ''}`;
    },
    defaultKeys: _type => {
      return [ungroups];
    },
    valuesGroup: (value, _type) => {
      if (typeof value !== 'string' || !value) {
        return [ungroups];
      }
      return [
        {
          key: hash(value),
          value,
        },
      ];
    },
    addToGroup: v => v,
    view: createUniComponentFromWebComponent(StringGroupView),
  }),
  createGroupByConfig({
    name: 'number',
    matchType: t.number.instance(),
    groupName: (_type, value: number | null) => {
      return `${value ?? ''}`;
    },
    defaultKeys: _type => {
      return [ungroups];
    },
    valuesGroup: (value: number | null, _type) => {
      if (typeof value !== 'number') {
        return [ungroups];
      }
      return [
        {
          key: `g:${Math.floor(value / 10)}`,
          value: Math.floor(value / 10),
        },
      ];
    },
    addToGroup: value => (typeof value === 'number' ? value * 10 : null),
    view: createUniComponentFromWebComponent(NumberGroupView),
  }),
  createGroupByConfig({
    name: 'boolean',
    matchType: t.boolean.instance(),
    groupName: (_type, value: boolean | null) => {
      return `${value?.toString() ?? ''}`;
    },
    defaultKeys: _type => {
      return [
        { key: 'true', value: true },
        { key: 'false', value: false },
      ];
    },
    valuesGroup: (value, _type) => {
      if (typeof value !== 'boolean') {
        return [
          {
            key: 'false',
            value: false,
          },
        ];
      }
      return [
        {
          key: value.toString(),
          value: value,
        },
      ];
    },
    addToGroup: v => v,
    view: createUniComponentFromWebComponent(BooleanGroupView),
  }),
  ...dateGroupByConfigs,
];
