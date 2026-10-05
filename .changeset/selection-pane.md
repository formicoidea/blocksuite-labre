---
'@labre/affine-shared': minor
'@labre/affine-block-surface': minor
'@labre/affine-widget-edgeless-toolbar': minor
'@labre/affine': minor
---

A selection pane for the canvas (ADR 0031, stage 2). A new button in the edgeless
toolbar, and the `canvas.selectionPane.toggle` command in the palette, open a side
panel listing every element by stacking order, top first: groups and mind maps are
collapsible rows, a click selects on the canvas (shift / ctrl / cmd adds), a hover
highlights, the padlock locks that row alone (never grouping a multi-selection),
a double-click renames a group, a drag moves a row in the stack (one undo step),
and the list can be filtered by frame. A read-only document is
listed and refuses every write.

New seam `SelectionPaneExtension({ open, close })` / `SelectionPaneProvider`,
shaped like the artefact catalogue's: `null` removes the pane and its button. The
headless tree is `selectionPaneTree(std)` (ids only, z-order, top first) and the
actions are core commands a host pane runs through `runCommand`:
`canvas.element.reorder`, `canvas.element.lock`, `canvas.element.unlock`,
`canvas.group.rename`. New telemetry event `SelectionPaneOpened` (`source`). New
i18n keys under `com.labre.selection-pane.*` and `com.labre.command.canvas.*`.
Nothing new is written to documents.
