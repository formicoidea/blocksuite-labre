---
'@labre/affine': minor
---

"Export selection as SVG": a new core command, `selection.export.svg` (contextual "⋮" of any canvas selection that holds no board, palette, catalogue), downloads the selected elements as a vector SVG file with the same renderer replay and `data-labre-*` markers as the board and whole-canvas exports. Groups, mindmaps and frames bring their content, what this viewer hid is left out, and blocks without an SVG painter (notes, frames, images, embeds) are set aside; when nothing selected can be drawn, the host's `NotificationProvider` shows a toast (`com.labre.export.svg.selection.nothing`) and no file is downloaded. `@labre/affine-block-surface` adds `renderSelectionSvg`, `selectionSvgModels` and `exportSelectionSvg`. New keys for the host catalogue: `com.labre.command.selection.export.svg`, `com.labre.command.selection.export.svg.description`, `com.labre.export.svg.selection.nothing`. `export.svg` is unchanged and still exports the selected board.
