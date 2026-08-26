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
