import { ES_HOTSPOT, ES_STICKIES } from '@labre/affine-gfx-ddd-shared';
import { neutralPalettes } from '@labre/affine-gfx-shape';
import { describe, expect, it } from 'vitest';

import {
  ES_PALETTE_LIST,
  EVENT_STORMING_FRAMEWORK_PALETTE,
} from '../toolbar/palette';

/**
 * Event Storming's page of the colour pickers' carousel (`docs/adr/0027`).
 *
 * This is the one notation of the pack where the colour IS the vocabulary — an
 * orange sticky is a domain event, a blue one a command — so the shelf is the
 * sticky table itself, in the order the grammar reads it, and this spec pins
 * both the order and the fact that every value comes from `ddd-shared` rather
 * than from a second table drifting beside it.
 */
const fillOf = (kind: (typeof ES_STICKIES)[number]['kind']) => {
  const sticky = ES_STICKIES.find(candidate => candidate.kind === kind);
  expect(sticky, kind).toBeDefined();
  return sticky?.fill;
};

const ES_SWATCHES = [
  { key: 'Domain event orange', value: fillOf('domainEvent') },
  { key: 'Command blue', value: fillOf('command') },
  { key: 'Aggregate cream', value: fillOf('aggregate') },
  { key: 'Actor yellow', value: fillOf('actor') },
  { key: 'Constraint yellow', value: fillOf('constraint') },
  { key: 'Policy lilac', value: fillOf('policy') },
  { key: 'Read model green', value: fillOf('readModel') },
  { key: 'External system pink', value: fillOf('system') },
  { key: 'Hotspot magenta', value: ES_HOTSPOT.fill },
];

describe('the event storming framework palette', () => {
  it('leads with the sticky colour code, in the grammar order', () => {
    const actual = ES_PALETTE_LIST.slice(0, ES_SWATCHES.length).map(
      ({ key, value }) => ({ key, value })
    );
    expect(actual).toEqual(ES_SWATCHES);
  });

  it('names every swatch for translation, one key per swatch', () => {
    for (const swatch of ES_PALETTE_LIST.slice(0, ES_SWATCHES.length)) {
      expect(swatch.labelWording?.[0]).toMatch(
        /^com\.labre\.ddd-event-storming\.palette\./
      );
      expect(swatch.labelWording?.[1]).toBe(swatch.key);
    }
  });

  it('offers one swatch per sticky kind, plus the hotspot', () => {
    expect(ES_SWATCHES.length).toBe(ES_STICKIES.length + 1);
  });

  it('says the notation colours the board already uses', () => {
    expect(fillOf('domainEvent')).toBe('#F5963B');
    expect(fillOf('command')).toBe('#5BA3DB');
    expect(ES_HOTSPOT.fill).toBe('#FF1E8E');
  });

  it('keeps only the neutrals of the default palette after them', () => {
    expect(ES_PALETTE_LIST.slice(ES_SWATCHES.length)).toEqual(
      neutralPalettes()
    );
  });

  it('registers under its own framework id, named by the framework key', () => {
    expect(EVENT_STORMING_FRAMEWORK_PALETTE.framework).toBe(
      'ddd-event-storming'
    );
    expect(EVENT_STORMING_FRAMEWORK_PALETTE.labelWording[0]).toBe(
      'com.labre.framework.ddd-event-storming'
    );
    expect(EVENT_STORMING_FRAMEWORK_PALETTE.palettes).toBe(ES_PALETTE_LIST);
  });
});
