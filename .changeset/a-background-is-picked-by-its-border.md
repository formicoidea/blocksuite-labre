---
'@labre/affine-model': patch
'@labre/affine-gfx-bpmn': patch
'@labre/affine-gfx-c4': patch
'@labre/affine-gfx-edgy': patch
'@labre/affine-gfx-wardley': patch
'@labre/std': patch
---

fix(edgeless): a framework background is picked by its border, not its whole area

Framework backgrounds and boards hit-tested their entire rectangle, so they
competed with their own content for every click. A board created after the
shapes it covers sits above them in the paint order and swallowed 100% of the
clicks on those shapes; one sitting below filled every gap the content left —
the interior of an unfilled shape, the space beside a small node — which is
where the "one time in two" came from. Eleven element types were affected: the
BPMN pool, both C4 frames, the event-storming board, the core domain chart, the
Wardley background and the context-map board (subclasses of the
framework-background primitive), plus the EDGY board, the EDGY facets diagram,
Cynefin and Estuarine (standalone implementations of the same geometry).

A background is now selected by a band along its border, ten screen pixels wide
and adjusted for the zoom like every shape's stroke, with two carve-outs:

- a **BPMN pool** keeps its title bands clickable — the participant strip on the
  left and the lane strip beside it — which is the bpmn.io convention and the
  only part of a pool that is the pool rather than the process drawn on it;
- **editable label zones** (Wardley axis titles, EDGY facet names, C4 board and
  boundary names) still receive the double-click that renames them, and a BPMN
  pool's lane separators still receive the drag that moves them. Pointer events
  now reach a view through the VIEW's `includesPoint` rather than the model's —
  it delegates to the model by default, so nothing else changes — which is what
  lets a framework declare its own gesture zones beside the code that draws
  them.

The lasso (`containsBound` / `intersectsBound`) is untouched, and a selected
background is still dragged from anywhere inside it: the drag path asks about
the element's visible extent (`ignoreTransparent: false`), which the interior
still answers, exactly as an unfilled shape does.
