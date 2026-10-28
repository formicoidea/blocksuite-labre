import { formatPropertyValue } from '@labre/affine-fragment-doc-title';
import {
  formatNumber,
  NumberFormatSchema,
} from '@labre/affine-database-engine/property-pure-presets';
import { describe, expect, test } from 'vitest';

/**
 * A number chip of the title band reads as its database cell does (ADR 0035
 * §9d: "a chip and a cell render with the same property preset").
 *
 * The band keeps its own copy of the number preset's formats
 * (`CHIP_NUMBER_FORMATS`, `fragments/doc-title/src/title-band/format.ts`)
 * because the preset's `formatNumber` reads `navigator.language`: it ignores
 * the host's locale, and throws on a tag `Intl` refuses (`en-US@posix` in a
 * headless Chromium), which blanked the whole band in the first recette. This
 * spec holds the two tables together: a format added to the preset and not to
 * the band, or a format whose options drifted, fails here.
 */
describe('title band number chips', () => {
  test('format every number preset format as the preset does', () => {
    const locale = navigator.language;
    for (const format of NumberFormatSchema.options) {
      for (const decimal of [undefined, 0, 2]) {
        const chip = formatPropertyValue(
          {
            id: 'n',
            namespace: 'workspace',
            name: 'N',
            type: 'number',
            data: { format, decimal },
            value: 1234.5,
            readonly: false,
          },
          locale
        );
        expect(chip, `${format} / ${decimal}`).toBe(
          formatNumber(1234.5, format, decimal)
        );
      }
    }
  });
});
