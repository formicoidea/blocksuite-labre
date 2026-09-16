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

/**
 * The BULLSEYE — a filled disc inside a ring.
 *
 * One helper for two entries, and it is the same argument {@link cubePreview}
 * makes for three: §15.3.4's activity final and §14.2.4's final state are ONE
 * drawing, and a palette that gave them two would be teaching a distinction UML
 * does not draw. What separates them is the role and the sheet each is legal
 * on, which the audit reads and a preview cannot show.
 */
const bullseyePreview = () =>
  `<svg ${ATTRS} fill="none"><circle cx="67.5" cy="40" r="22" fill="${UML_CARD}" stroke="${UML_INK}" stroke-width="2"/><circle cx="67.5" cy="40" r="12" fill="${UML_INK}"/></svg>`;

/**
 * The DIAMOND one token leaves by a single branch — §15.3.4's decision and
 * §14.2.4's choice, which are again one drawing on two diagrams.
 */
const diamondPreview = () =>
  `<svg ${ATTRS} fill="none"><path d="M67.5 14 L98 40 L67.5 66 L37 40 Z" fill="${UML_CARD}" stroke="${UML_INK}" stroke-width="2" stroke-linejoin="round"/><path d="M12 40 H37" stroke="${UML_INK}" stroke-width="2" stroke-linecap="round"/><path d="M98 40 H123" stroke="${UML_INK}" stroke-width="2" stroke-linecap="round"/></svg>`;

/**
 * The `H` in its circle (§14.2.4) — drawn as strokes rather than set as type,
 * so the preview does not depend on a font being loaded. `mark` is the deep
 * history's asterisk, and the only difference between the two.
 */
const historyPreview = (mark = '') =>
  `<svg ${ATTRS} fill="none"><circle cx="60" cy="40" r="22" fill="${UML_CARD}" stroke="${UML_INK}" stroke-width="2"/><path d="M51 29 V51 M69 29 V51 M51 40 H69" stroke="${UML_INK}" stroke-width="2.4" stroke-linecap="round"/>${mark}</svg>`;

export const umlTemplateCategory: TemplateCategory = {
  name: 'UML',
  // Reuses the senior button's own key — see `TemplateCategory.nameKey`.
  nameKey: 'com.labre.framework.uml',
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

    /* ── Phase 2: activities (§15.2.4, §15.3.4, §15.4.4, §16) ────────── */

    // The round-cornered rectangle a step is drawn as.
    templateFromCommand(
      byId('uml.addAction'),
      `<svg ${ATTRS} fill="none"><rect x="26" y="22" width="83" height="36" rx="14" fill="${UML_CARD}" stroke="${UML_INK}" stroke-width="2"/>${line(44, 38, 47, UML_INK)}</svg>`
    ),
    // The filled disc, and the first arrow out of it.
    templateFromCommand(
      byId('uml.addInitial'),
      `<svg ${ATTRS} fill="none"><circle cx="42" cy="40" r="13" fill="${UML_INK}"/><path d="M58 40 H92" stroke="${UML_INK}" stroke-width="2" stroke-linecap="round"/><path d="M85 34 L95 40 L85 46" stroke="${UML_INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`
    ),
    // The bullseye: every token stops.
    templateFromCommand(byId('uml.addActivityFinal'), bullseyePreview()),
    // The circle with the cross: THIS token stops, the activity carries on.
    templateFromCommand(
      byId('uml.addFlowFinal'),
      `<svg ${ATTRS} fill="none"><circle cx="67.5" cy="40" r="22" fill="${UML_CARD}" stroke="${UML_INK}" stroke-width="2"/><path d="M57 29.5 L78 50.5 M78 29.5 L57 50.5" stroke="${UML_INK}" stroke-width="2.4" stroke-linecap="round"/></svg>`
    ),
    // One token, ONE branch.
    templateFromCommand(byId('uml.addDecision'), diamondPreview()),
    // One token, EVERY branch: the filled bar, with the flows through it.
    templateFromCommand(
      byId('uml.addFork'),
      `<svg ${ATTRS} fill="none"><rect x="60" y="12" width="9" height="56" rx="2" fill="${UML_INK}"/><path d="M22 40 H60" stroke="${UML_INK}" stroke-width="2" stroke-linecap="round"/><path d="M69 26 H112 M69 54 H112" stroke="${UML_INK}" stroke-width="2" stroke-linecap="round"/></svg>`
    ),
    // Data ON a flow, which is the only thing that tells it from a class box.
    templateFromCommand(
      byId('uml.addObjectNode'),
      `<svg ${ATTRS} fill="none"><rect x="45" y="26" width="45" height="28" fill="${UML_CARD}" stroke="${UML_INK}" stroke-width="2"/>${line(54, 38, 28, UML_INK)}<path d="M14 40 H45 M90 40 H121" stroke="${UML_INK}" stroke-width="2" stroke-linecap="round"/></svg>`
    ),
    // The convex pentagon: the message leaving.
    templateFromCommand(
      byId('uml.addSendSignal'),
      `<svg ${ATTRS} fill="none"><path d="M24 22 H92 L110 40 L92 58 H24 Z" fill="${UML_CARD}" stroke="${UML_INK}" stroke-width="2" stroke-linejoin="round"/>${line(38, 38, 44, UML_INK)}</svg>`
    ),
    // The concave one: the cup it arrives into. Deliberately its mirror.
    templateFromCommand(
      byId('uml.addAcceptEvent'),
      `<svg ${ATTRS} fill="none"><path d="M22 22 H111 V58 H22 L40 40 Z" fill="${UML_CARD}" stroke="${UML_INK}" stroke-width="2" stroke-linejoin="round"/>${line(50, 38, 44, UML_INK)}</svg>`
    ),
    // The hourglass.
    templateFromCommand(
      byId('uml.addTimeEvent'),
      `<svg ${ATTRS} fill="none"><path d="M50 12 H85 L50 68 H85" stroke="${UML_INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M50 12 L85 68" stroke="${UML_INK}" stroke-width="2" stroke-linecap="round"/></svg>`
    ),
    // The swimlanes, and the heading strip that makes them lanes rather than
    // lines (§15.6.4).
    templateFromCommand(
      byId('uml.addPartition'),
      `<svg ${ATTRS} fill="none"><rect x="12" y="10" width="111" height="60" stroke="${UML_FRAME_INK}" stroke-width="1.6"/><path d="M12 24 H123 M67.5 10 V70" stroke="${UML_FRAME_INK}" stroke-width="1.4"/>${line(22, 15, 28, UML_FRAME_INK)}${line(78, 15, 28, UML_FRAME_INK)}<rect x="24" y="36" width="34" height="18" rx="7" stroke="${UML_DIVIDER}" stroke-width="1.6"/><rect x="78" y="36" width="34" height="18" rx="7" stroke="${UML_DIVIDER}" stroke-width="1.6"/></svg>`
    ),

    /* ── Phase 2: state machines (§14.2.4) ───────────────────────────── */

    // The rounded box with a name band: a name over the behaviour lines below.
    templateFromCommand(
      byId('uml.addState'),
      `<svg ${ATTRS} fill="none"><rect x="26" y="14" width="83" height="52" rx="14" fill="${UML_CARD}" stroke="${UML_INK}" stroke-width="2"/><path d="M26 34 H109" stroke="${UML_INK}" stroke-width="1.6"/>${line(44, 22, 47, UML_INK)}${line(38, 42, 56)}${line(38, 52, 44)}</svg>`
    ),
    // The bullseye again: §14.2.4 and §15.3.4 draw one circle, so this pack
    // draws one too — the ROLE is what says which sheet it is legal on.
    templateFromCommand(byId('uml.addFinalState'), bullseyePreview()),
    // The decision's diamond, on the other diagram.
    templateFromCommand(byId('uml.addChoice'), diamondPreview()),
    // The knot several transitions merge at.
    templateFromCommand(
      byId('uml.addJunction'),
      `<svg ${ATTRS} fill="none"><circle cx="67.5" cy="40" r="11" fill="${UML_INK}"/><path d="M20 18 L58 34 M20 62 L58 46 M79 40 H116" stroke="${UML_INK}" stroke-width="2" stroke-linecap="round"/></svg>`
    ),
    // `H` — come back to the sub-state this region was last in.
    templateFromCommand(byId('uml.addShallowHistory'), historyPreview()),
    // `H*` — come back to the whole nested configuration.
    templateFromCommand(
      byId('uml.addDeepHistory'),
      historyPreview(
        `<path d="M104 24 V40 M97 28 L111 36 M111 28 L97 36" stroke="${UML_INK}" stroke-width="2" stroke-linecap="round"/>`
      )
    ),
    // The named way IN, and the border it means nothing off.
    templateFromCommand(
      byId('uml.addEntryPoint'),
      `<svg ${ATTRS} fill="none"><path d="M67.5 8 V72" stroke="${UML_INK}" stroke-width="2"/><path d="M22 40 H55" stroke="${UML_INK}" stroke-width="2" stroke-linecap="round"/><circle cx="67.5" cy="40" r="11" fill="${UML_CARD}" stroke="${UML_INK}" stroke-width="2"/></svg>`
    ),
    // …and the named way out, crossed.
    templateFromCommand(
      byId('uml.addExitPoint'),
      `<svg ${ATTRS} fill="none"><path d="M67.5 8 V72" stroke="${UML_INK}" stroke-width="2"/><path d="M80 40 H113" stroke="${UML_INK}" stroke-width="2" stroke-linecap="round"/><circle cx="67.5" cy="40" r="11" fill="${UML_CARD}" stroke="${UML_INK}" stroke-width="2"/><path d="M60.5 33 L74.5 47 M74.5 33 L60.5 47" stroke="${UML_INK}" stroke-width="1.8" stroke-linecap="round"/></svg>`
    ),
    // The bare cross: no circle round it, which is the whole of what tells it
    // from the flow final and from the exit point.
    templateFromCommand(
      byId('uml.addTerminate'),
      `<svg ${ATTRS} fill="none"><path d="M46 19 L89 61 M89 19 L46 61" stroke="${UML_INK}" stroke-width="3" stroke-linecap="round"/></svg>`
    ),
    // The composite state: the container, with a sub-machine in it.
    templateFromCommand(
      byId('uml.addRegion'),
      `<svg ${ATTRS} fill="none"><rect x="12" y="10" width="111" height="60" rx="10" stroke="${UML_FRAME_INK}" stroke-width="1.6"/><path d="M12 26 H123" stroke="${UML_FRAME_INK}" stroke-width="1.4"/>${line(22, 15, 32, UML_FRAME_INK)}<rect x="26" y="38" width="32" height="18" rx="7" stroke="${UML_DIVIDER}" stroke-width="1.6"/><rect x="78" y="38" width="32" height="18" rx="7" stroke="${UML_DIVIDER}" stroke-width="1.6"/><path d="M58 47 H78" stroke="${UML_DIVIDER}" stroke-width="1.6"/></svg>`
    ),

    /* ── Phase 3: sequence diagrams (§17.2.4, §17.6.4, §17.7.4) ──────── */

    // The head with its name, and the DASHED spine falling out of it — the
    // half a reader recognises a sequence diagram by, because time runs down
    // it. Two of them, with a message between, so the preview shows what a
    // lifeline is FOR rather than a box with a dotted tail.
    templateFromCommand(
      byId('uml.addLifeline'),
      `<svg ${ATTRS} fill="none"><rect x="14" y="8" width="46" height="20" fill="${UML_CARD}" stroke="${UML_INK}" stroke-width="2"/>${line(22, 16, 30, UML_INK)}<path d="M37 28 V74" stroke="${UML_INK}" stroke-width="1.6" stroke-dasharray="5 5"/><rect x="75" y="8" width="46" height="20" fill="${UML_CARD}" stroke="${UML_INK}" stroke-width="2"/>${line(83, 16, 30, UML_INK)}<path d="M98 28 V74" stroke="${UML_INK}" stroke-width="1.6" stroke-dasharray="5 5"/><path d="M37 48 H92" stroke="${UML_DIVIDER}" stroke-width="1.6"/><path d="M92 44 L99 48 L92 52 Z" fill="${UML_DIVIDER}"/></svg>`
    ),
    // The bar ON the spine: the stretch of the conversation this participant
    // spends doing something (§17.2.4). Drawn over the dashes, because a bar
    // beside a lifeline states nothing.
    templateFromCommand(
      byId('uml.addExecution'),
      `<svg ${ATTRS} fill="none"><path d="M67.5 6 V74" stroke="${UML_INK}" stroke-width="1.6" stroke-dasharray="5 5"/><rect x="61" y="22" width="13" height="38" fill="${UML_CARD}" stroke="${UML_INK}" stroke-width="2"/><path d="M28 30 H61" stroke="${UML_DIVIDER}" stroke-width="1.6"/><path d="M74 52 H107" stroke="${UML_DIVIDER}" stroke-width="1.6"/></svg>`
    ),
    // The cross the spine stops at: nothing happens to this participant after
    // it (§17.2.4). The dashes ABOVE and none below is the whole statement.
    templateFromCommand(
      byId('uml.addDestruction'),
      `<svg ${ATTRS} fill="none"><path d="M67.5 6 V40" stroke="${UML_INK}" stroke-width="1.6" stroke-dasharray="5 5"/><path d="M53 26 L82 55 M82 26 L53 55" stroke="${UML_INK}" stroke-width="3" stroke-linecap="round"/><path d="M18 40 H50" stroke="${UML_DIVIDER}" stroke-width="1.6"/><path d="M44 36 L51 40 L44 44 Z" fill="${UML_DIVIDER}"/></svg>`
    ),
    // The frame with the PENTAGON tag, and the dashed rule that separates two
    // operands (§17.6.4) — the two marks nothing else in the pack draws.
    templateFromCommand(
      byId('uml.addFragment'),
      `<svg ${ATTRS} fill="none"><rect x="12" y="8" width="111" height="64" stroke="${UML_FRAME_INK}" stroke-width="1.6"/><path d="M12 8 H44 L52 17 V26 H12 Z" fill="${UML_CARD}" stroke="${UML_FRAME_INK}" stroke-width="1.6" stroke-linejoin="round"/>${line(18, 14, 24, UML_FRAME_INK)}${line(60, 32, 30, UML_FRAME_INK)}<path d="M12 46 H123" stroke="${UML_FRAME_INK}" stroke-width="1.4" stroke-dasharray="5 4"/>${line(60, 56, 30, UML_DIVIDER)}</svg>`
    ),
    // The same frame with `ref` in its tag and the name of the interaction it
    // points at in the middle (§17.7.4) — and NO dashed rule, which is what
    // tells it from the fragment above: a `ref` has no operands.
    templateFromCommand(
      byId('uml.addInteractionUse'),
      `<svg ${ATTRS} fill="none"><rect x="12" y="8" width="111" height="64" stroke="${UML_FRAME_INK}" stroke-width="1.6"/><path d="M12 8 H44 L52 17 V26 H12 Z" fill="${UML_CARD}" stroke="${UML_FRAME_INK}" stroke-width="1.6" stroke-linejoin="round"/>${line(18, 14, 24, UML_FRAME_INK)}${line(46, 42, 56, UML_INK)}</svg>`
    ),
  ],
};
