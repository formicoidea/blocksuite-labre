---
'@labre/affine-gfx-wardley': patch
'@labre/affine-gfx-edgy': patch
'@labre/affine-gfx-cynefin-estuarine': patch
'@labre/affine-gfx-bpmn': patch
'@labre/affine-gfx-ddd-shared': patch
'@labre/affine-gfx-ddd-event-storming': patch
'@labre/affine-gfx-ddd-core-domain': patch
'@labre/affine-gfx-ddd-context-map': patch
---

Senior button components resolve their own label through the translation seam

The toolbar's navigation tooltips learned to translate a senior tool's
`labelKey`, but the seven framework senior-button components still carried
their label as a hard-coded English string. Each button now resolves the same
`com.labre.framework.<id>` key through `translateKey`, with the previous
English wording as fallback — so a host catalogue that already translates the
toolbar translates the buttons too, and a standalone playground reads exactly
as before.
