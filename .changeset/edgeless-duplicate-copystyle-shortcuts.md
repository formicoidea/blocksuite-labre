---
'@labre/affine-block-root': minor
'@labre/affine': minor
---

feat(edgeless): add keyboard shortcuts for duplicate and apply last style

Duplicate (previously toolbar-only) is now bound to Mod+D on the canvas, and
Mod+Y applies the last used style to the selection. Both are edgeless-scoped,
enumerable and host-rebindable via the shortcut manifest
(`getShortcutManifest`).

- Mod+D duplicates the current selection. On mac this is Cmd+D and coexists
  with the existing Ctrl+D = delete binding; on Windows/Linux it is Ctrl+D.
- Mod+Y repaints the selected canvas elements with the last used style — the
  shared "last props" store that every style edit and element creation
  already records. One undo restores the previous styles.
