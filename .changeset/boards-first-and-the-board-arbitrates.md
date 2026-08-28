---
'@labre/affine-block-surface': patch
'@labre/affine-gfx-c4': patch
'@labre/affine': patch
---

feat(edgeless): the senior row and the c4 catalogue follow the boards-first order, and only the board arbitrates the checklist

Three arbitrations from the second recette wave, none of which changes what a
document contains — all three are about the order things are met in, and about
which element a decision is made on.

**The senior row reads in the order the PO asked for.** Left to right: Wardley
Maps, EDGY, Cynefin, BPMN, Event storming, C4, Core Domain Chart, Context
Mapping. Only one button moved — Event storming now sits before C4 — but the
mechanism that decides the row was worth writing down while we were in it. No
framework declares a `SeniorTool.order`, so they all share the default sort
group; `Array.prototype.sort` is stable, so the row is exactly the registration
order of the flag-gated tooling extensions. That order is declared once, in
`FRAMEWORK_DESCRIPTORS`, and a new spec holds `view.ts` to it — along with the
premise it rests on, that nobody has quietly declared an `order` that would make
the sort start mattering. The three DDD frameworks, whose always-on and
flag-gated halves had drifted into two separate blocks, are paired back up like
every other framework, so moving one in the row moves both halves with it.

**The C4 sub-menu leads with the board.** A new house convention, decided on
this pack and stated where the order is declared: for a framework of fourteen
commands or fewer — one whose sub-menu is never arbitrated, so the author's
order is the only order anybody ever sees — boards come first, then the base
components, then the niche ones, and components of the same type stay adjacent.
C4 now reads: the board, then person and person (external), system and system
(external), container, component, then the database, the mobile app and the web
browser, then the relationship, the two boundaries, and the export.

This supersedes the previous order, which led with the four levels and put the
board sixth. That order was built to make the would-be cold start _drawable_;
the PO's answer is that a cold start opening with the sheet is drawable sooner,
and that an external variant belongs next to the plain form it varies rather
than in a trailing ghetto of externals. The artefact catalogue follows: its
first section is now Diagrams rather than Elements.

**Only the board arbitrates the level of requirement.** The Sketch / Review
checklist selector belongs on the C4 board and on nothing else — a boundary is
part of a diagram, not a diagram, and offering the picker twice invited two
answers to one question.

That left a real gap, because two of C4's rules — the homeless component and
the person drawn inside a boundary — frame their question against the
_boundary_, and a finding is judged by the profile of the instance it is
attributed to. Raising a board to its review checklist would have hardened
eleven rules and silently left those two at the sketch level for ever.

So the engine learned the general form of the missing sentence: **a frame that
names no profile inherits the one chosen on the frame it is drawn inside** — the
innermost of them, by the same centre-in-the-frame arithmetic the audit, the
membership families and the C4 export already use to answer "which frame is this
drawn on". A frame that _does_ name one keeps it, so a framework can still offer
a second picker the day it wants one. A frame drawn inside nothing still falls
back to its framework's default. Cross-framework nesting needs no special case:
a profile id belonging to another framework was already ignored, so a frame that
inherits a foreign one lands exactly where it landed before.

It costs nothing on a document whose author never left the default level, which
is most of them: choosing the default back _deletes_ the field, so the engine
still reads no geometry at all unless somebody has actually chosen something.
