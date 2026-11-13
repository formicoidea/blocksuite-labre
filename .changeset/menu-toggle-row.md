---
'@labre/affine-components': patch
---

A `menu.toggleSwitch` row now flips its setting once per click: a click on the row calls `onChange(!on)` (it used to hand back the value the row was built with, so it changed nothing or undid a flip), and a click on its switch no longer also reaches the row. A caller that keeps a static `on` still needs to rebuild the row (for instance through `menu.dynamic`) for a second click on the row to flip back.
