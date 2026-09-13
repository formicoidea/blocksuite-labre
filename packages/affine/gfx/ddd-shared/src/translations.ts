import type { ChromeWording } from '@labre/affine-shared/services';
import type { TranslationKeyManifestEntry } from '@labre/std';

import {
  CD_SUBDOMAINS,
  ES_HOTSPOT,
  ES_STICKIES,
  TEAM_TOPOLOGIES,
} from './shared/consts';

/**
 * camelCase → kebab-case, the same WS2 derivation each framework's own role
 * table uses (see `ddd-event-storming/roles.ts`'s `kebab`).
 */
const kebab = (kind: string): string =>
  kind.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);

/**
 * The i18n key an Event Storming sticky's default label is asked of the
 * host's catalogue under, for the given `ES_STICKIES` / hotspot kind.
 * Exported so `ddd-event-storming/commands.ts` derives the SAME key at
 * placement rather than restating the derivation.
 */
export const esStickySeedKey = (kind: string) =>
  `com.labre.ddd-event-storming.seed.${kebab(kind)}`;

/**
 * The i18n key a Team Topologies marker's default label is asked of the
 * host's catalogue under, for the given `TEAM_TOPOLOGIES` kind. Exported so
 * `ddd-core-domain/commands.ts` derives the SAME key at placement.
 */
export const teamTopologySeedKey = (kind: string) =>
  `com.labre.ddd-core-domain.seed.${kind}`;

/**
 * The i18n key a Core Domain dot's default label is asked of the host's
 * catalogue under, for the given `CD_SUBDOMAINS` kind. Exported so
 * `ddd-core-domain/commands.ts` derives the SAME key at placement.
 */
export const cdSubdomainSeedKey = (kind: string) =>
  `com.labre.ddd-core-domain.seed.${kebab(kind)}`;

/**
 * The seeds baked into an Event Storming sticky at creation
 * (`ddd-event-storming/commands.ts`), derived from the shared palette rather
 * than restated — a tenth sticky kind added to {@link ES_STICKIES} gets its
 * seed key with no edit here.
 *
 * This TABLE lives in `ddd-shared` because the palette it is derived from
 * does; the KEYS still name the framework whose creation action actually
 * writes the text, matching `com.labre.<framework>.seed.<slug>` — nothing here
 * invents a "ddd-shared" framework.
 */
export const ES_STICKY_SEEDS: ChromeWording[] = [
  ...ES_STICKIES.map(
    (preset): ChromeWording => [esStickySeedKey(preset.kind), preset.label]
  ),
  [esStickySeedKey('hotspot'), ES_HOTSPOT.label],
];

/**
 * The seed baked into a Team Topologies interaction-mode marker at creation
 * (`ddd-core-domain/commands.ts`), derived from {@link TEAM_TOPOLOGIES}.
 */
export const TEAM_TOPOLOGY_SEEDS: ChromeWording[] = TEAM_TOPOLOGIES.map(
  (preset): ChromeWording => [teamTopologySeedKey(preset.kind), preset.label]
);

/**
 * The seed baked into a Core Domain sub-domain / bounded-context dot at
 * creation (`ddd-core-domain/commands.ts`), derived from {@link CD_SUBDOMAINS}.
 */
export const CD_SUBDOMAIN_SEEDS: ChromeWording[] = CD_SUBDOMAINS.map(
  (preset): ChromeWording => [cdSubdomainSeedKey(preset.kind), preset.label]
);

/**
 * Every seed derived from a palette THIS package owns, regardless of which DDD
 * framework's creation action writes it. `ddd-shared` carries no
 * `…TranslationEntries` of its own (it registers no command, no role, nothing
 * the manifest walks) — each of the frameworks above spreads this WHOLE list
 * into its own `…TranslationEntries` (`mergeTranslationEntries` de-duplicates
 * the ones it does not use), which is what keeps a DDD framework from ever
 * importing another one just to reach a shared table.
 *
 * Not `TEAM_TOPOLOGIES` / `CD_SUBDOMAINS`-only or `ES_STICKIES`-only: a
 * framework that does not use a slice of this table today may tomorrow (a
 * Context Map that starts drawing Team Topologies markers, say), and the
 * manifest test only cares that every entry here is used by SOME source file —
 * never that every framework that lists it also uses it.
 */
export const dddSharedTranslationEntries: TranslationKeyManifestEntry[] = [
  ...ES_STICKY_SEEDS,
  ...TEAM_TOPOLOGY_SEEDS,
  ...CD_SUBDOMAIN_SEEDS,
].map(([key, fallback]) => ({ key, fallback, source: 'seed' as const }));
