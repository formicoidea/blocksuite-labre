import { type AutoLegendSpec, roleLabel } from '@labre/affine-gfx-ddd-shared';

import { BOUNDARY_STROKE, NODE_PALETTE, RELATIONSHIP_STROKE } from './consts';
import { C4_ROLE, C4_ROLES } from './roles';

/**
 * What the C4 board's automatic legend can say — a TABLE, and nothing else: the
 * scan, the placement and the box are `createAutoLegend`'s job, shared with the
 * three DDD boards.
 *
 * Every row is DERIVED twice over: its WORDING from the role vocabulary's own
 * `labelFallback` ({@link roleLabel}), and its COLOUR from the very palette the
 * creation site paints with ({@link NODE_PALETTE}). Neither is restated here, so
 * renaming a role renames its legend row and restyling the pack restyles its
 * swatches — which is what keeps a legend a description of the board rather than
 * a second opinion about it.
 *
 * ## Why `exact` on the container, and only there
 *
 * `c4:database` specialises `c4:container`, so an inclusive entry on the parent
 * would put a "Container" row — with the container's blue square — on a board
 * carrying nothing but cylinders. The row would name a shape that is nowhere on
 * the diagram. EDGY's four base kinds hit this first and `AutoLegendEntry.exact`
 * exists for it: base and specialisation become two separate statements, each
 * listed when it is the thing the user actually drew.
 *
 * The other four element roles are childless, so `exact` would change nothing
 * for them and is left off — the flag marks the places where the distinction is
 * real.
 *
 * ## What is missing, and why
 *
 * `mobile` and `browser` get no row of their own: they carry `c4:container`,
 * because a phone app and a single-page app are containers with a picture
 * (`roles.ts`). Detection is by role and only by role, so a board of nothing but
 * mobile apps lists "Container" — which is the honest answer about what the
 * boxes MEAN. `person-ext` and `system-ext` collapse the same way onto person
 * and system, for the same reason: the grey says "out of scope", not "a
 * different sort of thing".
 */
export const C4_AUTO_LEGEND: AutoLegendSpec = {
  title: 'Legend',
  width: 290,
  roles: C4_ROLES,
  sections: [
    {
      title: 'Elements',
      entries: [
        {
          role: C4_ROLE.person,
          row: {
            swatch: 'square',
            color: NODE_PALETTE.person.fill,
            label: roleLabel(C4_ROLES, C4_ROLE.person),
          },
        },
        {
          role: C4_ROLE.system,
          row: {
            swatch: 'square',
            color: NODE_PALETTE.system.fill,
            label: roleLabel(C4_ROLES, C4_ROLE.system),
          },
        },
        {
          role: C4_ROLE.container,
          // See the note above: a board of cylinders must not claim a container.
          exact: true,
          row: {
            swatch: 'square',
            color: NODE_PALETTE.container.fill,
            label: roleLabel(C4_ROLES, C4_ROLE.container),
          },
        },
        {
          role: C4_ROLE.database,
          row: {
            swatch: 'square',
            color: NODE_PALETTE.database.fill,
            label: roleLabel(C4_ROLES, C4_ROLE.database),
          },
        },
        {
          role: C4_ROLE.component,
          row: {
            swatch: 'square',
            color: NODE_PALETTE.component.fill,
            label: roleLabel(C4_ROLES, C4_ROLE.component),
          },
        },
      ],
    },
    {
      title: 'Frames',
      entries: [
        {
          role: C4_ROLE.boundary,
          row: {
            // A line, not a square: a boundary has no body — it is the dashed
            // frame itself, and a filled swatch would draw the one thing this
            // background deliberately does not paint.
            swatch: 'line',
            color: BOUNDARY_STROKE,
            dashed: true,
            label: roleLabel(C4_ROLES, C4_ROLE.boundary),
          },
        },
      ],
    },
    {
      title: 'Relations',
      entries: [
        {
          role: C4_ROLE.relationship,
          row: {
            swatch: 'line',
            color: RELATIONSHIP_STROKE,
            dashed: true,
            label: roleLabel(C4_ROLES, C4_ROLE.relationship),
          },
        },
      ],
    },
  ],
};
