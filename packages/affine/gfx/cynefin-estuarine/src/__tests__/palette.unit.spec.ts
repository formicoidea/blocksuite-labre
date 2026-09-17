import { neutralPalettes } from '@labre/affine-gfx-shape';
import { describe, expect, it } from 'vitest';

import { COLORS as CYNEFIN_COLORS } from '../cynefin/consts';
import { COLORS as ESTUARINE_COLORS } from '../estuarine/consts';
import {
  CYNEFIN_ESTUARINE_FRAMEWORK_PALETTE,
  CYNEFIN_ESTUARINE_PALETTE_LIST,
} from '../toolbar/palette';

/**
 * This pack's page of the colour pickers' carousel (`docs/adr/0027`) — ONE
 * page for two diagrams, because they are one framework id and an author works
 * across both.
 *
 * The swatches are the hues the two frames are actually painted in: Cynefin's
 * iterate curve, and Estuarine's two legends plus its axes. Everything else on
 * either board is drawn in the shared notation neutrals, which is why the list
 * is this short.
 */
const CYNEFIN_ESTUARINE_SWATCHES = [
  { key: 'Iterate teal', value: CYNEFIN_COLORS.teal },
  { key: 'Liminal green', value: ESTUARINE_COLORS.liminal },
  { key: 'Liminal green dark', value: ESTUARINE_COLORS.liminalLabel },
  { key: 'Volatile red', value: ESTUARINE_COLORS.volatile },
  { key: 'Axis plum', value: ESTUARINE_COLORS.axis },
];

describe('the cynefin / estuarine framework palette', () => {
  it('leads with the two frames own hues, in order', () => {
    const actual = CYNEFIN_ESTUARINE_PALETTE_LIST.slice(
      0,
      CYNEFIN_ESTUARINE_SWATCHES.length
    ).map(({ key, value }) => ({ key, value }));
    expect(actual).toEqual(CYNEFIN_ESTUARINE_SWATCHES);
  });

  it('names every swatch for translation, one key per swatch', () => {
    for (const swatch of CYNEFIN_ESTUARINE_PALETTE_LIST.slice(
      0,
      CYNEFIN_ESTUARINE_SWATCHES.length
    )) {
      expect(swatch.labelWording?.[0]).toMatch(
        /^com\.labre\.(cynefin|estuarine)\.palette\./
      );
      expect(swatch.labelWording?.[1]).toBe(swatch.key);
    }
  });

  it('says the notation colours the two frames already use', () => {
    expect(CYNEFIN_COLORS.teal).toBe('#2a9d99');
    expect(ESTUARINE_COLORS.liminal).toBe('#5ecc44');
    expect(ESTUARINE_COLORS.volatile).toBe('#e63322');
    expect(ESTUARINE_COLORS.axis).toBe('#941253');
  });

  it('keeps only the neutrals of the default palette after them', () => {
    expect(
      CYNEFIN_ESTUARINE_PALETTE_LIST.slice(CYNEFIN_ESTUARINE_SWATCHES.length)
    ).toEqual(neutralPalettes());
  });

  it('registers under its own framework id, named by the framework key', () => {
    expect(CYNEFIN_ESTUARINE_FRAMEWORK_PALETTE.framework).toBe(
      'cynefin-estuarine'
    );
    expect(CYNEFIN_ESTUARINE_FRAMEWORK_PALETTE.labelWording[0]).toBe(
      'com.labre.framework.cynefin-estuarine'
    );
    expect(CYNEFIN_ESTUARINE_FRAMEWORK_PALETTE.palettes).toBe(
      CYNEFIN_ESTUARINE_PALETTE_LIST
    );
  });
});
