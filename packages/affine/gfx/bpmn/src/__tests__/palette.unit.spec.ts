import { neutralPalettes } from '@labre/affine-gfx-shape';
import { describe, expect, it } from 'vitest';

import { EVENT_END, EVENT_START } from '../consts';
import { BPMN_FRAMEWORK_PALETTE, BPMN_PALETTE_LIST } from '../toolbar/palette';

/**
 * BPMN's page of the colour pickers' carousel (`docs/adr/0027`).
 *
 * TWO swatches and no more, which is the claim this spec exists to pin: BPMN
 * is a black-and-white notation where the shape carries the meaning, so the
 * only hues the pack itself draws are the two ends of a process. A third
 * swatch appearing here would be an invention rather than the standard.
 */
const BPMN_SWATCHES = [
  { key: 'Start green', value: EVENT_START },
  { key: 'End red', value: EVENT_END },
];

describe('the bpmn framework palette', () => {
  it('leads with the two event rings, in order', () => {
    const actual = BPMN_PALETTE_LIST.slice(0, BPMN_SWATCHES.length).map(
      ({ key, value }) => ({ key, value })
    );
    expect(actual).toEqual(BPMN_SWATCHES);
  });

  it('names every swatch for translation, one key per swatch', () => {
    for (const swatch of BPMN_PALETTE_LIST.slice(0, BPMN_SWATCHES.length)) {
      expect(swatch.labelWording?.[0]).toMatch(/^com\.labre\.bpmn\.palette\./);
      expect(swatch.labelWording?.[1]).toBe(swatch.key);
    }
  });

  it('says the notation colours the process already uses', () => {
    expect(EVENT_START).toBe('#43a06b');
    expect(EVENT_END).toBe('#cf5648');
  });

  it('keeps only the neutrals of the default palette after them', () => {
    expect(BPMN_PALETTE_LIST.slice(BPMN_SWATCHES.length)).toEqual(
      neutralPalettes()
    );
  });

  it('registers under its own framework id, named by the framework key', () => {
    expect(BPMN_FRAMEWORK_PALETTE.framework).toBe('bpmn');
    expect(BPMN_FRAMEWORK_PALETTE.labelWording[0]).toBe(
      'com.labre.framework.bpmn'
    );
    expect(BPMN_FRAMEWORK_PALETTE.palettes).toBe(BPMN_PALETTE_LIST);
  });
});
