import {
  commandTranslationEntries,
  type TranslationKeyManifestEntry,
} from '@labre/std';

import { eventStormingCommands } from './commands.js';

/**
 * THIS framework's contribution to the translation-key manifest.
 *
 * Its command labels and descriptions are built from a TEMPLATE, so the
 * concrete keys exist nowhere but in the declarations themselves and the
 * core manifest could not restate them even if it wanted to. The
 * contribution therefore ships WITH the framework: in the bundled
 * distribution `@formicoidea/labre-framework-ddd-event-storming` carries it, and a host
 * composes it into its catalogue exactly as it already composes
 * `eventStormingCommands` into the command registry. See
 * `packages/affine/all/src/translations.ts`.
 */
export const eventStormingTranslationEntries: TranslationKeyManifestEntry[] =
  commandTranslationEntries(eventStormingCommands);
