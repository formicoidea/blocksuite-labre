---
'@labre/std': minor
'@labre/affine-block-root': minor
'@labre/affine-widget-edgeless-selected-rect': minor
---

Link a canvas drawing element to an existing doc or an external URL.

A new **Link** item in the edgeless element context menu opens the same
quick-search modal as the existing link feature (doc of the workspace _or_ an
internet URL) and attaches the chosen target to the selected drawing element
(shape, text, connector, group — anything but blocks/frames). The link is
stored as two optional fields on the surface element base model
(`externalLink` / `linkedDocId`), which are backward-compatible (old documents
read `undefined`, no migration).

When the linked element is hovered on the canvas, a small arrow button appears
(via the `edgeless-element-link` widget): clicking it opens the doc in the host
side-view (through `docLinkClicked`) or the URL in a new tab. Minimal by
design — no embed card, unlike "Create linked doc".

Out of scope for v1: links on block-type canvas elements (image / note /
bookmark), selecting-time affordance, and editing/removing the link from the
menu.
