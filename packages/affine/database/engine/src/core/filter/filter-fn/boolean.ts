import { t } from '../../logical/type-presets.js';
import { createFilter } from './create.js';
import {
  DATA_VIEW_FILTER_IS_CHECKED,
  DATA_VIEW_FILTER_IS_UNCHECKED,
  DATA_VIEW_STATS_CHECKED,
  DATA_VIEW_STATS_UNCHECKED,
} from '../../../translations.js';

export const booleanFilter = [
  createFilter({
    name: 'isChecked',
    self: t.boolean.instance(),
    args: [],
    label: DATA_VIEW_FILTER_IS_CHECKED[1],
    labelWording: DATA_VIEW_FILTER_IS_CHECKED,
    shortString: wording => `: ${wording(DATA_VIEW_STATS_CHECKED)}`,
    impl: value => {
      return !!value;
    },
    defaultValue: () => true,
  }),
  createFilter({
    name: 'isUnchecked',
    self: t.boolean.instance(),
    args: [],
    label: DATA_VIEW_FILTER_IS_UNCHECKED[1],
    labelWording: DATA_VIEW_FILTER_IS_UNCHECKED,
    shortString: wording => `: ${wording(DATA_VIEW_STATS_UNCHECKED)}`,
    impl: value => {
      return !value;
    },
    defaultValue: () => false,
  }),
];
