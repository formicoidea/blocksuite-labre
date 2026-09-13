---
'@labre/affine': minor
'@labre/affine-shared': minor
'@labre/affine-block-edgeless-text': minor
'@labre/affine-fragment-adapter-panel': minor
'@labre/affine-fragment-doc-title': minor
'@labre/affine-fragment-outline': minor
'@labre/affine-gfx-mindmap': minor
'@labre/affine-gfx-shape': minor
'@labre/affine-gfx-text': minor
'@labre/affine-widget-drag-handle': minor
'@labre/affine-widget-edgeless-auto-connect': minor
'@labre/affine-widget-edgeless-selected-rect': minor
'@labre/affine-widget-edgeless-toolbar': minor
'@labre/affine-widget-edgeless-zoom-toolbar': minor
'@labre/affine-widget-linked-doc': minor
'@labre/affine-widget-remote-selection': minor
'@labre/affine-widget-toolbar': minor
---

feat(blocks): translate the edgeless toolbar, canvas tools and generic widgets at the seam. The edgeless toolbar (font weight/style, style toggles, tool tooltips, zoom bar), the mindmap and shape frameworks (senior/quick tools, style and layout menus, shape names, templates category tab), the text toolbar, the outline panel and its floating mini-viewer, the adapter/debug panel, the document title placeholder, the drag-and-drop preview, the auto-connect index badges, the "+" auto-complete panel and floating link button, the "⋮" overflow menu, and the "@" linked-doc menu (including its import dialog and the remote-cursor fallback name) now resolve through `translateKey`/`ChromeWording` instead of hardcoded English. A new `com.labre.mindmap.seed.new-node` seed replaces the mindmap model's own "New node" default at every call site in these packages. With no `TranslationProvider` registered every surface reads exactly as before, letter for letter.
