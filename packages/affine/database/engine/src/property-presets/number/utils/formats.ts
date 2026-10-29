import type { NumberFormat } from './formatter.js';
import {
  DATA_VIEW_NUMBER_FORMAT_COMMAS,
  DATA_VIEW_NUMBER_FORMAT_PERCENT,
  DATA_VIEW_NUMBER_FORMAT_YEN,
  DATA_VIEW_NUMBER_FORMAT_CNY,
  DATA_VIEW_NUMBER_FORMAT_INR,
  DATA_VIEW_NUMBER_FORMAT_USD,
  DATA_VIEW_NUMBER_FORMAT_EUR,
  DATA_VIEW_NUMBER_FORMAT_GBP,
  DATA_VIEW_TYPE_NUMBER,
} from '../../../translations.js';
import { type ChromeWording } from '@labre/affine-shared/services';

export type NumberCellFormat = {
  type: NumberFormat;
  label: string;
  /** {@link label} as a key (#572). */
  labelWording: ChromeWording;
  symbol: string; // New property for symbol
};

export const numberFormats: NumberCellFormat[] = [
  {
    type: 'number',
    label: DATA_VIEW_TYPE_NUMBER[1],
    labelWording: DATA_VIEW_TYPE_NUMBER,
    symbol: '#',
  },
  {
    type: 'numberWithCommas',
    label: DATA_VIEW_NUMBER_FORMAT_COMMAS[1],
    labelWording: DATA_VIEW_NUMBER_FORMAT_COMMAS,
    symbol: '#',
  },
  {
    type: 'percent',
    label: DATA_VIEW_NUMBER_FORMAT_PERCENT[1],
    labelWording: DATA_VIEW_NUMBER_FORMAT_PERCENT,
    symbol: '%',
  },
  {
    type: 'currencyYen',
    label: DATA_VIEW_NUMBER_FORMAT_YEN[1],
    labelWording: DATA_VIEW_NUMBER_FORMAT_YEN,
    symbol: '¥',
  },
  {
    type: 'currencyCNY',
    label: DATA_VIEW_NUMBER_FORMAT_CNY[1],
    labelWording: DATA_VIEW_NUMBER_FORMAT_CNY,
    symbol: '¥',
  },
  {
    type: 'currencyINR',
    label: DATA_VIEW_NUMBER_FORMAT_INR[1],
    labelWording: DATA_VIEW_NUMBER_FORMAT_INR,
    symbol: '₹',
  },
  {
    type: 'currencyUSD',
    label: DATA_VIEW_NUMBER_FORMAT_USD[1],
    labelWording: DATA_VIEW_NUMBER_FORMAT_USD,
    symbol: '$',
  },
  {
    type: 'currencyEUR',
    label: DATA_VIEW_NUMBER_FORMAT_EUR[1],
    labelWording: DATA_VIEW_NUMBER_FORMAT_EUR,
    symbol: '€',
  },
  {
    type: 'currencyGBP',
    label: DATA_VIEW_NUMBER_FORMAT_GBP[1],
    labelWording: DATA_VIEW_NUMBER_FORMAT_GBP,
    symbol: '£',
  },
];
