import {
  EXEMPTION_FALLBACK,
  PROVENANCE_FALLBACK,
  RELATION_SIDE_FALLBACK,
  SEVERITY_FALLBACK,
} from '@labre/affine-block-surface';
import { bpmnTranslationEntries } from '@labre/affine-gfx-bpmn';
import { c4TranslationEntries } from '@labre/affine-gfx-c4';
import { cynefinEstuarineTranslationEntries } from '@labre/affine-gfx-cynefin-estuarine';
import { contextMapTranslationEntries } from '@labre/affine-gfx-ddd-context-map';
import { coreDomainTranslationEntries } from '@labre/affine-gfx-ddd-core-domain';
import { eventStormingTranslationEntries } from '@labre/affine-gfx-ddd-event-storming';
import { edgyTranslationEntries } from '@labre/affine-gfx-edgy';
import { wardleyTranslationEntries } from '@labre/affine-gfx-wardley';
import {
  CATALOGUE_CATEGORY_KEY_PREFIX,
  humanizeCategory,
} from '@labre/affine-widget-edgeless-toolbar';
import {
  collectTranslationKeys,
  commandTranslationEntries,
  type FrameworkId,
  mergeTranslationEntries,
  type TranslationKeyManifestEntry,
} from '@labre/std';

import { getCommands } from './commands.js';
import { FRAMEWORK_DESCRIPTORS } from './frameworks.js';

/**
 * The translation-key manifest (the i18n sibling of `getShortcutManifest` /
 * `getCommandManifest`): every i18n key the library can hand to
 * `TranslationProvider.t`, with its English fallback, enumerable WITHOUT an
 * editor instance. A host builds its catalogue from this list instead of
 * chasing `translateKey` call sites — see
 * `packages/affine/shared/src/services/translation-service/README.md`.
 *
 * ## Composed, not centralised
 *
 * The manifest is ASSEMBLED here out of parts declared where they belong — the
 * same shape `commands.ts` already has, and for the same reason.
 * `@formicoidea/labre-core` is the editor MINUS the frameworks: a manifest that
 * imported each framework's data into this file would break `build:bundles`
 * outright, and stripping the imports would leave `getTranslationKeyManifest()`
 * quietly answering with core's share alone (68 keys of 175) under a signature
 * promising the whole library.
 *
 * So each framework exports its own `…TranslationEntries`
 * ({@link FRAMEWORK_TRANSLATION_GROUPS}), `scripts/build-bundles.mjs` strips
 * the groups from core's copy exactly as it strips the command groups, and a
 * bundled host composes core's manifest with the entries of the framework
 * bundles it installed. The monorepo assembly below and the bundled one build
 * the same list out of the same parts — which is also what makes a new
 * framework (cynefin) arrive whole instead of arriving with a hole nothing
 * would report.
 *
 * ## Two kinds of entry, and the split is what keeps the list honest
 *
 * - **Declared data** (commands, roles, rules, profiles, nudges, audit
 *   criteria, reading conventions, background labels, and the chrome tables
 *   below): walked from the same runtime declarations the editor registers, so
 *   a key added to a rule or a command appears here BY CONSTRUCTION.
 * - **Chrome literals** ({@link CHROME_KEYS}): the widget wordings — panel
 *   titles, field names, action buttons — which live in lit templates and
 *   cannot be walked. They are restated here, and `manifest.unit.spec.ts`
 *   scans the source and fails when a key is used but missing from this
 *   manifest, when an entry here is used by nobody, or when a restated
 *   fallback drifts from the one the widget actually renders.
 */

export type {
  TranslationKeyManifestEntry,
  TranslationKeySource,
} from '@labre/std';

/**
 * The frameworks' contributions. Mirrors `FRAMEWORK_COMMAND_GROUPS` in
 * `commands.ts`, down to the line shape: `scripts/build-bundles.mjs` strips the
 * import and the `{ owner: '…' }` entry of every framework carrying
 * `shortcuts: true` on its descriptor, so core's copy of this file names no
 * framework at all.
 *
 * Deliberately NOT flag-filtered: a catalogue is built once for the whole
 * library, and a framework toggled on later must not find holes in it.
 */
interface FrameworkTranslationGroup {
  owner: FrameworkId;
  entries: readonly TranslationKeyManifestEntry[];
}

const FRAMEWORK_TRANSLATION_GROUPS: FrameworkTranslationGroup[] = [
  { owner: 'wardley', entries: wardleyTranslationEntries },
  { owner: 'edgy', entries: edgyTranslationEntries },
  { owner: 'cynefin-estuarine', entries: cynefinEstuarineTranslationEntries },
  { owner: 'bpmn', entries: bpmnTranslationEntries },
  { owner: 'c4', entries: c4TranslationEntries },
  { owner: 'ddd-event-storming', entries: eventStormingTranslationEntries },
  { owner: 'ddd-core-domain', entries: coreDomainTranslationEntries },
  { owner: 'ddd-context-map', entries: contextMapTranslationEntries },
];

/**
 * The chrome wordings that are TABLES: closed enumerations whose key is a
 * template literal (`com.labre.validation.severity.${severity}`). They are
 * walked from the widgets' own exported records rather than restated, which is
 * what lets the drift check mean something for them — a source scan cannot
 * pair a template key with a wording that arrives through a lookup.
 */
const CHROME_TABLES: readonly [
  prefix: string,
  table: Record<string, string>,
][] = [
  ['com.labre.validation.severity.', SEVERITY_FALLBACK],
  ['com.labre.validation.state.exempted.', EXEMPTION_FALLBACK],
  // The four kinds of authority a rule can claim. `organization` is enumerated
  // with the rest although nothing declares it yet: the table is the TYPE, and
  // a host building a catalogue must not have to come back for a fourth word
  // the day the first org profile ships.
  ['com.labre.validation.provenance.', PROVENANCE_FALLBACK],
  ['com.labre.reading.relations.', RELATION_SIDE_FALLBACK],
];

const chromeTableEntries = (): TranslationKeyManifestEntry[] =>
  CHROME_TABLES.flatMap(([prefix, table]) =>
    Object.entries(table).map(([suffix, fallback]) => ({
      key: `${prefix}${suffix}`,
      fallback,
      source: 'chrome' as const,
    }))
  );

/**
 * The artefact catalogue's group headers — one key per `category` any command
 * declares, with the sidepanel's own humanised fallback.
 *
 * DERIVED, not restated: the categories are walked out of `getCommands()`, so a
 * framework that invents a category gets its header key in the manifest by
 * construction — which is the whole point on the eve of a BPMN pack that will
 * declare several. The fallback comes from `humanizeCategory`, the very
 * function the panel renders with, so the two cannot drift.
 *
 * Flag-independent like the rest of the manifest: `getCommands()` with no flags
 * enumerates every command, so a catalogue built once covers a framework
 * switched on later.
 */
const catalogueCategoryEntries = (): TranslationKeyManifestEntry[] => {
  const categories = new Set<string>();
  for (const command of getCommands()) {
    if (command.category) categories.add(command.category);
  }
  return [...categories].map(category => ({
    key: `${CATALOGUE_CATEGORY_KEY_PREFIX}${category}`,
    fallback: humanizeCategory(category),
    source: 'chrome' as const,
  }));
};

/**
 * Chrome wordings: the `translateKey(std, key, fallback)` literals of the
 * library's own panels and toolbars. Restated data, guarded against drift AND
 * against going dead by the manifest unit test.
 */
const CHROME_KEYS: readonly [key: string, fallback: string][] = [
  // Validation bubble, badge and toolbar
  ['com.labre.validation.toolbar.label', 'Validation'],
  ['com.labre.validation.bubble.label', 'Validation details'],
  ['com.labre.validation.badge.label', 'Show validation details'],
  ['com.labre.validation.profile.section', 'Profile'],
  ['com.labre.validation.action.ignore', 'Ignore this validation rule'],
  [
    'com.labre.validation.action.ignore-map',
    'Ignore this rule on the whole map',
  ],
  ['com.labre.validation.action.revoke', 'Revoke'],
  ['com.labre.validation.action.revoke-exception', 'Revoke exception'],
  // Map quality panel
  ['com.labre.validation.map-quality.open', 'Map quality…'],
  ['com.labre.validation.map-quality.section', 'Map quality'],
  ['com.labre.validation.map-quality.checklist.yours', 'To be checked by you:'],
  ['com.labre.validation.map-quality.close', 'Close'],
  // Senior sub-menu, past the fourteen-slot cap
  ['com.labre.catalogue.open', 'More artefacts…'],
  [
    'com.labre.catalogue.open.description',
    'This framework offers more than the menu can show.',
  ],
  // Artefact catalogue sidepanel
  ['com.labre.catalogue.title', 'Artefacts'],
  ['com.labre.catalogue.close', 'Close'],
  ['com.labre.catalogue.other', 'Other'],
  ['com.labre.catalogue.ranked', 'Recent & frequent'],
  // Qualify (tags) toolbar
  ['com.labre.tags.toolbar.label', 'Qualify'],
  // Morph ("Change type") toolbar — generic chrome, like the two above: the
  // KINDS it offers are named by each framework's own creation commands, and
  // only the drop-down's own word lives here.
  ['com.labre.morph.toolbar.label', 'Change type'],
  // Reading panel
  ['com.labre.reading.toolbar.label', 'Read this component'],
  ['com.labre.reading.panel.label', 'Proposed record'],
  ['com.labre.reading.panel.title', 'What this map says about this component'],
  ['com.labre.reading.field.type', 'Type of node'],
  ['com.labre.reading.field.specialises', 'A kind of'],
  ['com.labre.reading.field.nature', 'Nature'],
  ['com.labre.reading.field.relations', 'Parent-child relations'],
  ['com.labre.reading.field.value-flow', 'Value flow'],
  ['com.labre.reading.field.phase', 'Evolution phase'],
  ['com.labre.reading.field.naming', 'Naming convention'],
  ['com.labre.reading.field.record', 'Record'],
  ['com.labre.reading.field.drift', 'Drift'],
  [
    'com.labre.reading.nature.none',
    'Not qualified — the reading proposes nothing of its own.',
  ],
  ['com.labre.reading.nature.unknown-record-value', 'The record says'],
  [
    'com.labre.reading.nature.unknown-record-value.suffix',
    'a value this framework does not describe.',
  ],
  ['com.labre.reading.action.confirm-nature', 'Confirm'],
  ['com.labre.reading.action.link', 'Link to a record'],
  ['com.labre.reading.action.update-record', 'Update the record'],
  ['com.labre.reading.relations.none', 'No typed link touches this component.'],
  [
    'com.labre.reading.relations.contradiction',
    'A link states the opposite of what the positions show',
  ],
  ['com.labre.reading.value-flow', 'Value flows up from'],
  ['com.labre.reading.value-flow.to', 'to'],
  ['com.labre.reading.phase.band', 'In the zone of punctuated equilibrium'],
  [
    'com.labre.reading.phase.none',
    'Not on a framework background — no phase to read.',
  ],
  [
    'com.labre.reading.naming.conforms',
    'The name follows the convention of its nature.',
  ],
  ['com.labre.reading.record.linked', 'Linked'],
  ['com.labre.reading.record.none', 'Not linked to a record.'],
  ['com.labre.reading.drift.message', 'The board and the record disagree'],
  // BPMN interchange: what an export could not write down. Chrome and not
  // framework prose — these are the words the library's own notification puts
  // around a report the writer produced, so they ship with an English default
  // and a standalone playground reads correctly with no catalogue registered.
  [
    'com.labre.commands.bpmn.exportXml.warnings',
    'What this export could not write down',
  ],
  // What an IMPORT did with the file — one set of keys for every format, not
  // one per format. The format's own name is composed into the wording
  // ("BPMN" + "file imported", "OWM 2.0" after the counts), which is the same
  // compromise the three count labels below already make: the seam has no
  // interpolation, so a proper noun and a countable noun are the largest units
  // this library can hand over without inventing grammar. A key per format
  // would ask a host to translate the same sentence once per reader we ship,
  // and would leave every new format silently untranslated.
  ['com.labre.interchange.import.done', 'file imported'],
  ['com.labre.interchange.import.failed', 'This file could not be imported'],
  [
    'com.labre.interchange.import.remarks',
    'What the import could not keep as it was',
  ],
  [
    'com.labre.interchange.import.console',
    'remarks — the full report is in the browser console.',
  ],
  // The three count labels of the summary line. Separate keys rather than one
  // sentence with holes in it: the seam has no interpolation and no
  // pluralisation (both are the host's), so a countable noun is the largest
  // unit this library can hand over without inventing grammar.
  ['com.labre.interchange.import.drawn', 'drawn'],
  ['com.labre.interchange.import.carried', 'carried'],
  ['com.labre.interchange.import.quarantined', 'quarantined'],
];

/**
 * Every i18n key THIS package can ask the host for, with its English fallback
 * where one ships.
 *
 * In the monorepo that is the whole library. In the bundled distribution it is
 * core's share, and the host appends the `…TranslationEntries` export of each
 * framework bundle it installed — see the composition note above and the
 * translation-service README.
 *
 * Flag-independent on purpose: `getCommands()` with no flags enumerates every
 * command, including the capability-gated ones, and the framework groups are
 * not filtered either.
 */
export function getTranslationKeyManifest(): TranslationKeyManifestEntry[] {
  return mergeTranslationEntries(
    commandTranslationEntries(getCommands()),
    collectTranslationKeys('framework', FRAMEWORK_DESCRIPTORS),
    ...FRAMEWORK_TRANSLATION_GROUPS.map(group => group.entries),
    chromeTableEntries(),
    catalogueCategoryEntries(),
    CHROME_KEYS.map(([key, fallback]) => ({
      key,
      fallback,
      source: 'chrome' as const,
    }))
  );
}
