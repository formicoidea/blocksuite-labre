import { CD_SUBDOMAINS, MOVEMENT_COLOR } from '@labre/affine-gfx-ddd-shared';
import { neutralPalettes } from '@labre/affine-gfx-shape';
import { describe, expect, it } from 'vitest';

import {
  CORE_DOMAIN_FRAMEWORK_PALETTE,
  CORE_DOMAIN_PALETTE_LIST,
} from '../toolbar/palette';

/**
 * The Core Domain Chart's page of the colour pickers' carousel
 * (`docs/adr/0027`): the three sub-domain classes, the bounded context as it
 * stands and the grey of where it is meant to go.
 *
 * Every value is read off {@link CD_SUBDOMAINS} rather than restated, which is
 * the claim this spec pins — together with the reason there is no sixth
 * swatch: the movement arrow is drawn in the current bounded context's own
 * red.
 */
const fillOf = (kind: (typeof CD_SUBDOMAINS)[number]['kind']) => {
  const subdomain = CD_SUBDOMAINS.find(candidate => candidate.kind === kind);
  expect(subdomain, kind).toBeDefined();
  return subdomain?.fill;
};

const CORE_DOMAIN_SWATCHES = [
  { key: 'Big-bet purple', value: fillOf('bigBet') },
  { key: 'Platform blue', value: fillOf('platform') },
  { key: 'Outsourced green', value: fillOf('outsourced') },
  { key: 'Bounded context red', value: fillOf('bcCurrent') },
  { key: 'Future position grey', value: fillOf('bcFuture') },
];

describe('the core domain framework palette', () => {
  it('leads with the sub-domain dots, in order', () => {
    const actual = CORE_DOMAIN_PALETTE_LIST.slice(
      0,
      CORE_DOMAIN_SWATCHES.length
    ).map(({ key, value }) => ({ key, value }));
    expect(actual).toEqual(CORE_DOMAIN_SWATCHES);
  });

  it('names every swatch for translation, one key per swatch', () => {
    for (const swatch of CORE_DOMAIN_PALETTE_LIST.slice(
      0,
      CORE_DOMAIN_SWATCHES.length
    )) {
      expect(swatch.labelWording?.[0]).toMatch(
        /^com\.labre\.ddd-core-domain\.palette\./
      );
      expect(swatch.labelWording?.[1]).toBe(swatch.key);
    }
  });

  it('offers one swatch per sub-domain preset', () => {
    expect(CORE_DOMAIN_SWATCHES.length).toBe(CD_SUBDOMAINS.length);
  });

  it('spends no swatch on the movement arrow, which is that same red', () => {
    // The day the two part, the shelf owes the movement arrow a swatch.
    expect(MOVEMENT_COLOR).toBe(fillOf('bcCurrent'));
  });

  it('says the notation colours the chart already uses', () => {
    expect(fillOf('bigBet')).toBe('#9933ff');
    expect(fillOf('bcFuture')).toBe('#cccccc');
  });

  it('keeps only the neutrals of the default palette after them', () => {
    expect(CORE_DOMAIN_PALETTE_LIST.slice(CORE_DOMAIN_SWATCHES.length)).toEqual(
      neutralPalettes()
    );
  });

  it('registers under its own framework id, named by the framework key', () => {
    expect(CORE_DOMAIN_FRAMEWORK_PALETTE.framework).toBe('ddd-core-domain');
    expect(CORE_DOMAIN_FRAMEWORK_PALETTE.labelWording[0]).toBe(
      'com.labre.framework.ddd-core-domain'
    );
    expect(CORE_DOMAIN_FRAMEWORK_PALETTE.palettes).toBe(
      CORE_DOMAIN_PALETTE_LIST
    );
  });
});
