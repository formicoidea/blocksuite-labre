---
'@labre/affine': minor
---

On the canvas the arrow keys always move the selection (1px, 10px with Shift),
whether a framework sub-menu is open or not; they no longer step the sub-menu's
highlight. Alt+← / Alt+→ now walks the open sub-menu, or the toolbar's buttons
when no sub-menu is open, and Enter presses what is highlighted. Shift+S keeps
stepping the open sub-menu backwards. Also fixes the arrows doing nothing after
a sub-menu was closed with its own toolbar button. A host that documents the
canvas shortcuts should replace "←/→ in an open sub-menu" with "Alt+←/→".
