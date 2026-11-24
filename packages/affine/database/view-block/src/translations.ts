import type { ChromeWording } from '@labre/affine-shared/services';

/**
 * What a stored `affine:data-view` block draws under its title in place of its
 * views (issue #745, product owner decision of 2026-11-24, ADR 0035 amendment
 * of 2026-11-24): its data source was never ported to the view engine, so the
 * block draws a status, and keeps what it stores.
 */
export const DATA_VIEW_BLOCK_UNAVAILABLE: ChromeWording = [
  'com.labre.data-view-block.unavailable',
  'This view cannot be displayed.',
];

export const DATA_VIEW_BLOCK_UNAVAILABLE_HINT: ChromeWording = [
  'com.labre.data-view-block.unavailable.hint',
  'It was created in another editor; its content is kept.',
];

/** The accessible name and tooltip of the block's "⋯" (rename, copy, delete). */
export const DATA_VIEW_BLOCK_OPTIONS: ChromeWording = [
  'com.labre.data-view-block.options',
  'Block options',
];

export const DATA_VIEW_BLOCK_WORDINGS: readonly ChromeWording[] = [
  DATA_VIEW_BLOCK_OPTIONS,
  DATA_VIEW_BLOCK_UNAVAILABLE,
  DATA_VIEW_BLOCK_UNAVAILABLE_HINT,
];
