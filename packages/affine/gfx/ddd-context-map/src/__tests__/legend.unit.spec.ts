import {
  autoLegendSections,
  CM_BUBBLE,
  CM_RELATIONSHIPS,
} from '@labre/affine-gfx-ddd-shared';
import { describe, expect, it } from 'vitest';

import { CONTEXT_MAP_AUTO_LEGEND } from '../legend';
import { CM_PATTERN_ROLE, CONTEXT_MAP_ROLE, CONTEXT_MAP_ROLES } from '../roles';

/**
 * The board's automatic legend is a TABLE over the shared presets. What is worth
 * freezing is not its prose but its DERIVATION: the day a tenth pattern lands in
 * `CM_RELATIONSHIPS` it must get its legend row for free, exactly as it gets its
 * role for free.
 */
describe('the Context Map auto-legend table derives from the presets', () => {
  const [boundaries, relationships] = CONTEXT_MAP_AUTO_LEGEND.sections;

  it('has one relationship entry per pattern, in the presets’ own order', () => {
    expect(relationships.entries.map(e => e.role)).toEqual(
      CM_RELATIONSHIPS.map(preset => CM_PATTERN_ROLE[preset.kind])
    );
    expect(relationships.entries.map(e => e.row.label)).toEqual(
      CM_RELATIONSHIPS.map(preset => `${preset.abbrev} — ${preset.label}`)
    );
  });

  it('draws the two no-integration patterns dashed, like the board does', () => {
    expect(relationships.entries.map(e => e.row.dashed)).toEqual(
      CM_RELATIONSHIPS.map(preset => preset.dashed)
    );
    const dashed = relationships.entries
      .filter(e => e.row.dashed)
      .map(e => e.role);
    expect(dashed).toEqual([
      CM_PATTERN_ROLE.separateWays,
      CM_PATTERN_ROLE.bbom,
    ]);
  });

  it('takes the bounded-context swatch colour and label from the shared units', () => {
    const [context] = boundaries.entries;
    expect(context.role).toBe(CONTEXT_MAP_ROLE.context);
    expect(context.row.color).toBe(CM_BUBBLE.fill);
    expect(context.row.label).toBe(
      CONTEXT_MAP_ROLES[CONTEXT_MAP_ROLE.context].labelFallback
    );
  });

  it('names only roles the vocabulary declares', () => {
    for (const section of CONTEXT_MAP_AUTO_LEGEND.sections) {
      for (const entry of section.entries) {
        expect(CONTEXT_MAP_ROLES[entry.role]).toBeDefined();
      }
    }
  });

  /**
   * The cloud carries no role (`commands.ts` creates it neutral, deliberately),
   * and detection is by role only — so the automatic legend cannot mention it.
   * Frozen here so the omission reads as a decision and not as an oversight; the
   * palette's static Legend entry is what still documents the cloud.
   */
  it('says nothing about the cloud, which carries no role', () => {
    // The BOUNDARIES section is the cloud's only possible home, and it holds one
    // entry: the bounded context. (The "BBoM" row further down is the PATTERN,
    // which does carry a role — not the cloud shape.)
    expect(boundaries.entries).toHaveLength(1);
    expect(boundaries.entries[0].role).toBe(CONTEXT_MAP_ROLE.context);
  });
});

describe('what a drawn board puts in its legend', () => {
  it('lists the contexts and the patterns actually drawn, and nothing else', () => {
    const sections = autoLegendSections(
      new Set([CONTEXT_MAP_ROLE.context, CM_PATTERN_ROLE.acl]),
      CONTEXT_MAP_AUTO_LEGEND
    );
    expect(sections.map(s => s.rows.map(r => r.label))).toEqual([
      ['Bounded context'],
      ['ACL — Anticorruption Layer'],
    ]);
  });
});
