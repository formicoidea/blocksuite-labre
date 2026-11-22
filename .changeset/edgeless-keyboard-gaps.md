---
'@labre/affine-widget-edgeless-toolbar': patch
'@labre/affine-gfx-template': patch
'@labre/affine-gfx-shape': patch
---

Canvas toolbar keyboard, the gaps found in the 4.1.0 acceptance (ADR 0054,
amendment of 2026-11-22). Enter on the Templates button now puts the keyboard
in the panel's search field; Tab goes on to the categories and the cards, the
arrows walk them, and Enter on a card places the template at the centre of the
view. Enter on a mind map style places the mind map at the centre of the view
instead of picking it up with no key to set it down
(`EdgelessDraggableElementController.dropAt`, new). At a narrow bar (one senior
tool a page), → from Text now moves the focus to Add file's own button: each
senior tool draws its own cell. The Shape tool taken from the keyboard no
longer draws its ghost in the canvas's top-left corner: it is hidden until the
pointer moves over the canvas. The mouse is unchanged.
