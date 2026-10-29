import { t } from '../../logical/type-presets.js';
import { createFilter } from './create.js';
import {
  DATA_VIEW_FILTER_CONTAINS,
  DATA_VIEW_FILTER_NOT_CONTAINS,
  DATA_VIEW_FILTER_STARTS_WITH,
  DATA_VIEW_FILTER_ENDS_WITH,
  DATA_VIEW_FILTER_IS,
  DATA_VIEW_FILTER_IS_NOT,
  DATA_VIEW_FILTER_NOT,
} from '../../../translations.js';

export const stringFilter = [
  createFilter({
    name: 'contains',
    self: t.string.instance(),
    args: [t.string.instance()] as const,
    label: DATA_VIEW_FILTER_CONTAINS[1],
    labelWording: DATA_VIEW_FILTER_CONTAINS,
    shortString: (_wording, v) => (v ? `: ${v.value}` : undefined),
    impl: (self = '', value) => {
      return self.toLowerCase().includes(value.toLowerCase());
    },
    defaultValue: args => args[0],
  }),
  createFilter({
    name: 'doesNoContains',
    self: t.string.instance(),
    args: [t.string.instance()] as const,
    label: DATA_VIEW_FILTER_NOT_CONTAINS[1],
    labelWording: DATA_VIEW_FILTER_NOT_CONTAINS,
    shortString: (wording, v) =>
      v ? `: ${wording(DATA_VIEW_FILTER_NOT, { value: v.value })}` : undefined,
    impl: (self = '', value) => {
      return !self.toLowerCase().includes(value.toLowerCase());
    },
  }),
  createFilter({
    name: 'startsWith',
    self: t.string.instance(),
    args: [t.string.instance()] as const,
    label: DATA_VIEW_FILTER_STARTS_WITH[1],
    labelWording: DATA_VIEW_FILTER_STARTS_WITH,
    shortString: (wording, v) =>
      v ? `: ${wording(DATA_VIEW_FILTER_STARTS_WITH)} ${v.value}` : undefined,
    impl: (self = '', value) => {
      return self.toLowerCase().startsWith(value.toLowerCase());
    },
    defaultValue: args => args[0],
  }),
  createFilter({
    name: 'endsWith',
    self: t.string.instance(),
    args: [t.string.instance()] as const,
    label: DATA_VIEW_FILTER_ENDS_WITH[1],
    labelWording: DATA_VIEW_FILTER_ENDS_WITH,
    shortString: (wording, v) =>
      v ? `: ${wording(DATA_VIEW_FILTER_ENDS_WITH)} ${v.value}` : undefined,
    impl: (self = '', value) => {
      return self.toLowerCase().endsWith(value.toLowerCase());
    },
    defaultValue: args => args[0],
  }),
  createFilter({
    name: 'is',
    self: t.string.instance(),
    args: [t.string.instance()] as const,
    label: DATA_VIEW_FILTER_IS[1],
    labelWording: DATA_VIEW_FILTER_IS,
    shortString: (_wording, v) => (v ? `: ${v.value}` : undefined),
    impl: (self = '', value) => {
      return self.toLowerCase() == value.toLowerCase();
    },
    defaultValue: args => args[0],
  }),
  createFilter({
    name: 'isNot',
    self: t.string.instance(),
    args: [t.string.instance()] as const,
    label: DATA_VIEW_FILTER_IS_NOT[1],
    labelWording: DATA_VIEW_FILTER_IS_NOT,
    shortString: (wording, v) =>
      v ? `: ${wording(DATA_VIEW_FILTER_NOT, { value: v.value })}` : undefined,
    impl: (self = '', value) => {
      return self.toLowerCase() != value.toLowerCase();
    },
  }),
];
