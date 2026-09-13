---
'@labre/affine': patch
'@labre/affine-block-attachment': patch
'@labre/affine-block-bookmark': patch
'@labre/affine-block-code': patch
'@labre/affine-block-embed-doc': patch
'@labre/affine-block-embed': patch
'@labre/affine-block-frame': patch
'@labre/affine-block-image': patch
'@labre/affine-block-latex': patch
'@labre/affine-block-note': patch
'@labre/affine-block-root': patch
'@labre/affine-block-surface-ref': patch
'@labre/affine-components': patch
'@labre/affine-fragment-adapter-panel': patch
'@labre/affine-fragment-frame-panel': patch
'@labre/affine-fragment-outline': patch
'@labre/affine-gfx-brush': patch
'@labre/affine-gfx-connector': patch
'@labre/affine-gfx-group': patch
'@labre/affine-gfx-mindmap': patch
'@labre/affine-gfx-note': patch
'@labre/affine-gfx-shape': patch
'@labre/affine-gfx-template': patch
'@labre/affine-inline-link': patch
'@labre/affine-inline-mention': patch
'@labre/affine-inline-preset': patch
'@labre/affine-shared': patch
'@labre/affine-widget-drag-handle': patch
'@labre/affine-widget-edgeless-toolbar': patch
'@labre/affine-widget-linked-doc': patch
'@labre/affine-widget-remote-selection': patch
---

refactor(blocks): one chrome word, one key. Where several packages declared the same English interface word under different keys (Copy-style verbs, text formats, display modes, Reload, Rename, Settings…), they now share one wording from `@labre/affine-shared/services`, and the key manifest carries 52 fewer entries. Nothing changes on screen, and no key that existed in a previous release is removed: the merged keys were all introduced by this release's translation work. The manifest spec now fails when a new interface word is declared under a second key (real homonyms such as « Light » or « Left » are allow-listed with a reason).
