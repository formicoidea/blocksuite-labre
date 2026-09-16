import type { ChromeWording } from '@labre/affine-shared/services';
import {
  collectTranslationKeys,
  commandCategoryTranslationEntries,
  commandTranslationEntries,
  mergeTranslationEntries,
  type TranslationKeyManifestEntry,
} from '@labre/std';

import { CONTEXT_MAP_BACKGROUND } from './background.js';
import {
  CONTEXT_MAP_SEED_BOUNDED_CONTEXT,
  CONTEXT_MAP_SEED_CLOUD,
  contextMapCommands,
} from './commands.js';
import { CONTEXT_MAP_NUDGES } from './nudges.js';
import { CONTEXT_MAP_PROFILES } from './profiles.js';
import { CONTEXT_MAP_READING } from './reading.js';
import { CONTEXT_MAP_ROLES } from './roles.js';
import { CONTEXT_MAP_RULES } from './rules.js';

/**
 * The automatic legend's own section titles (`legend.ts`) — text stamped onto
 * the board the moment the legend is built (`createAutoLegend`), like any
 * other seed. The box title itself is NOT here: it says the shared word
 * "Legend", so it reuses `BOARD_LEGEND_TITLE`
 * (`@labre/affine-shared/services`) instead of a key of its own.
 */
export const CONTEXT_MAP_SEED_LEGEND_BOUNDARIES: ChromeWording = [
  'com.labre.ddd-context-map.seed.legend-boundaries',
  'Boundaries',
];
export const CONTEXT_MAP_SEED_LEGEND_RELATIONSHIPS: ChromeWording = [
  'com.labre.ddd-context-map.seed.legend-relationships',
  'Relationships',
];

/**
 * THIS framework's contribution to the translation-key manifest — every
 * `com.labre.*` key Context Mapping can hand to `TranslationProvider.t`,
 * derived from the very declarations the editor registers (never restated).
 *
 * It lives HERE, not in `@labre/affine/translations`, because the bundled
 * distribution splits the library along exactly this line:
 * `@formicoidea/labre-core` is the editor MINUS the frameworks, and a host that
 * installs `@formicoidea/labre-framework-ddd-context-map` composes this export
 * into the catalogue it builds — the same sentence that already holds for
 * `contextMapCommands`. See `packages/affine/all/src/translations.ts`.
 */
export const contextMapTranslationEntries: TranslationKeyManifestEntry[] =
  mergeTranslationEntries(
    commandTranslationEntries(contextMapCommands),
    // The catalogue's own group headers, derived from the very categories
    // these commands declare. They ship WITH the framework because core's
    // registry names no framework category in the bundled distribution, so a
    // host that composed core's manifest alone drew translated entries under
    // English headers (#183).
    commandCategoryTranslationEntries(contextMapCommands),
    collectTranslationKeys('role', CONTEXT_MAP_ROLES),
    collectTranslationKeys('background', CONTEXT_MAP_BACKGROUND),
    collectTranslationKeys('rule', CONTEXT_MAP_RULES),
    collectTranslationKeys('nudge', CONTEXT_MAP_NUDGES),
    collectTranslationKeys('profile', CONTEXT_MAP_PROFILES),
    // LAST, and the order is load-bearing: a reading profile carries the
    // framework's own `roles`, so walking it reaches every role key the `role`
    // line above already named. `mergeTranslationEntries` keeps the FIRST
    // occurrence, which is what makes each key report the source it comes from.
    collectTranslationKeys('reading', CONTEXT_MAP_READING),
    [
      CONTEXT_MAP_SEED_BOUNDED_CONTEXT,
      CONTEXT_MAP_SEED_CLOUD,
      CONTEXT_MAP_SEED_LEGEND_BOUNDARIES,
      CONTEXT_MAP_SEED_LEGEND_RELATIONSHIPS,
    ].map(([key, fallback]) => ({ key, fallback, source: 'seed' as const }))
  );
