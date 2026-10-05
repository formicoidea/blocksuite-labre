import { safeFilename } from '@labre/affine-shared/utils';

/**
 * A name a file system will accept, minus the extension: the shared
 * `safeFilename`, held to it by `safe-filename-parity.unit.spec.ts`.
 *
 * `fallback` is a parameter here where the other frameworks hard-code theirs, because
 * UML writes two formats out of one pack and the word a nameless document should
 * take is the FORMAT's rather than the framework's.
 */
export function umlSafeFilename(
  raw: string | undefined,
  fallback = 'diagram'
): string {
  return safeFilename(raw, fallback);
}
