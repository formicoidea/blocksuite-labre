---
'@labre/affine-gfx-edgy': minor
'@labre/affine-block-surface': minor
'@labre/affine-model': minor
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
- The facets element gains an optional backward-compatible `showPictos` flag
  (defaults to `true`).
