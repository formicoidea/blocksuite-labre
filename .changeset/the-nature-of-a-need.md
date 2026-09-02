---
'@labre/affine-gfx-wardley': minor
'@labre/affine-block-surface': minor
'@labre/affine-gfx-connector': minor
'@labre/affine-shared': minor
'@labre/std': minor
---

feat(edgeless): nature icons and the needs chip on wardley

Two things the PO asked for on the 02/09/2026 recette of the Wardley
framework.

**The Nature dropdown pictures its four choices.** Qualifying a component now
reads at a glance: a gear for **Activity**, a database cylinder for **Data**,
two people for **Practice**, an open book for **Knowledge** — monochrome line
glyphs beside the labels that were there before.

The seam is what matters, because `UniverseTagDefs` is a HOST-extensible data
format that may ship as a `.json` asset: a tag value declares a serializable
`iconKey` and never a template, and the framework registers the drawings under
the same keys with the new `IconTableExtension` — the mechanism a command's
icons already use, resolved with `resolveIconKey`. Both ends are optional, in
both directions: a host pack that names no icon, and a key no registered table
answers (a framework switched off), render exactly as they did before — the
label alone, never a placeholder.

**The value-chain link says "needs", in the house blue.** The dependency role's
English verb was "depends on"; it is now `needs` — one word, in the user's own
vocabulary, on a chip that is laid ALONG the link and must not outgrow it. The
i18n KEY (`com.labre.wardley.role.dependency.verb`) is untouched, so a host
catalogue keeps binding it; the French wording comes from there.

The chip that shows it is painted `#2563eb`. The colour is declared by the
ROLE (`EdgeDirectionDef.chipColor`, optional) rather than by the reveal
mechanism, so exactly one relation changes: every other framework's typed edge
— BPMN's sequence flow, C4's "uses", the DDD context map's "is upstream of",
and Wardley's own evolution arrow — keeps the affordance blue it had.

Documents are untouched by both: an icon key and a chip colour are runtime
configuration, and no element gained or lost a field.
