import {
  collectTranslationKeys,
  commandTranslationEntries,
  mergeTranslationEntries,
  type TranslationKeyManifestEntry,
} from '@labre/std';

import { bpmnCommands } from './commands.js';
import { BPMN_ROLES } from './roles.js';

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
    collectTranslationKeys('role', BPMN_ROLES)
  );
