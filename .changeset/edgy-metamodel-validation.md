---
'@labre/affine-gfx-edgy': minor
---

EDGY boards are now checked against the metamodel

The EDGY artefacts carry a semantic role at last: the four base elements say
which kind they are, the twelve official elements of the metamodel say which
element they are, the facets diagram and the blank board say they are a frame,
and each of the 24 canonical relations carries a role named after its verb —
"expresses", "traverses", "is part of". The verb still travels with the link as
a visible label; the role is what the tool reads.

On top of that vocabulary, two checks appear on a selected EDGY background,
under the Validation dropdown the Wardley map already had:

- **a relation the metamodel does not declare** is reported, read as one
  sentence — source, verb, target. "A journey traverses a channel" is EDGY; the
  same link drawn the other way round is not, and the finding names all three
  elements so either fix is one gesture away.
- **two artefacts on top of each other** are reported, because on a facets
  diagram where an element sits is what says which facet it belongs to.

Both come with the Sketch / Strict profile choice — Sketch is the default and
says nothing on the canvas — and with a four-item work-quality checklist for
the things no algorithm can decide: intersection elements linked to both parent
facets, elements wearing their facet's colour, relations that read correctly,
all three facets explored.

Nothing is backfilled. A board drawn before this release carries no role on
anything, so it is never evaluated and never says a word; only the EDGY dynamic
template and the elements created from the EDGY palette are stamped. The
illustrative templates (customer journey, service blueprint, organisation
chart) stay deliberately neutral drawings.
