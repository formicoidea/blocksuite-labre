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
 * The relationship TOOLS have no template on purpose — they ARM the connector
 * tool and draw nothing, so there is no artefact to record; the two exports are
 * not artefact commands at all.
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

/**
 * The 3D box every deployment target is drawn as (§19.4.4) — the back faces
 * first, the front over them, and whatever mark the kind is told apart by
 * INSIDE that front face, which is the only face UML writes in.
 *
 * One helper for the three, exactly as {@link classifierPreview} is one helper
 * for four: a node, a device and an execution environment are the same drawing
 * and a reader who could tell them apart by their silhouette would be reading a
 * notation UML does not have.
 */
const cubePreview = (mark = '') =>
  `<svg ${ATTRS} fill="none"><path d="M24 26 L42 12 H106 V52 L88 66 Z" fill="${UML_CARD}" stroke="${UML_INK}" stroke-width="1.6" stroke-linejoin="round"/><path d="M24 26 H88 V66 H24 Z" fill="${UML_CARD}" stroke="${UML_INK}" stroke-width="2"/><path d="M88 26 L106 12" stroke="${UML_INK}" stroke-width="1.6"/>${line(34, 34, 44, UML_INK)}${mark}</svg>`;

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

    /* ── Phase 2: components (§11.6.4, §11.3.4, §10.4.4) ─────────────── */

    // The classifier box with the two-tab MARK in its corner — the one
    // classifier UML announces without a keyword (§11.6.4).
    templateFromCommand(
      byId('uml.addComponent'),
      `<svg ${ATTRS} fill="none"><rect x="30" y="14" width="75" height="52" fill="${UML_CARD}" stroke="${UML_INK}" stroke-width="2"/><path d="M30 30 H105" stroke="${UML_INK}" stroke-width="1.6"/><rect x="88" y="18" width="13" height="9" fill="${UML_CARD}" stroke="${UML_INK}" stroke-width="1.4"/><rect x="85" y="19.5" width="6" height="2.5" fill="${UML_CARD}" stroke="${UML_INK}" stroke-width="1.2"/><rect x="85" y="23.5" width="6" height="2.5" fill="${UML_CARD}" stroke="${UML_INK}" stroke-width="1.2"/>${line(38, 20, 38, UML_INK)}${line(38, 42, 50)}${line(38, 52, 34)}</svg>`
    ),
    // The filled square ON the border, and its label beside it: a port's whole
    // meaning is where it sits (§11.3.4).
    templateFromCommand(
      byId('uml.addPort'),
      `<svg ${ATTRS} fill="none"><rect x="18" y="16" width="56" height="48" fill="${UML_CARD}" stroke="${UML_INK}" stroke-width="2"/><rect x="66" y="32" width="16" height="16" fill="${UML_INK}"/>${line(88, 38, 30, UML_INK)}</svg>`
    ),
    // The lollipop (§10.4.4): a stub ending in the full circle.
    templateFromCommand(
      byId('uml.addProvidedInterface'),
      `<svg ${ATTRS} fill="none"><path d="M22 34 H62" stroke="${UML_INK}" stroke-width="2.4" stroke-linecap="round"/><circle cx="74" cy="34" r="12" fill="${UML_CARD}" stroke="${UML_INK}" stroke-width="2"/>${line(40, 58, 46, UML_INK)}</svg>`
    ),
    // The socket: the same stub, ending in the half circle that cups a ball.
    templateFromCommand(
      byId('uml.addRequiredInterface'),
      `<svg ${ATTRS} fill="none"><path d="M22 34 H62" stroke="${UML_INK}" stroke-width="2.4" stroke-linecap="round"/><path d="M74 22 A12 12 0 0 0 74 46" stroke="${UML_INK}" stroke-width="2" stroke-linecap="round"/>${line(40, 58, 46, UML_INK)}</svg>`
    ),

    /* ── Phase 2: deployment (§19.3.4, §19.4.4) ──────────────────────── */

    // The document, with words written ON it — which is what tells an artifact
    // from the note that shares its folded corner.
    templateFromCommand(
      byId('uml.addArtifact'),
      `<svg ${ATTRS} fill="none"><path d="M38 12 H80 L97 29 V68 H38 Z" fill="${UML_CARD}" stroke="${UML_INK}" stroke-width="2" stroke-linejoin="round"/><path d="M80 12 V29 H97" stroke="${UML_INK}" stroke-width="1.6" stroke-linejoin="round"/>${line(46, 36, 40, UML_INK)}${line(46, 50, 42)}${line(46, 58, 30)}</svg>`
    ),
    templateFromCommand(byId('uml.addNode'), cubePreview()),
    // The chip: this node is HARDWARE.
    templateFromCommand(
      byId('uml.addDevice'),
      cubePreview(
        `<rect x="34" y="46" width="26" height="11" rx="1.5" fill="${UML_INK}"/>`
      )
    ),
    // The run mark: this node is software other software is deployed INTO.
    templateFromCommand(
      byId('uml.addExecutionEnvironment'),
      cubePreview(`<path d="M34 45 L54 52.5 L34 60 Z" fill="${UML_INK}"/>`)
    ),
  ],
};
