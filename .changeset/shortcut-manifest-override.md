---
'@labre/std': minor
'@labre/affine-shared': minor
'@labre/affine-block-root': minor
---

Add an enumerable, host-overridable keyboard shortcut system (#30, phase 1).

- `ShortcutDescriptor` + `ShortcutExtension` register shortcuts that are both
  manifest entries and binding sources; `ShortcutKeymapExtension` installs the
  effective keymap via the normal dispatcher mechanism.
- `KeymapOverrideExtension(overrides)` lets the host rebind by id
  (`{ undo: ['Ctrl','Shift','Z'] }`) or disable (`'disabled'`); the effective
  combo is `override ?? default`.
- Combo conflicts within a scope are reported (via an optional
  `ShortcutConflictReporterExtension`, else the console) and the duplicate is
  never bound silently.
- Core `undo` / `redo` are migrated from the imperative page keymap to core
  descriptors, so they are now enumerable and rebindable.

The framework-aware manifest (`getShortcutManifest(flags)`) and per-framework
contributions are phase 2.
