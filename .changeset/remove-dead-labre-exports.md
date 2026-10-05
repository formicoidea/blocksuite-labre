---
'@labre/affine-block-surface': patch
'@labre/affine-block-note': patch
'@labre/affine-gfx-c4': patch
'@labre/affine-gfx-uml': patch
'@labre/affine-gfx-wardley': patch
'@labre/affine-gfx-bpmn': patch
---

The board SVG export now paints an edgeless text at its place in the canvas'
z-order: a shape drawn over an edgeless text covers it in the file as it does
on screen, where every edgeless text used to land on top of everything. The
never-read translation key `com.labre.note.display-mode.tooltip` ("Display
mode") is removed from the manifest; a host catalogue may drop its entry.
Everything else is dead code removed from module-internal exports none of the
packages' entry points reach (the superseded C4 and UML legend helpers, unused
re-exports in the Wardley and BPMN importers, an unused BPMN type, framework
models re-exported a second time by the surface's element-model module): no
host-visible change.
