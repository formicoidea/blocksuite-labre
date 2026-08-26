---
'@labre/affine-shared': patch
'@labre/affine-widget-edgeless-toolbar': patch
'@labre/affine': patch
---

feat(edgeless): the artefact catalogue sidepanel

A framework's senior sub-menu is a row of icons, and a row of icons stops
working somewhere around fourteen. The catalogue is where the rest go: a
full-height column down the left edge of the editor, listing everything the
framework declares on the `'catalogue'` surface — grouped by the categories the
framework itself declared, each artefact spelled out with its icon, its
translated label and its keyboard chord instead of guessed from a glyph.

It is drawn from the command registry and nothing else, so a framework that
adds an artefact gets a row for it with no code written here. Rows are at least
44px tall because these boards are worked on a tablet as often as on a laptop;
the list scrolls, the canvas behind it does not. One tap runs the command and
puts the panel away — and X, Escape and a click on the canvas all close it on
the first gesture, none of them touching the tool the user had armed.

`ArtefactCatalogueProvider` is the seam. The library registers its own panel as
the default implementation, unconditionally; a host that already owns a sidebar
registers `ArtefactCatalogueExtension(service)` and takes the catalogue over,
after which the library's widget is never asked to open.

Dormant until something opens it: no framework overflows its sub-menu yet, so
today nothing calls `open` — the panel is there for the BPMN pack and for the
hosts that want the catalogue on their own terms.
