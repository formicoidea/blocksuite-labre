import {
  type ChromeWording,
  PREVIEW_SETTINGS_LABEL,
} from '@labre/affine-shared/services';

/* ── `header/frame-panel-header.ts` ───────────────────────────────────── */

export const FRAME_PANEL_ALL_FRAMES_LABEL: ChromeWording = [
  'com.labre.frame-panel.header.all-frames',
  'All frames',
];

export const FRAME_PANEL_ALL_FRAMES_SETTINGS_TOOLTIP: ChromeWording = [
  'com.labre.frame-panel.header.all-frames-settings',
  'All Frames Settings',
];

export const FRAME_PANEL_PRESENTATION_LABEL: ChromeWording = [
  'com.labre.frame-panel.header.presentation',
  'Presentation',
];

/* ── `header/frames-setting-menu.ts` ──────────────────────────────────── */

export const FRAME_PANEL_PREVIEW_SETTINGS = PREVIEW_SETTINGS_LABEL;

export const FRAME_PANEL_FILL_SCREEN: ChromeWording = [
  'com.labre.frame-panel.menu.fill-screen',
  'Fill Screen',
];

export const FRAME_PANEL_DARK_BACKGROUND: ChromeWording = [
  'com.labre.frame-panel.menu.dark-background',
  'Dark background',
];

/* ── `body/frame-panel-body.ts` ────────────────────────────────────────── */

export const FRAME_PANEL_EMPTY_PLACEHOLDER: ChromeWording = [
  'com.labre.frame-panel.body.empty-placeholder',
  'Add frames to organize and present your Canvas',
];

/**
 * This package's contribution to the translation-key manifest, listed in
 * `PACKAGE_WORDINGS` under source `chrome`
 * (`packages/affine/all/src/translations.ts`). The shared verbs it reuses
 * (Hide toolbar, Playback Settings…) travel with
 * `@labre/affine-shared/services` instead, so they are not restated here.
 */
export const FRAME_PANEL_WORDINGS: readonly ChromeWording[] = [
  FRAME_PANEL_ALL_FRAMES_LABEL,
  FRAME_PANEL_ALL_FRAMES_SETTINGS_TOOLTIP,
  FRAME_PANEL_PRESENTATION_LABEL,
  FRAME_PANEL_FILL_SCREEN,
  FRAME_PANEL_DARK_BACKGROUND,
  FRAME_PANEL_EMPTY_PLACEHOLDER,
];
