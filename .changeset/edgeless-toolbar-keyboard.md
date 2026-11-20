---
'@labre/affine-widget-edgeless-toolbar': minor
'@labre/affine-block-root': minor
---

Edgeless toolbar keyboard model (#679, ADR 0054). The canvas toolbar is one
`role="toolbar"` named by the new key `com.labre.edgeless-toolbar.name`
("Canvas tools"), with one Tab stop: the active tool's button, through a roving
`tabindex`. One Tab from the canvas reaches it, notes or not; Shift+Tab from
the toolbar goes back to the canvas. The canvas keeps Tab while a text is
edited or a single mind map node is selected. While a toolbar button holds the
keyboard focus, the toolbar takes its own keys only: ←/→ walk every button and
page the senior row, Home/End go to the ends, Enter and Space press the button
exactly as a click does (once, even when held), Escape closes what the button
opened and gives it the focus back, or gives the canvas the keyboard. Every
other key (Delete, letters, shortcuts) still reaches the canvas. A mouse click
never puts the focus on a button, so after a click every key is the canvas's,
as before. Picking a tool gives the canvas the keyboard back. Keyboard focus
draws the same 2px ring as the Alt+←/→ highlight, which stays as a shortcut
from the canvas.
