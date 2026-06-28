import {
  type ShortcutConflictReporter,
  ShortcutConflictReporterIdentifier,
  type ShortcutOverrides,
  ShortcutOverrideIdentifier,
} from '@labre/std';
import type { ExtensionType } from '@labre/store';

/**
 * Host-injected shortcut rebinding table. Each entry maps a shortcut id to a
 * combo (array of keys, e.g. `['Ctrl', 'Shift', 'Z']`) or `'disabled'`. The
 * effective keymap is `override ?? default`; `'disabled'` removes the binding.
 *
 * Mirrors `TelemetryExtension` / `EditorSettingExtension`.
 */
export function KeymapOverrideExtension(
  overrides: ShortcutOverrides
): ExtensionType {
  return {
    setup: di => {
      di.override(ShortcutOverrideIdentifier, () => overrides);
    },
  };
}

/**
 * Host-injected sink for combo conflicts detected within a scope. Without it,
 * conflicts are logged to the console.
 */
export function ShortcutConflictReporterExtension(
  reporter: ShortcutConflictReporter
): ExtensionType {
  return {
    setup: di => {
      di.override(ShortcutConflictReporterIdentifier, () => reporter);
    },
  };
}
