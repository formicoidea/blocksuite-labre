---
'@labre/affine-gfx-bpmn': patch
---

BPMN validation rules: 21 spec-cited rules, sketch/descriptive profiles, reference corpus

A BPMN process is now checked against the notation it claims to follow.
Twenty-one rules, every one citing the page of BPMN 2.0.2 (ISO/IEC 19510) it
reads: what a sequence flow, a message flow and an association may run between;
how many flows may reach a start event, an end event, a step or a gateway;
whether a flow stays inside its pool or crosses between two; whether a pool that
says where it ends also says where it begins; whether every step can be reached;
and whether the steps are named at all.

Five of them are panel-only remarks rather than warnings, because the standard
explicitly sanctions the shape they report — a step that ends a path, a merge or
a split drawn without a gateway — and a warning would be the tool arguing with a
style BPMN allows.

Two levels of requirement ride on the pool element, and selecting a pool now
offers the Validation dropdown that chooses between them: `bpmn.sketch` (the
default, which writes nothing and collects every finding for the panel without
saying a word on the canvas) and `bpmn.descriptive` (the BPMN 2.0 descriptive
conformance posture). Two pools on one board can sit at two levels.

`bpmn:flow-object` joins the role vocabulary as the parent of events, activities
and gateways — the word BPMN itself uses — so a rule says it once where it would
otherwise enumerate three families. Pure static data: nothing is written to a
document and nothing is backfilled.
