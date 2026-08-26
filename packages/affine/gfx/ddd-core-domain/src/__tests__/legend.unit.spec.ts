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
  const [subdomains, markers, movement] = CORE_DOMAIN_AUTO_LEGEND.sections;

  it('titles the box in English', () => {
    // PO recette, 26/08/2026. Identifiers and fallback wordings are English in
    // this library; the box used to be the one that was not.
    expect(CORE_DOMAIN_AUTO_LEGEND.title).toBe('Legend');
  });

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
   * The markers were missing for one release: detection is by role only and
   * `addMarker` stamped none, so a chart covered in them produced a legend that
   * mentioned none (PO recette, 26/08/2026). Now that they carry a role, the
   * row has to show what identifies a marker on the chart — the LETTER, not
   * just a coloured square a reader has no key to.
   */
  it('shows each Team Topologies marker as its own square, letter included', () => {
    expect(markers.entries.map(e => e.role)).toEqual(
      TEAM_TOPOLOGIES.map(preset => CORE_DOMAIN_ROLE[preset.kind])
    );
    expect(markers.entries.map(e => e.row.color)).toEqual(
      TEAM_TOPOLOGIES.map(preset => preset.fill)
    );
    expect(markers.entries.map(e => e.row.letter)).toEqual(['C', 'X', 'F']);
    expect(markers.entries.every(e => e.row.swatch === 'square')).toBe(true);
    // Wording from the vocabulary that names the role, which is itself derived
    // from the preset: one source, read twice.
    expect(markers.entries.map(e => e.row.label)).toEqual(
      TEAM_TOPOLOGIES.map(preset => preset.label)
    );
  });
});

describe('what a drawn chart puts in its legend', () => {
  it('lists the dot kinds actually placed, and nothing else', () => {
    const sections = autoLegendSections(
      new Set([CORE_DOMAIN_ROLE.bigBet, CORE_DOMAIN_ROLE.bcCurrent]),
      CORE_DOMAIN_AUTO_LEGEND
    );
    // No marker on the chart, so no marker section — sub-title included.
    expect(sections.map(s => s.rows.map(r => r.label))).toEqual([
      ['Big-bet sub-domain', 'Bounded context'],
    ]);
  });

  it('lists a marker once one is on the chart, and only the ones that are', () => {
    const sections = autoLegendSections(
      new Set([CORE_DOMAIN_ROLE.bigBet, CORE_DOMAIN_ROLE.xaas]),
      CORE_DOMAIN_AUTO_LEGEND
    );
    expect(sections.map(s => s.title)).toEqual([
      'Sub-domains',
      'Team interaction modes',
    ]);
    expect(sections[1].rows).toEqual([
      { swatch: 'square', color: '#66b2ff', letter: 'X', label: 'X-as-a-Service' },
    ]);
  });

  it('is empty on a chart drawn before the roles existed', () => {
    // Every dot on such a chart is neutral, so nothing is recognised — and the
    // box the toolbar then draws is a title with no rows, not the full notation
    // it used to fall back to.
    expect(autoLegendSections(new Set(), CORE_DOMAIN_AUTO_LEGEND)).toEqual([]);
  });
});
