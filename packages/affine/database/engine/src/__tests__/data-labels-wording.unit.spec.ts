/**
 * GUARD — the labels the data view declares as DATA carry their key (#572,
 * labre recette of 1.1).
 *
 * The literal ratchet (`literals.unit.spec.ts`, `affine/all`) sees a literal
 * where it is written; a filter's label, a property type's name, a footer
 * statistic or a number format is written once in a table and drawn by
 * menus that only read the table. Before 1.1's recette they were plain
 * English in a French host: « Contains one of », « Count All », « Checkbox »,
 * « Euro ».
 *
 * What it would have caught:
 * - a filter, statistic, property type or number format added without its
 *   wording, or with a wording whose fallback is not its English text (the
 *   menus would say one thing and the key another);
 * - the drawn label ignoring the host's words (`sayLabel` with a catalogue);
 * - the grammar of 1.1's « Does not contains one of » / « Does no contains ».
 */
import type { ChromeWording } from '@labre/affine-shared/services';
import { describe, expect, test } from 'vitest';

import { filterMatcher } from '../core/filter/filter-fn/matcher.js';
import { t } from '../core/logical/index.js';
import { statsFunctions } from '../core/statistics/index.js';
import { sayLabel, type Wording } from '../core/utils/wording.js';
import { propertyPresets } from '../property-presets/index.js';
import { numberFormats } from '../property-presets/number/utils/formats.js';

const french: Wording = ([key, fallback]) =>
  (
    ({
      'com.labre.data-view.filter.fn.contains-one-of': 'Contient l’un de',
      'com.labre.data-view.stats.count-all': 'Tout compter',
    }) as Record<string, string>
  )[key] ?? fallback;

const expectKeyed = (
  where: string,
  text: string | undefined,
  wording: ChromeWording | undefined
) => {
  expect(wording, `${where} has a wording`).toBeDefined();
  expect(wording![0], where).toMatch(/^com\.labre\./);
  expect(wording![1], `${where}: the fallback is its English text`).toBe(text);
};

const filtersOf = (
  ...types: Parameters<typeof filterMatcher.filterListBySelfType>[0][]
) => types.flatMap(type => filterMatcher.filterListBySelfType(type));

describe('labels declared as data carry their key', () => {
  const filters = filtersOf(
    t.string.instance(),
    t.number.instance(),
    t.boolean.instance(),
    t.date.instance(),
    t.tag.instance(),
    t.array.instance(t.tag.instance())
  );

  test('every filter of every type', () => {
    expect(filters.length).toBeGreaterThan(10);
    for (const filter of filters) {
      // The comparison signs (=, ≠, <…) are symbols, not words.
      if (!/[A-Za-z]/.test(filter.label)) continue;
      expectKeyed(filter.name, filter.label, filter.labelWording);
    }
  });

  test('the negated filters say « Does not contain »', () => {
    const labels = filters.map(filter => filter.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        'Does not contain',
        'Does not contain one of',
        'Does not contain all',
      ])
    );
    expect(labels.join()).not.toMatch(/does not contains|does no contains/i);
  });

  test('every footer statistic: its group, its entry, its short name', () => {
    for (const stat of statsFunctions) {
      expectKeyed(`${stat.type} group`, stat.group, stat.groupWording);
      if (stat.menuName) {
        expectKeyed(`${stat.type} menu`, stat.menuName, stat.menuWording);
      }
      if (stat.displayName) {
        expectKeyed(
          `${stat.type} display`,
          stat.displayName,
          stat.displayWording
        );
      }
    }
  });

  test('every property type a menu lists', () => {
    for (const meta of Object.values(propertyPresets)) {
      if (meta.config.hide) continue;
      expectKeyed(meta.type, meta.config.name, meta.config.nameWording);
    }
  });

  test('every number format', () => {
    for (const format of numberFormats) {
      expectKeyed(format.type, format.label, format.labelWording);
    }
  });

  test('a drawn label speaks the host language', () => {
    const containsOneOf = filters.find(f => f.name === 'containsOneOf')!;
    expect(
      sayLabel(french, containsOneOf.label, containsOneOf.labelWording)
    ).toBe('Contient l’un de');
    const countAll = statsFunctions.find(s => s.type === 'count-all')!;
    expect(sayLabel(french, countAll.menuName!, countAll.menuWording)).toBe(
      'Tout compter'
    );
    // No wording: the label as written.
    expect(sayLabel(french, '≠', undefined)).toBe('≠');
  });
});
