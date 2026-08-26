import {
  type AutoLegendSpec,
  ES_HOTSPOT,
  ES_STICKIES,
  LABEL_COLOR,
  roleLabel,
} from '@labre/affine-gfx-ddd-shared';

import { ES_ROLE, ES_STICKY_ROLE, EVENT_STORMING_ROLES } from './roles';

/**
 * What the Event Storming board's automatic legend can say — a TABLE, and
 * nothing else: the scan, the placement and the box are `createAutoLegend`'s
 * job.
 *
 * Every row is DERIVED from the palette the stickies are drawn with
 * ({@link ES_STICKIES}, {@link ES_HOTSPOT}) and from the role vocabulary's own
 * labels, never restated — so the colour ladder the legend shows is by
 * construction the colour ladder on the wall, and a tenth sticky kind added to
 * `ES_STICKIES` gets its legend row with no edit.
 *
 * The hotspot is appended for the same reason `roles.ts` appends it: it lives in
 * its own preset (a diamond, not a square) rather than in the table.
 */
export const EVENT_STORMING_AUTO_LEGEND: AutoLegendSpec = {
  title: 'Légende',
  roles: EVENT_STORMING_ROLES,
  sections: [
    {
      title: 'Stickies',
      entries: [
        ...ES_STICKIES.map(preset => ({
          role: ES_STICKY_ROLE[preset.kind],
          row: {
            swatch: 'square' as const,
            color: preset.fill,
            label: preset.label,
          },
        })),
        {
          role: ES_STICKY_ROLE.hotspot,
          row: {
            swatch: 'square' as const,
            color: ES_HOTSPOT.fill,
            label: ES_HOTSPOT.label,
          },
        },
      ],
    },
    {
      title: 'Flow',
      entries: [
        {
          role: ES_ROLE.flow,
          row: {
            swatch: 'line',
            // The style `activateEventStormingFlow` arms the connector tool
            // with: a solid line in the label colour.
            color: LABEL_COLOR,
            label: roleLabel(EVENT_STORMING_ROLES, ES_ROLE.flow),
          },
        },
      ],
    },
  ],
};
