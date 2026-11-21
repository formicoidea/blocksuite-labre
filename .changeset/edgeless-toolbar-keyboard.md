---
'@labre/affine-widget-edgeless-toolbar': minor
'@labre/affine-block-root': minor
'@labre/affine-components': minor
'@labre/affine-gfx-brush': patch
'@labre/affine-gfx-note': patch
'@labre/affine-gfx-mindmap': patch
'@labre/affine-gfx-shape': patch
'@labre/affine-gfx-connector': patch
'@labre/affine-block-frame': patch
'@labre/affine-block-note': patch
'@labre/affine-block-image': patch
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
to its button, as Escape does. Enter or Space press a control as a click does,
and the menu then does what it does after that click: gone, the canvas has the
keys; still open (an option such as a shape type or Pen / Highlighter), the
focus stays on the control. A menu opened with the mouse moves no focus, and a
menu the keyboard visited is, for the mouse, the menu it was before. The
menus' buttons are named from their tooltip (each mind map style by its own
name) and the chosen option is announced as pressed (`aria-pressed`, through
the new `pressed` property of `edgeless-tool-icon-button`).

The discrete `affine-slider` (line widths, the note's corner radius) is now an
ARIA slider and a Tab stop everywhere it is drawn — the brush and highlighter
element toolbars, the connector's and the shape's line width, the note's
corner radius: the arrows step it point to point, Home and End go to its ends.
It is named by its new `label` property, which every use in the library
passes; a host that renders `affine-slider` itself should pass one too.

The pager arrows keep their names ("Next tools", "Previous tools") and their
tooltip still previews the tool they bring in; a click closes that preview
until the pointer leaves the arrow, where it used to stay shown, stale, over a
resting pointer. Keyboard focus draws the same 2px ring as the Alt+←/→
highlight, which stays as a shortcut from the canvas.
