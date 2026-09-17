import {
  type AutoLegendSpec,
  CLOUD,
  CM_BUBBLE,
  CM_RELATIONSHIPS,
  LABEL_COLOR,
  roleLabel,
} from '@labre/affine-gfx-ddd-shared';
import { BOARD_LEGEND_TITLE } from '@labre/affine-shared/services';

import { CM_PATTERN_ROLE, CONTEXT_MAP_ROLE, CONTEXT_MAP_ROLES } from './roles';
import {
  CONTEXT_MAP_SEED_LEGEND_BOUNDARIES,
  CONTEXT_MAP_SEED_LEGEND_RELATIONSHIPS,
} from './translations';

/**
 * What the Context Map board's automatic legend can say — a TABLE, and nothing
 * else: the scan, the placement and the box are `createAutoLegend`'s job.
 *
 * Every row is DERIVED from the presets the palette itself draws from
 * ({@link CM_RELATIONSHIPS}, {@link CM_BUBBLE}, {@link CLOUD}) and from the
 * role vocabulary's own labels, never restated. A tenth pattern added to
 * `CM_RELATIONSHIPS` gets its legend row here with no edit, the same way it
 * gets its role.
 *
 * ## What is missing, and why
 *
 * Detection is by role and only by role. The **cloud** carries
 * `context-map:system` since the PO recette of 17/09/2026 and is listed; a cloud
 * placed BEFORE that carries no role and stays out of the legend. Nothing is
 * backfilled, deliberately: telling a legacy cloud from any other lilac polygon
 * would mean detecting by shape or fill, which is exactly what this legend
 * refuses to do, and stamping a role onto stored elements is a document
 * migration. Placing a fresh cloud from the palette is the way to list it.
 */
export const CONTEXT_MAP_AUTO_LEGEND: AutoLegendSpec = {
  title: BOARD_LEGEND_TITLE[1],
  titleKey: BOARD_LEGEND_TITLE[0],
  width: 290,
  roles: CONTEXT_MAP_ROLES,
  sections: [
    {
      title: CONTEXT_MAP_SEED_LEGEND_BOUNDARIES[1],
      titleKey: CONTEXT_MAP_SEED_LEGEND_BOUNDARIES[0],
      entries: [
        {
          role: CONTEXT_MAP_ROLE.context,
          row: {
            swatch: 'square',
            color: CM_BUBBLE.fill,
            label: roleLabel(CONTEXT_MAP_ROLES, CONTEXT_MAP_ROLE.context),
          },
        },
        {
          role: CONTEXT_MAP_ROLE.system,
          row: {
            swatch: 'square',
            color: CLOUD.fill,
            label: roleLabel(CONTEXT_MAP_ROLES, CONTEXT_MAP_ROLE.system),
          },
        },
      ],
    },
    {
      title: CONTEXT_MAP_SEED_LEGEND_RELATIONSHIPS[1],
      titleKey: CONTEXT_MAP_SEED_LEGEND_RELATIONSHIPS[0],
      // One entry per PATTERN, not one for `context-map:relationship`: a legend
      // that said "Relationship" would document nothing a reader could use. The
      // dashed sample marks the two "no real integration" patterns, exactly as
      // the board draws them.
      entries: CM_RELATIONSHIPS.map(preset => ({
        role: CM_PATTERN_ROLE[preset.kind],
        labelPrefix: preset.abbrev,
        row: {
          swatch: 'line' as const,
          color: LABEL_COLOR,
          dashed: preset.dashed,
          // Overwritten by `resolveRowLabel` (labelPrefix + the role's own
          // translated `labelKey`, which every one of the nine patterns
          // carries) the moment the legend is actually built — this is the
          // pre-translation placeholder only.
          label: preset.label,
        },
      })),
    },
  ],
};
