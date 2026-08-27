import { svg } from 'lit';

/** Colored BPMN glyph for the main toolbar button: a pool (green name band) with
 * a single activity inside. */
export const bpmnToolbarIcon = svg`<svg width="100%" height="100%" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="4" y="13" width="48" height="30" rx="3" fill="#ffffff" stroke="#262626" stroke-width="2.2"/>
  <path d="M6 14 h5 v28 h-5 z" fill="#43a06b"/>
  <line x1="11" y1="13" x2="11" y2="43" stroke="#262626" stroke-width="1.8"/>
  <rect x="20" y="20" width="24" height="16" rx="3.5" fill="#ffffff" stroke="#262626" stroke-width="2.2"/>
</svg>`;

/** Start event — thin green ring. */
export const bpmnStartIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="12" r="8" stroke="#43a06b" stroke-width="2"/>
</svg>`;

/** End event — thick red ring. */
export const bpmnEndIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="12" r="8" stroke="#cf5648" stroke-width="3.5"/>
</svg>`;

/** Message start event — thin green ring, envelope inside. */
export const bpmnStartMessageIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="12" r="8" stroke="#43a06b" stroke-width="2"/>
  <rect x="8" y="9.5" width="8" height="5.5" stroke="currentColor" stroke-width="1.1"/>
  <path d="M8 9.5 L12 13 L16 9.5" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/>
</svg>`;

/** Timer start event — thin green ring, clock inside (rim + two hands). */
export const bpmnStartTimerIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="12" r="8" stroke="#43a06b" stroke-width="2"/>
  <circle cx="12" cy="12" r="4.2" stroke="currentColor" stroke-width="1.1"/>
  <path d="M12 12 V8.8 M12 12 L14.2 13.6" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
</svg>`;

/** Message end event — thick red ring, envelope inside. */
export const bpmnEndMessageIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="12" r="8" stroke="#cf5648" stroke-width="3.5"/>
  <rect x="8.5" y="9.8" width="7" height="4.8" stroke="currentColor" stroke-width="1.1"/>
  <path d="M8.5 9.8 L12 12.8 L15.5 9.8" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/>
</svg>`;

/** Terminate end event — thick red ring, solid disc inside. */
export const bpmnEndTerminateIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="12" r="8" stroke="#cf5648" stroke-width="3.5"/>
  <circle cx="12" cy="12" r="3.6" fill="currentColor"/>
</svg>`;

/** Task — rounded rectangle. */
export const bpmnTaskIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="3.5" y="6.5" width="17" height="11" rx="2.5" stroke="currentColor" stroke-width="1.6"/>
</svg>`;

/** User task — the rectangle with a person in its top-left corner. */
export const bpmnTaskUserIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="3.5" y="6.5" width="17" height="11" rx="2.5" stroke="currentColor" stroke-width="1.6"/>
  <circle cx="7.4" cy="9.9" r="1.15" stroke="currentColor" stroke-width="1"/>
  <path d="M5.7 13.3 A1.7 1.7 0 0 1 9.1 13.3" stroke="currentColor" stroke-width="1"/>
</svg>`;

/** Service task — the rectangle with a gear in its top-left corner. */
export const bpmnTaskServiceIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="3.5" y="6.5" width="17" height="11" rx="2.5" stroke="currentColor" stroke-width="1.6"/>
  <circle cx="7.6" cy="11" r="1.7" stroke="currentColor" stroke-width="1"/>
  <circle cx="7.6" cy="11" r="0.5" stroke="currentColor" stroke-width="0.8"/>
  <path d="M7.6 8.9 V9.3 M7.6 12.7 V13.1 M5.5 11 H5.9 M9.3 11 H9.7 M6.1 9.5 L6.4 9.8 M8.8 12.2 L9.1 12.5 M9.1 9.5 L8.8 9.8 M6.4 12.2 L6.1 12.5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
</svg>`;

/** Sub-process — the rectangle with the collapsed [+] marker on its bottom edge. */
export const bpmnSubProcessIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="3.5" y="6.5" width="17" height="11" rx="2.5" stroke="currentColor" stroke-width="1.6"/>
  <rect x="9.6" y="12.6" width="4.8" height="4.8" stroke="currentColor" stroke-width="1.1"/>
  <path d="M12 13.8 V16.2 M10.8 15 H13.2" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
</svg>`;

/** Call activity — the same [+] marker, on the notation's THICKEST border. */
export const bpmnCallActivityIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="4" y="7" width="16" height="10" rx="2.5" stroke="currentColor" stroke-width="3"/>
  <rect x="9.6" y="12.2" width="4.8" height="4.8" stroke="currentColor" stroke-width="1.1"/>
  <path d="M12 13.4 V15.8 M10.8 14.6 H13.2" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
</svg>`;

/** Exclusive gateway — diamond with an X. */
export const bpmnGatewayIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 3 L21 12 L12 21 L3 12 Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M9 9 L15 15 M15 9 L9 15" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
</svg>`;

/** Parallel gateway — diamond with a +. */
export const bpmnGatewayParallelIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 3 L21 12 L12 21 L3 12 Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M12 8 V16 M8 12 H16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
</svg>`;

/** Data object — a page with its top-right corner turned down. */
export const bpmnDataObjectIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M6 3.5 H14 L18 7.5 V20.5 H6 Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M14 3.5 V7.5 H18" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
</svg>`;

/** Data store — a cylinder. */
export const bpmnDataStoreIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M4.5 7 V17 C4.5 18.4 8 19.5 12 19.5 C16 19.5 19.5 18.4 19.5 17 V7" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
  <ellipse cx="12" cy="7" rx="7.5" ry="2.5" stroke="currentColor" stroke-width="1.6"/>
</svg>`;

/** Text annotation — an open bracket down the leading edge, and a note beside it. */
export const bpmnTextAnnotationIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M9 5 H5.5 V19 H9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M11.5 9 H18.5 M11.5 12 H18.5 M11.5 15 H16" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
</svg>`;

/** Sequence flow — solid arrow with a filled head. */
export const bpmnSequenceIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M3 12 H17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M15 8 L21 12 L15 16 Z" fill="currentColor"/>
</svg>`;

/** Group — a dashed, generously rounded rectangle drawn AROUND things. */
export const bpmnGroupIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="3.5" y="5.5" width="17" height="13" rx="4" stroke="currentColor" stroke-width="1.6" stroke-dasharray="3.4 2.6"/>
</svg>`;

/**
 * Message flow — dashed line, disc at the source, open head at the target.
 *
 * The source terminator is drawn FILLED because that is what the canvas paints:
 * `renderCircle` fills with the connector's `fillColor` before stroking it. The
 * norm asks for a hollow ring, and the shared connector renderer is where that
 * would be fixed; until then an icon promising a ring would be advertising a
 * shape the tool does not draw.
 */
export const bpmnMessageIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="4.8" cy="12" r="2.2" fill="currentColor"/>
  <path d="M7.4 12 H17.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="3 2.6"/>
  <path d="M15.6 8.6 L20 12 L15.6 15.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

/**
 * Association — a dashed line with no head at either end.
 *
 * Same weight as the message flow's line, because on canvas it IS the same
 * weight: both are `strokeWidth: 2`. A thinner icon would hint at a distinction
 * the tool cannot draw (`ASSOCIATION_WIDTH` in `../consts.ts` says why).
 */
export const bpmnAssociationIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M3.5 17 L20.5 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="2.4 2.4"/>
</svg>`;

/** Pool — rectangle with a left name band. */
export const bpmnPoolIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" stroke="currentColor" stroke-width="1.6"/>
  <path d="M8 5.5 V18.5" stroke="currentColor" stroke-width="1.6"/>
</svg>`;

/** Add lane — the pool, cut in two, with a plus on the new band. */
export const bpmnLaneAddIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" stroke="currentColor" stroke-width="1.6"/>
  <path d="M8 5.5 V18.5" stroke="currentColor" stroke-width="1.6"/>
  <path d="M8 12 H20.5" stroke="currentColor" stroke-width="1.6"/>
  <path d="M14.25 13.25 V17 M12.4 15.1 H16.1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
</svg>`;

/** Remove lane — the same pool, with a minus on the band that goes. */
export const bpmnLaneRemoveIcon = svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" stroke="currentColor" stroke-width="1.6"/>
  <path d="M8 5.5 V18.5" stroke="currentColor" stroke-width="1.6"/>
  <path d="M8 12 H20.5" stroke="currentColor" stroke-width="1.6"/>
  <path d="M12.4 15.1 H16.1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
</svg>`;
