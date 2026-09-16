import type { ServiceProvider } from '@labre/global/di';

import { TranslationProvider } from '../../services/translation-service/index.js';

/**
 * `translateKey`'s own contract, over a `ServiceProvider` rather than a
 * `BlockStdScope` — an adapter/transformer (`ClipboardAdapter`, the markdown
 * / mix-text / plain-text `toDocSnapshot` importers…) has no `std`, only the
 * provider `std.getOptional` itself delegates to. `undefined` (no provider
 * handed in) resolves exactly like no host registered one.
 */
export function resolveWording(
  provider: ServiceProvider | undefined,
  wording: readonly [key: string, fallback: string]
): string {
  const resolved = provider?.getOptional(TranslationProvider)?.t(wording[0]);
  return resolved !== undefined && resolved !== '' ? resolved : wording[1];
}
