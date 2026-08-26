import {
  type AutoLegendSpec,
  CD_SUBDOMAINS,
  MOVEMENT_COLOR,
  roleLabel,
  TEAM_TOPOLOGIES,
} from '@labre/affine-gfx-ddd-shared';

import { CORE_DOMAIN_ROLE, CORE_DOMAIN_ROLES } from '../roles';

/**
 * What the Core Domain Chart's automatic legend can say — a TABLE, and nothing
 * else: the scan, the placement and the box are `createAutoLegend`'s job.
 *
 * Every row is DERIVED from the presets the palette draws its dots with
 * ({@link CD_SUBDOMAINS}) and from the role vocabulary's own labels, never
 * restated — which also keeps this table and `core-domain.off-legend-colour`
 * naming the same five colours by construction.
 *
 * ## What changed
 *
 * The chart's legend button predates roles: until now it scanned the perimeter
 * for FILL COLOURS, which is why it fell back to the full notation when it
 * recognised nothing. Detection is now by role, like every other reader of the
 * board, with one consequence worth stating: a chart on which nothing is
 * recognised yields a legend box with a title and no rows, rather than the whole
 * notation. That is Wardley's behaviour and the honest one — a legend lists what
 * is drawn, not what could have been.
 *
 * The **Team Topologies markers** were the casualty of that change for one
 * release: `addMarker` stamped no role, so a chart covered in them produced a
 * legend that mentioned none (PO recette, 26/08/2026). They now carry
 * `core-domain:marker-*` and their section is here, derived from
 * `TEAM_TOPOLOGIES` like everything else — swatch, letter and colour from the
 * preset the palette draws with, wording from the vocabulary that names the
 * role.
 */
export const CORE_DOMAIN_AUTO_LEGEND: AutoLegendSpec = {
  title: 'Legend',
  roles: CORE_DOMAIN_ROLES,
  sections: [
    {
      title: 'Sub-domains',
      entries: CD_SUBDOMAINS.map(preset => ({
        role: CORE_DOMAIN_ROLE[preset.kind],
        row: {
          swatch: 'dot' as const,
          color: preset.fill,
          label: preset.label,
        },
      })),
    },
    {
      // The letter is what identifies a marker on the chart — the squares are
      // three colours a reader has no key to — so the legend shows the same
      // square with the same letter in it, which is what `LegendRow.letter`
      // exists for.
      title: 'Team interaction modes',
      entries: TEAM_TOPOLOGIES.map(preset => ({
        role: CORE_DOMAIN_ROLE[preset.kind],
        row: {
          swatch: 'square' as const,
          color: preset.fill,
          letter: preset.letter,
          label: roleLabel(CORE_DOMAIN_ROLES, CORE_DOMAIN_ROLE[preset.kind]),
        },
      })),
    },
    {
      title: 'Movement',
      entries: [
        {
          role: CORE_DOMAIN_ROLE.movement,
          row: {
            swatch: 'line',
            // The style `activateMovement` arms the connector tool with: a red
            // dashed line.
            color: MOVEMENT_COLOR,
            dashed: true,
            label: roleLabel(CORE_DOMAIN_ROLES, CORE_DOMAIN_ROLE.movement),
          },
        },
      ],
    },
  ],
};
