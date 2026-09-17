import { neutralPalettes } from '@labre/affine-gfx-shape';
import { describe, expect, it } from 'vitest';

import { NODE_PALETTE, RELATIONSHIP_STROKE } from '../consts';
import { C4_FRAMEWORK_PALETTE, C4_PALETTE_LIST } from '../toolbar/palette';

/**
 * C4's page of the colour pickers' carousel (`docs/adr/0027`) offers the
 * stencil's level ladder as ready-made swatches. This spec pins WHAT is
 * offered and in WHICH order, because the list is the only place the ladder is
 * said in colour: a silent reordering, or a historical editor colour creeping
 * back in, would leave an author picking a hue that says nothing in C4.
 *
 * Nothing here constrains what an author may paint — the custom picker is
 * untouched, and no rule of this pack reads a colour.
 */
const C4_SWATCHES = [
  { key: 'Person blue', value: NODE_PALETTE.person.fill },
  { key: 'System blue', value: NODE_PALETTE.system.fill },
  { key: 'Container blue', value: NODE_PALETTE.container.fill },
  { key: 'Component blue', value: NODE_PALETTE.component.fill },
  { key: 'External grey', value: NODE_PALETTE['system-ext'].fill },
  { key: 'Relationship grey', value: RELATIONSHIP_STROKE },
];

describe('the c4 framework palette', () => {
  it('leads with the level ladder, in order', () => {
    const actual = C4_PALETTE_LIST.slice(0, C4_SWATCHES.length).map(
      ({ key, value }) => ({ key, value })
    );
    expect(actual).toEqual(C4_SWATCHES);
  });

  it('names every swatch for translation, one key per swatch', () => {
    for (const swatch of C4_PALETTE_LIST.slice(0, C4_SWATCHES.length)) {
      expect(swatch.labelWording?.[0]).toMatch(/^com\.labre\.c4\.palette\./);
      expect(swatch.labelWording?.[1]).toBe(swatch.key);
    }
  });

  it('says the stencil colours the diagram already uses', () => {
    expect(NODE_PALETTE.person.fill).toBe('#08427b');
    expect(NODE_PALETTE.system.fill).toBe('#1168bd');
    expect(NODE_PALETTE.container.fill).toBe('#438dd5');
    expect(NODE_PALETTE.component.fill).toBe('#85bbf0');
    // One grey for both external kinds, and the same grey on the boundary
    // frame as on the relationship arrow.
    expect(NODE_PALETTE['person-ext'].fill).toBe(
      NODE_PALETTE['system-ext'].fill
    );
    expect(RELATIONSHIP_STROKE).toBe('#444444');
  });

  it('keeps only the neutrals of the default palette after them', () => {
    expect(C4_PALETTE_LIST.slice(C4_SWATCHES.length)).toEqual(
      neutralPalettes()
    );
  });

  it('registers under its own framework id, named by the framework key', () => {
    expect(C4_FRAMEWORK_PALETTE.framework).toBe('c4');
    expect(C4_FRAMEWORK_PALETTE.labelWording[0]).toBe('com.labre.framework.c4');
    expect(C4_FRAMEWORK_PALETTE.palettes).toBe(C4_PALETTE_LIST);
  });
});
