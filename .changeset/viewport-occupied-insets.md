---
'@labre/affine': minor
---

The viewport now knows which part of the canvas a docked panel covers:
`Viewport.setOccupiedInset(owner, insets)` declares it (and returns its
withdrawal), `occupiedInsets$` is the combined value (the max per side),
`visibleRect` the container less it, and `paddingWithInsets(viewport, padding)`
adds it to a fit padding. The selection pane and the artefact catalogue declare
their width while open, so edge auto-pan triggers at the panel's edge instead of
under it, fit to screen centres on the visible area and the element toolbar
stays clear of the panel. Runtime state only: nothing is stored, and nothing
changes while no panel is open.
