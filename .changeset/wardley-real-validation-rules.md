---
'@labre/affine-block-surface': minor
'@labre/affine-gfx-wardley': minor
---

Three generic rule families, and the first three real Wardley rules

The validation engine gained the three families a business framework actually
needs, and Wardley gained the first rules that were asked for rather than
invented to prove the machinery.

**The declaration now answers questions.** A framework background (PF2) already
described its axes and zones so they could be painted; it now exposes them as
evaluation FACTS — which way each axis runs, where one zone ends and the next
begins, in model coordinates for a given instance. Pure data in, pure data out:
a rule reads the frame of reference without the engine owning a registry of
backgrounds or importing a renderer.

**Three families, all declarative.** `orientation-against-axis` confronts a
directional element with the declared sense of an axis, `attachment` requires an
element to be posed on a carrier and optionally at a zone transition, and
`no-overlap` is the first family that is not element-local: it evaluates PAIRS
of declared roles, with each side's geometry following its role's own kind, so
an edge is measured along its path and not by the bounding box of its diagonal.
`no-overlap` supports an incremental pass — a drag re-tests only the couples
involving something that moved, reaches the same verdict as a full one, and is
bounded by it: past the crossover, or when a frame is touched at all, it simply
sweeps.

**Three Wardley rules.** A change arrow may not point against evolution; an
inertia bar belongs on a dependency, at a phase transition; nodes and labels
must not sit on top of each other. Each ships an i18n key and the framework's
own wording as a fallback, so a host with no catalogue reads a sentence instead
of a dotted key — and the library still never invents the wording of somebody
else's rule.

**New role values, no schema change.** Reversing a PF1 decision: the change
arrow, the inertia bar and the artefact labels are no longer neutral, because an
element with no role is never evaluated and these three rules are about exactly
those artefacts. Toolbox and templates write the same values. Documents drawn
before today carry none of them, so they raise nothing — no backfill, no
retro-violation. The market glyph's inner dots went the other way and became
neutral, for the same reason its triangle wiring always was: they are part of a
composite, not artefacts anybody placed.

**The pilot rule is gone.** `wardley.component-outside-map` existed to prove the
engine end to end; parking a node in the margin while you think is normal work.
Every test that exercised the affordance, the exceptions, the profiles and the
budget through it now exercises them through the real rules, in the same commit.

The bench grew a reference map carrying arrows, bars, labels and links, and a
worst-case drag. Both stay far inside one frame.
