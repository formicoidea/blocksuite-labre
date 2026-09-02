---
'@labre/affine-gfx-wardley': minor
'@labre/affine-gfx-connector': minor
'@labre/std': minor
---

feat(edgeless): the wardley value-chain link says "needs", in the house blue

The dependency role's English verb was "depends on"; it is now `needs` — one
word, in the user's own vocabulary, on a chip that is laid ALONG the link and
must not outgrow it. The i18n KEY (`com.labre.wardley.role.dependency.verb`) is
untouched, so a host catalogue keeps binding it; the French wording comes from
there.

The chip that shows it is painted `#2563eb`. The colour is declared by the
ROLE (`EdgeDirectionDef.chipColor`, optional) rather than by the reveal
mechanism, so exactly one relation changes: every other framework's typed edge
— BPMN's sequence flow, C4's "uses", the DDD context map's "is upstream of",
and Wardley's own evolution arrow — keeps the affordance blue it had.

Documents are untouched: a chip colour is runtime configuration, and no element
gained or lost a field.
