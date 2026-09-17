---
'@labre/affine-gfx-uml': minor
'@labre/affine': minor
---

feat(edgeless): UML 2.5.1 pack, phase 1

A ninth business framework on the edgeless senior row: **UML**, covering the
four structural diagrams a transformation architect draws by hand — class,
package, object and use case.

What it puts on the canvas: a diagram frame with the cut-corner name tag and a
kind picker (class / package / object / use case), a subject frame for the use
cases one system offers, and ten artefacts — class, interface, enumeration,
object, package, note, actor, use case — each arriving as its shape and its own
compartments rather than as a box to type into. Nine typed relationships:
association, aggregation, composition, generalization, realization, dependency,
anchor, include and extend, each drawn with the endpoint UML gives it.

What it can hand you: the selected diagram as **PlantUML** source, or as **XMI
2.5.1** — the OMG's own interchange format, read by every UML tool. Both are
semantic-tier capabilities (`docs/adr/0012`): the attributes and operations you
typed are parsed and written as model, not as a picture of one.

Flag-gated like every framework (`uml`, ADR 0009): switching it off removes the
toolbar button, its menu, the templates shelf and the exports. A diagram already
drawn keeps painting, stays selectable and stays editable.
