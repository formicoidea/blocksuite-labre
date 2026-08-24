---
'@labre/affine-block-surface': patch
---

fix(edgeless): the bubble reads, the link is marked where it is, and the panel says who is speaking

Three things the PO sent back from the 02/08 recette. None of them changes what
is evaluated, when, or what is written to the document — all three are about a
surface that was telling the truth in a way nobody could read.

**The detail bubble could not be read.** It opened UNDERNEATH the element
toolbar, and the wheel over it panned the board instead of scrolling it — which
closed it, on `viewportUpdated`, at exactly the length where reading mattered.
Both halves had one cause and one fix each:

- while a bubble is open, the widget HOST is raised above the popover level (a
  z-index of its own makes the host a stacking context, so the bubble can never
  climb out of it on its own) and drops straight back to the badge's level when
  it closes;
- while a bubble is open, the CANVAS does not take the wheel. One capture-phase
  listener on the editor host stops the event before any bubble-phase handler
  sees it — the edgeless wheel handler included, which used to `preventDefault`
  the scroll on its way past. Nothing is cancelled, so the browser still
  scrolls the bubble; nothing is registered on `document`, so the page outside
  the editor keeps its wheel; nothing happens at all while no bubble is open.
  The board is frozen wherever the pointer is, and one click anywhere gives it
  back — the PO's call, and the only one that survives a bubble the user is
  halfway through.

**A link was badged on a corner of its bounding box.** For a diagonal
connector that corner is a point on empty paper, a long way from the trait
being accused. Anchors now carry a `kind`: a `node` keeps its top-right corner,
an `edge` is marked in the MIDDLE of the link — the midpoint of the drawn path
by arc length (so an elbowed connector is marked halfway along what the eye
follows, not at its bend), falling back to the intersection of the bounding
rectangle's diagonals for an edge the layout has not routed. An anchor is an
edge because its ROLE says so (`kind: 'edge'`) or because its GEOMETRY does (it
exposes a path), so a generalist connector carrying no role is marked correctly
too. The point is computed once, in `resolveViolationAnchors`, where it can be
asserted as a coordinate.

**The Map quality panel appeared to contradict itself**: "Nothing to report"
over a map wearing amber badges, with no title and no legend. Three different
things live on that surface and the panel never said which was speaking. It
does now, without moving a single boundary between them:

- the checklist is introduced as "To be checked by you" — the tool does not
  judge a nudge, and ticking is still assuming;
- the check-up names the rule FAMILIES it walked ("Check-up (tones,
  nomenclature):"), so its verdict is about something rather than about
  everything;
- a read-only context line counts the real-time findings on THIS map, narrowed
  on `backgroundId` exactly as a check-up is, so the badges on the canvas are
  accounted for in the panel instead of being silently denied by it.

Every one of those strings is an i18n key with a library fallback, like the
rest of the panel; rule wording still comes from the framework and the host
catalogue still wins over both. The panel's rows now share one fixed gutter for
the checkboxes, so the lines that have no box no longer hang a checkbox-width
to the left of the ones that do.
