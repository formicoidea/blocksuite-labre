import {
  type AutoLegendSpec,
  CM_BUBBLE,
  CM_RELATIONSHIPS,
  LABEL_COLOR,
  roleLabel,
} from '@labre/affine-gfx-ddd-shared';

import { CM_PATTERN_ROLE, CONTEXT_MAP_ROLE, CONTEXT_MAP_ROLES } from './roles';

/**
 * What the Context Map board's automatic legend can say — a TABLE, and nothing
 * else: the scan, the placement and the box are `createAutoLegend`'s job.
 *
 * Every row is DERIVED from the presets the palette itself draws from
 * ({@link CM_RELATIONSHIPS}, {@link CM_BUBBLE}) and from the role vocabulary's
 * own labels, never restated. A tenth pattern added to `CM_RELATIONSHIPS` gets
 * its legend row here with no edit, the same way it gets its role.
 *
 * ## What is missing, and why
 *
 * The **cloud** (the "System / Big Ball of Mud" blob) carries no role: it is
 * created neutral by `commands.ts`, deliberately — the endpoint grammar treats a
 * relationship drawn onto a cloud as a sketch and stays silent on it. Detection
 * is by role and only by role, so the automatic legend cannot list the cloud and
 * does not pretend to. The palette's static Legend entry still documents it, and
 * the day the cloud earns a role its row lands here in one line.
 */
export const CONTEXT_MAP_AUTO_LEGEND: AutoLegendSpec = {
  title: 'Legend',
  width: 290,
  roles: CONTEXT_MAP_ROLES,
  sections: [
    {
      title: 'Boundaries',
      entries: [
        {
          role: CONTEXT_MAP_ROLE.context,
          row: {
            swatch: 'square',
            color: CM_BUBBLE.fill,
            label: roleLabel(CONTEXT_MAP_ROLES, CONTEXT_MAP_ROLE.context),
          },
        },
      ],
    },
    {
      title: 'Relationships',
      // One entry per PATTERN, not one for `context-map:relationship`: a legend
      // that said "Relationship" would document nothing a reader could use. The
      // dashed sample marks the two "no real integration" patterns, exactly as
      // the board draws them.
      entries: CM_RELATIONSHIPS.map(preset => ({
        role: CM_PATTERN_ROLE[preset.kind],
        row: {
          swatch: 'line' as const,
          color: LABEL_COLOR,
          dashed: preset.dashed,
          label: `${preset.abbrev} — ${preset.label}`,
        },
      })),
    },
  ],
};
