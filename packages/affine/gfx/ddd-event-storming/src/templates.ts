import { ES_HOTSPOT, ES_STICKIES } from '@labre/affine-gfx-ddd-shared';
import {
  type TemplateCategory,
  templateFromCommand,
} from '@labre/affine-gfx-template';
import { NOTATION_NEUTRALS } from '@labre/affine-shared/consts';
import type { CommandDescriptor } from '@labre/std';

import { eventStormingCommands } from './commands';

/**
 * The Event Storming palette — DERIVED from the toolbox, one template per
 * placement command.
 *
 * It used to be hand-written surface JSON in `ddd-shared`, untouched since
 * 2026-06-21 while the toolbox kept moving: a sticky was one flat rect instead
 * of the shadow + face the prefab groups, it carried neither
 * `textFitMode: Contained` nor the `es:*` role every rule reads, and there was
 * no board template at all. Derived, none of that can happen again — and
 * `__tests__/templates-parity.unit.spec.ts` re-runs each command and compares.
 *
 * The Flow entry has no template on purpose: it arms the connector tool and
 * draws nothing (`docs/adr/0010`) — the user draws the arc.
 */

/** The command a derived template is the picture of. Throws rather than skips. */
function byLabel(label: string): CommandDescriptor {
  const command = eventStormingCommands.find(
    entry => entry.labelFallback === label
  );
  if (!command) {
    throw new Error(`[ddd-event-storming] templates: no command "${label}"`);
  }
  return command;
}

const ATTRS =
  'width="100%" height="100%" viewBox="0 0 135 80" xmlns="http://www.w3.org/2000/svg"';

const sq = (c: string) =>
  `<svg ${ATTRS}><rect x="38" y="13" width="60" height="54" rx="5" fill="${c}"/></svg>`;
const dia = (c: string) =>
  `<svg ${ATTRS}><rect x="48" y="20" width="40" height="40" transform="rotate(45 68 40)" fill="${c}"/></svg>`;

/** The roll, in miniature: a white card, a few stickies, and the one axis. */
const BOARD_PREVIEW = `<svg ${ATTRS} fill="none"><rect x="4" y="6" width="127" height="68" rx="6" fill="${NOTATION_NEUTRALS.cardFill}" stroke="${NOTATION_NEUTRALS.cardBorder}" stroke-width="1.5"/><rect x="14" y="18" width="18" height="18" rx="3" fill="${ES_STICKIES[0].fill}"/><rect x="38" y="18" width="18" height="18" rx="3" fill="${ES_STICKIES[1].fill}"/><rect x="62" y="18" width="18" height="18" rx="3" fill="${ES_STICKIES[2].fill}"/><rect x="86" y="18" width="18" height="18" rx="3" fill="${ES_STICKIES[3].fill}"/><path d="M12 58 H114" stroke="${NOTATION_NEUTRALS.frameInk}" stroke-width="3"/><path d="M112 53 L122 58 L112 63 Z" fill="${NOTATION_NEUTRALS.frameInk}"/></svg>`;

export const eventStormingTemplateCategory: TemplateCategory = {
  name: 'Event Storming',
  // Reuses the senior button's own key — see `TemplateCategory.nameKey`.
  nameKey: 'com.labre.framework.ddd-event-storming',
  templates: [
    // No name override: it would only restate the command's own
    // `labelFallback` as a second literal the panel could not translate — see
    // `resolveTemplateName`, which reads the command's `labelKey` instead.
    templateFromCommand(byLabel('Event Storming board'), BOARD_PREVIEW),
    ...ES_STICKIES.map(preset =>
      templateFromCommand(
        byLabel(preset.label),
        sq(preset.fill),
        `Event Storming — ${preset.label}`
      )
    ),
    templateFromCommand(
      byLabel(ES_HOTSPOT.label),
      dia(ES_HOTSPOT.fill),
      `Event Storming — ${ES_HOTSPOT.label}`
    ),
  ],
};
