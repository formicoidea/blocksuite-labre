import {
  CLOUD,
  CM_BUBBLE,
  TEAM_TOPOLOGIES,
} from '@labre/affine-gfx-ddd-shared';
import { neutralPalettes } from '@labre/affine-gfx-shape';
import { describe, expect, it } from 'vitest';

import {
  CONTEXT_MAP_FRAMEWORK_PALETTE,
  CONTEXT_MAP_PALETTE_LIST,
} from '../toolbar/palette';

/**
 * The Context Map's page of the colour pickers' carousel (`docs/adr/0027`) —
 * what the map is actually drawn in: the bounded-context bubble, the Big Ball
 * of Mud cloud, and the three Team Topologies interaction modes.
 *
 * Every value is read off the shared DDD tables, which is the claim this spec
 * pins: a second table of hexes beside them would drift on the first change.
 */
const fillOf = (kind: (typeof TEAM_TOPOLOGIES)[number]['kind']) => {
  const mode = TEAM_TOPOLOGIES.find(candidate => candidate.kind === kind);
  expect(mode, kind).toBeDefined();
  return mode?.fill;
};

const CONTEXT_MAP_SWATCHES = [
  { key: 'Bounded context blue', value: CM_BUBBLE.fill },
  { key: 'Bounded context outline', value: CM_BUBBLE.stroke },
  { key: 'Big ball of mud lilac', value: CLOUD.fill },
  { key: 'Collaboration green', value: fillOf('collaboration') },
  { key: 'X-as-a-Service blue', value: fillOf('xaas') },
  { key: 'Facilitating yellow', value: fillOf('facilitating') },
];

describe('the context map framework palette', () => {
  it('leads with the notation swatches, in order', () => {
    const actual = CONTEXT_MAP_PALETTE_LIST.slice(
      0,
      CONTEXT_MAP_SWATCHES.length
    ).map(({ key, value }) => ({ key, value }));
    expect(actual).toEqual(CONTEXT_MAP_SWATCHES);
  });

  it('names every swatch for translation, one key per swatch', () => {
    for (const swatch of CONTEXT_MAP_PALETTE_LIST.slice(
      0,
      CONTEXT_MAP_SWATCHES.length
    )) {
      expect(swatch.labelWording?.[0]).toMatch(
        /^com\.labre\.ddd-context-map\.palette\./
      );
      expect(swatch.labelWording?.[1]).toBe(swatch.key);
    }
  });

  it('offers one swatch per team interaction mode', () => {
    expect(TEAM_TOPOLOGIES.length).toBe(3);
  });

  it('says the notation colours the map already uses', () => {
    expect(CM_BUBBLE.fill).toBe('#e6f0fa');
    expect(CM_BUBBLE.stroke).toBe('#2f6fb0');
    expect(CLOUD.fill).toBe('#f0eef6');
  });

  it('keeps only the neutrals of the default palette after them', () => {
    expect(CONTEXT_MAP_PALETTE_LIST.slice(CONTEXT_MAP_SWATCHES.length)).toEqual(
      neutralPalettes()
    );
  });

  it('registers under its own framework id, named by the framework key', () => {
    expect(CONTEXT_MAP_FRAMEWORK_PALETTE.framework).toBe('ddd-context-map');
    expect(CONTEXT_MAP_FRAMEWORK_PALETTE.labelWording[0]).toBe(
      'com.labre.framework.ddd-context-map'
    );
    expect(CONTEXT_MAP_FRAMEWORK_PALETTE.palettes).toBe(
      CONTEXT_MAP_PALETTE_LIST
    );
  });
});
