import {
  collectTranslationKeys,
  commandTranslationEntries,
  mergeTranslationEntries,
  type TranslationKeyManifestEntry,
} from '@labre/std';

import { bpmnCommands } from './commands.js';
import { BPMN_PROFILES } from './profiles.js';
import { BPMN_ROLES } from './roles.js';
import { BPMN_RULES, BPMN_RULES_PENDING_ENGINE_V2 } from './rules.js';

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
    collectTranslationKeys('role', BPMN_ROLES),
    // Both arrays: the three rules waiting on `claude/bpmn-engine-v2` carry
    // wordings a host translates once, and a catalogue that gained them only on
    // the day they were registered would be a catalogue with a hole in it for
    // exactly one release.
    collectTranslationKeys('rule', [
      ...BPMN_RULES,
      ...BPMN_RULES_PENDING_ENGINE_V2,
    ]),
    collectTranslationKeys('profile', BPMN_PROFILES)
  );
