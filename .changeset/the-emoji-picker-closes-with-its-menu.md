---
'@labre/affine-block-callout': patch
---

The callout's emoji picker closes with its menu

The emoji-mart picker was built imperatively and appended to the menu, so Lit
knew nothing about it and the component never took it down. It holds a
document-wide click listener and a `prefers-color-scheme` listener, and each
open left one more picker attached to a menu on its way out.

The picker is now unmounted with the menu that opened it, and the selection
callback is typed instead of `any`.
