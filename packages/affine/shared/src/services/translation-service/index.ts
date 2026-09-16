import { createIdentifier } from '@labre/global/di';
import type { BlockStdScope } from '@labre/std';
import type { ExtensionType } from '@labre/store';

export * from './chrome.js';

/**
 * The library holds no prose: every human-readable string it produces —
 * shortcut labels, role names, validation messages — is an i18n KEY
 * (`com.labre.wardley.validation.change-arrow-against-evolution`). Historically those
 * keys never had to be rendered here: `getShortcutManifest` hands them to the
 * host, which owns the catalogue and the settings panel.
 *
 * PF7 is the first library UI that has to SHOW one — a violation bubble names
 * the rule it reports. This is the seam for it, and nothing more: the host
 * injects a catalogue, the library asks it for a key. There is no bundled
 * catalogue, no locale negotiation and no pluralisation. Those belong to the
 * host, which already runs an i18n stack.
 *
 * Mirrors `TelemetryExtension` / `KeymapOverrideExtension`: an optional
 * host-injected service, absent by default, with a graceful fallback at every
 * call site (see {@link translateKey}).
 *
 * A host builds its catalogue from `getTranslationKeyManifest()`
 * (`@labre/affine/translations`) — every key the library can ask for, with its
 * English fallback — rather than chasing call sites. See `./README.md`.
 */
export interface TranslationService {
  /**
   * Resolve an i18n key. Return `undefined` when the catalogue has no entry,
   * so the caller can fall back rather than render an empty bubble.
   *
   * `params` carries the values of a sentence with holes in it ("Failed to
   * upload {{name}}"). The host interpolates them — and pluralises on `count` —
   * with its own i18n stack; the placeholders are i18next's `{{name}}`, so a
   * catalogue seeded from the manifest's fallbacks works as is. A host that
   * ignores `params` still type-checks and simply shows its unfilled wording.
   */
  t(key: string, params?: TranslationParams): string | undefined;

  /**
   * The language the catalogue is currently serving, as a BCP-47 tag
   * (`'fr'`, `'en-GB'`). Optional, and NOT locale negotiation — the library
   * still holds no catalogue and still chooses nothing.
   *
   * It exists for the one kind of statement the library cannot make without
   * knowing the language: a suggestion ABOUT WORDS. A naming convention is a
   * motif in one language (see `ReadingNamingConvention.lang`), and applying an
   * English motif to a board named in French produces a confident wrong answer
   * in both directions. The host that owns the catalogue is the only thing here
   * that knows which language the user is working in; a host that does not say
   * gets silence rather than a guess.
   */
  language?: string;
}

/**
 * The primary subtag of the host's language, lower-cased — `'fr'` for
 * `'fr-CA'` — or `undefined` when no host said.
 *
 * Primary subtag only: a naming motif is a property of a LANGUAGE, and no
 * framework has a convention that holds in `en-GB` and not in `en-US`.
 */
export function hostLanguage(std: BlockStdScope): string | undefined {
  const tag = std.getOptional(TranslationProvider)?.language;
  if (typeof tag !== 'string' || tag.length === 0) return undefined;
  return tag.split('-')[0].toLowerCase();
}

/**
 * The host's full language tag (`'fr-CA'`), or `undefined` when no host said —
 * for `Intl` formatting of dates and numbers, where the region matters
 * (`en-GB` and `en-US` write a date differently). `undefined` hands `Intl` the
 * runtime default, which is what the editor did before hosts could say.
 */
export function hostLocale(std: BlockStdScope): string | undefined {
  const tag = std.getOptional(TranslationProvider)?.language;
  return typeof tag === 'string' && tag.length > 0 ? tag : undefined;
}

/**
 * `hostLocale(std)`, defaulting to `'en-US'` when the host said nothing —
 * the locale every `Intl.*Format` call in the library resolves against.
 *
 * Dates and numbers fall back to English like every string does, so a
 * standalone playground stays deterministic: `Intl`'s own runtime-default
 * fallback would instead read whatever locale the machine happens to have,
 * which is not a fallback a test can assert on.
 */
export function formatLocale(std: BlockStdScope): string {
  return hostLocale(std) ?? 'en-US';
}

/** The values of a wording's `{{name}}` placeholders. */
export type TranslationParams = Record<string, string | number>;

/**
 * Fill `{{name}}` placeholders from `params`; a placeholder with no value is
 * left as written, so a missing argument shows rather than vanishes.
 *
 * The library's side of interpolation only — used on the English fallback when
 * the host has no entry. Pluralisation is the host's: a fallback stays neutral
 * ("{{count}} element(s)").
 */
export function fillPlaceholders(
  wording: string,
  params?: TranslationParams
): string {
  if (!params) return wording;
  return wording.replace(/\{\{\s*(\w+)\s*\}\}/g, (hole, name: string) =>
    name in params ? String(params[name]) : hole
  );
}

export const TranslationProvider = createIdentifier<TranslationService>(
  'AffineTranslationService'
);

export const TranslationExtension = (
  service: TranslationService
): ExtensionType => {
  return {
    setup: di => {
      di.override(TranslationProvider, () => service);
    },
  };
};

/**
 * Resolve `key`, falling back to `fallback` — which defaults to the key itself.
 *
 * Two deliberate cases:
 *
 * - **Framework prose** (a rule message, a role name) passes NO fallback. With
 *   no catalogue registered the raw key is shown. It is ugly, and that is the
 *   point: the library must never invent the wording of somebody else's rule,
 *   and a dangling key is a bug the host has to see rather than a sentence we
 *   made up.
 * - **Chrome** (the word "Warning" on a severity chip) passes an English
 *   default, so a standalone playground reads correctly without a catalogue.
 *
 * `params` fill the wording's `{{name}}` placeholders: handed to the host,
 * which interpolates its own translation, and filled here into the fallback
 * when the host has none.
 */
export function translateKey(
  std: BlockStdScope,
  key: string,
  fallback: string = key,
  params?: TranslationParams
): string {
  const resolved = std.getOptional(TranslationProvider)?.t(key, params);
  return resolved !== undefined && resolved !== ''
    ? resolved
    : fillPlaceholders(fallback, params);
}
