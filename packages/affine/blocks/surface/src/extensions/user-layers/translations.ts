import type { ChromeWording } from '@labre/affine-shared/services';

/**
 * The name a new user layer is created with (ADR 0031 §2). A SEED: the
 * creation site resolves it through the translation seam once and writes
 * the result into the document, where it is content from then on — a layer
 * renamed, or opened under another locale, keeps its name.
 */
export const LAYER_SEED_NAME: ChromeWording = [
  'com.labre.layer.seed.name',
  'Layer {{n}}',
];

/** The seeds this package writes into a document for user layers. */
export const USER_LAYER_SEED_WORDINGS: readonly ChromeWording[] = [
  LAYER_SEED_NAME,
];
