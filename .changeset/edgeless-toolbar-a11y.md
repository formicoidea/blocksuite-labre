---
'@labre/affine-widget-edgeless-toolbar': minor
'@labre/affine-components': minor
'@labre/affine-block-code': minor
'@labre/affine-block-frame': minor
'@labre/affine-gfx-brush': minor
'@labre/affine-gfx-connector': minor
'@labre/affine-gfx-pointer': minor
'@labre/affine-gfx-note': minor
'@labre/affine-gfx-template': minor
'@labre/affine-gfx-mindmap': minor
---

Edgeless toolbar names, state and element toolbar height (#679). Every button
of the canvas toolbar now has an accessible name, the same translated wording
as its tooltip: the quick tools, the pen and the eraser, each senior tool
(a framework's button is named after the framework, "Wardley map",
"Cynefin / Estuarine"), "More Tools" and the two pager arrows. The tools expose
their state as `aria-pressed` (the note and template tools and the mind map
menu included); an action (undo, insert a text, add a file) exposes none. After paging the senior row, the arrow no longer keeps the
tooltip of the tool it brought in. `edgeless-tool-icon-button` gains `label`
(its name when its tooltip is a template) and `onToolbarRow`; it names and
states itself only on the toolbar row or when given a `label`, so its other
uses (panels, menus, auto-complete) keep the attributes their owner gives; its `active`
defaults to `undefined` instead of `false`. The pen's senior tool declares the
`com.labre.brush.tooltip.pen` key. New keys for the host's catalogue:
`com.labre.edgeless-toolbar.previous-tools` ("Previous tools") and
`com.labre.edgeless-toolbar.next-tools` ("Next tools"). The element (contextual)
toolbar, which also draws the page view's formatting toolbar, is 40px tall
border included (`box-sizing: border-box`), instead of a 36px content box plus its
border (measured 37 to 38px depending on the browser, in 4.0.0 and before); the code block's bar keeps its size.
