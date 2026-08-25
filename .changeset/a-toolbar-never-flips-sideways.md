---
'@labre/affine-widget-toolbar': patch
---

fix(edgeless): a toolbar that flips never flips sideways

PO recette of 25/08/2026, third video. The map background's contextual row kept
teleporting between two anchors under zoom while its composition held perfectly
still — a positioner defect, not a fitter one. Measured frame by frame, the row
alternated between the LEFT clamp and the RIGHT clamp of the very same
geometry.

**Why.** `flip()` ran with its defaults, `crossAxis` and `flipAlignment` both
on. On a reference far wider than the screen — the definition of a map
background — every alignment overflows somewhere, so `bestFit` picks between
`-start` and `-end` by a few pixels of margin, and under a zoom that verdict
changes from one frame to the next. `-start` is the left clamp, `-end` the
right one: the teleport, exactly.

**The fix** gives each middleware back its one job. `flip` now answers only
"above or below" — `crossAxis: false, flipAlignment: false` — and horizontal
placement belongs to `shift` alone, which slides instead of teleporting. The
middleware order and the cap semantics (`size` before `shift`: the room at the
ANCHORED position) are untouched. One hardening rides along, taken from the
same measurement trace: a computation that resolves after its loop aborted no
longer writes at all.

New guard in the collapse-stability suite: "the background row never hesitates
between two anchors" — red before the fix, green with it, and mutation-tested
(reverting only the `flip` options turns it red again). The twelve existing
collapse-stability tests pass unchanged.
