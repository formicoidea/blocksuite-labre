---
'@labre/affine-block-attachment': minor
'@labre/affine-block-image': minor
'@labre/affine-shared': minor
'@labre/affine': minor
---

Anything replaces anything, in the frame of what it replaces: on a canvas image, file, html
and shape, in a page image, file and html. A picture is cut to the frame by the crop of ADR
0037 and never distorted, so an image replaced by an image no longer follows the new ratio.
A `replace` answer of `AssetPickerProvider` may be of any type. New commands
`canvas.attachment.replace` and `canvas.attachment.replaceWithShape`; `ElementReplaced` gains
`attachment`. Removed: `pickImageSource`, `pickAttachmentSource`. A card on a canvas is
contained in its box instead of stretched. New keys:
`com.labre.image.replace.with-asset`, `com.labre.attachment.replace.description`,
`com.labre.attachment.replace.with-shape.description`. Removed key:
`com.labre.image.replace.with-image` (ADR 0044, amendment of 2026-11-04).
