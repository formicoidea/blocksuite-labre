---
'@labre/affine-block-root': minor
'@labre/affine-shared': minor
'@labre/affine': minor
---

feat(edgeless): add keyboard shortcuts for duplicate and apply last style

Duplicate (previously toolbar-only) is now bound to Mod+D on the canvas, and
Mod+Y applies the last used style to the selection — across element types.
Both are edgeless-scoped, enumerable and host-rebindable via the shortcut
manifest (`getShortcutManifest`).

- Mod+D duplicates the current selection. On mac this is Cmd+D and coexists
  with the existing Ctrl+D = delete binding; on Windows/Linux it is Ctrl+D.
- Mod+Y repaints the selected elements with every style prop the user last
  set, wherever the target type supports it: a fill picked on a rect applies
  to an ellipse, a font style set on a text applies to a shape. Props foreign
  to the target type are dropped per prop (schema-filtered), geometry and
  content are never touched, and one undo restores the previous styles.
