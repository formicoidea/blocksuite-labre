import { t } from '../logical/index.js';
import { createStatisticConfig } from './create.js';
import type { StatisticsConfig } from './types.js';
import {
  DATA_VIEW_STATS_GROUP_COUNT,
  DATA_VIEW_STATS_COUNT_UNCHECKED,
  DATA_VIEW_STATS_COUNT_CHECKED,
  DATA_VIEW_STATS_PERCENT_UNCHECKED,
  DATA_VIEW_STATS_PERCENT_CHECKED,
  DATA_VIEW_STATS_UNCHECKED,
  DATA_VIEW_STATS_CHECKED,
  DATA_VIEW_NUMBER_FORMAT_PERCENT,
} from '../../translations.js';

export const checkboxTypeStatsFunctions: StatisticsConfig[] = [
  createStatisticConfig({
    group: DATA_VIEW_STATS_GROUP_COUNT[1],
    groupWording: DATA_VIEW_STATS_GROUP_COUNT,
    type: 'count-values',
    dataType: t.boolean.instance(),
  }),
  createStatisticConfig({
    group: DATA_VIEW_STATS_GROUP_COUNT[1],
    groupWording: DATA_VIEW_STATS_GROUP_COUNT,
    type: 'count-unique-values',
    dataType: t.boolean.instance(),
  }),
  createStatisticConfig({
    group: DATA_VIEW_STATS_GROUP_COUNT[1],
    groupWording: DATA_VIEW_STATS_GROUP_COUNT,
    type: 'count-empty',
    dataType: t.boolean.instance(),
    menuName: DATA_VIEW_STATS_COUNT_UNCHECKED[1],
    menuWording: DATA_VIEW_STATS_COUNT_UNCHECKED,
    displayName: DATA_VIEW_STATS_UNCHECKED[1],
    displayWording: DATA_VIEW_STATS_UNCHECKED,
    impl: data => {
      const emptyList = data.filter(value => !value);
      return emptyList.length.toString();
    },
  }),
  createStatisticConfig({
    group: DATA_VIEW_STATS_GROUP_COUNT[1],
    groupWording: DATA_VIEW_STATS_GROUP_COUNT,
    type: 'count-not-empty',
    dataType: t.boolean.instance(),
    menuName: DATA_VIEW_STATS_COUNT_CHECKED[1],
    menuWording: DATA_VIEW_STATS_COUNT_CHECKED,
    displayName: DATA_VIEW_STATS_CHECKED[1],
    displayWording: DATA_VIEW_STATS_CHECKED,
    impl: data => {
      const notEmptyList = data.filter(value => !!value);
      return notEmptyList.length.toString();
    },
  }),
  createStatisticConfig({
    group: DATA_VIEW_NUMBER_FORMAT_PERCENT[1],
    groupWording: DATA_VIEW_NUMBER_FORMAT_PERCENT,
    type: 'percent-empty',
    dataType: t.boolean.instance(),
    menuName: DATA_VIEW_STATS_PERCENT_UNCHECKED[1],
    menuWording: DATA_VIEW_STATS_PERCENT_UNCHECKED,
    displayName: DATA_VIEW_STATS_UNCHECKED[1],
    displayWording: DATA_VIEW_STATS_UNCHECKED,
    impl: data => {
      if (data.length === 0) return '';
      const emptyList = data.filter(value => !value);
      return ((emptyList.length / data.length) * 100).toFixed(2) + '%';
    },
  }),
  createStatisticConfig({
    group: DATA_VIEW_NUMBER_FORMAT_PERCENT[1],
    groupWording: DATA_VIEW_NUMBER_FORMAT_PERCENT,
    type: 'percent-not-empty',
    dataType: t.boolean.instance(),
    menuName: DATA_VIEW_STATS_PERCENT_CHECKED[1],
    menuWording: DATA_VIEW_STATS_PERCENT_CHECKED,
    displayName: DATA_VIEW_STATS_CHECKED[1],
    displayWording: DATA_VIEW_STATS_CHECKED,
    impl: data => {
      if (data.length === 0) return '';
      const notEmptyList = data.filter(value => !!value);
      return ((notEmptyList.length / data.length) * 100).toFixed(2) + '%';
    },
  }),
];
