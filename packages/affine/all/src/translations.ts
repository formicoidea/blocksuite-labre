import { ATTACHMENT_WORDINGS } from '@labre/affine-block-attachment/translations';
import { BOOKMARK_WORDINGS } from '@labre/affine-block-bookmark/translations';
import { EMBED_WORDINGS } from '@labre/affine-block-embed/translations';
import { EMBED_DOC_WORDINGS } from '@labre/affine-block-embed-doc/translations';
import {
  FRAME_CHROME_WORDINGS,
  FRAME_WORDINGS,
} from '@labre/affine-block-frame/translations';
import { IMAGE_WORDINGS } from '@labre/affine-block-image/translations';
import {
  EXEMPTION_FALLBACK,
  PROVENANCE_FALLBACK,
  SEVERITY_FALLBACK,
  SVG_SKETCH_WORDINGS,
} from '@labre/affine-block-surface';
import {
  SURFACE_REF_CHROME_WORDINGS,
  SURFACE_REF_WORDINGS,
} from '@labre/affine-block-surface-ref/translations';
import { ADAPTER_PANEL_WORDINGS } from '@labre/affine-fragment-adapter-panel/translations';
import { DOC_TITLE_WORDINGS } from '@labre/affine-fragment-doc-title/translations';
import { OUTLINE_WORDINGS } from '@labre/affine-fragment-outline/translations';
import { COMPONENTS_WORDINGS } from '@labre/affine-components/translations';
import {
  ROOT_CHROME_WORDINGS,
  ROOT_SEED_WORDINGS,
} from '@labre/affine-block-root/translations';
import { bpmnTranslationEntries } from '@labre/affine-gfx-bpmn';
import { BRUSH_WORDINGS } from '@labre/affine-gfx-brush/translations';
import { c4TranslationEntries } from '@labre/affine-gfx-c4';
import { CONNECTOR_WORDINGS } from '@labre/affine-gfx-connector/translations';
import { cynefinEstuarineTranslationEntries } from '@labre/affine-gfx-cynefin-estuarine';
import { dddAggregateTranslationEntries } from '@labre/affine-gfx-ddd-aggregate';
import { contextMapTranslationEntries } from '@labre/affine-gfx-ddd-context-map';
import { coreDomainTranslationEntries } from '@labre/affine-gfx-ddd-core-domain';
import { eventStormingTranslationEntries } from '@labre/affine-gfx-ddd-event-storming';
import { edgyTranslationEntries } from '@labre/affine-gfx-edgy';
import { umlTranslationEntries } from '@labre/affine-gfx-uml';
import {
  GROUP_CHROME_WORDINGS,
  GROUP_WORDINGS,
} from '@labre/affine-gfx-group/translations';
import {
  MINDMAP_CHROME_WORDINGS,
  MINDMAP_SEED_WORDINGS,
} from '@labre/affine-gfx-mindmap/translations';
import { SHAPE_WORDINGS } from '@labre/affine-gfx-shape/translations';
import { POINTER_WORDINGS } from '@labre/affine-gfx-pointer/translations';
import { FRAME_PANEL_WORDINGS } from '@labre/affine-fragment-frame-panel/translations';
import {
  TEMPLATE_PACKAGE_WORDINGS,
  TEMPLATE_SEED_WORDINGS,
} from '@labre/affine-gfx-template/translations';
import { TEXT_WORDINGS } from '@labre/affine-gfx-text/translations';
import { wardleyTranslationEntries } from '@labre/affine-gfx-wardley';
import { LATEX_WORDINGS as INLINE_LATEX_WORDINGS } from '@labre/affine-inline-latex/translations';
import { LINK_WORDINGS } from '@labre/affine-inline-link/translations';
import { MENTION_WORDINGS } from '@labre/affine-inline-mention/translations';
import { PRESET_WORDINGS } from '@labre/affine-inline-preset/translations';
import { REFERENCE_WORDINGS } from '@labre/affine-inline-reference/translations';
import {
  CHROME_WORDINGS,
  type ChromeWording,
} from '@labre/affine-shared/services';
import { CALLOUT_WORDINGS } from '@labre/affine-block-callout/translations';
import { CODE_WORDINGS } from '@labre/affine-block-code/translations';
import { LATEX_WORDINGS } from '@labre/affine-block-latex/translations';
import { NOTE_WORDINGS } from '@labre/affine-block-note/translations';
import { PARAGRAPH_WORDINGS } from '@labre/affine-block-paragraph/translations';
import { GFX_NOTE_WORDINGS } from '@labre/affine-gfx-note/translations';
import { DRAG_HANDLE_WORDINGS } from '@labre/affine-widget-drag-handle/translations';
import { AUTO_CONNECT_WORDINGS } from '@labre/affine-widget-edgeless-auto-connect/translations';
import { EDGELESS_SELECTED_RECT_WORDINGS } from '@labre/affine-widget-edgeless-selected-rect/translations';
import { EDGELESS_TOOLBAR_WORDINGS } from '@labre/affine-widget-edgeless-toolbar/translations';
import { ZOOM_TOOLBAR_WORDINGS } from '@labre/affine-widget-edgeless-zoom-toolbar/translations';
import { LINKED_DOC_WORDINGS } from '@labre/affine-widget-linked-doc/translations';
import { REMOTE_SELECTION_WORDINGS } from '@labre/affine-widget-remote-selection/translations';
import { SLASH_MENU_WORDINGS } from '@labre/affine-widget-slash-menu/translations';
import { TOOLBAR_WIDGET_WORDINGS } from '@labre/affine-widget-toolbar/translations';
import {
  collectTranslationKeys,
  commandCategoryTranslationEntries,
  commandTranslationEntries,
  type FrameworkId,
  mergeTranslationEntries,
  type TranslationKeyManifestEntry,
} from '@labre/std';
import { STD_WORDINGS } from '@labre/std/translations';

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

/**
 * The auxiliary bundles' contributions (`AUXILIARY_BUNDLES` in `frameworks.ts`):
 * packages that ship as their own bundle without being a framework. Same
 * one-line `{ owner: '<label>', … }` shape as the framework groups, so
 * `scripts/build-bundles.mjs` strips them from core's copy the same way.
 */
const AUXILIARY_TRANSLATION_GROUPS: {
  owner: string;
  entries: readonly TranslationKeyManifestEntry[];
}[] = [
  // One line per bundle: the bundler strips it by its `owner`.
  { owner: 'ddd-aggregate', entries: dddAggregateTranslationEntries },
];

const FRAMEWORK_TRANSLATION_GROUPS: FrameworkTranslationGroup[] = [
  { owner: 'wardley', entries: wardleyTranslationEntries },
  { owner: 'edgy', entries: edgyTranslationEntries },
  { owner: 'cynefin-estuarine', entries: cynefinEstuarineTranslationEntries },
  { owner: 'bpmn', entries: bpmnTranslationEntries },
  { owner: 'c4', entries: c4TranslationEntries },
  { owner: 'ddd-event-storming', entries: eventStormingTranslationEntries },
  { owner: 'ddd-core-domain', entries: coreDomainTranslationEntries },
  { owner: 'ddd-context-map', entries: contextMapTranslationEntries },
  { owner: 'uml', entries: umlTranslationEntries },
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
  // `com.labre.reading.relations.consumers` / `.suppliers` USED to be here, as
  // a chrome table walked out of the reading widget. They moved to Wardley's
  // own `ReadingProfile` when every framework gained one: the two wordings are
  // a value chain's ("Consumers (above)"), not the panel's, and a BPMN sequence
  // flow names its sides differently. They now arrive with the rest of the
  // declared data, through `wardleyTranslationEntries`, under source `reading`
  // and with the same keys and the same English.
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
 * construction. The fallback comes from `humanizeCategory`, the very function
 * the panel renders with, so the two cannot drift.
 *
 * Flag-independent like the rest of the manifest: `getCommands()` with no flags
 * enumerates every command, so a catalogue built once covers a framework
 * switched on later.
 *
 * In the BUNDLED distribution this walks core's commands alone — the framework
 * groups are stripped from this file — which is why every framework contributes
 * its OWN category headers from its `…TranslationEntries` as well (#183: a
 * bundled host was offered translated catalogue ENTRIES under untranslated
 * headers, because "EVENTS" and "GATEWAYS" are BPMN's categories and BPMN's
 * commands are not in core). The two overlap in the monorepo and
 * `mergeTranslationEntries` de-duplicates them, so both assemblies produce the
 * same list.
 */
const catalogueCategoryEntries = (): TranslationKeyManifestEntry[] =>
  commandCategoryTranslationEntries(getCommands());

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
  // `com.labre.catalogue.other` USED to be here — L7 dedupe moved it to
  // `chrome.ts` (`CATALOGUE_OTHER`), the same word as the templates-panel's
  // own "Other" category tab, and its one call site now imports the constant
  // instead of restating the literal.
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
  // Wardley's own, and the same sentence: one key per WRITER, because an
  // export's losses are the capability's own words and there is no generic
  // pipeline writing them (the import's wordings below are shared precisely
  // because there is one).
  [
    'com.labre.commands.wardley.exportOwm.warnings',
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
  // The name an imported sheet takes when neither the file nor the source
  // document carries one. Resolved at the creation site (`interchange-import`,
  // which has `std`); the pure readers keep the same English text as their own
  // last-resort default, so the two can never drift (#390).
  ['com.labre.interchange.import.default-name', 'Imported diagram'],
  // Rights lost WHILE the file was being read — the import's own sentence,
  // because nothing is wrong with the file. It rides under the same "could not
  // be imported" headline as a reader's refusal, which is what it is to the
  // person who picked it.
  [
    'com.labre.interchange.import.readonly',
    'This document became read-only while the file was being read, so nothing was imported.',
  ],
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
  // The one remark the shared materializer raises itself — a provisional name
  // two imported elements were both handed. It belongs here with the pipeline's
  // other words rather than in a reader's table, because no reader produces it:
  // `materializeInterchangeImport` does, whichever format was read.
  [
    'com.labre.interchange.import.duplicate-provisional-name',
    'Two imported elements were handed the same provisional name "{{name}}". Both are on the board; anything referring to that name points at the first of them.',
  ],
];

/**
 * The block and widget packages' own wordings — one `readonly ChromeWording[]`
 * per package, declared in that package's `translations.ts` beside the code
 * that renders them, and walked here rather than restated.
 *
 * Per package and not one central table because the wordings belong to the
 * package that renders them (an image toolbar's "Download" is the image
 * block's), and because a single file every block edits is a file every
 * parallel change conflicts on. Framework wordings do NOT go here: they travel
 * in the framework's own `…TranslationEntries`, so a bundled host gets them
 * with the framework bundle.
 */
const PACKAGE_WORDINGS: readonly (readonly ChromeWording[])[] = [
  SLASH_MENU_WORDINGS,
  OUTLINE_WORDINGS,
  TEMPLATE_PACKAGE_WORDINGS,
  NOTE_WORDINGS,
  GFX_NOTE_WORDINGS,
  CODE_WORDINGS,
  LATEX_WORDINGS,
  CALLOUT_WORDINGS,
  PARAGRAPH_WORDINGS,
  ADAPTER_PANEL_WORDINGS,
  DOC_TITLE_WORDINGS,
  SHAPE_WORDINGS,
  TEXT_WORDINGS,
  MINDMAP_CHROME_WORDINGS,
  DRAG_HANDLE_WORDINGS,
  AUTO_CONNECT_WORDINGS,
  EDGELESS_SELECTED_RECT_WORDINGS,
  EDGELESS_TOOLBAR_WORDINGS,
  ZOOM_TOOLBAR_WORDINGS,
  LINKED_DOC_WORDINGS,
  REMOTE_SELECTION_WORDINGS,
  TOOLBAR_WIDGET_WORDINGS,
  COMPONENTS_WORDINGS,
  INLINE_LATEX_WORDINGS,
  LINK_WORDINGS,
  MENTION_WORDINGS,
  PRESET_WORDINGS,
  REFERENCE_WORDINGS,
  BRUSH_WORDINGS,
  CONNECTOR_WORDINGS,
  GROUP_CHROME_WORDINGS,
  POINTER_WORDINGS,
  ROOT_CHROME_WORDINGS,
  SVG_SKETCH_WORDINGS,
  STD_WORDINGS,
  ATTACHMENT_WORDINGS,
  BOOKMARK_WORDINGS,
  IMAGE_WORDINGS,
  EMBED_WORDINGS,
  EMBED_DOC_WORDINGS,
  SURFACE_REF_CHROME_WORDINGS,
  FRAME_CHROME_WORDINGS,
  FRAME_PANEL_WORDINGS,
];

/**
 * Like {@link PACKAGE_WORDINGS}, for a non-framework package's SEEDS: text a
 * creation action writes INTO the document, not chrome. Kept as its own
 * source rather than folded into `PACKAGE_WORDINGS` under `chrome` — the two
 * answer different questions for a host building a catalogue: a seed is
 * translated once and becomes document content forever (a document created
 * before the key existed keeps its plain text), while a chrome wording is
 * re-rendered on every locale switch. `manifest.unit.spec.ts`'s "a placed
 * artefact is seeded through the seam" pins a few of these by key, exactly as
 * it does for a framework's own seeds.
 */
const PACKAGE_SEED_WORDINGS: readonly (readonly ChromeWording[])[] = [
  FRAME_WORDINGS,
  GROUP_WORDINGS,
  MINDMAP_SEED_WORDINGS,
  SURFACE_REF_WORDINGS,
  TEMPLATE_SEED_WORDINGS,
  ROOT_SEED_WORDINGS,
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
    ...AUXILIARY_TRANSLATION_GROUPS.map(group => group.entries),
    chromeTableEntries(),
    catalogueCategoryEntries(),
    // The editor's own shared vocabulary — the toasts, the toolbar verbs, the
    // view switcher, the board tooltips — DECLARED in
    // `@labre/affine-shared/services` beside nothing at all, and walked here
    // rather than restated. Same rule as the tables above: a wording added to
    // `CHROME_WORDINGS` reaches a host with no second edit.
    [...CHROME_WORDINGS, ...PACKAGE_WORDINGS.flat()].map(([key, fallback]) => ({
      key,
      fallback,
      source: 'chrome' as const,
    })),
    CHROME_KEYS.map(([key, fallback]) => ({
      key,
      fallback,
      source: 'chrome' as const,
    })),
    // The non-framework packages' own SEEDS — text a creation action writes
    // INTO the document (a frame's default title, a starter mindmap's
    // captions), never re-rendered once placed. See
    // `PACKAGE_SEED_WORDINGS`.
    PACKAGE_SEED_WORDINGS.flat().map(([key, fallback]) => ({
      key,
      fallback,
      source: 'seed' as const,
    }))
  );
}
