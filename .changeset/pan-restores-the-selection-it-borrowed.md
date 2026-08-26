---
'@labre/affine-gfx-pointer': patch
---

A middle-click pan gives back the selection it borrowed

Pressing the wheel borrows the canvas for a temporary pan and hands it back on
release. Handing back the selection never worked: the selection was read at
release time, long after activating the pan tool had cleared it, so every
middle-click pan silently emptied the selection. It is now snapshotted when the
wheel goes down and restored after the tool switch.

A middle click while the pan tool is already the chosen tool is also left alone
instead of borrowing the canvas from itself — that gesture used to hang a
restore listener with nothing to restore.
