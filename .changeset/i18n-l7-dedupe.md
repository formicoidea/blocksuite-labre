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

fix(blocks): merge 42 chrome words that several lots had declared under different keys (i18n closing pass, `.claude/i18n-chantier/dedupe-plan.json`) onto one canonical key each -- every alias package keeps its constant NAME so no call site changes, and the English fallback is byte-for-byte the same everywhere, so a standalone playground and an already-registered `TranslationProvider` both read exactly as before. A host catalogue that had already translated one of the alias keys below should move that translation onto the canonical key it now points to (the alias key no longer appears in the manifest):

- `com.labre.edgeless-toolbar.coming-soon` -> `com.labre.icon-button.coming-soon`
- `com.labre.connector.label.add-text` -> `com.labre.shape.toolbar.add-text`
- `com.labre.outline.placeholder.attachment` -> `com.labre.attachment.slash.name`
- `com.labre.note.slash-menu.format.bold` -> `com.labre.text-format.bold`
- `com.labre.note.border.style-label` -> `com.labre.board.toolbar.border-style`
- `com.labre.outline.card.mode.both` -> `com.labre.note.display-mode.both`
- `com.labre.embed.cancel` -> `com.labre.action.cancel`
- `com.labre.code.toolbar.caption` -> `com.labre.toolbar.caption`
- `com.labre.outline.placeholder.code` -> `com.labre.block-type.code-block`
- `com.labre.brush.label.color` -> `com.labre.color.label`
- `com.labre.code.toolbar.comment` -> `com.labre.toolbar.comment`
- `com.labre.embed.confirm` -> `com.labre.action.confirm`
- `com.labre.embed.iframe.toolbar.create-linked-doc` -> `com.labre.root.toolbar.create-linked-doc`
- `com.labre.outline.preview.deleted-doc` -> `com.labre.doc.deleted`
- `com.labre.outline.card.mode.edgeless` -> `com.labre.note.display-mode.edgeless`
- `com.labre.surface-ref.slash.tooltip.edgeless` -> `com.labre.note.display-mode.edgeless`
- `com.labre.drag-handle.preview.generic` -> `com.labre.surface-ref.type.edgeless`
- `com.labre.embed.iframe.error.edit` -> `com.labre.inline-link.toolbar.edit`
- `com.labre.latex.block.empty-placeholder` -> `com.labre.latex.equation-empty`
- `com.labre.latex.block.error-placeholder` -> `com.labre.latex.equation-error`
- `com.labre.note.style.fill-color` -> `com.labre.color.fill-color`
- `com.labre.root.toolbar.frame` -> `com.labre.tool.frame`
- `com.labre.toolbar.frame` -> `com.labre.tool.frame`
- `com.labre.gfx-note.menu.image` -> `com.labre.image.label`
- `com.labre.outline.placeholder.image` -> `com.labre.image.label`
- `com.labre.group.toolbar.insert-into-page` -> `com.labre.frame.toolbar.insert-into-page`
- `com.labre.font.style.italic` -> `com.labre.text-format.italic`
- `com.labre.note.slash-menu.format.italic` -> `com.labre.text-format.italic`
- `com.labre.note.tooltip.italic` -> `com.labre.text-format.italic`
- `com.labre.bookmark.slash.name` -> `com.labre.toolbar.link`
- `com.labre.inline-link.popup.link-label` -> `com.labre.toolbar.link`
- `com.labre.surface-ref.slash.mindmap.name` -> `com.labre.mindmap.tooltip`
- `com.labre.embed-doc.slash.new-doc.name` -> `com.labre.linked-doc.group.new-doc`
- `com.labre.gfx-note.tool.label` -> `com.labre.tool.note`
- `com.labre.template.panel.category.other` -> `com.labre.catalogue.other`
- `com.labre.outline.card.mode.page` -> `com.labre.note.display-mode.page`
- `com.labre.adapter-panel.html.preview` -> `com.labre.code.preview.toggle-preview`
- `com.labre.frame-panel.menu.preview-settings` -> `com.labre.outline.preview-settings-tooltip`
- `com.labre.resource.status.reload` -> `com.labre.toolbar.reload`
- `com.labre.root.toolbar.reload` -> `com.labre.toolbar.reload`
- `com.labre.root.toolbar.remove-link` -> `com.labre.inline-link.toolbar.remove-link`
- `com.labre.group.toolbar.rename` -> `com.labre.toolbar.rename`
- `com.labre.embed.html.settings-header` -> `com.labre.toolbar.settings`
- `com.labre.outline.setting-menu.settings` -> `com.labre.toolbar.settings`
- `com.labre.outline.card.show-in` -> `com.labre.note.display-mode.show-in`
- `com.labre.note.slash-menu.format.strikethrough` -> `com.labre.text-format.strikethrough`
- `com.labre.note.tooltip.strikethrough` -> `com.labre.text-format.strikethrough`
- `com.labre.connector.toolbar.style` -> `com.labre.style.menu-label`
- `com.labre.note.slash-menu.format.underline` -> `com.labre.text-format.underline`
- `com.labre.note.tooltip.underline` -> `com.labre.text-format.underline`
- `com.labre.frame.toolbar.ungroup` -> `com.labre.group.toolbar.ungroup`
- `com.labre.mention.unknown-name-fallback` -> `com.labre.remote-selection.unknown-user`

The manifest shrinks from 1629 to 1577 entries (-52, one per alias removed) and stays exhaustive and drift-free. A genuine homonym (the same English word, a different meaning at each call site -- "Confirm", "Equation", "Link", "Page" among others) was deliberately left as two keys; `manifest.unit.spec.ts`'s new "one chrome word, one key" test enforces the rule going forward and lists every accepted exception with its reason.
