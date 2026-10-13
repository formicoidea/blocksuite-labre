import type { TitleBandProperty } from '@labre/affine-shared/services';

/**
 * A property's value as one line of text — pure, render-free, so a host's own
 * properties panel can show what a chip reads (`formatPropertyValue`,
 * re-exported by `@labre/affine/host-panels`), and the band can still read
 * a type no data-view cell draws (`relation`, an unknown one).
 *
 * The value is the JSON a data-view cell of `type` holds (ADR 0035 §9d), and
 * the shapes below are the data-view presets' own: an option id for `select`,
 * option ids for `multi-select`, epoch milliseconds for `date`, and a number
 * formatted with the number preset's options, so a chip and a database cell
 * read the same.
 *
 * The chips themselves no longer read this: each value is drawn and edited by
 * the data-view cell of its type (`./band-cell.ts`, ADR 0035 §11 amended
 * 2026-10-13). This text is the host panels' reading and the band's fallback.
 */

/** A select option as a data-view `select` / `multi-select` holds it. */
export interface ChipTag {
  id: string;
  label: string;
  /** A CSS colour (a `var(--…)` from the tag palette). */
  color?: string;
}

export type ChipValueView =
  | { kind: 'empty' }
  | { kind: 'text'; text: string }
  | { kind: 'checkbox'; checked: boolean }
  | { kind: 'tags'; tags: ChipTag[] };

const DATE_TYPES = new Set(['date', 'created-time', 'modified-time']);
const currency = (code: string): Intl.NumberFormatOptions => ({
  style: 'currency',
  currency: code,
  currencyDisplay: 'symbol',
});

/**
 * The number preset's formats (`data-view/…/number/utils/formatter.ts`),
 * restated rather than imported: the preset formats with
 * `navigator.language`, which ignores the host's locale and throws on a tag
 * `Intl` refuses (`en-US@posix` in a headless Chromium), and a chip must
 * neither. `title-band-number-parity.unit.spec.ts` (`affine/all`) holds the
 * two tables together.
 */
export const CHIP_NUMBER_FORMATS: Readonly<
  Record<string, Intl.NumberFormatOptions>
> = {
  number: { style: 'decimal', useGrouping: false },
  numberWithCommas: { style: 'decimal', useGrouping: true },
  percent: { style: 'percent', useGrouping: false },
  currencyINR: currency('INR'),
  currencyYen: currency('JPY'),
  currencyCNY: currency('CNY'),
  currencyUSD: currency('USD'),
  currencyEUR: currency('EUR'),
  currencyGBP: currency('GBP'),
};

/** `Intl.NumberFormat`, or the bare number when `Intl` refuses the locale. */
function numberText(
  value: number,
  locale: string,
  options: Intl.NumberFormatOptions = {}
) {
  try {
    return new Intl.NumberFormat(locale, options).format(value);
  } catch {
    return String(value);
  }
}

/** The options of a select-like property, whatever its `data` holds. */
export function chipOptions(property: TitleBandProperty): ChipTag[] {
  const options = property.data.options;
  if (!Array.isArray(options)) return [];
  const tags: ChipTag[] = [];
  for (const option of options) {
    if (option == null || typeof option !== 'object') continue;
    const { id, value, color } = option as Record<string, unknown>;
    if (typeof id !== 'string') continue;
    tags.push({
      id,
      label: typeof value === 'string' ? value : '',
      color: typeof color === 'string' ? color : undefined,
    });
  }
  return tags;
}

/** Nullish, a blank string or an empty list. `false` is a value, not empty. */
export function isPropertyValueEmpty(property: TitleBandProperty): boolean {
  const { value } = property;
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'number') return Number.isNaN(value);
  return false;
}

function formatDate(value: number, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
      date
    );
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function formatNumberValue(
  property: TitleBandProperty,
  value: number,
  locale: string
) {
  const { format, decimal } = property.data;
  const options = {
    ...(typeof format === 'string' && Object.hasOwn(CHIP_NUMBER_FORMATS, format)
      ? CHIP_NUMBER_FORMATS[format]
      : CHIP_NUMBER_FORMATS.number),
  };
  if (typeof decimal === 'number') {
    options.minimumFractionDigits = decimal;
    options.maximumFractionDigits = decimal;
  }
  return numberText(value, locale, options);
}

/** What a chip draws for this property's value. Never throws. */
export function chipValueView(
  property: TitleBandProperty,
  locale: string
): ChipValueView {
  const { type, value } = property;

  if (type === 'checkbox') return { kind: 'checkbox', checked: value === true };
  if (isPropertyValueEmpty(property)) return { kind: 'empty' };

  if (type === 'select' || type === 'multi-select') {
    const ids = Array.isArray(value) ? value : [value];
    const options = chipOptions(property);
    const tags = ids.flatMap(id => options.filter(option => option.id === id));
    return tags.length > 0 ? { kind: 'tags', tags } : { kind: 'empty' };
  }

  if (DATE_TYPES.has(type) && typeof value === 'number') {
    const text = formatDate(value, locale);
    return text ? { kind: 'text', text } : { kind: 'empty' };
  }

  if (type === 'number' && typeof value === 'number') {
    return { kind: 'text', text: formatNumberValue(property, value, locale) };
  }

  if (type === 'progress' && typeof value === 'number') {
    return {
      kind: 'text',
      text: numberText(value / 100, locale, { style: 'percent' }),
    };
  }

  if (typeof value === 'string') return { kind: 'text', text: value };
  if (typeof value === 'number') {
    return { kind: 'text', text: numberText(value, locale) };
  }
  if (Array.isArray(value)) {
    const text = value.filter(item => typeof item === 'string').join(', ');
    return text ? { kind: 'text', text } : { kind: 'empty' };
  }
  return { kind: 'empty' };
}

/**
 * The value as one line of text, as a chip reads it: option labels joined by
 * a comma, an empty value as `''`. A checkbox has no text either: it is a
 * mark, not a word, so a host draws its own from `property.value`.
 */
export function formatPropertyValue(
  property: TitleBandProperty,
  locale = 'en-US'
): string {
  const view = chipValueView(property, locale);
  switch (view.kind) {
    case 'text':
      return view.text;
    case 'tags':
      return view.tags.map(tag => tag.label).join(', ');
    default:
      return '';
  }
}
