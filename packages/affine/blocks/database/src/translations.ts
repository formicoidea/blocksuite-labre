import type { ChromeWording } from '@labre/affine-shared/services';

/* ── A hosted source (ADR 0035 §7, issue B1) ───────────────────────────── */

/** Drawn in place of a view whose `sourceId` the host cannot resolve. */
export const DATABASE_SOURCE_MISSING: ChromeWording = [
  'com.labre.database.source-missing',
  'Source not found',
];

export const DATABASE_SOURCE_MISSING_HINT: ChromeWording = [
  'com.labre.database.source-missing.hint',
  'The source this view reads was deleted or cannot be reached. Pick another view.',
];

/* ── Cell hydration (ADR 0035 §9e, issue B2) ───────────────────────────── */

/** After 3 s of loading (`VALUES_SLOW_AFTER_MS`). */
export const DATABASE_VALUES_LOADING: ChromeWording = [
  'com.labre.database.values.loading',
  'Values are still loading…',
];

export const DATABASE_VALUES_ERROR: ChromeWording = [
  'com.labre.database.values.error',
  'Values could not be loaded. Nothing was changed.',
];

// Retry is the resource status's own word (`RESOURCE_STATUS_RETRY`,
// `@labre/affine-components/translations`): one chrome word, one key.

export const DATABASE_WORDINGS: readonly ChromeWording[] = [
  DATABASE_SOURCE_MISSING,
  DATABASE_SOURCE_MISSING_HINT,
  DATABASE_VALUES_ERROR,
  DATABASE_VALUES_LOADING,
];
