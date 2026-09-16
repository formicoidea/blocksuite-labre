import { dddSharedTranslationEntries } from '@labre/affine-gfx-ddd-shared';
import type { ChromeWording } from '@labre/affine-shared/services';
import {
  collectTranslationKeys,
  commandCategoryTranslationEntries,
  commandTranslationEntries,
  mergeTranslationEntries,
  type TranslationKeyManifestEntry,
} from '@labre/std';

import { coreDomainCommands } from './commands.js';
import { CORE_DOMAIN_BACKGROUND } from './core-domain/background.js';
import { CORE_DOMAIN_NUDGES } from './nudges.js';
import { CORE_DOMAIN_PROFILES } from './profiles.js';
import { CORE_DOMAIN_READINGS } from './reading.js';
import { CORE_DOMAIN_ROLES } from './roles.js';
import { CORE_DOMAIN_RULES } from './rules.js';

/**
 * The automatic legend's own section titles (`core-domain/legend.ts`) — text
 * stamped onto the chart the moment the legend is built
 * (`createAutoLegend`), like any other seed. The box title itself is NOT
 * here: it says the shared word "Legend", so it reuses `BOARD_LEGEND_TITLE`
 * (`@labre/affine-shared/services`) instead of a key of its own.
 */
export const CORE_DOMAIN_SEED_LEGEND_SUBDOMAINS: ChromeWording = [
  'com.labre.ddd-core-domain.seed.legend-subdomains',
  'Sub-domains',
];
export const CORE_DOMAIN_SEED_LEGEND_TEAM_MODES: ChromeWording = [
  'com.labre.ddd-core-domain.seed.legend-team-modes',
  'Team interaction modes',
];
export const CORE_DOMAIN_SEED_LEGEND_MOVEMENT: ChromeWording = [
  'com.labre.ddd-core-domain.seed.legend-movement',
  'Movement',
];

/**
 * THIS framework's contribution to the translation-key manifest — every
 * `com.labre.*` key the Core Domain Chart can hand to `TranslationProvider.t`,
 * derived from the very declarations the editor registers.
 *
 * It lives HERE, not in `@labre/affine/translations`, because the bundled
 * distribution splits the library along exactly this line:
 * `@formicoidea/labre-core` is the editor MINUS the frameworks, and a host that
 * installs `@formicoidea/labre-framework-ddd-core-domain` composes this export
 * into the catalogue it builds — the same sentence that already holds for
 * `coreDomainCommands`.
 */
export const coreDomainTranslationEntries: TranslationKeyManifestEntry[] =
  mergeTranslationEntries(
    commandTranslationEntries(coreDomainCommands),
    // The catalogue's own group headers, derived from the very categories
    // these commands declare. They ship WITH the framework because core's
    // registry names no framework category in the bundled distribution, so a
    // host that composed core's manifest alone drew translated entries under
    // English headers (#183).
    commandCategoryTranslationEntries(coreDomainCommands),
    collectTranslationKeys('role', CORE_DOMAIN_ROLES),
    collectTranslationKeys('background', CORE_DOMAIN_BACKGROUND),
    collectTranslationKeys('rule', CORE_DOMAIN_RULES),
    collectTranslationKeys('nudge', CORE_DOMAIN_NUDGES),
    collectTranslationKeys('profile', CORE_DOMAIN_PROFILES),
    // LAST, and the order is load-bearing: a reading profile carries the
    // framework's own `roles`, so walking it reaches every role key the `role`
    // line above already named. `mergeTranslationEntries` keeps the FIRST
    // occurrence, which is what makes each key report the source it comes from.
    collectTranslationKeys('reading', CORE_DOMAIN_READINGS),
    // The seeds baked into a placed dot / marker (`commands.ts`), derived from
    // the shared tables in `ddd-shared` rather than restated — spread whole
    // rather than imported from a sibling DDD framework (never allowed), and
    // de-duplicated with whatever this framework already listed.
    dddSharedTranslationEntries,
    [
      CORE_DOMAIN_SEED_LEGEND_SUBDOMAINS,
      CORE_DOMAIN_SEED_LEGEND_TEAM_MODES,
      CORE_DOMAIN_SEED_LEGEND_MOVEMENT,
    ].map(([key, fallback]) => ({ key, fallback, source: 'seed' as const }))
  );
