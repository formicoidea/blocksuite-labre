---
'@labre/affine-gfx-bpmn': patch
---

BPMN validation rules: 21 spec-cited rules (13 registered), sketch/descriptive profiles, reference corpus

A BPMN process is now checked against the notation it claims to follow. Thirteen
rules ship live — what a sequence flow, a message flow and an association may run
between, how many flows may reach a start or an end event, whether a flow stays
inside its pool or crosses between two, whether every step can be reached from a
start — and every one of them cites the page of BPMN 2.0.2 (ISO/IEC 19510) it
reads. Eight more are authored and wait on engine work.

Two levels of requirement ride on the pool element: `bpmn.sketch` (the default,
which writes nothing and collects every finding for the panel without saying a
word on the canvas) and `bpmn.descriptive` (the BPMN 2.0 descriptive conformance
posture). Two pools on one board can sit at two levels.

`bpmn:flow-object` joins the role vocabulary as the parent of events, activities
and gateways — the word BPMN itself uses — so a rule says it once where it would
otherwise enumerate three families. Pure static data: nothing is written to a
document and nothing is backfilled.
