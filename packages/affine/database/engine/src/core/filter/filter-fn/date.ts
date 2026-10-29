import { addDays } from 'date-fns/addDays';
import { format } from 'date-fns/format';
import { subDays } from 'date-fns/subDays';

import { t } from '../../logical/type-presets.js';
import { createFilter } from './create.js';
import {
  DATA_VIEW_FILTER_BEFORE,
  DATA_VIEW_FILTER_AFTER,
} from '../../../translations.js';

export const dateFilter = [
  createFilter({
    name: 'before',
    self: t.date.instance(),
    args: [t.date.instance()] as const,
    label: DATA_VIEW_FILTER_BEFORE[1],
    labelWording: DATA_VIEW_FILTER_BEFORE,
    shortString: (_wording, v) =>
      v ? ` < ${format(v.value, 'yyyy/MM/dd')}` : undefined,
    impl: (self, value) => {
      if (self == null) {
        return false;
      }
      return self < value;
    },
    defaultValue: args => subDays(args[0], 1).getTime(),
  }),
  createFilter({
    name: 'after',
    self: t.date.instance(),
    args: [t.date.instance()] as const,
    label: DATA_VIEW_FILTER_AFTER[1],
    labelWording: DATA_VIEW_FILTER_AFTER,
    shortString: (_wording, v) =>
      v ? ` > ${format(v.value, 'yyyy/MM/dd')}` : undefined,
    impl: (self, value) => {
      if (self == null) {
        return false;
      }
      return self > value;
    },
    defaultValue: args => addDays(args[0], 1).getTime(),
  }),
];
