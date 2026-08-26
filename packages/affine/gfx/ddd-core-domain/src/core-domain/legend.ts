import {
  type AutoLegendSpec,
  CD_SUBDOMAINS,
  MOVEMENT_COLOR,
  roleLabel,
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
 * ## What changed, and what is missing
 *
 * The chart's legend button predates roles: until now it scanned the perimeter
 * for FILL COLOURS, which is why it could list a Team Topologies marker and why
 * it fell back to the full notation when it recognised nothing. Detection is now
 * by role, like every other reader of the board, with two consequences worth
 * stating:
 *
 * - the **Team Topologies markers** carry no role — `addMarker` stamps none —
 *   so they are no longer listed. The day they earn one their section lands here
 *   in three lines, derived from `TEAM_TOPOLOGIES` like everything else;
 * - a chart on which nothing is recognised now yields a legend box with a title
 *   and no rows, rather than the whole notation. That is Wardley's behaviour and
 *   the honest one: a legend lists what is drawn, not what could have been.
 */
export const CORE_DOMAIN_AUTO_LEGEND: AutoLegendSpec = {
  title: 'Légende',
  roles: CORE_DOMAIN_ROLES,
  sections: [
    {
      title: 'Sub-domains',
      entries: CD_SUBDOMAINS.map(preset => ({
        role: CORE_DOMAIN_ROLE[preset.kind],
        row: { swatch: 'dot' as const, color: preset.fill, label: preset.label },
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
