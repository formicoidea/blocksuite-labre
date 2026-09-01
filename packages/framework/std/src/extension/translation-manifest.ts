import {
  type AnyCommandDescriptor,
  toCommandManifestEntry,
} from './command-registry.js';

/**
 * The translation-key manifest seam, declared here for the same reason
 * {@link CommandManifestEntry} is: a manifest a framework CONTRIBUTES to must
 * be describable by the framework itself, and `@labre/std` is the only layer
 * every framework package already depends on.
 *
 * The manifest is assembled in `@labre/affine/translations`, but assembled from
 * PARTS: the editor chrome's own entries plus one `…TranslationEntries` export
 * per installed framework. That is what makes it survive the bundled
 * distribution, where `@formicoidea/labre-core` ships WITHOUT the frameworks —
 * exactly the composition the command registry already does (see
 * `packages/affine/all/src/commands.ts` and `scripts/build-bundles.mjs`).
 */

export type TranslationKeySource =
  | 'command'
  | 'framework'
  | 'role'
  | 'background'
  | 'rule'
  | 'nudge'
  | 'profile'
  | 'audit-criterion'
  | 'reading'
  /**
   * The words a framework WRITES ONTO THE CANVAS when an artefact is placed —
   * the "Task" a fresh BPMN task is captioned with, the "People" under an EDGY
   * person. Document content and not chrome, which is why they are a source of
   * their own: they are resolved ONCE, at placement, and what lands in the
   * document is a string the author then owns and edits. Changing the
   * catalogue afterwards renames nothing, exactly as renaming a shape by hand
   * would not.
   */
  | 'seed'
  | 'chrome';

export interface TranslationKeyManifestEntry {
  key: string;
  /**
   * The English default the library renders when the host's catalogue has no
   * entry. Absent for the keys that deliberately ship none (framework prose
   * whose wording the library must not invent — see the `translateKey`
   * docstring).
   */
  fallback?: string;
  /** Which kind of declaration the key comes from. */
  source: TranslationKeySource;
}

const KEY_PREFIX = 'com.labre.';

function walk(
  source: TranslationKeySource,
  value: unknown,
  out: Map<string, TranslationKeyManifestEntry>,
  seen: WeakSet<object>
): void {
  if (typeof value !== 'object' || value === null) return;
  if (seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) walk(source, item, out, seen);
    return;
  }

  const record = value as Record<string, unknown>;
  for (const [prop, propValue] of Object.entries(record)) {
    if (
      typeof propValue === 'string' &&
      prop.endsWith('Key') &&
      propValue.startsWith(KEY_PREFIX)
    ) {
      if (out.has(propValue)) continue;
      const stem = prop.slice(0, -'Key'.length);
      const fallback =
        record[`${stem}Fallback`] ??
        (prop === 'labelKey' ? record.fallback : undefined);
      out.set(propValue, {
        key: propValue,
        ...(typeof fallback === 'string' ? { fallback } : {}),
        source,
      });
    } else {
      walk(source, propValue, out, seen);
    }
  }
}

/**
 * Deep-walk a declaration and collect every `…Key` string property holding a
 * `com.labre.*` key, paired with its fallback by the repo's own conventions:
 * `<stem>Key` ↔ `<stem>Fallback` (roles, rules, commands, conventions), and
 * `labelKey` ↔ `fallback` (profiles, nudges, criteria, background labels).
 *
 * This is what makes the manifest DERIVED rather than restated: a key added to
 * a rule or a role shows up with no further work.
 */
export function collectTranslationKeys(
  source: TranslationKeySource,
  value: unknown
): TranslationKeyManifestEntry[] {
  const out = new Map<string, TranslationKeyManifestEntry>();
  walk(source, value, out, new WeakSet());
  return [...out.values()];
}

/**
 * A command group's contribution. Walks the SERIALIZABLE projection, not the
 * descriptors: `run` and the zod schemas carry no keys and walking them would
 * mean walking zod internals.
 */
export function commandTranslationEntries(
  commands: readonly AnyCommandDescriptor[]
): TranslationKeyManifestEntry[] {
  return collectTranslationKeys(
    'command',
    commands.map(toCommandManifestEntry)
  );
}

/** The i18n key prefix every artefact-catalogue group header is looked up under. */
export const CATALOGUE_CATEGORY_KEY_PREFIX = 'com.labre.catalogue.category.';

/**
 * The English default for a category header, derived from the category id.
 *
 * `'backgrounds'` → `'Backgrounds'`, `'value-flow'` → `'Value flow'`,
 * `'boundedContext'` → `'Bounded context'`. Sentence case, not title case: a
 * header is a phrase, and capitalising every word turns `'change arrows'` into
 * a product name.
 *
 * It is a FALLBACK and nothing more. A host with a catalogue answers
 * `com.labre.catalogue.category.<id>` and this is never seen; a standalone
 * playground reads a word instead of a raw key. The library still invents no
 * framework prose — a category id is the framework's own word, only respelled.
 *
 * It lives in `@labre/std` rather than beside the panel that renders it because
 * a FRAMEWORK has to derive the same fallback for its own contribution to the
 * key manifest (see {@link commandCategoryTranslationEntries}), and `@labre/std`
 * is the only layer every framework package already depends on. The catalogue
 * widget re-exports it, so the panel and the manifest cannot drift.
 */
export function humanizeCategory(category: string): string {
  const words = category
    // camelCase and PascalCase boundaries, before the separators are split on:
    // `'boundedContext'` has no separator to find otherwise.
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(word => word.toLowerCase());

  if (!words.length) return category;
  const [first, ...rest] = words;
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(' ');
}

/**
 * The catalogue group headers a command group implies: one entry per distinct
 * `category` it declares, with the panel's own humanised fallback.
 *
 * A framework contributes these WITH its commands, for the reason the command
 * entries themselves ship with the framework: `@formicoidea/labre-core` is the
 * editor minus the frameworks, so a header key derived from core's registry
 * alone knows nothing about "events", "gateways" or "swimlanes" — and a bundled
 * host ended up drawing translated catalogue entries under English headers
 * (#183). Deriving them from the same `commands` array on both sides makes the
 * monorepo assembly and the composed bundle produce the same list.
 */
export function commandCategoryTranslationEntries(
  commands: readonly AnyCommandDescriptor[]
): TranslationKeyManifestEntry[] {
  const categories = new Set<string>();
  for (const command of commands) {
    if (command.category) categories.add(command.category);
  }
  return [...categories].map(category => ({
    key: `${CATALOGUE_CATEGORY_KEY_PREFIX}${category}`,
    fallback: humanizeCategory(category),
    source: 'chrome' as const,
  }));
}

/**
 * Compose contributions into one manifest: first occurrence of a key wins (so
 * the caller's order decides which `source` a shared key reports), sorted by
 * key so two hosts composing the same parts get the same list.
 */
export function mergeTranslationEntries(
  ...groups: readonly (readonly TranslationKeyManifestEntry[])[]
): TranslationKeyManifestEntry[] {
  const out = new Map<string, TranslationKeyManifestEntry>();
  for (const group of groups) {
    for (const entry of group) {
      if (!out.has(entry.key)) out.set(entry.key, entry);
    }
  }
  return [...out.values()].sort((a, b) => a.key.localeCompare(b.key));
}
