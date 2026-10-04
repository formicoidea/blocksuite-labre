---
'@labre/std': minor
'@labre/affine-shared': minor
'@labre/affine-block-surface': minor
'@labre/affine-block-root': minor
'@labre/affine-block-surface-ref': minor
'@labre/affine': minor
---

The canvas grid becomes a setting (ADR 0031, stage 4). New commands
`canvas.grid.toggle` (this viewer only, remembered per document in
`localStorage`, nothing written to the document) and
`canvas.grid.saveForEveryone` (stores the grid as the viewer sees it in the
surface's new optional `showGrid` prop, clears the saver's own override, refused
on a read-only document), on the palette and the agent. The nearest decision
wins: the viewer's toggle, then the document, then the host default — the new
optional `edgelessShowGrid` in `GeneralSettingSchema` — then the library
default, on. Off removes the grid from the canvas background and from the PNG
export; the edgeless preview and surface references follow the document's
setting only. New service `CanvasGrid`, helpers `resolveCanvasGrid` /
`documentShowsGrid`, telemetry event `CanvasGridToggled` (`scope`, `visible`).
