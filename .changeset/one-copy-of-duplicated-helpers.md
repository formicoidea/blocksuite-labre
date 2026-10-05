---
'@labre/std': patch
'@labre/affine-shared': patch
'@labre/affine-block-surface': patch
'@labre/affine-block-root': patch
'@labre/affine-widget-edgeless-toolbar': patch
'@labre/affine-gfx-wardley': patch
'@labre/affine-gfx-c4': patch
'@labre/affine-gfx-bpmn': patch
'@labre/affine-gfx-uml': patch
---

Duplicated helpers now have a single copy, with no host-visible change in
behaviour. `wardleySafeFilename`, `c4SafeFilename`, `bpmnSafeFilename` and
`umlSafeFilename` keep their names and signatures and call the shared
`safeFilename`, and a parity table holds every exported file name to it. The
Wardley SVG recognisers start their answer from one builder. The rule that a
group's outermost group carries its layer (ADR 0031 §5) is exported once from
`@labre/std/gfx` as `layerCarrierOf`. The selection pane draws its "hide for
everyone" entry, row name and eye toggle from one helper each. A parity test
now holds the paste's z-order to the canvas comparator.
