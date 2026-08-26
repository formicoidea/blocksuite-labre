---
'@labre/affine-components': patch
'@labre/affine-shared': patch
'@labre/affine-widget-toolbar': patch
---

Making a selection costs less

Selecting blocks did four kinds of avoidable work. De-duplicating the selected
blocks rescanned the whole list once per block, which is quadratic and shows up
as soon as a large document is selected at once. A captioned block read its own
selected flag straight out of its render, so every selection change re-rendered
the whole block instead of just its selection outline. The toolbar measured
every selected block twice per positioning pass, and it ran that pass on every
animation frame even for anchors that only move when the page scrolls.

The de-duplication now uses a set, the selection outline subscribes on its own,
the block rectangles are measured once per frame, and the per-frame loop is now
kept only for canvas anchors, which can move without a scroll or a resize to
announce it. Selection order and toolbar placement are unchanged.
