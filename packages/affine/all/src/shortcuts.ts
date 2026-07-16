import { coreShortcuts } from '@labre/affine-block-root';
import { wardleyShortcuts } from '@labre/affine-gfx-wardley';
import type { ShortcutDescriptor } from '@labre/std';

import { type BlockFlags, isBlockEnabled, type OptionalBlock } from './flags.js';

/**
 * Manifest view of a shortcut: the metadata a host "Shortcuts" settings panel
 * needs, without the runtime `handler`.
 */
export type ShortcutManifestEntry = Omit<ShortcutDescriptor, 'handler'>;

interface FrameworkShortcutGroup {
  owner: OptionalBlock;
  shortcuts: ShortcutDescriptor[];
}

/**
 * Per-framework shortcut contributions. A framework that adds shortcuts lists
 * them here (manifest) AND registers `ShortcutExtension(...)` in its view
 * (runtime binding); both are gated by its flag.
 */
const FRAMEWORK_SHORTCUT_GROUPS: FrameworkShortcutGroup[] = [
  { owner: 'wardley', shortcuts: wardleyShortcuts },
];

const toEntry = (d: ShortcutDescriptor): ShortcutManifestEntry => ({
  id: d.id,
  labelKey: d.labelKey,
  defaultKeys: d.defaultKeys,
  scope: d.scope,
  owner: d.owner,
  when: d.when,
});

/**
 * Pure aggregator (exported for testing): core shortcuts plus the shortcuts of
 * every framework group whose flag is enabled.
 */
export function buildShortcutManifest(
  core: ShortcutDescriptor[],
  groups: FrameworkShortcutGroup[],
  flags?: BlockFlags
): ShortcutManifestEntry[] {
  const entries = core.map(toEntry);
  for (const { owner, shortcuts } of groups) {
    if (isBlockEnabled(flags, owner)) {
      entries.push(...shortcuts.map(toEntry));
    }
  }
  return entries;
}

/**
 * The enumerable shortcut manifest for a given flag set: core shortcuts plus
 * the shortcuts contributed by the currently-enabled frameworks. Enumerable
 * without an editor instance (for a settings panel). Mirrors the flag gating of
 * `getInternalViewExtensions`.
 */
export function getShortcutManifest(
  flags?: BlockFlags
): ShortcutManifestEntry[] {
  return buildShortcutManifest(coreShortcuts, FRAMEWORK_SHORTCUT_GROUPS, flags);
}
