---
'@labre/affine-gfx-c4': patch
---

C4 diagrams are checked against the official review checklist

Eleven validation rules and two levels of requirement land on the C4 pack, read
off Simon Brown's own diagram review checklist (c4model.com): every element is
named, every relationship carries a label, every arrow is one the model can state
in one direction, and every element earns its place on the sheet.

Six of the eleven restate a question from the checklist. The other five say so in
their own words rather than implying C4 requires them — a relationship looping
onto its own element, a plain connector the model never recorded, a component
outside every boundary, a data store that calls somebody, a person drawn inside a
boundary. Which rules are the notation speaking and which are the editor's house
style is readable rule by rule, and the two never share one id.

The default level is **Sketch** and it argues with nothing — every finding is
collected for the check-up panel and the canvas stays silent, because a C4
diagram is drawn boxes-first, arrows-next, words-last and a tool that brackets an
empty box the moment it appears is a tool switched off within the hour. Choosing
**Review checklist** on a board promotes six rules to warnings and leaves five as
remarks — the three isolation nudges, which report unfinished work rather than a
mistake, and the two house idioms a diagram might honestly have meant.

The board is where the level is chosen, and the only place: a boundary inherits
its board's choice, so the two rules anchored on a boundary harden with the rest
without a second picker to keep in step.

Naming is one rule for all nine artefacts, because an element's name is now the
`c4:title` text of its group. It reports a title an author has **emptied** — never
a freshly dropped node, whose title already carries its kind's own label.
