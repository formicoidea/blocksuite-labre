---
'@labre/affine-gfx-mindmap': minor
'@labre/affine': minor
---

Replace the edgeless "Others" senior toolbar button (and its submenu) with two
standalone senior buttons placed next to pen/eraser: **Text** (insert an
editable text element) and **Add file** (open the file picker and insert the
image/attachment). Each is a single tap and is individually flag-gated
(`edgeless-text`, `edgeless-media`, replacing the old `other` flag). The actions
reuse the former submenu's `textRender` / `mediaRender`, so text/file insertion
is unchanged.
