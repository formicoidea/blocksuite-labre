---
'@labre/affine-gfx-ddd-event-storming': patch
'@labre/affine-gfx-ddd-core-domain': patch
---

fix(edgeless): the morph dropdown draws the sticky and dot swatches

The Event Storming and Core Domain swatch icons declared a `viewBox` and no
size of their own: the senior sub-menu sizes icons with a container rule, so
they rendered there and collapsed to nothing in the "Change type" dropdown —
nine invisible stickies, five invisible dots (playground recette of the morph
train, 02/09/2026). Every swatch now carries `width`/`height` like the other
frameworks' icons, so it renders at 24px wherever it is drawn. The sub-menu is
unchanged: its container rule was already forcing the same 24px.
