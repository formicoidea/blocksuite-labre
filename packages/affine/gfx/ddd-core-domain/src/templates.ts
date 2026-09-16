import { CD_SUBDOMAINS, TEAM_TOPOLOGIES } from '@labre/affine-gfx-ddd-shared';
import {
  type TemplateCategory,
  templateFromCommand,
} from '@labre/affine-gfx-template';
import { NOTATION_NEUTRALS } from '@labre/affine-shared/consts';
import type { CommandDescriptor } from '@labre/std';

import { coreDomainCommands } from './commands';

/**
 * The Core Domain Chart palette — DERIVED from the toolbox, one template per
 * placement command.
 *
 * It used to be hand-written surface JSON in `ddd-shared`, untouched since
 * 2026-06-21: the chart background had lost `role: core-domain:chart` (so the
 * validation engine never saw a templated chart as a chart at all), the dots
 * were bare ellipses with neither role, name nor group, and the markers were a
 * single square instead of the square + glyph + caption the prefab groups.
 * Derived, none of that can happen again.
 *
 * "Movement over time" has no template on purpose: it arms the connector tool
 * and draws nothing (`docs/adr/0010`) — the movement is a pair the user draws.
 */

/** The command a derived template is the picture of. Throws rather than skips. */
function byLabel(label: string): CommandDescriptor {
  const command = coreDomainCommands.find(
    entry => entry.labelFallback === label
  );
  if (!command) {
    throw new Error(`[ddd-core-domain] templates: no command "${label}"`);
  }
  return command;
}

const ATTRS =
  'width="100%" height="100%" viewBox="0 0 135 80" xmlns="http://www.w3.org/2000/svg"';

const circ = (c: string) =>
  `<svg ${ATTRS}><circle cx="68" cy="40" r="22" fill="${c}" stroke="${NOTATION_NEUTRALS.ink}" stroke-width="1.5"/></svg>`;
const mk = (c: string, l: string) =>
  `<svg ${ATTRS}><rect x="48" y="20" width="40" height="40" rx="5" fill="${c}" stroke="${NOTATION_NEUTRALS.ink}" stroke-width="1.5"/><text x="68" y="47" text-anchor="middle" font-size="20" fill="${NOTATION_NEUTRALS.ink}">${l}</text></svg>`;

const CHART_PREVIEW = `<svg ${ATTRS} fill="none"><rect x="10" y="6" width="115" height="62" fill="#4d9900" fill-opacity="0.5"/><rect x="10" y="6" width="22" height="62" fill="#9933ff" fill-opacity="0.5"/><path d="M10 68 V6 M10 68 H125" stroke="${NOTATION_NEUTRALS.frameInk}" stroke-width="1.6"/></svg>`;

export const coreDomainTemplateCategory: TemplateCategory = {
  name: 'Core Domain Chart',
  // Reuses the senior button's own key — see `TemplateCategory.nameKey`.
  nameKey: 'com.labre.framework.ddd-core-domain',
  templates: [
    // No name override: it would only restate the command's own
    // `labelFallback` as a second literal the panel could not translate — see
    // `resolveTemplateName`, which reads the command's `labelKey` instead.
    templateFromCommand(byLabel('Core Domain Chart'), CHART_PREVIEW),
    ...CD_SUBDOMAINS.map(preset =>
      templateFromCommand(
        byLabel(preset.label),
        circ(preset.fill),
        `Core Domain — ${preset.label}`
      )
    ),
    ...TEAM_TOPOLOGIES.map(preset =>
      templateFromCommand(
        byLabel(preset.label),
        mk(preset.fill, preset.letter),
        `Team topology — ${preset.label}`
      )
    ),
  ],
};
