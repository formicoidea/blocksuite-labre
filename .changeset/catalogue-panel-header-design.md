---
'@labre/affine-widget-edgeless-toolbar': patch
---

The artefact catalogue side panel's header now matches the frame panel's (and
the selection pane's): a 36px row with no divider, the framework's name as a
14px secondary-text title, and the close as a 20px icon button instead of the
touch-sized ×. Only the header changes: the catalogue's rows, behaviour, seam,
commands and keys (`com.labre.catalogue.close` included) are unchanged.
