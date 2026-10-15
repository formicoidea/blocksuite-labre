---
'@labre/affine-shared': minor
'@labre/affine-block-image': minor
'@labre/affine-block-attachment': minor
'@labre/affine-gfx-note': minor
'@labre/affine-widget-keyboard-toolbar': minor
---

Images and files can come from the host's own asset library, through a new
optional host seam, `AssetPickerProvider`
(`AssetPickerExtension({ pick })`, `@labre/affine/shared/services`).
`pick({ kind: 'image' | 'file', mode: 'insert' | 'replace', multiple?, docId })`
resolves with `AssetRef[]` (`{ sourceId, name, type, size, width?, height? }`,
blobs the host already stores) or `null` when the viewer cancels. With a host,
the slash menu's Image, Attachment and PDF, the mobile keyboard toolbar's
Image and Attachment, and the canvas's image and file buttons open it instead
of the system file chooser, and the image toolbar gains "Replace" (page and
canvas), which swaps the picture in place, keeping the displayed width and
following the new ratio, in one undo step. Blocks reference the picked blob by
its `sourceId`: the bytes are never sent again. Without a host nothing
changes; pasting and dropping files never go through the seam.

New exports: `addSiblingImageBlocksFromAssets`, `addImagesFromAssets`,
`replaceImage`, `pickAndAddSiblingImageBlocks`, `pickAndAddImages`
(`@labre/affine/blocks/image`); `addSiblingAttachmentBlocksFromAssets`,
`addAttachmentsFromAssets`, `pickAndAddSiblingAttachmentBlocks`,
`pickAndAddAttachments` (`@labre/affine/blocks/attachment`). New key:
`com.labre.image.toolbar.replace`. No stored format changes.
