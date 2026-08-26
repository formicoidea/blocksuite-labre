---
'@labre/affine-block-surface': patch
'@labre/affine-model': patch
'@labre/affine-gfx-bpmn': patch
'@labre/affine': patch
---

refactor(edgeless): the BPMN pool is a declared framework background

The pool was the last background in the library still drawn by hand: ninety
lines of canvas code, and a model class that restated the five geometry answers
every other background inherits. It is now an **instantiation of the
framework-background primitive**, declared as data in `background.ts` like the
Wardley map, the Core Domain Chart and the Event Storming board before it.

One thing changes on screen, and it was asked for: **a pool now paints an opaque
white card**, like every other framework background. It used to be transparent
— a decision taken at the red-zone review of 26/08/2026, on the ground that a
pool IS a map background, and a board where one framework's backdrop is
see-through and every other one is not reads as a bug. A pool dropped over
strokes already on the canvas covers them, exactly as a Wardley map dropped over
them always has; sending the background to the back is the answer in both cases.

Everything else is reproduced operation for operation — the frame, its rounded
corners, the filled name band, the divider and the participant name rotated up
the band — and pinned by a fidelity suite that asserts every literal the deleted
renderer used to emit. Three further differences are known and recorded there,
none of them visible: the divider is stroked before the frame instead of after
(same ink, same width), a `lineJoin` that had nothing to act on is no longer
set, and the participant name is no longer hidden on a pool narrower than twelve
model units — a pool narrower than one character of its own name.

The primitive gains the one concept the pool needed: **side bands**, a filled
strip painted over a margin, with its own divider and its own label. A band has
no width of its own — it IS the margin it covers — and it belongs to the card,
painted over the card's fill and under its border so the frame keeps outlining
the whole element. A text can now also declare a `middle` baseline, which is
what centres a name across a band rather than sitting it on a line inside one.

**Assumed behaviour change: a frame no longer adopts a pool.** Frames have
excluded framework backgrounds since PF2 — a backdrop the frame was drawn on top
of would be permanently buried behind its own child — and the pool, now one of
them, joins that rule. Drawing a frame over a lane groups the flow objects
inside it and leaves the lane where it is, which is what already happens on a
Wardley map, a Core Domain Chart and a Context Map board.

**No document changes.** The persisted element type is still `bpmnPool` and its
props are still the four it has always written (`name`, `resizeEnabled`,
`rotate`, `xywh`), with the same defaults, in the same order. A pool authored
before this change opens, round-trips and paints identically.
