import {
  type TemplateCategory,
  templateFromCommand,
} from '@labre/affine-gfx-template';
import type { CommandDescriptor } from '@labre/std';

import { umlCommands } from './commands.js';
import { UML_CARD, UML_DIVIDER, UML_FRAME_INK, UML_INK } from './consts.js';

/**
 * The UML palette — DERIVED from the toolbox, one template per artefact
 * command.
 *
 * Nothing here is hand-authored, and at this notation's size that is not a
 * preference: a UML class is FIVE elements (a bodyless shape, three text tiers
 * and the group that makes them one thing), created in painting order, with the
 * compartment seeds written verbatim so the grammar can read them back. A
 * hand-written restatement of that would have drifted from `actions.ts` the way
 * every framework palette written before C4's already had.
 *
 * So every entry below IS its command, run once against a recording surface,
 * and `__tests__/templates-parity.unit.spec.ts` re-runs each one and compares.
 * The day `createUmlClassifier` changes, the palette changes with it.
 *
 * The nine relationship TOOLS have no template on purpose — they ARM the
 * connector tool and draw nothing, so there is no artefact to record; the two
 * exports are not artefact commands at all.
 */

/** The command a derived template is the picture of. Throws rather than skips. */
function byId(id: string): CommandDescriptor {
  const command = umlCommands.find(entry => entry.id === id);
  if (!command) throw new Error(`[uml] templates: no command "${id}"`);
  return command;
}

const ATTRS =
  'width="100%" height="100%" viewBox="0 0 135 80" xmlns="http://www.w3.org/2000/svg"';

/** A written line, drawn as the ink bar it is at this size. */
const line = (x: number, y: number, w: number, color = UML_FRAME_INK) =>
  `<rect x="${x}" y="${y}" width="${w}" height="3" rx="1.5" fill="${color}" opacity="0.8"/>`;

/**
 * The three-compartment box every classifier is a variation of: the body, the
 * separators at the tiers `umlCompartmentBoxes` computes, and the words.
 */
const classifierPreview = (options: {
  /** The name compartment's own content — keyword chevrons, or a plain name. */
  head?: string;
  /** Lower tiers: how many rules, and whether the name is underlined. */
  rules?: number;
  underline?: boolean;
  /** Where the separators fall, as fractions of the box height. */
  splits?: number[];
}) => {
  const {
    head = line(44, 26, 47, UML_INK),
    rules = 2,
    underline = false,
    splits = [0.34, 0.66],
  } = options;
  const top = 12;
  const height = 56;
  const rows = Array.from({ length: rules }, (_, i) =>
    line(40, 46 + i * 8, i === rules - 1 ? 34 : 50)
  ).join('');
  const separators = splits
    .map(
      f =>
        `<path d="M32 ${top + height * f} H103" stroke="${UML_INK}" stroke-width="1.6"/>`
    )
    .join('');
  return `<svg ${ATTRS} fill="none"><rect x="32" y="${top}" width="71" height="${height}" fill="${UML_CARD}" stroke="${UML_INK}" stroke-width="2"/>${separators}${head}${underline ? `<path d="M44 31 H91" stroke="${UML_INK}" stroke-width="1.6"/>` : ''}${rows}</svg>`;
};

export const umlTemplateCategory: TemplateCategory = {
  name: 'UML',
  templates: [
    // The sheet: the frame with its cut-corner name tag, and two classifiers
    // joined by an association on it.
    templateFromCommand(
      byId('uml.addDiagram'),
      `<svg ${ATTRS} fill="none"><rect x="8" y="8" width="119" height="64" fill="${UML_CARD}" stroke="${UML_FRAME_INK}" stroke-width="1.6"/><path d="M8 8 H44 L50 15 V22 H8 Z" fill="${UML_CARD}" stroke="${UML_FRAME_INK}" stroke-width="1.6" stroke-linejoin="round"/>${line(14, 13, 24, UML_FRAME_INK)}<rect x="20" y="34" width="34" height="26" fill="${UML_CARD}" stroke="${UML_INK}" stroke-width="1.6"/><path d="M20 43 H54" stroke="${UML_INK}" stroke-width="1.4"/><rect x="81" y="34" width="34" height="26" fill="${UML_CARD}" stroke="${UML_INK}" stroke-width="1.6"/><path d="M81 43 H115" stroke="${UML_INK}" stroke-width="1.4"/><path d="M54 47 H81" stroke="${UML_INK}" stroke-width="1.6"/></svg>`
    ),
    templateFromCommand(byId('uml.addClass'), classifierPreview({})),
    // The keyword above the name, drawn as the guillemets it is made of.
    templateFromCommand(
      byId('uml.addInterface'),
      classifierPreview({
        head: `<path d="M56 22 L51 27 L56 32 M79 22 L84 27 L79 32" stroke="${UML_INK}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
      })
    ),
    // The lower compartment of an enumeration is a LIST of literals.
    templateFromCommand(
      byId('uml.addEnumeration'),
      classifierPreview({ rules: 3, splits: [0.34] })
    ),
    // An instance specification: the same box, name UNDERLINED, one tier of
    // slots below it.
    templateFromCommand(
      byId('uml.addObject'),
      classifierPreview({ underline: true, rules: 2, splits: [0.42] })
    ),
    // The folder.
    templateFromCommand(
      byId('uml.addPackage'),
      `<svg ${ATTRS} fill="none"><path d="M26 16 H56 L62 26 H109 V66 H26 Z" fill="${UML_CARD}" stroke="${UML_INK}" stroke-width="2" stroke-linejoin="round"/><path d="M26 26 H62" stroke="${UML_INK}" stroke-width="1.6"/>${line(38, 40, 48, UML_INK)}</svg>`
    ),
    // The bent corner.
    templateFromCommand(
      byId('uml.addNote'),
      `<svg ${ATTRS} fill="none"><path d="M32 14 H88 L103 29 V66 H32 Z" fill="${UML_CARD}" stroke="${UML_INK}" stroke-width="2" stroke-linejoin="round"/><path d="M88 14 V29 H103" stroke="${UML_INK}" stroke-width="1.6" stroke-linejoin="round"/>${line(42, 38, 42)}${line(42, 47, 34)}</svg>`
    ),
    // The stick figure.
    templateFromCommand(
      byId('uml.addActor'),
      `<svg ${ATTRS} fill="none"><circle cx="67.5" cy="18" r="7" stroke="${UML_INK}" stroke-width="2" fill="${UML_CARD}"/><path d="M67.5 25 V45 M52 32 H83 M67.5 45 L56 62 M67.5 45 L79 62" stroke="${UML_INK}" stroke-width="2" stroke-linecap="round"/>${line(50, 68, 35)}</svg>`
    ),
    // The ellipse, and the words centred in it.
    templateFromCommand(
      byId('uml.addUseCase'),
      `<svg ${ATTRS} fill="none"><ellipse cx="67.5" cy="40" rx="45" ry="24" fill="${UML_CARD}" stroke="${UML_INK}" stroke-width="2"/>${line(45, 38, 45, UML_INK)}</svg>`
    ),
    // The frame drawn round the use cases one system offers: a plain thin
    // rectangle, its name along the top, NOT dashed — a subject is a boundary
    // of ownership, and UML draws it solid (§18.1.1).
    templateFromCommand(
      byId('uml.addSubject'),
      `<svg ${ATTRS} fill="none"><rect x="12" y="10" width="111" height="60" stroke="${UML_FRAME_INK}" stroke-width="1.6"/>${line(20, 17, 34, UML_FRAME_INK)}<ellipse cx="50" cy="45" rx="24" ry="13" stroke="${UML_DIVIDER}" stroke-width="1.6"/><ellipse cx="97" cy="45" rx="18" ry="11" stroke="${UML_DIVIDER}" stroke-width="1.6"/></svg>`
    ),
  ],
};
