import type { TranslationKeyManifestEntry } from '@labre/std';

/**
 * This package's `com.labre.database.*` wordings, exported from the package
 * root as a framework exports its `…TranslationEntries`: the umbrella lists
 * them in `EDITOR_TRANSLATION_GROUPS` (`packages/affine/all/src/translations.ts`),
 * the bundle script strips that group from core's copy, and a host that
 * installs `@formicoidea/labre-core-database` composes them with core's
 * manifest.
 *
 * ponytail: empty until the chrome lands (B10 to B13); each wording joins
 * this list as it is drawn.
 */
export const databaseEditorTranslationEntries: readonly TranslationKeyManifestEntry[] =
  [];
