import {
  collectTranslationKeys,
  commandCategoryTranslationEntries,
  commandTranslationEntries,
  mergeTranslationEntries,
  type TranslationKeyManifestEntry,
} from '@labre/std';

import { EVENT_STORMING_BACKGROUND } from './background.js';
import { eventStormingCommands } from './commands.js';
import { EVENT_STORMING_NUDGES } from './nudges.js';
import { EVENT_STORMING_PROFILES } from './profiles.js';
import { EVENT_STORMING_ROLES } from './roles.js';
import { EVENT_STORMING_RULES } from './rules.js';

/**
 * THIS framework's contribution to the translation-key manifest — every
 * `com.labre.*` key Event Storming can hand to `TranslationProvider.t`,
 * derived from the very declarations the editor registers (never restated).
 *
 * Its command labels and descriptions are built from a TEMPLATE, so the
 * concrete keys exist nowhere but in the declarations themselves and the core
 * manifest could not restate them even if it wanted to. The contribution
 * therefore ships WITH the framework: in the bundled distribution
 * `@formicoidea/labre-framework-ddd-event-storming` carries it, and a host
 * composes it into its catalogue exactly as it already composes
 * `eventStormingCommands` into the command registry. See
 * `packages/affine/all/src/translations.ts`.
 */
export const eventStormingTranslationEntries: TranslationKeyManifestEntry[] =
  mergeTranslationEntries(
    commandTranslationEntries(eventStormingCommands),
    // The catalogue's own group headers, derived from the very categories
    // these commands declare. They ship WITH the framework because core's
    // registry names no framework category in the bundled distribution, so a
    // host that composed core's manifest alone drew translated entries under
    // English headers (#183).
    commandCategoryTranslationEntries(eventStormingCommands),
    collectTranslationKeys('role', EVENT_STORMING_ROLES),
    collectTranslationKeys('background', EVENT_STORMING_BACKGROUND),
    collectTranslationKeys('rule', EVENT_STORMING_RULES),
    collectTranslationKeys('nudge', EVENT_STORMING_NUDGES),
    collectTranslationKeys('profile', EVENT_STORMING_PROFILES)
  );
