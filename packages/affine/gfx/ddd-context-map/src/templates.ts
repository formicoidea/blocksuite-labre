import { CLOUD, CM_BUBBLE } from '@labre/affine-gfx-ddd-shared';
import {
  type TemplateCategory,
  templateFromCommand,
} from '@labre/affine-gfx-template';
import { NOTATION_NEUTRALS } from '@labre/affine-shared/consts';
import type { CommandDescriptor } from '@labre/std';

import { contextMapCommands } from './commands';

/**
 * The Context Map palette — DERIVED from the toolbox, one template per
 * placement command.
 *
 * It used to be hand-written surface JSON in `ddd-shared`, untouched since
 * 2026-06-21: the bubble carried neither `context-map:context` nor its overflow
 * fit mode, the cloud's name was text stored on the polygon instead of the
 * grouped label the prefab writes, there was no board template, and NINE of the
 * eleven entries were free-floating connectors — the drawing WS2 removed from
 * the toolbox (`docs/adr/0010`). Those nine are gone: their commands arm the
 * connector tool, so there is no artefact to record and the user draws the
 * relation between two real contexts.
 */

/** The command a derived template is the picture of. Throws rather than skips. */
function byLabel(label: string): CommandDescriptor {
  const command = contextMapCommands.find(
    entry => entry.labelFallback === label
  );
  if (!command) {
    throw new Error(`[ddd-context-map] templates: no command "${label}"`);
  }
  return command;
}

const ATTRS =
  'width="100%" height="100%" viewBox="0 0 135 80" xmlns="http://www.w3.org/2000/svg"';

/** The map, in miniature: a white card, two contexts and the line between them. */
const BOARD_PREVIEW = `<svg ${ATTRS} fill="none"><rect x="4" y="6" width="127" height="68" rx="6" fill="${NOTATION_NEUTRALS.cardFill}" stroke="${NOTATION_NEUTRALS.cardBorder}" stroke-width="1.5"/><rect x="18" y="20" width="44" height="18" rx="9" fill="${CM_BUBBLE.fill}" stroke="${CM_BUBBLE.stroke}" stroke-width="1.5"/><rect x="74" y="44" width="44" height="18" rx="9" fill="${CM_BUBBLE.fill}" stroke="${CM_BUBBLE.stroke}" stroke-width="1.5"/><path d="M62 33 L76 48" stroke="${NOTATION_NEUTRALS.ink}" stroke-width="1.5"/></svg>`;

const BUBBLE_PREVIEW = `<svg ${ATTRS} fill="none"><rect x="20" y="25" width="95" height="30" rx="15" fill="${CM_BUBBLE.fill}" stroke="${CM_BUBBLE.stroke}" stroke-width="1.6"/></svg>`;

const CLOUD_PREVIEW = `<svg ${ATTRS} fill="none"><path d="M30 52 C18 52 16 40 26 37 C24 25 42 24 46 32 C50 22 70 24 70 35 C84 32 90 46 78 50 Z" fill="${CLOUD.fill}" stroke="${CLOUD.stroke}" stroke-width="1.4"/></svg>`;

export const contextMapTemplateCategory: TemplateCategory = {
  name: 'Context Map',
  // Reuses the senior button's own key — see `TemplateCategory.nameKey`.
  nameKey: 'com.labre.framework.ddd-context-map',
  templates: [
    // No name override: it would only restate `addBoard`'s own
    // `labelFallback` as a second literal the panel could not translate — see
    // `resolveTemplateName`, which reads the command's `labelKey` instead.
    templateFromCommand(byLabel('Context Map board'), BOARD_PREVIEW),
    templateFromCommand(
      byLabel('Bounded Context'),
      BUBBLE_PREVIEW,
      'Context Map — Bounded Context'
    ),
    templateFromCommand(
      byLabel('Cloud / System (Big Ball of Mud)'),
      CLOUD_PREVIEW,
      'Context Map — Cloud / System'
    ),
  ],
};
