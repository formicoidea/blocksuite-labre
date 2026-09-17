import { tagDefsTranslationEntries } from '@labre/affine-shared/services';
import {
  collectTranslationKeys,
  commandCategoryTranslationEntries,
  commandTranslationEntries,
  mergeTranslationEntries,
  type TranslationKeyManifestEntry,
} from '@labre/std';

import { WARDLEY_AXIS_SEED } from './actions.js';
import { WARDLEY_AUDIT_CRITERIA } from './audit-criteria.js';
import { WARDLEY_BACKGROUND } from './background.js';
import { wardleyCommands } from './commands.js';
import { WARDLEY_OWM_IMPORT_REMARKS } from './import.js';
import { WARDLEY_LEGEND_WORDINGS } from './legend.js';
import { WARDLEY_TAG_DEFS } from './natures.js';
import { WARDLEY_NUDGES } from './nudges.js';
import { WARDLEY_NODE_LABEL, wardleyNodeLabelKey } from './presets.js';
import { WARDLEY_PROFILES } from './profiles.js';
import { WARDLEY_READING } from './reading.js';
import { WARDLEY_ROLES } from './roles.js';
import { WARDLEY_RULES } from './rules.js';
import {
  KODAK_INERTIA_SEED,
  TEA_SHOP_SEED,
  WARDLEY_TEMPLATE_NAME_KODAK_INERTIA,
  WARDLEY_TEMPLATE_NAME_TEA_SHOP,
} from './templates/maps.js';
import {
  WARDLEY_TEMPLATE_NAME_AREA_POLYGON,
  WARDLEY_TEMPLATE_NAME_EVOLUTION_ARROW,
  WARDLEY_TEMPLATE_NAME_LINK,
} from './templates/index.js';
import { WARDLEY_TOOLBAR_WORDINGS } from './toolbar/config.js';
import { WARDLEY_PALETTE_WORDINGS } from './toolbar/node-config.js';

/**
 * The prompt every labelled artefact is created NEXT TO — the fallback IS
 * `WARDLEY_NODE_LABEL[kind]`, never restated, mirroring BPMN's `seedEntries`.
 */
const nodeSeedEntries = (): TranslationKeyManifestEntry[] =>
  Object.entries(WARDLEY_NODE_LABEL).map(([kind, label]) => ({
    key: wardleyNodeLabelKey(kind as keyof typeof WARDLEY_NODE_LABEL),
    fallback: label,
    source: 'seed' as const,
  }));

/** The three axis words a translated background variant is seeded with. */
const axisSeedEntries = (): TranslationKeyManifestEntry[] =>
  Object.values(WARDLEY_AXIS_SEED).map(({ key, fallback }) => ({
    key,
    fallback,
    source: 'seed' as const,
  }));

/**
 * The seeds the two worked-example maps write — derived from the very tables
 * `templates/maps.ts` reads at placement.
 */
const exampleSeedEntries = (): TranslationKeyManifestEntry[] =>
  [...Object.values(TEA_SHOP_SEED), ...Object.values(KODAK_INERTIA_SEED)].map(
    ({ key, fallback }) => ({ key, fallback, source: 'seed' as const })
  );

/**
 * The auto-legend's own wordings — title, row captions, gradient blocks and
 * the Porter panel — derived from `legend.ts`'s own `WARDLEY_LEGEND_WORDINGS`,
 * the very declarations the rows subscribe and the two extras write when the
 * group lands on the canvas.
 */
const legendSeedEntries = (): TranslationKeyManifestEntry[] =>
  WARDLEY_LEGEND_WORDINGS.map(([key, fallback]) => ({
    key,
    fallback,
    source: 'seed' as const,
  }));

/** The toolbar tooltips this framework used to hard-code as English literals. */
const toolbarChromeEntries = (): TranslationKeyManifestEntry[] =>
  WARDLEY_TOOLBAR_WORDINGS.map(([key, fallback]) => ({
    key,
    fallback,
    source: 'chrome' as const,
  }));

/**
 * The five hand-composed cards' own tile names — chrome, not seeds: a
 * `Template.nameKey`, re-resolved every time the panel opens, never written
 * into a document. See `templates/index.ts` and `templates/maps.ts`.
 */
const templateNameEntries = (): TranslationKeyManifestEntry[] =>
  [
    WARDLEY_TEMPLATE_NAME_LINK,
    WARDLEY_TEMPLATE_NAME_EVOLUTION_ARROW,
    WARDLEY_TEMPLATE_NAME_AREA_POLYGON,
    WARDLEY_TEMPLATE_NAME_TEA_SHOP,
    WARDLEY_TEMPLATE_NAME_KODAK_INERTIA,
  ].map(([key, fallback]) => ({ key, fallback, source: 'chrome' as const }));

/** The five fixed-wording OWM import remarks ({@link WARDLEY_OWM_IMPORT_REMARKS}). */
const importRemarkEntries = (): TranslationKeyManifestEntry[] =>
  Object.values(WARDLEY_OWM_IMPORT_REMARKS).map(([key, english]) => ({
    key,
    fallback: english,
    source: 'chrome' as const,
  }));

/**
 * The nine node-colour-picker swatches' own names (`WARDLEY_PALETTE_WORDINGS`,
 * `toolbar/node-config.ts`) — chrome, like the toolbar tooltips above: a
 * swatch's name is re-rendered on every locale switch, never seeded into a
 * document.
 */
const paletteWordingEntries = (): TranslationKeyManifestEntry[] =>
  WARDLEY_PALETTE_WORDINGS.map(([key, fallback]) => ({
    key,
    fallback,
    source: 'chrome' as const,
  }));

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
 * complete in the monorepo and silently 61 % short (107 keys of 175) in the
 * distribution hosts actually consume.
 */
export const wardleyTranslationEntries: TranslationKeyManifestEntry[] =
  mergeTranslationEntries(
    commandTranslationEntries(wardleyCommands),
    // The catalogue's own group headers, derived from the very categories
    // these commands declare. They ship WITH the framework because core's
    // registry names no framework category in the bundled distribution, so a
    // host that composed core's manifest alone drew translated entries under
    // English headers (#183).
    commandCategoryTranslationEntries(wardleyCommands),
    collectTranslationKeys('role', WARDLEY_ROLES),
    collectTranslationKeys('background', WARDLEY_BACKGROUND),
    collectTranslationKeys('rule', WARDLEY_RULES),
    collectTranslationKeys('nudge', WARDLEY_NUDGES),
    collectTranslationKeys('profile', WARDLEY_PROFILES),
    collectTranslationKeys('audit-criterion', WARDLEY_AUDIT_CRITERIA),
    nodeSeedEntries(),
    axisSeedEntries(),
    exampleSeedEntries(),
    legendSeedEntries(),
    templateNameEntries(),
    toolbarChromeEntries(),
    importRemarkEntries(),
    paletteWordingEntries(),
    collectTranslationKeys('reading', WARDLEY_READING),
    // The library's own tag pack (`WARDLEY_TAG_DEFS`) — the natures and the
    // Porter competition tags. A host's app-seeded pack needs no entry here:
    // see `tagDefsTranslationEntries`.
    tagDefsTranslationEntries(WARDLEY_TAG_DEFS)
  );
