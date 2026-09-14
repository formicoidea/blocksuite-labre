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
 * this record is the nineteen glyphs of things UML DRAWS, and an export draws
 * nothing.
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
} as const;
