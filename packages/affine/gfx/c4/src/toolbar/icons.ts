import { svg } from 'lit';

/**
 * The C4 senior-button tile: a person, a dashed relationship, and the system
 * they use — the smallest complete C4 sentence, in the stencil's own blues.
 *
 * The one COLOURED glyph of this file. Everything below it is a 24×24
 * monochrome outline drawn in `currentColor`, because a command glyph sits in a
 * menu row and takes the row's colour; the tile is the framework's face on the
 * toolbar and is painted in the palette the pack draws with (`consts.ts`).
 */
export const c4ToolbarIcon = svg`
  <svg viewBox="0 0 56 56" width="100%" height="100%" fill="none"
       xmlns="http://www.w3.org/2000/svg">
    <circle cx="13" cy="10.5" r="5" fill="#08427b"/>
    <rect x="5" y="16.5" width="16" height="11" rx="5.5" fill="#08427b"/>
    <path d="M12.5 28.5 L19.4 33.8" stroke="#08427b" stroke-width="2"
          stroke-dasharray="3 3" stroke-linecap="round"/>
    <path d="M23 36.5 L18.1 35.6 L20.7 32 Z" fill="#08427b"/>
    <rect x="24" y="22" width="27" height="28" rx="4" fill="#1168bd"/>
    <rect x="28" y="27" width="12" height="8" rx="2" fill="#438dd5"/>
    <rect x="42" y="27" width="5" height="8" rx="2" fill="#438dd5"/>
    <rect x="28" y="39" width="19" height="7" rx="2" fill="#85bbf0"/>
  </svg>
`;

/* ── The four levels ───────────────────────────────────────────────────── */

/** Person — a head over a rounded body, the stencil's own silhouette. */
export const c4PersonIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="7" r="3.2" stroke="currentColor" stroke-width="1.6"/>
  <rect x="5.5" y="12" width="13" height="8" rx="4" stroke="currentColor" stroke-width="1.6"/>
</svg>`;

/**
 * Person (external) — the same silhouette, DASHED. The stencil greys an
 * external element out; a monochrome glyph has no grey to spend, so the dash is
 * what carries "somebody else owns this" here.
 */
export const c4PersonExtIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="7" r="3.2" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.6 2"/>
  <rect x="5.5" y="12" width="13" height="8" rx="4" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.6 2"/>
</svg>`;

/** Software system — a plain rounded rectangle, which is what C4 draws. */
export const c4SystemIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="3.5" y="6" width="17" height="12" rx="2.5" stroke="currentColor" stroke-width="1.6"/>
</svg>`;

/** Software system (external) — the same rectangle, dashed. */
export const c4SystemExtIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="3.5" y="6" width="17" height="12" rx="2.5" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.6 2"/>
</svg>`;

/** Container — a box INSIDE a box: one level in from the system. */
export const c4ContainerIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" stroke="currentColor" stroke-width="1.6"/>
  <rect x="6.5" y="8.5" width="11" height="7" rx="1.8" stroke="currentColor" stroke-width="1.4"/>
</svg>`;

/** Component — the UML component: a box with two tabs down its leading edge. */
export const c4ComponentIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="6" y="5.5" width="14.5" height="13" rx="1.8" stroke="currentColor" stroke-width="1.6"/>
  <rect x="3.5" y="8" width="5" height="3" stroke="currentColor" stroke-width="1.3"/>
  <rect x="3.5" y="13" width="5" height="3" stroke="currentColor" stroke-width="1.3"/>
</svg>`;

/* ── The container flavours the stencil gives a silhouette of their own ─── */

/** Database — a cylinder. */
export const c4DatabaseIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M4.5 7 V17 C4.5 18.4 8 19.5 12 19.5 C16 19.5 19.5 18.4 19.5 17 V7" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
  <ellipse cx="12" cy="7" rx="7.5" ry="2.5" stroke="currentColor" stroke-width="1.6"/>
</svg>`;

/** Mobile app — a phone: a tall bezel with a speaker slot and a home bar. */
export const c4MobileIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="7" y="2.5" width="10" height="19" rx="2.2" stroke="currentColor" stroke-width="1.6"/>
  <path d="M10.5 5.2 H13.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
  <path d="M10 18.8 H14" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
</svg>`;

/** Web browser — a window with a chrome band and its three dots. */
export const c4BrowserIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="2.5" y="4.5" width="19" height="15" rx="2.2" stroke="currentColor" stroke-width="1.6"/>
  <path d="M2.5 9 H21.5" stroke="currentColor" stroke-width="1.4"/>
  <circle cx="5.6" cy="6.8" r="0.85" fill="currentColor"/>
  <circle cx="8.3" cy="6.8" r="0.85" fill="currentColor"/>
  <circle cx="11" cy="6.8" r="0.85" fill="currentColor"/>
</svg>`;

/* ── The connecting object ─────────────────────────────────────────────── */

/** Relationship — a dashed arrow with a filled head, exactly as it is drawn. */
export const c4RelationshipIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M3 12 H15.5" stroke="currentColor" stroke-width="1.8" stroke-dasharray="3 2.6" stroke-linecap="round"/>
  <path d="M14.5 8.2 L21 12 L14.5 15.8 Z" fill="currentColor"/>
</svg>`;

/* ── The two frames ────────────────────────────────────────────────────── */

/** C4 board — a titled card with two elements and the arrow between them. */
export const c4BoardIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="2.5" y="3.5" width="19" height="17" rx="2" stroke="currentColor" stroke-width="1.6"/>
  <path d="M5.5 7 H12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
  <rect x="5.5" y="10" width="6" height="4" rx="1" stroke="currentColor" stroke-width="1.3"/>
  <rect x="13" y="14" width="6" height="4" rx="1" stroke="currentColor" stroke-width="1.3"/>
  <path d="M11.5 13 L13.5 14.6" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 1.6"/>
</svg>`;

/** System boundary — a dashed rectangle, and nothing inside it to see. */
export const c4SystemBoundaryIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="2.5" y="4.5" width="19" height="15" rx="2" stroke="currentColor" stroke-width="1.6" stroke-dasharray="3.2 2.4"/>
</svg>`;

/**
 * Container boundary — the same dashed rectangle, one level IN: a second,
 * smaller frame drawn inside it. The pair reads the way the two boundaries
 * relate on the canvas, which is the only difference the notation makes between
 * them.
 */
export const c4ContainerBoundaryIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="2.5" y="4.5" width="19" height="15" rx="2" stroke="currentColor" stroke-width="1.6" stroke-dasharray="3.2 2.4"/>
  <rect x="6.5" y="8" width="11" height="8" rx="1.6" stroke="currentColor" stroke-width="1.3" stroke-dasharray="2.4 1.8"/>
</svg>`;

/**
 * Every command glyph, keyed by its `iconKey`.
 *
 * Registered together with the commands themselves
 * (`CommandExtension(c4Commands, c4CommandIcons)`), so a key a descriptor names
 * and this record does not hold renders as nothing — which is what the icon
 * coverage test in `__tests__/commands.unit.spec.ts` exists to catch.
 *
 * The legend's glyph is deliberately NOT here: it is `dddLegendIcon`, the one
 * the three DDD boards already use for the very same gesture, and it is added
 * to this record in `commands.ts` rather than redrawn.
 */
export const C4_TOOLBOX_ICONS = {
  'c4.person': c4PersonIcon,
  'c4.person.external': c4PersonExtIcon,
  'c4.system': c4SystemIcon,
  'c4.system.external': c4SystemExtIcon,
  'c4.container': c4ContainerIcon,
  'c4.component': c4ComponentIcon,
  'c4.database': c4DatabaseIcon,
  'c4.mobile': c4MobileIcon,
  'c4.browser': c4BrowserIcon,
  'c4.relationship': c4RelationshipIcon,
  'c4.board': c4BoardIcon,
  'c4.boundary.system': c4SystemBoundaryIcon,
  'c4.boundary.container': c4ContainerBoundaryIcon,
} as const;
