import { createIdentifier } from '@labre/global/di';
import type { BlockStdScope } from '@labre/std';
import type { ExtensionType } from '@labre/store';

/**
 * The library holds no prose: every human-readable string it produces —
 * shortcut labels, role names, validation messages — is an i18n KEY
 * (`com.labre.wardley.validation.component-outside-map`). Historically those
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
 */
export interface TranslationService {
  /**
   * Resolve an i18n key. Return `undefined` when the catalogue has no entry,
   * so the caller can fall back rather than render an empty bubble.
   */
  t(key: string): string | undefined;
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
 */
export function translateKey(
  std: BlockStdScope,
  key: string,
  fallback: string = key
): string {
  const resolved = std.getOptional(TranslationProvider)?.t(key);
  return resolved !== undefined && resolved !== '' ? resolved : fallback;
}
