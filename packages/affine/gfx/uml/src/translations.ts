import {
  collectTranslationKeys,
  commandCategoryTranslationEntries,
  commandTranslationEntries,
  mergeTranslationEntries,
  type TranslationKeyManifestEntry,
} from '@labre/std';

import { UML_DIAGRAM_FRAME, UML_SUBJECT_FRAME } from './background.js';
import { umlCommands } from './commands.js';
import { UML_DIAGRAM_KIND_MENU } from './kinds.js';
import { UML_READINGS } from './reading.js';
import { UML_ROLES } from './roles.js';

/**
 * THIS framework's contribution to the translation-key manifest — every
 * `com.labre.*` key UML can hand to `TranslationProvider.t`, derived from the
 * very declarations the editor registers (never restated).
 *
 * The contribution ships WITH the framework, exactly as C4's and BPMN's do: in
 * the bundled distribution `@formicoidea/labre-framework-uml` carries it, and a
 * host composes it into its catalogue the same way it already composes
 * `umlCommands` into the command registry. See
 * `packages/affine/all/src/translations.ts`.
 *
 * The two BACKGROUND declarations are walked even though neither carries a
 * `labelKey` today: both frames write the user's own words (a diagram's
 * heading, a subject's name) and have no vocabulary to fall back to. Walking
 * them costs nothing and means the day one of them gains a declared label the
 * manifest already names it — which is the whole reason these lists are derived
 * rather than written.
 *
 * Phase 1 declares no RULE and no PROFILE, so neither is walked here: the
 * validation checklist is tranche D's, and a `collectTranslationKeys('rule', …)`
 * over an empty list would be a line that looks like coverage and is not.
 */
export const umlTranslationEntries: TranslationKeyManifestEntry[] =
  mergeTranslationEntries(
    commandTranslationEntries(umlCommands),
    // The catalogue's own group headers, derived from the very categories these
    // commands declare. They ship WITH the framework because core's registry
    // names no framework category in the bundled distribution, so a host that
    // composed core's manifest alone drew translated entries under English
    // headers (#183).
    commandCategoryTranslationEntries(umlCommands),
    collectTranslationKeys('role', UML_ROLES),
    collectTranslationKeys('background', [
      UML_DIAGRAM_FRAME,
      UML_SUBJECT_FRAME,
      // Which of the four diagrams a frame declares it draws, and the words the
      // picker offers them under. Filed under `background` with the two
      // declarations above, and it is the honest bucket rather than a
      // convenient one: `kind` is a prop of the diagram frame, these are the
      // names of the values it can take, and the table is walked exactly as the
      // two declarations beside it are.
      UML_DIAGRAM_KIND_MENU,
    ]),
    // LAST, and the order is load-bearing: a reading profile carries the
    // framework's own `roles`, so walking it reaches keys the list above
    // already named. `mergeTranslationEntries` keeps the FIRST occurrence,
    // which is what makes each key report the source it actually comes from.
    collectTranslationKeys('reading', UML_READINGS)
  );
