---
'@labre/affine-widget-edgeless-toolbar': minor
'@labre/affine-block-root': minor
---

Edgeless toolbar keyboard model (#679, ADR 0054). The canvas toolbar is one
`role="toolbar"` named by the new key `com.labre.edgeless-toolbar.name`
("Canvas tools"), with one Tab stop: the active tool's button, through a roving
`tabindex`. Tab from the canvas now reaches it: the canvas keeps Tab only while
a text is edited or a single mind map node is selected. In the toolbar, ←/→
walk every button and page the senior row, Home/End go to the ends, Enter and
Space press, Escape closes the open sub-menu or gives focus back to the canvas
without changing the tool; picking a tool gives the canvas the keyboard back.
Keyboard focus draws the same 2px ring as the Alt+←/→ highlight, which stays as
a shortcut from the canvas.
