import { svg } from 'lit';

import { UML_CARD, UML_FRAME_INK, UML_INK } from '../consts.js';

/**
 * The UML senior-button tile: a class box with its two compartment separators,
 * beside a use-case ellipse — the two shapes the pack's two diagram families
 * are recognised by, in one glyph.
 *
 * The one tile of this file, and unlike C4's it is NOT coloured: UML 2.5.1 has
 * no stencil palette of its own (§7 draws in ink on paper), so the tile reads
 * off the shared neutral scale exactly as the canvas does — `UML_INK` for the
 * outlines, `UML_CARD` for the body, `UML_FRAME_INK` for the ellipse that
 * stands a shade back (R33: never a grey hex literal here).
 *
 * Everything below it is a 24×24 monochrome outline drawn in `currentColor`,
 * because a command glyph sits in a menu row and takes the row's colour.
 */
export const umlToolbarIcon = svg`
  <svg viewBox="0 0 56 56" width="100%" height="100%" fill="none"
       xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="9" width="26" height="30" rx="1.5" fill="${UML_CARD}"
          stroke="${UML_INK}" stroke-width="2"/>
    <path d="M4 19 H30 M4 29 H30" stroke="${UML_INK}" stroke-width="2"/>
    <rect x="9" y="12.5" width="16" height="3" rx="1.5" fill="${UML_INK}"/>
    <rect x="9" y="22.5" width="12" height="2.5" rx="1.25" fill="${UML_FRAME_INK}"
          opacity="0.75"/>
    <rect x="9" y="32.5" width="14" height="2.5" rx="1.25" fill="${UML_FRAME_INK}"
          opacity="0.75"/>
    <ellipse cx="39.5" cy="35" rx="13" ry="9" fill="${UML_CARD}"
             stroke="${UML_FRAME_INK}" stroke-width="2"/>
    <rect x="33" y="33.5" width="13" height="3" rx="1.5" fill="${UML_FRAME_INK}"
          opacity="0.75"/>
  </svg>
`;

/* ── The sheet and the frame drawn round part of it ─────────────────────── */

/**
 * Class diagram — the frame of §C.2's diagram notation: a rectangle with the
 * cut-corner name tag in its top-left corner, which is what tells a UML frame
 * from any other box on the canvas.
 */
export const umlDiagramIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="2.5" y="4" width="19" height="16" rx="1.2" stroke="currentColor" stroke-width="1.6"/>
  <path d="M2.5 4 H11 L13 6.4 V9 H2.5 Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
</svg>`;

/**
 * Subject — the rectangle a use-case diagram draws round the use cases that
 * belong to one system (§18.1.1): a plain frame, its name along the top.
 */
export const umlSubjectIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="3" y="4.5" width="18" height="15" rx="1.2" stroke="currentColor" stroke-width="1.6"/>
  <path d="M6 8 H14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
  <ellipse cx="12" cy="14.5" rx="5.5" ry="3" stroke="currentColor" stroke-width="1.3"/>
</svg>`;

/* ── The classifiers: the three-compartment box and what varies on it ───── */

/** Class — the canonical three-compartment rectangle (§11.4.4). */
export const umlClassIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="4" y="3.5" width="16" height="17" rx="1.2" stroke="currentColor" stroke-width="1.6"/>
  <path d="M4 9 H20 M4 15 H20" stroke="currentColor" stroke-width="1.4"/>
</svg>`;

/**
 * Interface — the same box, with the guillemets keyword above the name
 * (§10.4.2.1). Drawn as the two chevrons, which is the whole of what
 * `«interface»` looks like at this size.
 */
export const umlInterfaceIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="4" y="3.5" width="16" height="17" rx="1.2" stroke="currentColor" stroke-width="1.6"/>
  <path d="M4 15 H20" stroke="currentColor" stroke-width="1.4"/>
  <path d="M10 7 L8 9.2 L10 11.4 M14 7 L16 9.2 L14 11.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

/**
 * Enumeration — the box whose lower compartment is a LIST of literals
 * (§10.2.4): three stacked rules rather than the two tiers of a class.
 */
export const umlEnumerationIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="4" y="3.5" width="16" height="17" rx="1.2" stroke="currentColor" stroke-width="1.6"/>
  <path d="M4 9 H20" stroke="currentColor" stroke-width="1.4"/>
  <path d="M7 12 H17 M7 15 H17 M7 18 H13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
</svg>`;

/**
 * Object — an instance specification: the same box with its name UNDERLINED,
 * which is the one notation that tells an instance from its classifier
 * (§9.8.4).
 */
export const umlObjectIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="4" y="3.5" width="16" height="17" rx="1.2" stroke="currentColor" stroke-width="1.6"/>
  <path d="M4 11 H20" stroke="currentColor" stroke-width="1.4"/>
  <path d="M7.5 8.4 H16.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
</svg>`;

/** Package — the folder: a tab over a body (§12.2.4). */
export const umlPackageIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M3 6.5 H10 L11.6 9 H21 V19 H3 Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M3 9 H11.6" stroke="currentColor" stroke-width="1.4"/>
</svg>`;

/** Note — the rectangle with its top-right corner turned down (§7.5.4). */
export const umlNoteIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M4 4.5 H15.5 L20 9 V19.5 H4 Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M15.5 4.5 V9 H20" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
</svg>`;

/** Actor — the stick figure (§18.1.1). */
export const umlActorIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="5.5" r="2.6" stroke="currentColor" stroke-width="1.6"/>
  <path d="M12 8.5 V15 M7 11 H17 M12 15 L8.5 20 M12 15 L15.5 20" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
</svg>`;

/** Use case — the ellipse, and nothing else (§18.1.1). */
export const umlUseCaseIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="12" cy="12" rx="9" ry="6" stroke="currentColor" stroke-width="1.6"/>
</svg>`;

/* ── Phase 2: what a component diagram is made of ───────────────────────── */

/**
 * Component — the rectangle with the two protruding tabs on its left edge
 * (§11.6.4). The one classifier UML announces with a MARK rather than with a
 * keyword, which is why the glyph is the mark and not a box with words in it.
 */
export const umlComponentIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="7" y="4.5" width="13" height="15" rx="1.2" stroke="currentColor" stroke-width="1.6"/>
  <rect x="4" y="7.5" width="6" height="3.5" rx="0.6" stroke="currentColor" stroke-width="1.4"/>
  <rect x="4" y="13" width="6" height="3.5" rx="0.6" stroke="currentColor" stroke-width="1.4"/>
</svg>`;

/**
 * Port — the small square straddling the border of what owns it (§11.3.4).
 * FILLED, and drawn half in and half out, because the whole of what a port
 * means is that it sits ON the boundary: a square inside the box would be a
 * part, and one outside it would be a neighbour.
 */
export const umlPortIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="3" y="5" width="13" height="14" rx="1.2" stroke="currentColor" stroke-width="1.6"/>
  <rect x="13" y="9" width="6" height="6" rx="0.5" fill="currentColor"/>
</svg>`;

/** Provided interface — the LOLLIPOP: a stub ending in a full circle (§10.4.4). */
export const umlProvidedInterfaceIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M2.5 12 H12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  <circle cx="16" cy="12" r="4.2" stroke="currentColor" stroke-width="1.6"/>
</svg>`;

/**
 * Required interface — the SOCKET: the same stub ending in the half circle that
 * cups a ball (§10.4.4). Open on the side the ball comes from, which is what
 * makes an assembly read as one joint rather than as two marks that happen to
 * touch.
 */
export const umlRequiredInterfaceIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M2.5 12 H12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M16.5 7.5 A4.5 4.5 0 0 0 16.5 16.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
</svg>`;

/* ── Phase 2: what a deployment diagram is made of ──────────────────────── */

/**
 * Artifact — the document with its corner turned down (§19.3.4), told from the
 * note beside it by the lines written ON it: a note is a comment about the
 * model, an artifact is a FILE that is part of the system.
 */
export const umlArtifactIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M5.5 3.5 H14.5 L18.5 7.5 V20.5 H5.5 Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M14.5 3.5 V7.5 H18.5" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="M8.5 12 H15.5 M8.5 15.5 H13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
</svg>`;

/** The cube every deployment target is drawn as (§19.4.4) — front, top, side. */
const cube = 'M3 8 H16 V20 H3 Z';
const cubeBack = 'M3 8 L7 4 H20 V16 L16 20 M16 8 L20 4';

/** Node — the bare 3D box: a computational resource, and nothing said of it. */
export const umlNodeIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="${cube}" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="${cubeBack}" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
</svg>`;

/**
 * Device — the same cube, carrying the filled chip that says this node is a
 * piece of HARDWARE (§19.4.4's `«device»`, as a mark rather than as a word,
 * because a 24-unit glyph has no room for a keyword).
 */
export const umlDeviceIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="${cube}" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="${cubeBack}" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
  <rect x="6" y="12" width="7" height="4.5" rx="0.6" fill="currentColor"/>
</svg>`;

/**
 * Execution environment — the cube with the RUN mark on its face: software that
 * other software is deployed into (§19.4.4's `«executionEnvironment»`), which is
 * exactly the distinction from the device beside it.
 */
export const umlExecutionEnvironmentIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="${cube}" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="${cubeBack}" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="M7 11.5 L12.5 14.3 L7 17 Z" fill="currentColor"/>
</svg>`;

/* ── Phase 2: what an ACTIVITY diagram is made of (§15, §16) ────────────── */

/**
 * Action — the round-cornered rectangle of §15.2.4, and the one shape of an
 * activity diagram that holds a sentence. The corners are the whole of what
 * tells it from a class box at this size, so they are drawn generously.
 */
export const umlActionIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="3" y="7" width="18" height="10" rx="4" stroke="currentColor" stroke-width="1.6"/>
</svg>`;

/**
 * Initial node — the FILLED disc where a flow begins (§15.3.4), with the first
 * arrow leaving it. One per region, and the arrow is what says the disc is a
 * start rather than a junction.
 */
export const umlInitialIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="7" cy="12" r="4.5" fill="currentColor"/>
  <path d="M12.5 12 H19" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M16.5 9 L20 12 L16.5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

/**
 * Activity final — the BULLSEYE that ends the whole activity (§15.3.4): every
 * token in it stops, not only the one that arrived.
 */
export const umlActivityFinalIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.6"/>
  <circle cx="12" cy="12" r="4.5" fill="currentColor"/>
</svg>`;

/**
 * Flow final — the circle with the CROSS through it (§15.3.4): this one token
 * ends here and the rest of the activity carries on. The distinction the
 * bullseye beside it cannot draw, and the one everybody forgets exists.
 */
export const umlFlowFinalIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.6"/>
  <path d="M8.5 8.5 L15.5 15.5 M15.5 8.5 L8.5 15.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
</svg>`;

/**
 * Decision — the diamond one token leaves by ONE branch (§15.3.4). The two
 * outgoing stubs are the glyph's argument: a bare diamond is a shape, a diamond
 * with a choice coming out of it is a decision.
 */
export const umlDecisionIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M9 12 L14 6.5 L19 12 L14 17.5 Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M2.5 12 H9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
</svg>`;

/**
 * Fork — the filled BAR one token leaves by every branch at once (§15.3.4),
 * which is exactly the difference from the diamond above: concurrency, not
 * choice. Drawn with the two outgoing lines, because a bar on its own is a rule.
 */
export const umlForkIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="4" width="3.5" height="16" rx="0.6" fill="currentColor"/>
  <path d="M3 12 H10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M13.5 8 H20 M13.5 16 H20" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
</svg>`;

/**
 * Object node — the plain rectangle DATA travels through (§15.4.4), drawn with
 * the flow entering and leaving it. The arrows are not decoration: an object
 * node is told from every other rectangle on the sheet by sitting ON a flow.
 */
export const umlObjectNodeIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="7" y="8" width="10" height="8" stroke="currentColor" stroke-width="1.6"/>
  <path d="M2.5 12 H7 M17 12 H21.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
</svg>`;

/**
 * Send signal — the CONVEX pentagon of §16.3.4: a box with its right edge
 * pushed out into a point, which is the message leaving.
 */
export const umlSendSignalIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M3 7 H15 L20 12 L15 17 H3 Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
</svg>`;

/**
 * Accept event — the CONCAVE pentagon of §16.10.4: the same box with its LEFT
 * edge notched IN, the cup the message arrives into. The pair is the one thing
 * on an activity diagram a reader tells apart by silhouette alone, which is why
 * the two glyphs are deliberately mirror images.
 */
export const umlAcceptEventIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M3 7 H21 V17 H3 L8 12 Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
</svg>`;

/** Time event — the HOURGLASS that fires when its moment comes (§16.10.4). */
export const umlTimeEventIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M6 4 H18 L6 20 H18" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
  <path d="M6 4 L18 20" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
</svg>`;

/**
 * Partition — the swimlane (§15.6.4): two bands with a name strip on top, which
 * is what a vertical partition set actually looks like. The strip is the half
 * of the drawing that matters — a lane with no heading is a line.
 */
export const umlPartitionIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="3" y="4" width="18" height="16" stroke="currentColor" stroke-width="1.6"/>
  <path d="M3 9 H21 M12 4 V20" stroke="currentColor" stroke-width="1.4"/>
</svg>`;

/* ── Phase 2: what a STATE MACHINE is made of (§14.2.4) ─────────────────── */

/**
 * State — the round-cornered box with a NAME BAND (§14.2.4). The separator is
 * what tells it from the action it shares a silhouette with: an action is one
 * sentence, a state is a name over the `entry` / `do` / `exit` lines below it.
 */
export const umlStateIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="3" y="5" width="18" height="14" rx="4" stroke="currentColor" stroke-width="1.6"/>
  <path d="M3 11 H21" stroke="currentColor" stroke-width="1.4"/>
</svg>`;

/**
 * Final state — the bullseye that ends the machine (§14.2.4).
 *
 * The SAME drawing as the activity final beside it, deliberately: §14.2.4 and
 * §15.3.4 both draw a filled circle inside a ring, and inventing a difference
 * would be this pack teaching a notation UML does not have. What separates them
 * is the role and the sheet they are legal on — a final state on an activity
 * diagram is what the per-frame admissibility lists refuse.
 */
export const umlFinalStateIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.6"/>
  <circle cx="12" cy="12" r="4.5" fill="currentColor"/>
</svg>`;

/**
 * Choice — the diamond a transition branches at (§14.2.4), and the state
 * machine's twin of the activity decision: the same drawing, on the other
 * diagram, for the same reason the two finals share theirs.
 */
export const umlChoiceIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M9 12 L14 6.5 L19 12 L14 17.5 Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M2.5 12 H9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
</svg>`;

/**
 * Junction — the small filled dot several transitions MERGE at (§14.2.4). The
 * three incoming stubs are what tells it from the initial node's disc: an
 * initial has one arrow out and nothing in, a junction is a knot.
 */
export const umlJunctionIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="12" r="3.5" fill="currentColor"/>
  <path d="M3 6 L9 10.5 M3 18 L9 13.5 M15.5 12 H21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
</svg>`;

/** The `H` of a history pseudostate, drawn as strokes rather than set as type. */
const historyH = 'M9 8.5 V15.5 M15 8.5 V15.5 M9 12 H15';

/**
 * Shallow history — the `H` in a circle (§14.2.4): re-enter this region at the
 * sub-state it was last in.
 */
export const umlShallowHistoryIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.6"/>
  <path d="${historyH}" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
</svg>`;

/**
 * Deep history — the same `H` with the ASTERISK (§14.2.4): restore the whole
 * nested configuration, not only the top level. One star apart, which is why
 * the circle is drawn smaller here to make room for it rather than redrawn.
 */
export const umlDeepHistoryIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="10.5" cy="12" r="8" stroke="currentColor" stroke-width="1.6"/>
  <path d="M7.5 8.5 V15.5 M13.5 8.5 V15.5 M7.5 12 H13.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M19.5 4.5 V9.5 M17.3 5.8 L21.7 8.2 M21.7 5.8 L17.3 8.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
</svg>`;

/**
 * Entry point — the hollow circle ON a composite state's border (§14.2.4): the
 * named way IN. The border is drawn because the mark means nothing off it.
 */
export const umlEntryPointIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 3.5 V20.5" stroke="currentColor" stroke-width="1.6"/>
  <path d="M2.5 12 H8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/>
</svg>`;

/**
 * Exit point — the same circle on the same border, CROSSED (§14.2.4): the named
 * way out.
 */
export const umlExitPointIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 3.5 V20.5" stroke="currentColor" stroke-width="1.6"/>
  <path d="M16 12 H21.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/>
  <path d="M9.5 9.5 L14.5 14.5 M14.5 9.5 L9.5 14.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
</svg>`;

/**
 * Terminate — the bare CROSS (§14.2.4): the machine stops here and nothing
 * else runs. No circle round it, which is the whole of what tells it from the
 * flow final and from the exit point.
 */
export const umlTerminateIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M5 5 L19 19 M19 5 L5 19" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
</svg>`;

/**
 * Region — the composite state (§14.2.4): the rounded box with its name band
 * and a sub-machine inside it. The two little states are the point — a region
 * is a container, and a glyph of an empty rounded box would be the state's.
 */
export const umlRegionIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="2.5" y="4" width="19" height="16" rx="3" stroke="currentColor" stroke-width="1.6"/>
  <path d="M2.5 9 H21.5" stroke="currentColor" stroke-width="1.4"/>
  <rect x="5.5" y="12" width="5.5" height="4.5" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
  <rect x="13" y="12" width="5.5" height="4.5" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
</svg>`;

/* ── The relationships: each glyph IS the line the tool draws ───────────── */

/** Association — a plain solid line, undirected (§11.5.4). */
export const umlAssociationIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M3 12 H21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
</svg>`;

/** Aggregation — the HOLLOW diamond at the whole's end (§11.5.4). */
export const umlAggregationIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M9 12 H21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M3 12 L6 9 L9 12 L6 15 Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
</svg>`;

/** Composition — the same diamond, FILLED (§11.5.4). */
export const umlCompositionIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M9 12 H21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M3 12 L6 9 L9 12 L6 15 Z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
</svg>`;

/** Generalization — a solid line with a hollow triangle on the general end. */
export const umlGeneralizationIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M3 12 H15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M15 7.5 L21 12 L15 16.5 Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
</svg>`;

/** Realization — the same hollow triangle, on a DASHED line (§10.4.2.1). */
export const umlRealizationIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M3 12 H15" stroke="currentColor" stroke-width="1.8" stroke-dasharray="3 2.6" stroke-linecap="round"/>
  <path d="M15 7.5 L21 12 L15 16.5 Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
</svg>`;

/** Dependency — a dashed line with an open arrowhead (§7.8.4). */
export const umlDependencyIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M3 12 H18" stroke="currentColor" stroke-width="1.8" stroke-dasharray="3 2.6" stroke-linecap="round"/>
  <path d="M14.5 8.4 L21 12 L14.5 15.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

/**
 * Anchor — the DASHED line with no head at all, which is how a note is tied to
 * what it comments on (§7.5.4). The only relationship of this pack that says
 * nothing about direction, and the glyph says so by carrying no arrow.
 */
export const umlAnchorIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M3 12 H21" stroke="currentColor" stroke-width="1.8" stroke-dasharray="3 2.6" stroke-linecap="round"/>
</svg>`;

/**
 * Include — a dependency whose keyword is `«include»`, drawn with the chevrons
 * over the line so the two use-case relationships are told apart at a glance
 * rather than by their tooltip (§18.1.4).
 */
export const umlIncludeIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M3 16 H18" stroke="currentColor" stroke-width="1.8" stroke-dasharray="3 2.6" stroke-linecap="round"/>
  <path d="M14.5 12.4 L21 16 L14.5 19.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M8 4 L5.5 6.8 L8 9.6 M14 4 L16.5 6.8 L14 9.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

/** Extend — the same dashed arrow, with the chevrons pointing outward. */
export const umlExtendIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M3 16 H18" stroke="currentColor" stroke-width="1.8" stroke-dasharray="3 2.6" stroke-linecap="round"/>
  <path d="M14.5 12.4 L21 16 L14.5 19.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M5.5 4 L8 6.8 L5.5 9.6 M16.5 4 L14 6.8 L16.5 9.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

/**
 * Deploy — the dashed dependency arrow of §19.2.4, pointed at the NODE it lands
 * on. The box above it is the target, not decoration: `«deploy»` and
 * `«manifest»` are the same line, and the only thing that can tell them apart in
 * a menu row is what sits at the far end.
 */
export const umlDeployIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M2 16 H16" stroke="currentColor" stroke-width="1.8" stroke-dasharray="3 2.6" stroke-linecap="round"/>
  <path d="M12.5 12.4 L19 16 L12.5 19.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="13" y="2.5" width="8" height="7" rx="0.8" stroke="currentColor" stroke-width="1.4"/>
</svg>`;

/** Manifest — the same arrow, landing on the artifact's own document glyph. */
export const umlManifestIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M2 16 H16" stroke="currentColor" stroke-width="1.8" stroke-dasharray="3 2.6" stroke-linecap="round"/>
  <path d="M12.5 12.4 L19 16 L12.5 19.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M13.5 2.5 H18 L20.5 5 V10 H13.5 Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="M18 2.5 V5 H20.5" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
</svg>`;

/**
 * Communication path — a plain solid line between two NODES (§19.4.4). The two
 * boxes are what separates it from the association it is drawn exactly like: a
 * network link joins machines, and it claims no direction at either end.
 */
export const umlCommunicationPathIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M6 12 H18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  <rect x="1.5" y="8.5" width="5" height="7" rx="0.8" stroke="currentColor" stroke-width="1.4"/>
  <rect x="17.5" y="8.5" width="5" height="7" rx="0.8" stroke="currentColor" stroke-width="1.4"/>
</svg>`;

/**
 * Control flow — the SOLID line with an open arrowhead (§15.2.4). The look no
 * structural relationship wears: a behaviour diagram states an order and
 * therefore always points.
 */
export const umlControlFlowIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M3 12 H18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M14.5 8.4 L21 12 L14.5 15.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

/**
 * Object flow — the same arrow, with the DATA on it. §15.2.4 draws no line of
 * its own for an object flow and tells it apart by what the flow runs between,
 * so the glyph says that rather than inventing a dash: the little rectangle is
 * the object node the line passes through.
 */
export const umlObjectFlowIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M2 12 H8 M14 12 H18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M14.5 8.4 L21 12 L14.5 15.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="8" y="9" width="6" height="6" stroke="currentColor" stroke-width="1.4"/>
</svg>`;

/**
 * Transition — the same arrow again (§14.2.4.8), carrying its LABEL: the
 * `trigger [guard] / effect` written over the line is the whole of what a state
 * machine's arrow says, and the only thing that separates this glyph from the
 * control flow above it.
 */
export const umlTransitionIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M3 16 H18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M14.5 12.4 L21 16 L14.5 19.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M5 7 H16 M5 10.5 H12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
</svg>`;

/* ── The two exports ───────────────────────────────────────────────────── */

/**
 * Export as PlantUML — the generic "document, going out" glyph the other packs
 * use for an export, restated here rather than imported from BPMN's or C4's
 * private module: a cross-framework import for one path would tie this pack's
 * build to theirs, and the three are meant to ship separately.
 */
export const umlExportPlantumlIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M13.5 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M13.5 3.5 18.5 8.5V12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M16 20.5v-6M13.5 18l2.5 2.5 2.5-2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

/** Export as XMI — the same document, marked as the angle-bracketed one. */
export const umlExportXmiIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M13.5 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M13.5 3.5 18.5 8.5V11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M14.5 14.5 12 17.5 14.5 20.5M18.5 14.5 21 17.5 18.5 20.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

/**
 * Every command glyph of the TOOLBOX, keyed by its `iconKey`.
 *
 * Registered together with the commands themselves
 * (`CommandExtension(umlCommands, umlCommandIcons)`), so a key a descriptor
 * names and this record does not hold renders as nothing.
 *
 * The two export glyphs are deliberately NOT here and are added to
 * {@link umlToolbarIcon}'s sibling `umlCommandIcons` in `commands.ts` instead:
 * this record is the glyphs of things UML DRAWS, and an export draws nothing.
 */
export const UML_TOOLBOX_ICONS = {
  'uml.diagram': umlDiagramIcon,
  'uml.class': umlClassIcon,
  'uml.interface': umlInterfaceIcon,
  'uml.enumeration': umlEnumerationIcon,
  'uml.object': umlObjectIcon,
  'uml.package': umlPackageIcon,
  'uml.note': umlNoteIcon,
  'uml.actor': umlActorIcon,
  'uml.use-case': umlUseCaseIcon,
  'uml.subject': umlSubjectIcon,
  'uml.association': umlAssociationIcon,
  'uml.aggregation': umlAggregationIcon,
  'uml.composition': umlCompositionIcon,
  'uml.generalization': umlGeneralizationIcon,
  'uml.realization': umlRealizationIcon,
  'uml.dependency': umlDependencyIcon,
  'uml.anchor': umlAnchorIcon,
  'uml.include': umlIncludeIcon,
  'uml.extend': umlExtendIcon,
  /* ── Phase 2: components and deployment ────────────────────────────── */
  'uml.component': umlComponentIcon,
  'uml.port': umlPortIcon,
  'uml.provided-interface': umlProvidedInterfaceIcon,
  'uml.required-interface': umlRequiredInterfaceIcon,
  'uml.artifact': umlArtifactIcon,
  'uml.node': umlNodeIcon,
  'uml.device': umlDeviceIcon,
  'uml.execution-environment': umlExecutionEnvironmentIcon,
  'uml.deploy': umlDeployIcon,
  'uml.manifest': umlManifestIcon,
  'uml.communication-path': umlCommunicationPathIcon,
  /* ── Phase 2: activities and state machines ────────────────────────── */
  'uml.action': umlActionIcon,
  'uml.initial': umlInitialIcon,
  'uml.activity-final': umlActivityFinalIcon,
  'uml.flow-final': umlFlowFinalIcon,
  'uml.decision': umlDecisionIcon,
  'uml.fork': umlForkIcon,
  'uml.object-node': umlObjectNodeIcon,
  'uml.send-signal': umlSendSignalIcon,
  'uml.accept-event': umlAcceptEventIcon,
  'uml.time-event': umlTimeEventIcon,
  'uml.partition': umlPartitionIcon,
  'uml.state': umlStateIcon,
  'uml.final-state': umlFinalStateIcon,
  'uml.choice': umlChoiceIcon,
  'uml.junction': umlJunctionIcon,
  'uml.shallow-history': umlShallowHistoryIcon,
  'uml.deep-history': umlDeepHistoryIcon,
  'uml.entry-point': umlEntryPointIcon,
  'uml.exit-point': umlExitPointIcon,
  'uml.terminate': umlTerminateIcon,
  'uml.region': umlRegionIcon,
  'uml.control-flow': umlControlFlowIcon,
  'uml.object-flow': umlObjectFlowIcon,
  'uml.transition': umlTransitionIcon,
} as const;
