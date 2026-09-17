import {
  autoLegendSections,
  CLOUD,
  CM_BUBBLE,
  CM_RELATIONSHIPS,
} from '@labre/affine-gfx-ddd-shared';
import type { BlockStdScope } from '@labre/std';
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
    // The spec's own `row.label` is the PRE-TRANSLATION placeholder
    // (`preset.label` alone): `resolveRowLabel` combines it with
    // `labelPrefix` and the role's translated `labelKey` at legend-build
    // time — see the "what a drawn board puts in its legend" block below for
    // the resolved, combined string.
    expect(relationships.entries.map(e => e.labelPrefix)).toEqual(
      CM_RELATIONSHIPS.map(preset => preset.abbrev)
    );
    expect(relationships.entries.map(e => e.row.label)).toEqual(
      CM_RELATIONSHIPS.map(preset => preset.label)
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
   * The cloud carries `context-map:system` (PO recette, 17/09/2026), so it has a
   * row — in BOUNDARIES, beside the bounded context, in the cloud's own lilac.
   * (The "BBoM" row further down is the PATTERN, not the cloud shape.)
   */
  it('lists the cloud under its role, in the fill the palette draws it with', () => {
    expect(boundaries.entries.map(e => e.role)).toEqual([
      CONTEXT_MAP_ROLE.context,
      CONTEXT_MAP_ROLE.system,
    ]);
    const [, system] = boundaries.entries;
    expect(system.row.color).toBe(CLOUD.fill);
    expect(system.row.label).toBe(
      CONTEXT_MAP_ROLES[CONTEXT_MAP_ROLE.system].labelFallback
    );
  });
});

describe('what a drawn board puts in its legend', () => {
  // No host catalogue: `translateKey` falls through to the fallback it is
  // given, so the plain English wording is still what these rows show.
  const NO_HOST_STD = {
    getOptional: () => undefined,
  } as unknown as BlockStdScope;

  it('lists the contexts and the patterns actually drawn, and nothing else', () => {
    const sections = autoLegendSections(
      new Set([CONTEXT_MAP_ROLE.context, CM_PATTERN_ROLE.acl]),
      CONTEXT_MAP_AUTO_LEGEND,
      NO_HOST_STD
    );
    expect(sections.map(s => s.rows.map(r => r.label))).toEqual([
      ['Bounded context'],
      ['ACL — Anticorruption Layer'],
    ]);
  });

  it('gives a cloud on the board its row, and a board without one none', () => {
    const rows = (present: string[]) =>
      autoLegendSections(
        new Set(present),
        CONTEXT_MAP_AUTO_LEGEND,
        NO_HOST_STD
      ).flatMap(s => s.rows.map(r => r.label));
    expect(rows([CONTEXT_MAP_ROLE.system])).toEqual([
      'System / Big Ball of Mud',
    ]);
    // A legacy cloud carries no role: it contributes nothing to `present`.
    expect(rows([CONTEXT_MAP_ROLE.context])).toEqual(['Bounded context']);
  });
});
