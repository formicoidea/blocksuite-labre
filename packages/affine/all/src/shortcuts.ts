import type { ShortcutDescriptor } from '@labre/std';
import { toShortcutDescriptor } from '@labre/std';

import { getCommands } from './commands.js';
import type { BlockFlags } from './flags.js';

/**
 * Manifest view of a shortcut: the metadata a host "Shortcuts" settings panel
 * needs, without the runtime `handler`.
 *
 * Since PF3 it is a projection of a projection: {@link CommandDescriptor} →
 * {@link ShortcutDescriptor} → here. It KEEPS representing shortcuts and
 * nothing else — no `iconKey`, no `category`; catalogue metadata travels on
 * `CommandManifestEntry` (`docs/adr/0008` § Icons).
 *
 * Breaking shape change for hosts: `when?: string` is gone (no descriptor in
 * the repo ever set it), `defaultKeys` is always present, and `owner` narrows
 * from `string` to `CommandOwner`.
 */
export type ShortcutManifestEntry = Omit<ShortcutDescriptor, 'handler'>;

const toEntry = (d: ShortcutDescriptor): ShortcutManifestEntry => ({
  id: d.id,
  labelKey: d.labelKey,
  defaultKeys: d.defaultKeys,
  scope: d.scope,
  owner: d.owner,
});

/**
 * The enumerable shortcut manifest for a given flag set. TOTAL over the command
 * registry: every command yields a row, keyless ones included, so Settings ›
 * Shortcuts can bind precisely the commands a user most wants to bind. The
 * panel therefore grows from ~10 rows to the full command count — that is the
 * intent, and `owner` grouping is what keeps it usable.
 */
export function getShortcutManifest(
  flags?: BlockFlags
): ShortcutManifestEntry[] {
  return getCommands(flags).map(toShortcutDescriptor).map(toEntry);
}
