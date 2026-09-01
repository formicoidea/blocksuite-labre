import {
  collectTranslationKeys,
  commandCategoryTranslationEntries,
  commandTranslationEntries,
  mergeTranslationEntries,
  type TranslationKeyManifestEntry,
} from '@labre/std';

import { coreDomainCommands } from './commands.js';
import { CORE_DOMAIN_BACKGROUND } from './core-domain/background.js';
import { CORE_DOMAIN_NUDGES } from './nudges.js';
import { CORE_DOMAIN_PROFILES } from './profiles.js';
import { CORE_DOMAIN_ROLES } from './roles.js';
import { CORE_DOMAIN_RULES } from './rules.js';

/**
 * THIS framework's contribution to the translation-key manifest — every
 * `com.labre.*` key the Core Domain Chart can hand to `TranslationProvider.t`,
 * derived from the very declarations the editor registers.
 *
 * It lives HERE, not in `@labre/affine/translations`, because the bundled
 * distribution splits the library along exactly this line:
 * `@formicoidea/labre-core` is the editor MINUS the frameworks, and a host that
 * installs `@formicoidea/labre-framework-ddd-core-domain` composes this export
 * into the catalogue it builds — the same sentence that already holds for
 * `coreDomainCommands`.
 */
export const coreDomainTranslationEntries: TranslationKeyManifestEntry[] =
  mergeTranslationEntries(
    commandTranslationEntries(coreDomainCommands),
    // The catalogue's own group headers, derived from the very categories
    // these commands declare. They ship WITH the framework because core's
    // registry names no framework category in the bundled distribution, so a
    // host that composed core's manifest alone drew translated entries under
    // English headers (#183).
    commandCategoryTranslationEntries(coreDomainCommands),
    collectTranslationKeys('role', CORE_DOMAIN_ROLES),
    collectTranslationKeys('background', CORE_DOMAIN_BACKGROUND),
    collectTranslationKeys('rule', CORE_DOMAIN_RULES),
    collectTranslationKeys('nudge', CORE_DOMAIN_NUDGES),
    collectTranslationKeys('profile', CORE_DOMAIN_PROFILES)
  );
