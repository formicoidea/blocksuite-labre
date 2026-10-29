import { t } from '../logical/index.js';
import { createStatisticConfig } from './create.js';
import type { StatisticsConfig } from './types.js';
import {
  DATA_VIEW_STATS_GROUP_COUNT,
  DATA_VIEW_STATS_COUNT_ALL,
  DATA_VIEW_STATS_COUNT_VALUES,
  DATA_VIEW_STATS_COUNT_UNIQUE,
  DATA_VIEW_STATS_COUNT_EMPTY,
  DATA_VIEW_STATS_COUNT_NOT_EMPTY,
  DATA_VIEW_STATS_PERCENT_EMPTY,
  DATA_VIEW_STATS_PERCENT_NOT_EMPTY,
  DATA_VIEW_STATS_ALL,
  DATA_VIEW_STATS_VALUES,
  DATA_VIEW_STATS_UNIQUE,
  DATA_VIEW_STATS_NOT_EMPTY,
  DATA_VIEW_NUMBER_FORMAT_PERCENT,
  DATA_VIEW_EMPTY_VALUE,
} from '../../translations.js';

export const anyTypeStatsFunctions: StatisticsConfig[] = [
  createStatisticConfig({
    group: DATA_VIEW_STATS_GROUP_COUNT[1],
    groupWording: DATA_VIEW_STATS_GROUP_COUNT,
    menuName: DATA_VIEW_STATS_COUNT_ALL[1],
    menuWording: DATA_VIEW_STATS_COUNT_ALL,
    displayName: DATA_VIEW_STATS_ALL[1],
    displayWording: DATA_VIEW_STATS_ALL,
    type: 'count-all',
    dataType: t.unknown.instance(),
    impl: data => {
      return data.length.toString();
    },
  }),
  createStatisticConfig({
    group: DATA_VIEW_STATS_GROUP_COUNT[1],
    groupWording: DATA_VIEW_STATS_GROUP_COUNT,
    menuName: DATA_VIEW_STATS_COUNT_VALUES[1],
    menuWording: DATA_VIEW_STATS_COUNT_VALUES,
    displayName: DATA_VIEW_STATS_VALUES[1],
    displayWording: DATA_VIEW_STATS_VALUES,
    type: 'count-values',
    dataType: t.unknown.instance(),
    impl: data => {
      const values = data.reduce((acc: number, v) => {
        if (Array.isArray(v)) {
          return acc + v.length;
        }
        return acc + (v == null ? 0 : 1);
      }, 0);
      return values.toString();
    },
  }),
  createStatisticConfig({
    group: DATA_VIEW_STATS_GROUP_COUNT[1],
    groupWording: DATA_VIEW_STATS_GROUP_COUNT,
    menuName: DATA_VIEW_STATS_COUNT_UNIQUE[1],
    menuWording: DATA_VIEW_STATS_COUNT_UNIQUE,
    displayName: DATA_VIEW_STATS_UNIQUE[1],
    displayWording: DATA_VIEW_STATS_UNIQUE,
    type: 'count-unique-values',
    dataType: t.unknown.instance(),
    impl: data => {
      const values = data
        .flatMap(v => {
          if (Array.isArray(v)) {
            return v;
          }
          return [v];
        })
        .filter(v => v != null);
      return new Set(values).size.toString();
    },
  }),
  createStatisticConfig({
    group: DATA_VIEW_STATS_GROUP_COUNT[1],
    groupWording: DATA_VIEW_STATS_GROUP_COUNT,
    menuName: DATA_VIEW_STATS_COUNT_EMPTY[1],
    menuWording: DATA_VIEW_STATS_COUNT_EMPTY,
    displayName: DATA_VIEW_EMPTY_VALUE[1],
    displayWording: DATA_VIEW_EMPTY_VALUE,
    type: 'count-empty',
    dataType: t.unknown.instance(),
    impl: (data, { meta, dataSource }) => {
      const emptyList = data.filter(value =>
        meta.config.jsonValue.isEmpty({ value, dataSource })
      );
      return emptyList.length.toString();
    },
  }),
  createStatisticConfig({
    group: DATA_VIEW_STATS_GROUP_COUNT[1],
    groupWording: DATA_VIEW_STATS_GROUP_COUNT,
    menuName: DATA_VIEW_STATS_COUNT_NOT_EMPTY[1],
    menuWording: DATA_VIEW_STATS_COUNT_NOT_EMPTY,
    displayName: DATA_VIEW_STATS_NOT_EMPTY[1],
    displayWording: DATA_VIEW_STATS_NOT_EMPTY,
    type: 'count-not-empty',
    dataType: t.unknown.instance(),
    impl: (data, { meta, dataSource }) => {
      const notEmptyList = data.filter(
        value => !meta.config.jsonValue.isEmpty({ value, dataSource })
      );
      return notEmptyList.length.toString();
    },
  }),
  createStatisticConfig({
    group: DATA_VIEW_NUMBER_FORMAT_PERCENT[1],
    groupWording: DATA_VIEW_NUMBER_FORMAT_PERCENT,
    menuName: DATA_VIEW_STATS_PERCENT_EMPTY[1],
    menuWording: DATA_VIEW_STATS_PERCENT_EMPTY,
    displayName: DATA_VIEW_EMPTY_VALUE[1],
    displayWording: DATA_VIEW_EMPTY_VALUE,
    type: 'percent-empty',
    dataType: t.unknown.instance(),
    impl: (data, { meta, dataSource }) => {
      if (data.length === 0) return '';
      const emptyList = data.filter(value =>
        meta.config.jsonValue.isEmpty({ value, dataSource })
      );
      return ((emptyList.length / data.length) * 100).toFixed(2) + '%';
    },
  }),
  createStatisticConfig({
    group: DATA_VIEW_NUMBER_FORMAT_PERCENT[1],
    groupWording: DATA_VIEW_NUMBER_FORMAT_PERCENT,
    menuName: DATA_VIEW_STATS_PERCENT_NOT_EMPTY[1],
    menuWording: DATA_VIEW_STATS_PERCENT_NOT_EMPTY,
    displayName: DATA_VIEW_STATS_NOT_EMPTY[1],
    displayWording: DATA_VIEW_STATS_NOT_EMPTY,
    type: 'percent-not-empty',
    dataType: t.unknown.instance(),
    impl: (data, { meta, dataSource }) => {
      if (data.length === 0) return '';
      const notEmptyList = data.filter(
        value => !meta.config.jsonValue.isEmpty({ value, dataSource })
      );
      return ((notEmptyList.length / data.length) * 100).toFixed(2) + '%';
    },
  }),
];
