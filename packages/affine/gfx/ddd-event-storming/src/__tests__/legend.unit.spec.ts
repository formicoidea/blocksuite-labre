import {
  autoLegendSections,
  ES_HOTSPOT,
  ES_STICKIES,
} from '@labre/affine-gfx-ddd-shared';
import { describe, expect, it } from 'vitest';

import { EVENT_STORMING_AUTO_LEGEND } from '../legend';
import { ES_ROLE, ES_STICKY_ROLE, EVENT_STORMING_ROLES } from '../roles';

/**
 * The board's automatic legend is a TABLE over the shared presets. What is worth
 * freezing is its DERIVATION: the colour the legend shows for a kind must BE the
 * colour the palette sticks on the wall, and a tenth sticky kind must get its
 * row for free.
 */
describe('the Event Storming auto-legend table derives from the palette', () => {
  const [stickies, flow] = EVENT_STORMING_AUTO_LEGEND.sections;

  it('has one entry per sticky kind, hotspot included, in palette order', () => {
    expect(stickies.entries.map(e => e.role)).toEqual([
      ...ES_STICKIES.map(preset => ES_STICKY_ROLE[preset.kind]),
      ES_STICKY_ROLE.hotspot,
    ]);
  });

  it('shows each kind in the colour the palette draws it with', () => {
    expect(stickies.entries.map(e => e.row.color)).toEqual([
      ...ES_STICKIES.map(preset => preset.fill),
      ES_HOTSPOT.fill,
    ]);
    expect(stickies.entries.map(e => e.row.label)).toEqual([
      ...ES_STICKIES.map(preset => preset.label),
      ES_HOTSPOT.label,
    ]);
  });

  it('names the flow with the vocabulary’s own wording', () => {
    const [entry] = flow.entries;
    expect(entry.role).toBe(ES_ROLE.flow);
    expect(entry.row.label).toBe(
      EVENT_STORMING_ROLES[ES_ROLE.flow].labelFallback
    );
    expect(entry.row.swatch).toBe('line');
  });

  it('names only roles the vocabulary declares', () => {
    for (const section of EVENT_STORMING_AUTO_LEGEND.sections) {
      for (const entry of section.entries) {
        expect(EVENT_STORMING_ROLES[entry.role]).toBeDefined();
      }
    }
  });
});

describe('what a stormed board puts in its legend', () => {
  it('lists the kinds actually stuck to it, and nothing else', () => {
    const sections = autoLegendSections(
      new Set([
        ES_STICKY_ROLE.domainEvent,
        ES_STICKY_ROLE.command,
        ES_ROLE.flow,
      ]),
      EVENT_STORMING_AUTO_LEGEND
    );
    expect(sections.map(s => s.rows.map(r => r.label))).toEqual([
      ['Domain event', 'Command'],
      ['Flow'],
    ]);
  });

  it('drops the Flow section on a board with no arc drawn yet', () => {
    const sections = autoLegendSections(
      new Set([ES_STICKY_ROLE.hotspot]),
      EVENT_STORMING_AUTO_LEGEND
    );
    expect(sections.map(s => s.title)).toEqual(['Stickies']);
  });
});
