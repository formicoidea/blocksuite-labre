/**
 * Single-keystroke edgeless bindings owned by imperative code — the raw
 * `bindHotKey({...})` call in `edgeless-keyboard.ts`, which predates the
 * shortcut manifest.
 *
 * Those bindings are not `ShortcutDescriptor`s, so `resolveKeymap` cannot see
 * them and cannot report a conflict against them: an EDGY chord on `e` would
 * silently shadow the eraser. Until they are folded into real descriptors
 * (sequenced AFTER the PF3 switchover — several of them are stateful cycles,
 * not commands, so expressing them changes their semantics), this list is what
 * closes the hole. It is asserted against the real bindings by a mirror test
 * and checked against every `FrameworkDescriptor.chordPrefix`.
 *
 * `Mod-`-prefixed bindings are deliberately absent: a framework chord prefix is
 * a bare letter, so only the bare-letter bindings can collide with one.
 *
 * See `docs/adr/0008` § Reserving the prefix letter. When surface (e) becomes
 * descriptors, this constant is deleted.
 */
export const RESERVED_EDGELESS_KEYS = [
  'v',
  't',
  'c',
  'h',
  'n',
  'p',
  'Shift-p',
  'e',
  'k',
  'f',
  '-',
  '@',
  'Shift-s',
] as const;

export type ReservedEdgelessKey = (typeof RESERVED_EDGELESS_KEYS)[number];
