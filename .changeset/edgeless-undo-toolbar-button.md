---
'@labre/affine-gfx-link': minor
---

Replace the edgeless toolbar **link** quick tool with an **undo** button. The
button is wired to the store undo command (the same one Ctrl/Cmd-Z uses) and
takes the former link slot (next to `frame`), in both desktop and dense/mobile
toolbars. The unused link quick-tool button, dense menu and tool are removed.
