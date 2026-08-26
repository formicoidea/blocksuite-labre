import {
  collectTranslationKeys,
  commandTranslationEntries,
  mergeTranslationEntries,
  type TranslationKeyManifestEntry,
} from '@labre/std';

import { edgyCommands } from './commands.js';
import { EDGY_NUDGES } from './nudges.js';
import { EDGY_PROFILES } from './profiles.js';
import { EDGY_ROLES } from './roles.js';
import { EDGY_RULES } from './rules.js';

/**
 * THIS framework's contribution to the translation-key manifest — every
 * `com.labre.*` key EDGY can hand to `TranslationProvider.t`, derived from the
 * very declarations the editor registers.
 *
 * Its command labels and descriptions are built from a TEMPLATE, so the
 * concrete keys exist nowhere but in the declarations themselves and the core
 * manifest could not restate them even if it wanted to. The same now holds for
 * the roles: one key per canonical verb, derived from the metamodel, so a
 * relation added there contributes its keys without anybody editing this file.
 *
 * That derivation is why the hand-drawn relation tool needed no line here: its
 * `com.labre.commands.edgy.addRelation` and the `.description` key that carries
 * its gesture sentence — the first DESCRIPTION any EDGY command has declared —
 * are collected off `edgyCommands` with their English fallbacks, like every
 * label before them.
 *
 * The contribution therefore ships WITH the framework: in the bundled
 * distribution `@formicoidea/labre-framework-edgy` carries it, and a host
 * composes it into its catalogue exactly as it already composes `edgyCommands`
 * into the command registry. See `packages/affine/all/src/translations.ts`.
 */
export const edgyTranslationEntries: TranslationKeyManifestEntry[] =
  mergeTranslationEntries(
    commandTranslationEntries(edgyCommands),
    collectTranslationKeys('role', EDGY_ROLES),
    collectTranslationKeys('rule', EDGY_RULES),
    collectTranslationKeys('nudge', EDGY_NUDGES),
    collectTranslationKeys('profile', EDGY_PROFILES)
  );
