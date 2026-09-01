import {
  type ShortcutManifestEntry,
  toShortcutManifestEntry,
} from '@labre/std';

import { getCommands } from './commands.js';
import type { LabreFlags } from './flags.js';

/**
 * Manifest view of a shortcut: the metadata a host "Shortcuts" settings panel
 * needs, without the runtime `handler`.
 *
 * Since PF3 it is a projection of `CommandDescriptor`, and it is now declared
 * ONCE, in `@labre/std` beside the projection that builds it — because the
 * framework bundles publish the very same rows on their own
 * `./commands-manifest` subpath, and a host composing core's manifest with a
 * framework's must be handed one type, not two.
 *
 * It KEEPS representing shortcuts and nothing else — no `iconKey`, no
 * `category`; catalogue metadata travels on `CommandManifestEntry`
 * (`docs/adr/0008` § Icons). `labelFallback` is the one addition, and it is not
 * catalogue metadata: it is the wording the panel SHOWS when the host has no
 * translation for `labelKey`. Dropping it was why a host with no catalogue
 * rendered raw keys, and why every host had to re-project from the main entry
 * to recover a wording the library already knew.
 *
 * Breaking shape change for hosts: `when?: string` is gone (no descriptor in
 * the repo ever set it), `defaultKeys` is always present, and `owner` narrows
 * from `string` to `CommandOwner`.
 */
export type { ShortcutManifestEntry };

/**
 * The enumerable shortcut manifest for a given flag set. TOTAL over the command
 * registry: every command yields a row, keyless ones included, so Settings ›
 * Shortcuts can bind precisely the commands a user most wants to bind. The
 * panel therefore grows from ~10 rows to the full command count — that is the
 * intent, and `owner` grouping is what keeps it usable.
 *
 * In the BUNDLED distribution this returns core's share only: each framework
 * bundle's commands are stripped out of core by `scripts/build-bundles.mjs` and
 * republished as that bundle's data-only `./commands-manifest` export, which
 * the host concatenates for the frameworks it enables.
 */
export function getShortcutManifest(
  flags?: LabreFlags
): ShortcutManifestEntry[] {
  return getCommands(flags).map(toShortcutManifestEntry);
}
