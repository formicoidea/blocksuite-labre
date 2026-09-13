import type { ChromeWording } from '@labre/affine-shared/services';
import type { TranslationKeyManifestEntry } from '@labre/std';

/**
 * The Aggregate Design Canvas template's own seeds: the header band's caption
 * and the nine numbered section titles painted onto the canvas
 * (`templates.ts`). This is a hand-composed template (no command draws this
 * scene), so the seeds are resolved through `Template.localize` rather than at
 * a creation action — see `templates.ts`'s `build`.
 *
 * `ddd-aggregate` carries no `FrameworkId` (it ships one template, no command,
 * no role): it is a non-framework package, so its keys follow
 * `com.labre.ddd-aggregate.seed.<slug>` and its wordings join
 * `AUXILIARY_TRANSLATION_GROUPS` (`packages/affine/all/src/translations.ts`)
 * through {@link dddAggregateTranslationEntries}: this package ships as its own
 * bundle, so core must not import it, and the bundler strips the group from
 * core's copy exactly as it strips a framework's.
 */
export const AGGREGATE_SEED_HEADER: ChromeWording = [
  'com.labre.ddd-aggregate.seed.header',
  'Aggregate Design Canvas',
];
export const AGGREGATE_SEED_NAME: ChromeWording = [
  'com.labre.ddd-aggregate.seed.name',
  '1. Name',
];
export const AGGREGATE_SEED_DESCRIPTION: ChromeWording = [
  'com.labre.ddd-aggregate.seed.description',
  '2. Description',
];
export const AGGREGATE_SEED_STATE_TRANSITIONS: ChromeWording = [
  'com.labre.ddd-aggregate.seed.state-transitions',
  '3. State Transitions',
];
export const AGGREGATE_SEED_ENFORCED_INVARIANTS: ChromeWording = [
  'com.labre.ddd-aggregate.seed.enforced-invariants',
  '4. Enforced Invariants',
];
export const AGGREGATE_SEED_CORRECTIVE_POLICIES: ChromeWording = [
  'com.labre.ddd-aggregate.seed.corrective-policies',
  '5. Corrective Policies',
];
export const AGGREGATE_SEED_HANDLED_COMMANDS: ChromeWording = [
  'com.labre.ddd-aggregate.seed.handled-commands',
  '6. Handled Commands',
];
export const AGGREGATE_SEED_CREATED_EVENTS: ChromeWording = [
  'com.labre.ddd-aggregate.seed.created-events',
  '7. Created Events',
];
export const AGGREGATE_SEED_THROUGHPUT: ChromeWording = [
  'com.labre.ddd-aggregate.seed.throughput',
  '8. Throughput',
];
export const AGGREGATE_SEED_SIZE: ChromeWording = [
  'com.labre.ddd-aggregate.seed.size',
  '9. Size',
];

/**
 * This package's contribution to the translation-key manifest, listed in
 * `PACKAGE_SEED_WORDINGS` under source `seed`.
 */
export const DDD_AGGREGATE_WORDINGS: readonly ChromeWording[] = [
  AGGREGATE_SEED_HEADER,
  AGGREGATE_SEED_NAME,
  AGGREGATE_SEED_DESCRIPTION,
  AGGREGATE_SEED_STATE_TRANSITIONS,
  AGGREGATE_SEED_ENFORCED_INVARIANTS,
  AGGREGATE_SEED_CORRECTIVE_POLICIES,
  AGGREGATE_SEED_HANDLED_COMMANDS,
  AGGREGATE_SEED_CREATED_EVENTS,
  AGGREGATE_SEED_THROUGHPUT,
  AGGREGATE_SEED_SIZE,
];

/**
 * The same wordings as manifest entries, exported from the package root the way
 * a framework bundle exports its `…TranslationEntries`: a bundled host composes
 * them with core's manifest when it installs this bundle.
 */
export const dddAggregateTranslationEntries: readonly TranslationKeyManifestEntry[] =
  DDD_AGGREGATE_WORDINGS.map(([key, fallback]) => ({
    key,
    fallback,
    source: 'seed' as const,
  }));
