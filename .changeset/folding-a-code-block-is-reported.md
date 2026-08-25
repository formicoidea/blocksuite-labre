---
'@labre/affine-shared': patch
'@labre/affine-block-code': patch
'@labre/affine-components': patch
---

Folding a code block is reported, and menu labels stop being selectable

The code toolbar reported the language picker and the HTML preview toggle but
said nothing about the collapse toggle, so how often long snippets are folded
away was invisible. It now emits `codeBlockToggleCollapse`, carrying which way
the fold went. As everywhere else on this bus, a host with no telemetry adapter
is unaffected.

Dragging across a menu entry in a toolbar used to select its label as text; the
entries are buttons, so they no longer take a text selection.
