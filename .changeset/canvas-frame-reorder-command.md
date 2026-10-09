---
'@labre/affine-block-frame': minor
---

New command `canvas.frame.reorder` (`{ ids, before }`, `before: null` = the end): the one write of the frames' presentation order, exported with its `reorderFramesParams` schema and the `reorderFramePresentation` action. The frame panel's drag and the presentation toolbar's order menu now go through it, so on a read-only document they write nothing, a drop that changes nothing pushes no undo step, and a reorder is undone in one step instead of merging into the gesture before it. A host's own slide panel runs the same command through `runCommand`. New keys `com.labre.command.canvas.frame.reorder` and `com.labre.command.canvas.frame.reorder.description`.
