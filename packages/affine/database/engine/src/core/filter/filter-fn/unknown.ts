import { t } from '../../logical/type-presets.js';
import { createFilter } from './create.js';
import {
  DATA_VIEW_FILTER_IS_NOT_EMPTY,
  DATA_VIEW_FILTER_IS_EMPTY,
} from '../../../translations.js';

export const unknownFilter = [
  createFilter({
    name: 'isNotEmpty',
    self: t.unknown.instance(),
    args: [] as const,
    label: DATA_VIEW_FILTER_IS_NOT_EMPTY[1],
    labelWording: DATA_VIEW_FILTER_IS_NOT_EMPTY,
    shortString: wording => `: ${wording(DATA_VIEW_FILTER_IS_NOT_EMPTY)}`,
    impl: self => {
      if (Array.isArray(self)) {
        return self.length > 0;
      }
      if (typeof self === 'string') {
        return !!self;
      }
      return self != null;
    },
  }),
  createFilter({
    name: 'isEmpty',
    self: t.unknown.instance(),
    args: [] as const,
    label: DATA_VIEW_FILTER_IS_EMPTY[1],
    labelWording: DATA_VIEW_FILTER_IS_EMPTY,
    shortString: wording => `: ${wording(DATA_VIEW_FILTER_IS_EMPTY)}`,
    impl: self => {
      if (Array.isArray(self)) {
        return self.length === 0;
      }
      if (typeof self === 'string') {
        return !self;
      }
      return self == null;
    },
  }),
];
