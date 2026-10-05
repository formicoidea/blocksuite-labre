---
'@labre/affine-block-surface': patch
---

`renderBoardSvg(std, board)` keeps its 0.43 signature: called without options it returns a `BoardSvgExport`, never `null`, so `renderBoardSvg(std, board).svg` compiles unchanged. 0.44.0's widening to `BoardSvgExport | null` is withdrawn before publication and now applies only to the overload that takes `options`, which returns `null` when the options leave nothing to draw.

Two 0.44 changes a host may notice stay as they are. `TelemetryEventMap` gains `SelectionPaneOpened`, `CanvasVisibilityChanged`, `CanvasGridToggled` and `CanvasLayerChanged`; an adapter written as `track(event, props)` is unaffected, but a host keeping an exhaustive `Record<keyof TelemetryEventMap, …>` must add the four. And when edgeless content is pasted, the index an `EdgelessClipboardConfig.createBlock` writes is now replaced by the paste's planned index, so pasted blocks keep their relative order with the pasted elements.
