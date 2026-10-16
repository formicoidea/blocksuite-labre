---
'@labre/affine-shared': minor
'@labre/affine-block-frame': minor
---

`FrameTemplateService` gains an optional `showTemplates()`: with it, the notification that says a frame was saved as a template carries a « View » action (`com.labre.frame.toast.template-view`) that calls it, so the host can open the place where its templates are listed. A host without it gets the same notification as before, with no action.
