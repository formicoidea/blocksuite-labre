import { svg } from 'lit';

/** Colored EDGY facets glyph for the main toolbar button (3 overlapping circles). */
export const edgyToolbarIcon = svg`<svg width="100%" height="100%" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g opacity="0.95">
    <circle cx="22" cy="24" r="13" fill="#00ea4e"/>
    <circle cx="34" cy="24" r="13" fill="#034cee"/>
    <circle cx="28" cy="34" r="13" fill="#ff0056"/>
  </g>
</svg>`;

/** Menu icon — the facets diagram (colored mini Venn). */
export const edgyFacetsIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="9.5" cy="10" r="6" fill="#00ea4e" opacity="0.92"/>
  <circle cx="14.5" cy="10" r="6" fill="#034cee" opacity="0.92"/>
  <circle cx="12" cy="14.5" r="6" fill="#ff0056" opacity="0.92"/>
</svg>`;

/** Menu icon — the dynamic diagram: mini Venn + three connected white shapes. */
export const edgyDynamicIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="9.5" cy="10" r="6" fill="#00ea4e" opacity="0.92"/>
  <circle cx="14.5" cy="10" r="6" fill="#034cee" opacity="0.92"/>
  <circle cx="12" cy="14.5" r="6" fill="#ff0056" opacity="0.92"/>
  <path d="M8.5 8.5 L15.5 8.5 M8.5 8.5 L12 16 M15.5 8.5 L12 16" stroke="#fff" stroke-width="1.3"/>
  <rect x="6.9" y="6.9" width="3.2" height="3.2" fill="#fff"/>
  <circle cx="15.5" cy="8.5" r="1.7" fill="#fff"/>
  <path d="M10.4 14.9 H12.9 L14 16 L12.9 17.1 H10.4 Z" fill="#fff"/>
</svg>`;

/** Menu icon — the blank board: rounded rect + connected facet-colored shapes. */
export const edgyBoardIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="3" y="4.5" width="18" height="15" rx="2.5" stroke="currentColor" stroke-width="1.4"/>
  <path d="M8.3 9 L15.7 9 M8.3 9 L12 15.2 M15.7 9 L12 15.2" stroke="currentColor" stroke-width="1.1"/>
  <rect x="6.8" y="7.5" width="3" height="3" fill="#00ea4e"/>
  <circle cx="15.7" cy="9" r="1.7" fill="#034cee"/>
  <path d="M10.5 14.1 H12.8 L13.9 15.2 L12.8 16.3 H10.5 Z" fill="#ff0056"/>
</svg>`;

/** People — person glyph (official Icon-People), uses currentColor. */
export const edgyPeopleIcon = svg`<svg width="24" height="24" viewBox="0 0 32 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
  <path d="m16,19c-3.308,0-6-2.692-6-6v-4c0-3.308,2.692-6,6-6s6,2.692,6,6v4c0,3.308-2.692,6-6,6Zm0-14c-2.206,0-4,1.794-4,4v4c0,2.206,1.794,4,4,4s4-1.794,4-4v-4c0-2.206-1.794-4-4-4Z"/>
  <path d="m29,30H3v-3.5c0-3.308,2.692-6,6-6h14c3.308,0,6,2.692,6,6v3.5Zm-24-2h22v-1.5c0-2.206-1.794-4-4-4h-14c-2.206,0-4,1.794-4,4v1.5Z"/>
</svg>`;

/** Outcome — lightly rounded rectangle. */
export const edgyOutcomeIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="3.5" y="6.5" width="17" height="11" rx="2" stroke="currentColor" stroke-width="1.6"/>
</svg>`;

/** Object — plain rectangle. */
export const edgyObjectIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="3.5" y="6.5" width="17" height="11" stroke="currentColor" stroke-width="1.6"/>
</svg>`;

/**
 * Relation — a bare line between two ends, with the label riding on it.
 *
 * No arrowhead, exactly like the 24 relations of the metamodel template: EDGY
 * draws its links as plain lines and lets the verb say which way the sentence
 * runs. The little box in the middle IS the verb the tool writes there.
 */
export const edgyRelationIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M3.5 12 H20.5" stroke="currentColor" stroke-width="1.6"/>
  <circle cx="3.8" cy="12" r="1.6" fill="currentColor"/>
  <circle cx="20.2" cy="12" r="1.6" fill="currentColor"/>
  <rect x="8" y="8.6" width="8" height="6.8" rx="1.4" fill="var(--affine-background-primary-color, #fff)" stroke="currentColor" stroke-width="1.4"/>
</svg>`;

/** Activity — right-pointing chevron. */
export const edgyActivityIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M3.5 6.5 H15 L20.5 12 L15 17.5 H3.5 Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
</svg>`;
