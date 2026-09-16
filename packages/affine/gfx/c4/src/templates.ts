import {
  type TemplateCategory,
  templateFromCommand,
} from '@labre/affine-gfx-template';
import type { C4NodeKind } from '@labre/affine-model';
import type { CommandDescriptor } from '@labre/std';

import { c4Commands } from './commands';
import {
  BOARD_BAND_FILL,
  BOARD_CARD_BORDER,
  BOARD_CARD_FILL,
  BOARD_TITLE_COLOR,
  BOUNDARY_STROKE,
  NODE_PALETTE,
  RELATIONSHIP_STROKE,
} from './consts';

/**
 * The C4 palette — DERIVED from the toolbox, one template per command.
 *
 * C4 was the ONE framework the Templates panel had no category for: the pack
 * landed on 28/08/2026 with thirteen commands and nobody wrote the palette
 * (audit of 09/09/2026, § 4.3). Writing it by hand was never an option — a C4
 * component is five elements (a bodyless shape, three text tiers and the group
 * that makes them one thing), created in painting order, and a hand-written
 * restatement of that would have drifted from `actions.ts` the way every other
 * framework's palette already had.
 *
 * So every entry below IS its command, run once against a recording surface, and
 * `__tests__/templates-parity.unit.spec.ts` re-runs each one and compares. There
 * is nothing hand-authored here to fall out of date: the day `createC4Node`
 * changes, the palette changes with it.
 *
 * `relationshipTool` has no template on purpose — it ARMS the connector tool and
 * draws nothing, so there is no artefact to record; `exportMermaid` is not an
 * artefact command at all.
 */

/** The command a derived template is the picture of. Throws rather than skips. */
function byId(id: string): CommandDescriptor {
  const command = c4Commands.find(entry => entry.id === id);
  if (!command) throw new Error(`[c4] templates: no command "${id}"`);
  return command;
}

const ATTRS =
  'width="100%" height="100%" viewBox="0 0 135 80" xmlns="http://www.w3.org/2000/svg"';

/** The two written lines every element carries, drawn as the words they are. */
const words = (color: string, y: number) =>
  `<g fill="${color}" opacity="0.85"><rect x="44" y="${y}" width="47" height="4" rx="2"/><rect x="52" y="${y + 8}" width="31" height="3" rx="1.5"/></g>`;

/** A kind's body, in its own stencil colours — the plain box the levels share. */
const boxPreview = (kind: C4NodeKind, extra = '') => {
  const p = NODE_PALETTE[kind];
  return `<svg ${ATTRS} fill="none"><rect x="30" y="20" width="75" height="40" fill="${p.fill}" stroke="${p.border}" stroke-width="2"/>${words(p.text, 32)}${extra}</svg>`;
};

/** The silhouette: a head standing clear of the same body. */
const personPreview = (kind: C4NodeKind) => {
  const p = NODE_PALETTE[kind];
  return `<svg ${ATTRS} fill="none"><circle cx="67" cy="18" r="10" fill="${p.fill}" stroke="${p.border}" stroke-width="2"/><rect x="34" y="32" width="67" height="32" rx="14" fill="${p.fill}" stroke="${p.border}" stroke-width="2"/>${words(p.text, 42)}</svg>`;
};

/** A dashed frame, and — one level in — a second frame inside it. */
const boundaryPreview = (inner = '') =>
  `<svg ${ATTRS} fill="none"><rect x="14" y="12" width="107" height="56" stroke="${BOUNDARY_STROKE}" stroke-width="2" stroke-dasharray="7 4.5"/>${inner}</svg>`;

const CONTAINER = NODE_PALETTE.container;

export const c4TemplateCategory: TemplateCategory = {
  name: 'C4',
  // Reuses the senior button's own key — see `TemplateCategory.nameKey`.
  nameKey: 'com.labre.framework.c4',
  templates: [
    templateFromCommand(
      byId('c4.addBoard'),
      `<svg ${ATTRS} fill="none"><rect x="10" y="10" width="115" height="60" rx="6" fill="${BOARD_CARD_FILL}" stroke="${BOARD_CARD_BORDER}" stroke-width="1.5"/><path d="M10 26 H125" stroke="${BOARD_CARD_BORDER}" stroke-width="1.5"/><rect x="11" y="11" width="113" height="15" fill="${BOARD_BAND_FILL}"/><rect x="20" y="15" width="40" height="6" rx="3" fill="${BOARD_TITLE_COLOR}" opacity="0.55"/><rect x="22" y="36" width="34" height="20" rx="2" fill="${NODE_PALETTE.system.fill}"/><rect x="79" y="36" width="34" height="20" rx="2" fill="${CONTAINER.fill}"/><path d="M58 46 H75" stroke="${RELATIONSHIP_STROKE}" stroke-width="1.6" stroke-dasharray="4 3"/></svg>`
    ),
    templateFromCommand(byId('c4.addPerson'), personPreview('person')),
    templateFromCommand(byId('c4.addPersonExt'), personPreview('person-ext')),
    templateFromCommand(byId('c4.addSystem'), boxPreview('system')),
    templateFromCommand(byId('c4.addSystemExt'), boxPreview('system-ext')),
    templateFromCommand(byId('c4.addContainer'), boxPreview('container')),
    // The UML component: the same box, with two tabs down its leading edge.
    templateFromCommand(
      byId('c4.addComponent'),
      boxPreview(
        'component',
        `<g fill="${NODE_PALETTE.component.fill}" stroke="${NODE_PALETTE.component.border}" stroke-width="2"><rect x="22" y="28" width="16" height="8"/><rect x="22" y="44" width="16" height="8"/></g>`
      )
    ),
    // A cylinder, and the stencil's own container blue: a database is a
    // container drawn as a data store, never a fourth level.
    templateFromCommand(
      byId('c4.addDatabase'),
      `<svg ${ATTRS} fill="none"><path d="M36 22 V58 C36 62 50 65 67 65 C84 65 99 62 99 58 V22 Z" fill="${CONTAINER.fill}" stroke="${CONTAINER.border}" stroke-width="2"/><ellipse cx="67.5" cy="22" rx="31.5" ry="7" fill="${CONTAINER.fill}" stroke="${CONTAINER.border}" stroke-width="2"/>${words(CONTAINER.text, 38)}</svg>`
    ),
    // The two decorated containers paint their BEZEL in the border colour and
    // their SCREEN in the fill, which is the stencil's own pair (`consts.ts`).
    templateFromCommand(
      byId('c4.addMobile'),
      `<svg ${ATTRS} fill="none"><rect x="49" y="6" width="37" height="68" rx="7" fill="${CONTAINER.border}"/><rect x="54" y="15" width="27" height="50" fill="${CONTAINER.fill}"/><rect x="61" y="10" width="13" height="2.5" rx="1.25" fill="${CONTAINER.fill}"/></svg>`
    ),
    templateFromCommand(
      byId('c4.addBrowser'),
      `<svg ${ATTRS} fill="none"><rect x="20" y="14" width="95" height="52" rx="4" fill="${CONTAINER.border}"/><rect x="24" y="28" width="87" height="34" fill="${CONTAINER.fill}"/><g fill="${CONTAINER.fill}"><circle cx="29" cy="21" r="2.4"/><circle cx="37" cy="21" r="2.4"/><circle cx="45" cy="21" r="2.4"/></g></svg>`
    ),
    templateFromCommand(byId('c4.addSystemBoundary'), boundaryPreview()),
    templateFromCommand(
      byId('c4.addContainerBoundary'),
      boundaryPreview(
        `<rect x="34" y="26" width="67" height="30" stroke="${BOUNDARY_STROKE}" stroke-width="1.6" stroke-dasharray="5 3.5"/>`
      )
    ),
  ],
};
