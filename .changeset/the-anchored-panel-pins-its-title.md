---
'@labre/affine-block-surface': patch
---

The editor-anchored info panel — "What this map says about this component" and
Map quality — keeps its title in place and wears the toolbar's own chrome.

The panel was one scrolling box with 12px of padding, so a reading longer than
the panel scrolled its own heading off the top and ran its words into the
rounded edge on the way. It is now a fixed header over a scrolling body: the
title stays, and Map quality's close button stays with it.

Its corners round at 16px, the measure `edgeless-toolbar` and its slide-out
menus already use, and the body gets the house scrollbar — thin, invisible at
rest, drawn on hover — in a lane of its own so the text never shifts sideways
when a section appears.
