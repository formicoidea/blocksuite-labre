import { ct } from '../../logical/composite-type.js';
import { t } from '../../logical/type-presets.js';
import { tRef, tVar } from '../../logical/type-variable.js';
import { createFilter } from './create.js';
import { tagToString } from './utils.js';
import {
  DATA_VIEW_FILTER_IS_ONE_OF,
  DATA_VIEW_FILTER_IS_NOT_ONE_OF,
  DATA_VIEW_FILTER_NOT,
} from '../../../translations.js';

const optionName = 'options' as const;
export const tagFilter = [
  createFilter({
    name: 'isOneOf',
    vars: [tVar(optionName, t.tag.instance())] as const,
    self: tRef(optionName),
    args: [ct.array.instance(tRef(optionName))] as const,
    label: DATA_VIEW_FILTER_IS_ONE_OF[1],
    labelWording: DATA_VIEW_FILTER_IS_ONE_OF,
    shortString: (_wording, v) =>
      v ? `: ${tagToString(v.value, v.type.element)}` : undefined,
    impl: (self, value) => {
      if (!value.length) {
        return true;
      }
      if (self == null) {
        return false;
      }
      return value.includes(self);
    },
    defaultValue: args => args[0][0],
  }),
  createFilter({
    name: 'isNotOneOf',
    vars: [tVar(optionName, t.tag.instance())] as const,
    self: tRef(optionName),
    args: [ct.array.instance(tRef(optionName))] as const,
    label: DATA_VIEW_FILTER_IS_NOT_ONE_OF[1],
    labelWording: DATA_VIEW_FILTER_IS_NOT_ONE_OF,
    shortString: (wording, v) =>
      v
        ? `: ${wording(DATA_VIEW_FILTER_NOT, { value: tagToString(v.value, v.type.element) ?? '' })}`
        : undefined,
    impl: (self, value) => {
      if (!value.length) {
        return true;
      }
      if (self == null) {
        return true;
      }
      return !value.includes(self);
    },
  }),
];
