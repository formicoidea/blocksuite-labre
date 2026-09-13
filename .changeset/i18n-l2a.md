---
'@labre/affine-gfx-bpmn': minor
'@labre/affine-gfx-c4': minor
'@labre/affine-gfx-wardley': minor
'@labre/affine-gfx-edgy': minor
---

feat(blocks): every seed the four gfx-primitive frameworks write into a document — a BPMN pool's and lane's default name, the two worked BPMN scenes, a C4 component's title and description tier and a boundary's name, a Wardley node's/pipeline's/market's/accelerator's caption and a background variant's axis titles, the two shipped Wardley maps, an EDGY facets diagram's three circle names, the "EDGY dynamic" metamodel template and its four hand-composed scenes — now resolves through the translation seam at placement (`translateKey`, ADR 0016), so a document created in a translated host starts in that language instead of English. Every hand-composed template (BPMN's two scenes, Wardley's two maps, EDGY's four scenes and its metamodel card) gained a `localize` rebuild, mirroring the derived-template mechanism already in place: without a host catalogue every one of them still inserts byte-identical English content. C4's type-line bracket word and technology placeholder, and the dead `AREA_LABEL` in Wardley, are deliberately left English — see this lot's notes. Model defaults (`BpmnPoolElementModel.name`, `C4BoundaryElementModel.name`, `EdgyFacetsElementModel`'s three labels) are untouched; existing documents keep their stored text exactly as before.
