---
'@labre/affine-gfx-c4': patch
---

every C4 rule declares its provenance, and none of them claims a standard

The eleven C4 rules join the frameworks annotated in the provenance work: each
now says where its authority comes from, so the violation bubble can print a
citation the reader can weigh instead of leaving them to guess whether the tool
is quoting the method or the house.

The split is six `recommendation` and five `labre-convention`, and **`standard`
appears nowhere**. That is the distinguishing fact about this pack rather than an
omission: C4 has no published specification to cite a clause of. What it has is
Simon Brown's diagram review checklist, which is a recommendation however widely
it is followed — so the six rules that read it name the method, the way the
Wardley and Context Mapping packs name theirs.

The five that are the editor's own say so in the citation itself: a plain
connector the model never recorded, a relationship looping onto its own element,
a component outside every boundary, a data store that calls somebody, a person
drawn inside a boundary. Three of those five are still promoted to warnings by
the Review checklist profile, which is the point worth keeping: where a rule's
authority comes from and how hard it bites are separate questions, and what
decides the second is whether the diagram might honestly have meant it.
