import type { ChromeWording } from '@labre/affine-shared/services';

export const ZOOM_TOGGLE_BAR_TOOLTIP: ChromeWording = [
  'com.labre.zoom-toolbar.toggle-bar',
  'Toggle Zoom Tool Bar',
];

export const ZOOM_FIT_TO_SCREEN_TOOLTIP: ChromeWording = [
  'com.labre.zoom-toolbar.fit-to-screen',
  'Fit to screen',
];

export const ZOOM_OUT_TOOLTIP: ChromeWording = [
  'com.labre.zoom-toolbar.zoom-out',
  'Zoom out',
];

export const ZOOM_IN_TOOLTIP: ChromeWording = [
  'com.labre.zoom-toolbar.zoom-in',
  'Zoom in',
];

/** Every wording this package declares, in the order it renders them. */
export const ZOOM_TOOLBAR_WORDINGS: readonly ChromeWording[] = [
  ZOOM_TOGGLE_BAR_TOOLTIP,
  ZOOM_FIT_TO_SCREEN_TOOLTIP,
  ZOOM_OUT_TOOLTIP,
  ZOOM_IN_TOOLTIP,
];
