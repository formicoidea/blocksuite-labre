import {
  collectTranslationKeys,
  commandCategoryTranslationEntries,
  commandTranslationEntries,
  mergeTranslationEntries,
  type TranslationKeyManifestEntry,
} from '@labre/std';

import { bpmnCommands } from './commands.js';
import {
  LANE_NAME_FALLBACK,
  LANE_NAME_KEY,
  NODE_LABEL,
  nodeLabelKey,
  POOL_NAME_FALLBACK,
  POOL_NAME_KEY,
} from './consts.js';
import { BPMN_EXPORT_WARNING_KEYS } from './export.js';
import {
  BPMN_IMPORT_ERRORS,
  BPMN_IMPORT_REMARKS,
  BPMN_QUARANTINE_REASON,
  BPMN_QUARANTINE_REASON_KEY,
} from './import.js';
import { BPMN_PROFILES } from './profiles.js';
import { BPMN_READINGS } from './reading.js';
import { BPMN_ROLES } from './roles.js';
import { BPMN_RULES } from './rules.js';
import {
  BPMN_TEMPLATE_NAME_MESSAGE_EXCHANGE,
  BPMN_TEMPLATE_NAME_SEQUENCE_FLOW,
  BPMN_TEMPLATE_NAME_SIMPLE_PROCESS,
  MESSAGE_EXCHANGE_SEED,
  SIMPLE_PROCESS_SEED,
} from './templates/index.js';

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
 * The reader's own refusals ({@link BPMN_IMPORT_ERRORS}) — thrown via
 * `InterchangeImportError`, chrome like the remarks above for the same
 * reason: re-rendered by the catch site every time, never written into a
 * document.
 */
const importErrorEntries = (): TranslationKeyManifestEntry[] =>
  Object.values(BPMN_IMPORT_ERRORS).map(([key, english]) => ({
    key,
    fallback: english,
    source: 'chrome' as const,
  }));

/**
 * {@link BPMN_QUARANTINE_REASON}'s own four keys — a report note about
 * material the import kept but will never write back (D5), fixed wording like
 * the three remarks above and for the same reason: nothing in any of the four
 * sentences names anything out of the file.
 */
const quarantineReasonEntries = (): TranslationKeyManifestEntry[] =>
  (
    Object.keys(
      BPMN_QUARANTINE_REASON
    ) as (keyof typeof BPMN_QUARANTINE_REASON)[]
  ).map(reason => ({
    key: BPMN_QUARANTINE_REASON_KEY[reason],
    fallback: BPMN_QUARANTINE_REASON[reason],
    source: 'chrome' as const,
  }));

/**
 * The nine export-warning keys ({@link BPMN_EXPORT_WARNING_KEYS}) — a report
 * built from the board rather than written into it, so `chrome` like the
 * import remarks above and not `seed`.
 */
const exportWarningEntries = (): TranslationKeyManifestEntry[] =>
  BPMN_EXPORT_WARNING_KEYS.map(([key, fallback]) => ({
    key,
    fallback,
    source: 'chrome' as const,
  }));

/**
 * The pool's own default name and a fresh lane's, resolved at placement
 * exactly like {@link seedEntries} — the fallback IS `POOL_NAME_FALLBACK` /
 * `LANE_NAME_FALLBACK`, never restated.
 */
const furnitureSeedEntries = (): TranslationKeyManifestEntry[] => [
  { key: POOL_NAME_KEY, fallback: POOL_NAME_FALLBACK, source: 'seed' },
  { key: LANE_NAME_KEY, fallback: LANE_NAME_FALLBACK, source: 'seed' },
];

/**
 * The seeds the two worked-example scenes write — derived from the very
 * tables `templates/index.ts` reads at placement, so the words a host is
 * offered are the words the card would insert.
 */
const exampleSeedEntries = (): TranslationKeyManifestEntry[] =>
  [
    ...Object.values(SIMPLE_PROCESS_SEED),
    ...Object.values(MESSAGE_EXCHANGE_SEED),
  ].map(({ key, fallback }) => ({ key, fallback, source: 'seed' as const }));

/**
 * The three hand-composed cards' own tile names — chrome, not seeds: a
 * `Template.nameKey`, re-resolved every time the panel opens, never written
 * into a document. See `templates/index.ts`.
 */
const templateNameEntries = (): TranslationKeyManifestEntry[] =>
  [
    BPMN_TEMPLATE_NAME_SIMPLE_PROCESS,
    BPMN_TEMPLATE_NAME_MESSAGE_EXCHANGE,
    BPMN_TEMPLATE_NAME_SEQUENCE_FLOW,
  ].map(([key, fallback]) => ({ key, fallback, source: 'chrome' as const }));

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
    furnitureSeedEntries(),
    exampleSeedEntries(),
    templateNameEntries(),
    importRemarkEntries(),
    importErrorEntries(),
    quarantineReasonEntries(),
    exportWarningEntries(),
    // LAST, and the order is load-bearing: a reading profile carries the
    // framework's own `roles`, so walking it reaches every role key the `role`
    // line above already named. `mergeTranslationEntries` keeps the FIRST
    // occurrence, which is what makes each key report the source it comes from.
    collectTranslationKeys('reading', BPMN_READINGS)
  );
