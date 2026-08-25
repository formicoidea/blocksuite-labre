import {
  collectTranslationKeys,
  commandTranslationEntries,
  mergeTranslationEntries,
  type TranslationKeyManifestEntry,
} from '@labre/std';

import { WARDLEY_AUDIT_CRITERIA } from './audit-criteria.js';
import { WARDLEY_BACKGROUND } from './background.js';
import { wardleyCommands } from './commands.js';
import { WARDLEY_NUDGES } from './nudges.js';
import { WARDLEY_PROFILES } from './profiles.js';
import { WARDLEY_READING } from './reading.js';
import { WARDLEY_ROLES } from './roles.js';
import { WARDLEY_RULES } from './rules.js';

/**
 * THIS framework's contribution to the translation-key manifest — every
 * `com.labre.*` key Wardley can hand to `TranslationProvider.t`, derived from
 * the very declarations the editor registers.
 *
 * It lives HERE, not in `@labre/affine/translations`, because the bundled
 * distribution splits the library along exactly this line:
 * `@formicoidea/labre-core` is the editor MINUS the frameworks, and a host that
 * installs `@formicoidea/labre-framework-wardley` composes this export into the
 * catalogue it builds — the same sentence that already holds for
 * `wardleyCommands`. A manifest that named Wardley from the core side would be
 * complete in the monorepo and silently 61 % short in the distribution hosts
 * actually consume.
 */
export const wardleyTranslationEntries: TranslationKeyManifestEntry[] =
  mergeTranslationEntries(
    commandTranslationEntries(wardleyCommands),
    collectTranslationKeys('role', WARDLEY_ROLES),
    collectTranslationKeys('background', WARDLEY_BACKGROUND),
    collectTranslationKeys('rule', WARDLEY_RULES),
    collectTranslationKeys('nudge', WARDLEY_NUDGES),
    collectTranslationKeys('profile', WARDLEY_PROFILES),
    collectTranslationKeys('audit-criterion', WARDLEY_AUDIT_CRITERIA),
    collectTranslationKeys('reading', WARDLEY_READING)
  );
