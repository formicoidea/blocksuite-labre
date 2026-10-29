import { t } from '../logical/index.js';
import { createStatisticConfig } from './create.js';
import type { StatisticsConfig } from './types.js';
import {
  DATA_VIEW_STATS_GROUP_MORE,
  DATA_VIEW_STATS_SUM,
  DATA_VIEW_STATS_AVERAGE,
  DATA_VIEW_STATS_MEDIAN,
  DATA_VIEW_STATS_MIN,
  DATA_VIEW_STATS_MAX,
  DATA_VIEW_STATS_RANGE,
} from '../../translations.js';
import { type Wording } from '../utils/wording.js';
import { LINE_STYLE_NONE } from '@labre/affine-components/translations';

/** The footer's "None", for a column with no number. */
const none = (wording: Wording | undefined) =>
  wording ? wording(LINE_STYLE_NONE) : LINE_STYLE_NONE[1];

export const numberStatsFunctions: StatisticsConfig[] = [
  createStatisticConfig({
    group: DATA_VIEW_STATS_GROUP_MORE[1],
    groupWording: DATA_VIEW_STATS_GROUP_MORE,
    menuName: DATA_VIEW_STATS_SUM[1],
    menuWording: DATA_VIEW_STATS_SUM,
    type: 'sum',
    displayName: DATA_VIEW_STATS_SUM[1],
    displayWording: DATA_VIEW_STATS_SUM,
    dataType: t.number.instance(),
    impl: (data, { wording }) => {
      const numbers = withoutNull(data);
      if (numbers.length === 0) {
        return none(wording);
      }
      return parseFloat(
        numbers.reduce((a, b) => a + b, 0).toFixed(2)
      ).toString();
    },
  }),
  createStatisticConfig({
    group: DATA_VIEW_STATS_GROUP_MORE[1],
    groupWording: DATA_VIEW_STATS_GROUP_MORE,
    menuName: DATA_VIEW_STATS_AVERAGE[1],
    menuWording: DATA_VIEW_STATS_AVERAGE,
    displayName: DATA_VIEW_STATS_AVERAGE[1],
    displayWording: DATA_VIEW_STATS_AVERAGE,
    type: 'average',
    dataType: t.number.instance(),
    impl: (data, { wording }) => {
      const numbers = withoutNull(data);
      if (numbers.length === 0) {
        return none(wording);
      }
      return parseFloat(
        (numbers.reduce((a, b) => a + b, 0) / numbers.length).toFixed(2)
      ).toString();
    },
  }),
  createStatisticConfig({
    group: DATA_VIEW_STATS_GROUP_MORE[1],
    groupWording: DATA_VIEW_STATS_GROUP_MORE,
    menuName: DATA_VIEW_STATS_MEDIAN[1],
    menuWording: DATA_VIEW_STATS_MEDIAN,
    displayName: DATA_VIEW_STATS_MEDIAN[1],
    displayWording: DATA_VIEW_STATS_MEDIAN,
    type: 'median',
    dataType: t.number.instance(),
    impl: (data, { wording }) => {
      const arr = withoutNull(data).sort((a, b) => a - b);
      let result: number | undefined = undefined;
      if (arr.length % 2 === 1) {
        result = arr[(arr.length - 1) / 2];
      } else {
        const index = arr.length / 2;
        const a = arr[index];
        const b = arr[index - 1];
        if (a == null || b == null) return none(wording);
        result = parseFloat(((a + b) / 2).toFixed(2));
      }
      return result?.toString() ?? none(wording);
    },
  }),
  createStatisticConfig({
    group: DATA_VIEW_STATS_GROUP_MORE[1],
    groupWording: DATA_VIEW_STATS_GROUP_MORE,
    menuName: DATA_VIEW_STATS_MIN[1],
    menuWording: DATA_VIEW_STATS_MIN,
    displayName: DATA_VIEW_STATS_MIN[1],
    displayWording: DATA_VIEW_STATS_MIN,
    type: 'min',
    dataType: t.number.instance(),
    impl: (data, { wording }) => {
      let min: number | null = null;
      for (const num of data) {
        if (num != null) {
          if (min == null) {
            min = num;
          } else {
            min = Math.min(min, num);
          }
        }
      }
      return min?.toString() ?? none(wording);
    },
  }),
  createStatisticConfig({
    group: DATA_VIEW_STATS_GROUP_MORE[1],
    groupWording: DATA_VIEW_STATS_GROUP_MORE,
    menuName: DATA_VIEW_STATS_MAX[1],
    menuWording: DATA_VIEW_STATS_MAX,
    displayName: DATA_VIEW_STATS_MAX[1],
    displayWording: DATA_VIEW_STATS_MAX,
    type: 'max',
    dataType: t.number.instance(),
    impl: (data, { wording }) => {
      let max: number | null = null;
      for (const num of data) {
        if (num != null) {
          if (max == null) {
            max = num;
          } else {
            max = Math.max(max, num);
          }
        }
      }
      return max?.toString() ?? none(wording);
    },
  }),
  createStatisticConfig({
    group: DATA_VIEW_STATS_GROUP_MORE[1],
    groupWording: DATA_VIEW_STATS_GROUP_MORE,
    menuName: DATA_VIEW_STATS_RANGE[1],
    menuWording: DATA_VIEW_STATS_RANGE,
    displayName: DATA_VIEW_STATS_RANGE[1],
    displayWording: DATA_VIEW_STATS_RANGE,
    type: 'range',
    dataType: t.number.instance(),
    impl: (data, { wording }) => {
      let min: number | null = null;
      let max: number | null = null;
      for (const num of data) {
        if (num != null) {
          if (max == null) {
            max = num;
          } else {
            max = Math.max(max, num);
          }
          if (min == null) {
            min = num;
          } else {
            min = Math.min(min, num);
          }
        }
      }
      if (min == null || max == null) {
        return none(wording);
      }
      return parseFloat((max - min).toFixed(2)).toString();
    },
  }),
];
const withoutNull = (arr: readonly (number | null | undefined)[]): number[] =>
  arr.filter(v => v != null);
