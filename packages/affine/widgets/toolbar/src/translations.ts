import type { ChromeWording } from '@labre/affine-shared/services';

/**
 * The row's own "⋮" overflow menu button — its `aria-label` (naming the
 * whole dropdown), distinct from `TOOLBAR_MORE` (`chrome.ts`, "More": the
 * icon-button's own tooltip inside it).
 */
export const TOOLBAR_MORE_MENU_ARIA: ChromeWording = [
  'com.labre.toolbar.more-menu',
  'More menu',
];

/** Every wording this package declares, in the order it renders them. */
export const TOOLBAR_WIDGET_WORDINGS: readonly ChromeWording[] = [
  TOOLBAR_MORE_MENU_ARIA,
];
