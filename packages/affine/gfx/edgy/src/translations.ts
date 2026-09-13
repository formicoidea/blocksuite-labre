import {
  collectTranslationKeys,
  commandCategoryTranslationEntries,
  commandTranslationEntries,
  mergeTranslationEntries,
  type TranslationKeyManifestEntry,
} from '@labre/std';

import { edgyCommands } from './commands.js';
import { EDGY_LEGEND_CHROME_WORDINGS } from './legend.js';
import {
  EDGY_DYNAMIC_NODES,
  EDGY_DYNAMIC_VERBS,
  EDGY_ZONES,
  edgyElementLabel,
  edgyElementLabelKey,
  type EdgyElementName,
  type EdgyZone,
  edgyVerbSeedKey,
} from './metamodel.js';
import { NODE_LABEL, nodeLabelKey } from './node/consts.js';
import { EDGY_NUDGES } from './nudges.js';
import { EDGY_PROFILES } from './profiles.js';
import { EDGY_READING } from './reading.js';
import { EDGY_ROLES } from './roles.js';
import { EDGY_RULES } from './rules.js';
import {
  EDGY_TEMPLATE_NAME_CUSTOMER_JOURNEY,
  EDGY_TEMPLATE_NAME_FACETS_OVERVIEW,
  EDGY_TEMPLATE_NAME_ORGANISATION_CHART,
  EDGY_TEMPLATE_NAME_SERVICE_BLUEPRINT,
  EDGY_TEMPLATE_SEED,
} from './templates/index.js';
import { EDGY_TOOLBAR_WORDINGS } from './toolbar/config.js';
import { EDGY_PALETTE_WORDINGS } from './toolbar/node-config.js';

/**
 * The name every one of the 12 official elements and the 6 Venn zones is
 * seeded with — one key per distinct lowercase word (`organisation`, `brand`
 * and `product` name BOTH an element and an intersection zone, so the same
 * key covers both), reused verbatim by `templates/dynamic.ts`,
 * `templates/index.ts` and the facets background's own creation site
 * (`actions.ts`).
 */
const elementAndZoneSeedEntries = (): TranslationKeyManifestEntry[] => {
  const names = new Set<EdgyElementName | EdgyZone>([
    ...(Object.keys(EDGY_DYNAMIC_NODES) as EdgyElementName[]),
    ...EDGY_ZONES.map(zone => zone.id),
  ]);
  return [...names].map(name => ({
    key: edgyElementLabelKey(name),
    fallback: edgyElementLabel(name),
    source: 'seed' as const,
  }));
};

/** The legend's own section titles (see {@link EDGY_LEGEND_CHROME_WORDINGS}). */
const legendChromeEntries = (): TranslationKeyManifestEntry[] =>
  EDGY_LEGEND_CHROME_WORDINGS.map(([key, fallback]) => ({
    key,
    fallback,
    source: 'chrome' as const,
  }));

/** The toolbar tooltips this framework used to hard-code as English literals. */
const toolbarChromeEntries = (): TranslationKeyManifestEntry[] =>
  EDGY_TOOLBAR_WORDINGS.map(([key, fallback]) => ({
    key,
    fallback,
    source: 'chrome' as const,
  }));

/**
 * The twelve node-colour-picker swatches' own names
 * (`EDGY_PALETTE_WORDINGS`, `toolbar/node-config.ts`) — chrome, re-rendered
 * on every locale switch, never seeded into a document.
 */
const paletteWordingEntries = (): TranslationKeyManifestEntry[] =>
  EDGY_PALETTE_WORDINGS.map(([key, fallback]) => ({
    key,
    fallback,
    source: 'chrome' as const,
  }));

/** The metamodel's 24 canonical verbs, drawn raw as a connector label. */
const verbSeedEntries = (): TranslationKeyManifestEntry[] =>
  EDGY_DYNAMIC_VERBS.map(verb => ({
    key: edgyVerbSeedKey(verb),
    fallback: verb,
    source: 'seed' as const,
  }));

/**
 * The seeds that belong to the four hand-composed scenes only (a lane title,
 * a case name, a step counter…) — derived from `EDGY_TEMPLATE_SEED`, the very
 * table the scenes read at placement.
 */
const sceneSeedEntries = (): TranslationKeyManifestEntry[] =>
  Object.values(EDGY_TEMPLATE_SEED).map(({ key, fallback }) => ({
    key,
    fallback,
    source: 'seed' as const,
  }));

/**
 * The four hand-composed scenes' own tile names — chrome, not seeds: a
 * `Template.nameKey`, re-resolved every time the panel opens, never written
 * into a document. None of the four derives from a command.
 */
const templateNameEntries = (): TranslationKeyManifestEntry[] =>
  [
    EDGY_TEMPLATE_NAME_FACETS_OVERVIEW,
    EDGY_TEMPLATE_NAME_CUSTOMER_JOURNEY,
    EDGY_TEMPLATE_NAME_SERVICE_BLUEPRINT,
    EDGY_TEMPLATE_NAME_ORGANISATION_CHART,
  ].map(([key, fallback]) => ({ key, fallback, source: 'chrome' as const }));

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
    // The catalogue's own group headers, derived from the very categories
    // these commands declare. They ship WITH the framework because core's
    // registry names no framework category in the bundled distribution, so a
    // host that composed core's manifest alone drew translated entries under
    // English headers (#183).
    commandCategoryTranslationEntries(edgyCommands),
    collectTranslationKeys('role', EDGY_ROLES),
    collectTranslationKeys('rule', EDGY_RULES),
    collectTranslationKeys('nudge', EDGY_NUDGES),
    collectTranslationKeys('profile', EDGY_PROFILES),
    // The captions a placed base element is seeded with. Derived from
    // `NODE_LABEL`, the very table the gesture writes from, so the wording a
    // host is offered is the wording the canvas would have carried.
    Object.entries(NODE_LABEL).map(([kind, label]) => ({
      key: nodeLabelKey(kind as keyof typeof NODE_LABEL),
      fallback: label,
      source: 'seed' as const,
    })),
    elementAndZoneSeedEntries(),
    verbSeedEntries(),
    sceneSeedEntries(),
    templateNameEntries(),
    legendChromeEntries(),
    toolbarChromeEntries(),
    paletteWordingEntries(),
    // LAST, and the order is load-bearing: a reading profile carries the
    // framework's own `roles`, so walking it reaches every role key the line
    // above already named. `mergeTranslationEntries` keeps the FIRST
    // occurrence, which is what makes each key report the source it comes from.
    collectTranslationKeys('reading', EDGY_READING)
  );
