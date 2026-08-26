import {
  autoLegendSections,
  CD_SUBDOMAINS,
  MOVEMENT_COLOR,
  TEAM_TOPOLOGIES,
} from '@labre/affine-gfx-ddd-shared';
import { describe, expect, it } from 'vitest';

import { CORE_DOMAIN_AUTO_LEGEND } from '../core-domain/legend';
import { CORE_DOMAIN_ROLE, CORE_DOMAIN_ROLES } from '../roles';

/**
 * The chart's automatic legend is a TABLE over the shared presets. What is worth
 * freezing is its DERIVATION: the five dot colours the legend shows must BE the
 * five the palette draws — the same five `core-domain.off-legend-colour`
 * sanctions.
 */
describe('the Core Domain auto-legend table derives from the presets', () => {
  const [subdomains, movement] = CORE_DOMAIN_AUTO_LEGEND.sections;

  it('has one dot entry per sub-domain preset, in the presets’ own order', () => {
    expect(subdomains.entries.map(e => e.role)).toEqual(
      CD_SUBDOMAINS.map(preset => CORE_DOMAIN_ROLE[preset.kind])
    );
    expect(subdomains.entries.map(e => e.row.color)).toEqual(
      CD_SUBDOMAINS.map(preset => preset.fill)
    );
    expect(subdomains.entries.map(e => e.row.label)).toEqual(
      CD_SUBDOMAINS.map(preset => preset.label)
    );
    expect(subdomains.entries.every(e => e.row.swatch === 'dot')).toBe(true);
  });

  it('draws the movement red and dashed, like the chart does, and names it from the vocabulary', () => {
    const [entry] = movement.entries;
    expect(entry.role).toBe(CORE_DOMAIN_ROLE.movement);
    expect(entry.row.color).toBe(MOVEMENT_COLOR);
    expect(entry.row.dashed).toBe(true);
    expect(entry.row.label).toBe(
      CORE_DOMAIN_ROLES[CORE_DOMAIN_ROLE.movement].labelFallback
    );
  });

  it('names only roles the vocabulary declares', () => {
    for (const section of CORE_DOMAIN_AUTO_LEGEND.sections) {
      for (const entry of section.entries) {
        expect(CORE_DOMAIN_ROLES[entry.role]).toBeDefined();
      }
    }
  });

  /**
   * The Team Topologies markers carry no role — `addMarker` stamps none — and
   * detection is by role only, so they dropped out of the legend when it stopped
   * scanning fill colours. Frozen here so the omission reads as the consequence
   * of a decision, and so the day the markers earn a role this test is what
   * fails and asks for their section back.
   */
  it('says nothing about the Team Topologies markers, which carry no role', () => {
    const labels = CORE_DOMAIN_AUTO_LEGEND.sections.flatMap(s =>
      s.entries.map(e => e.row.label)
    );
    for (const marker of TEAM_TOPOLOGIES) {
      expect(labels).not.toContain(marker.label);
    }
  });
});

describe('what a drawn chart puts in its legend', () => {
  it('lists the dot kinds actually placed, and nothing else', () => {
    const sections = autoLegendSections(
      new Set([CORE_DOMAIN_ROLE.bigBet, CORE_DOMAIN_ROLE.bcCurrent]),
      CORE_DOMAIN_AUTO_LEGEND
    );
    expect(sections.map(s => s.rows.map(r => r.label))).toEqual([
      ['Big-bet sub-domain', 'Bounded context'],
    ]);
  });

  it('is empty on a chart drawn before the roles existed', () => {
    // Every dot on such a chart is neutral, so nothing is recognised — and the
    // box the toolbar then draws is a title with no rows, not the full notation
    // it used to fall back to.
    expect(autoLegendSections(new Set(), CORE_DOMAIN_AUTO_LEGEND)).toEqual([]);
  });
});
