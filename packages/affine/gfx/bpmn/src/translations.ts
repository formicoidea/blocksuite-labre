import {
  collectTranslationKeys,
  commandCategoryTranslationEntries,
  commandTranslationEntries,
  mergeTranslationEntries,
  type TranslationKeyManifestEntry,
} from '@labre/std';

import { bpmnCommands } from './commands.js';
import { NODE_LABEL, nodeLabelKey } from './consts.js';
import { BPMN_IMPORT_REMARKS } from './import.js';
import { BPMN_PROFILES } from './profiles.js';
import { BPMN_ROLES } from './roles.js';
import { BPMN_RULES } from './rules.js';

/**
 * The captions a placed artefact is seeded with, and the fixed-wording remarks
 * an import can produce — the two families of BPMN prose that live in tables
 * rather than in a declaration the walker can reach.
 *
 * Derived from those tables, never restated: the fallback IS `NODE_LABEL[kind]`
 * and `BPMN_IMPORT_REMARKS[…][1]`, so the wording a host is offered and the
 * wording the library writes cannot drift. The kinds with no caption
 * contribute no key — there is nothing to translate.
 */
const seedEntries = (): TranslationKeyManifestEntry[] =>
  Object.entries(NODE_LABEL)
    .filter(([, label]) => label !== '')
    .map(([kind, label]) => ({
      key: nodeLabelKey(kind as keyof typeof NODE_LABEL),
      fallback: label,
      source: 'seed' as const,
    }));

const importRemarkEntries = (): TranslationKeyManifestEntry[] =>
  Object.values(BPMN_IMPORT_REMARKS).map(([key, english]) => ({
    key,
    fallback: english,
    source: 'chrome' as const,
  }));

/**
 * THIS framework's contribution to the translation-key manifest — every
 * `com.labre.*` key BPMN can hand to `TranslationProvider.t`, derived from the
 * very declarations the editor registers (never restated).
 *
 * Its command labels and descriptions are built from a TEMPLATE, so the
 * concrete keys exist nowhere but in the declarations themselves and the
 * core manifest could not restate them even if it wanted to. The
 * contribution therefore ships WITH the framework: in the bundled
 * distribution `@formicoidea/labre-framework-bpmn` carries it, and a host
 * composes it into its catalogue exactly as it already composes
 * `bpmnCommands` into the command registry. See
 * `packages/affine/all/src/translations.ts`.
 */
export const bpmnTranslationEntries: TranslationKeyManifestEntry[] =
  mergeTranslationEntries(
    commandTranslationEntries(bpmnCommands),
    // The catalogue's own group headers, derived from the very categories
    // these commands declare. They ship WITH the framework because core's
    // registry names no framework category in the bundled distribution, so a
    // host that composed core's manifest alone drew translated entries under
    // English headers (#183).
    commandCategoryTranslationEntries(bpmnCommands),
    collectTranslationKeys('role', BPMN_ROLES),
    collectTranslationKeys('rule', BPMN_RULES),
    collectTranslationKeys('profile', BPMN_PROFILES),
    seedEntries(),
    importRemarkEntries()
  );
