---
'@labre/affine': minor
---

Replace a shape by an image, and an image by a shape, on the canvas (ADR 0044).
A plain shape's toolbar gains « Replace with image »: the picture comes from the
host's `AssetPickerProvider` when one is registered, from the system file
chooser otherwise, and is cut to the shape's box (the largest centred crop of
its proportions, ADR 0037). A canvas image's toolbar gains « Replace with
shape », which puts a rectangle in its place. Both keep the box, rotation,
z-order, user layer, connectors, group and frame of what they replace, in one
undo step; the new model has a new id. Notation shapes (with a role), shapes
with text, images with a caption or comments, and locked models are not
offered. New commands `canvas.shape.replaceWithImage` and
`canvas.image.replaceWithShape` (core, behind the `image` flag), new telemetry
event `ElementReplaced { from, to }` (kinds only), new wording keys
`com.labre.image.replace.with-image`, `com.labre.image.replace.with-shape` and
their `.description`. `reassociateConnectors(surface, oldId, newId)` is now
exported by `@labre/affine-block-surface` beside the command it backs.
