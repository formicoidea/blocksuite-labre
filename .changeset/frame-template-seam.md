---
'@labre/affine-shared': minor
'@labre/affine-block-frame': minor
'@labre/affine-gfx-template': minor
---

A frame can be saved as a template, through a new host seam,
`FrameTemplateProvider` (`FrameTemplateExtension({ save, list, frameDeleted?, frameRestored? })`,
`@labre/affine/shared/services`). With it, the toolbar of one selected frame
offers "Save as template" (`com.labre.frame.toolbar.save-as-template`), which
hands the host `{ docId, frameId, title, snapshot }`, a snapshot of the frame
and everything it holds, and tells the viewer the outcome
(`com.labre.frame.toast.template-saved`,
`com.labre.frame.toast.template-save-failed`). The canvas Templates panel lists
what `list()` returns under a last "Saved frames" tab
(`com.labre.template.panel.category.saved-frames`, asked only when shown) and
inserts it as a copy with fresh ids, in the active layer. `frameDeleted` is
called when this viewer deletes a frame on a writable document, never for
another peer's deletion, and `frameRestored` when an undo brings it back.
Without the seam, nothing of this appears. See `docs/integrate/04-host-seams.md`.

Removed: `EdgelessTemplatePanel.templates.extend(...)` and
`TemplateManager.extend`, a module-level registry shared by every editor of the
page and never emptied. A host category goes through
`TemplateCategoryExtension(category)` (`@labre/affine/gfx/template`), per
editor; saved frames go through `FrameTemplateProvider`. The panel now keys its
tiles by template rather than by name, so two templates with one name show as
two tiles.
