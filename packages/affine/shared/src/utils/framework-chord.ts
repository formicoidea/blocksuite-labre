import type { CommandDescriptor } from '@labre/std';

/**
 * The default keys of a framework command: the framework's chord prefix, then
 * the command's own second key, on both platforms — or none at all when the
 * command is keyless by intent (still bindable from a host's Settings ›
 * Shortcuts, because `toShortcutDescriptor` is total).
 *
 * Shared because every framework reads its prefix the same way
 * (`docs/adr/0055`): a framework declares DATA — one prefix, one optional
 * letter per command — and this is the whole of the logic, written once
 * instead of once per framework. The prefix is also spelled as
 * `FrameworkDescriptor.chordPrefix` in `@labre/affine`'s `frameworks.ts`,
 * which a framework package cannot import; the parity tests in
 * `affine/all/src/__tests__/shortcuts/chord-prefixes.unit.spec.ts` hold the
 * two spellings together.
 */
export function frameworkChord(
  prefix: string,
  key: string | undefined
): CommandDescriptor['defaultKeys'] {
  if (key === undefined) return { mac: [], other: [] };
  return { mac: [prefix, key], other: [prefix, key] };
}
