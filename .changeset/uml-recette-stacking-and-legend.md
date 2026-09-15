---
'@labre/affine-block-surface': patch
'@labre/affine-gfx-ddd-shared': minor
'@labre/affine-gfx-uml': minor
---

fix(blocks): a framework board is never raised above a board it strictly encloses when it is moved or resized, so a UML frame (or a C4 board) holding inner regions no longer jumps to the front and hides its own content (rule R10). The UML legend draws a real pictogram per notation — class box with its separators, actor, use case ellipse, package tab, component, node cube, lifeline, the typed edges with their hollow heads — instead of a plain chip; the shared legend gains glyph and edge swatches for any framework that wants them.
