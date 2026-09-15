---
'@labre/affine-block-surface': minor
'@labre/affine-gfx-uml': minor
---

fix(edgeless): two findings of the UML recette. The imports and exports now sit in their own **Interchange** section at the END of the UML catalogue, where BPMN and Wardley already put theirs — they used to open the panel, filed under "Diagrams" above every artefact the framework draws. `uml.importXmi` keeps its senior-menu nomination and surfaces on the row through use (ADR 0014 § R3) instead of holding a cold-start seat. And **"Read this component" now describes every typed line touching an artefact**, not just one: a reading profile may declare several relation tables (`ReadingProfile.alsoRelations`), so a use case reads its associations, its `«include»` and `«extend»`, a class reads its generalizations, realizations and dependencies, a node its communication paths and an artifact its manifestations. A connector's per-end label (ADR 0020 — a UML multiplicity) is read with the far end's name: "Associated with: OrderLine (1..\*)".
