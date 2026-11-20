---
'@labre/affine-widget-edgeless-toolbar': minor
'@labre/affine-block-root': minor
'@labre/affine-components': minor
'@labre/affine-gfx-brush': patch
'@labre/affine-gfx-note': patch
'@labre/affine-gfx-mindmap': patch
'@labre/affine-block-frame': patch
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
as before. A press that only picks a tool (the eraser) gives the canvas the
keyboard back.

A menu opened from the keyboard (a framework's commands, the frame, connector,
pen, note, shape and mind map options) takes the keyboard on its first
control: the arrows walk a group of controls, Tab and Shift+Tab move between
groups (types, widths, colours) and, past the last, close the menu and return
to its button, as Escape does; Enter or Space press a control as a click does.
A framework's command, or a press that picks a tool, closes the menu and gives
the canvas the keys. A menu opened with the mouse moves no focus. The menus'
buttons are named from their tooltip. The discrete `affine-slider` (the line
widths) is an ARIA slider now, stepping point to point with the arrows, Home
and End. The pager arrows' tooltip is their own name ("Next tools", "Previous
tools") instead of the tool they bring in, which stayed shown over a resting
pointer after a page turn. Keyboard focus draws the same 2px ring as the
Alt+←/→ highlight, which stays as a shortcut from the canvas.
