---
'@labre/affine': minor
---

A Wardley "component + method" node can now be given a nature and a method from its toolbar, in the same "Qualify" dropdown and with the same labels as a plain component's nature (ADR 0046).

- The role `wardley:method` now specialises `wardley:component`: the method node is offered the `wardley:nature` tag, is read by the reading panel like a component, is measured by the overlap rule (W3) and lights the "Component" legend row, as a market and an ecosystem already did.
- New tag `wardley:method` in the Wardley pack, single-valued, on method nodes only, with nine values: `build`, `buy`, `outsource` (buying policy), `agile`, `lean`, `six-sigma` (project management), `pioneers`, `settlers`, `town-planners` (attitudes).
- The ring follows the method: blue `#2563eb`, green `#16a34a` or amber `#f59e0b` by family, as an outline (uncharted), a 40 % fill (transitional) or a solid fill (industrialized), the wardley-map-renderer's look. Derived at paint time, never written: a method node with no method tag keeps painting its stored fill, so existing maps look as before, and clearing the tag gives the fill back.
- New exports from the Wardley bundle: `WARDLEY_METHOD`, `WARDLEY_METHOD_TAG_ID`, `wardleyMethodOf(category, recommendation)` and `wardleyMethodParts(valueId)` (the renderer JSON pair, both directions), and the types `WardleyMethodFamily`, `WardleyMethodPhase`, `WardleyMethodParts`.
- New translation keys (English fallbacks shipped, French belongs to the host): `com.labre.wardley.tag.method`, `com.labre.wardley.tag.method.description`, and for each of `build`, `buy`, `outsource`, `agile`, `lean`, `six-sigma`, `pioneers`, `settlers`, `town-planners`: `com.labre.wardley.tag.method.<value>` and `com.labre.wardley.tag.method.<value>.description`.
