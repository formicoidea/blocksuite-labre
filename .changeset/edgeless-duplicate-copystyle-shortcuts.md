---
'@labre/affine-block-root': minor
'@labre/affine': minor
---

feat(edgeless): add keyboard shortcuts for duplicate and copy style

Duplicate (previously toolbar-only) is now bound to Mod+D on the canvas, and a
new copy-style action is bound to Mod+Y. Both are edgeless-scoped, enumerable
and host-rebindable via the shortcut manifest (`getShortcutManifest`).

- Mod+D duplicates the current selection. On mac this is Cmd+D and coexists
  with the existing Ctrl+D = delete binding; on Windows/Linux it is Ctrl+D.
- Mod+Y copies the style of a single selected canvas element into the shared
  "last props" store, so the next element created of the same type inherits it.
