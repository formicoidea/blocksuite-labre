---
'@labre/affine-gfx-edgy': minor
'@labre/affine-block-surface': minor
'@labre/affine-model': minor
'@labre/std': patch
---

feat(edgeless): EDGY dynamic template, blank EDGY board and dependency spotlight

- New "EDGY dynamic" template (template panel + EDGY senior menu): the facets
  background (without writings) with the 12 EDGY elements as prefab nodes,
  linked by the 24 canonical relations of the metamodel, each carrying its
  verb as a native connector label.
- New blank "EDGY board" background element for free-form EDGY modelling.
- New modular spotlight-on-hover: backgrounds registered as spotlight hosts
  (`SpotlightHostExtension`) grant the elements laid inside their bounds a
  dependency highlight — hovering a node fades everything but the node, its
  connectors and their endpoints. Enabled for the EDGY facets diagram and the
  EDGY board; other frameworks (e.g. Wardley) can opt in with one line.
- The facets element gains optional backward-compatible `showPictos`,
  `cropToCircles` and `spotlightEnabled` flags; the board gains
  `spotlightEnabled`. Both background toolbars expose a spotlight toggle.
- Fix: canvas view events (click/dblclick) now route to the TOPMOST view
  under the pointer (paint order), so elements laid on a background stay
  editable — previously the background could swallow the double-click.
- EDGY template gallery: Customer journey, Service blueprint and
  Organisation chart connectors are now ATTACHED to their elements (they
  follow moves, endpoints clip to edges); the blueprint's diagonal arrows
  no longer render as orthogonal zigzags.
