import {
  collectTranslationKeys,
  commandCategoryTranslationEntries,
  commandTranslationEntries,
  mergeTranslationEntries,
  type TranslationKeyManifestEntry,
} from '@labre/std';

import { CONTEXT_MAP_BACKGROUND } from './background.js';
import { contextMapCommands } from './commands.js';
import { CONTEXT_MAP_NUDGES } from './nudges.js';
import { CONTEXT_MAP_PROFILES } from './profiles.js';
import { CONTEXT_MAP_ROLES } from './roles.js';
import { CONTEXT_MAP_RULES } from './rules.js';

/**
 * THIS framework's contribution to the translation-key manifest — every
 * `com.labre.*` key Context Mapping can hand to `TranslationProvider.t`,
 * derived from the very declarations the editor registers (never restated).
 *
 * It lives HERE, not in `@labre/affine/translations`, because the bundled
 * distribution splits the library along exactly this line:
 * `@formicoidea/labre-core` is the editor MINUS the frameworks, and a host that
 * installs `@formicoidea/labre-framework-ddd-context-map` composes this export
 * into the catalogue it builds — the same sentence that already holds for
 * `contextMapCommands`. See `packages/affine/all/src/translations.ts`.
 */
export const contextMapTranslationEntries: TranslationKeyManifestEntry[] =
  mergeTranslationEntries(
    commandTranslationEntries(contextMapCommands),
    // The catalogue's own group headers, derived from the very categories
    // these commands declare. They ship WITH the framework because core's
    // registry names no framework category in the bundled distribution, so a
    // host that composed core's manifest alone drew translated entries under
    // English headers (#183).
    commandCategoryTranslationEntries(contextMapCommands),
    collectTranslationKeys('role', CONTEXT_MAP_ROLES),
    collectTranslationKeys('background', CONTEXT_MAP_BACKGROUND),
    collectTranslationKeys('rule', CONTEXT_MAP_RULES),
    collectTranslationKeys('nudge', CONTEXT_MAP_NUDGES),
    collectTranslationKeys('profile', CONTEXT_MAP_PROFILES)
  );
