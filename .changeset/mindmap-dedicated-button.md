---
'@labre/affine-gfx-mindmap': minor
'@labre/affine-gfx-template': patch
'@labre/affine': minor
---

feat(edgeless): split the "Others" toolbox into a dedicated Mind Map button

The combined senior button now splits in two:

- **Mind Map** — a dedicated senior button (the mindmap glyph, the `m` shortcut,
  the style picker + import), flag-gated by `mindmap`.
- **Others** — keeps free-text and add-file, flag-gated by a new `other` flag
  (it no longer rides the `mindmap` flag), same basket icon minus the mindmap.

Both buttons share one parameterized component/menu (`variant`). Mindmap
rendering (element view, painter, interaction, contextual toolbars) is now
always registered, independent of either flag — so disabling a button never
un-paints existing mindmaps nor breaks Templates-panel insertion.

A new **"Mind Map"** section in the Templates panel offers the 4 built-in styles
as starter mindmaps. Inserting a mindmap template required teaching the
template id-regeneration middleware (`replaceIdMiddleware`) to remap a mindmap's
node-id references (`children` keys + `parent` back-refs), so inserted mindmaps
rebuild correctly.
