---
'@labre/affine-block-surface': minor
'@labre/affine-shared': minor
'@labre/std': minor
---

feat(edgeless): no rule is a wall — validation exceptions (PF8)

A rule that cannot be waived is a wall, and a whiteboard with walls stops being
a thinking tool. Every violation now carries its own way out, on the message
that reports it.

- **One click, on the bubble.** Each rule named in the violation bubble carries
  an "Ignore this validation rule" action. No detour through a settings panel,
  and no waiting: the gesture applies immediately.
- **The exception is written on the element.** It lands in the document as
  `{ ruleId, author?, at }`, on the elements the rule actually indicts — so it
  says nothing about the next component, and nothing about the next rule. It
  rides along on a copy, a duplicate, a "turn into linked doc" and an export,
  and it dies with the element it belongs to.
- **The finding changes state, it does not vanish.** An excused violation is
  still reported: it drops out of the flash and the bracket and its badge goes
  grey, but it keeps its line in the bubble, now reading "exception" and
  carrying a **Revoke** that puts it straight back. A board can never hide an
  arbitration it was told to make.
- **One map, once you have said it twice.** After the same rule has been waived
  somewhere else on the board, the bubble offers "Ignore this rule on the whole
  map". Accepting writes the exception on the framework's own background
  element — and on THAT one only. A violation of `element-in-background` now
  records the background it is attributed to: since no background contained the
  element (that is what the violation says), it is the NEAREST one, by
  edge-to-edge gap, with exact ties broken by the smaller id so the answer never
  depends on the order the surface was walked in. A board carrying three maps
  therefore holds three independent arbitrations: waiving a rule on one says
  nothing about the map beside it, and deleting a map takes exactly its own
  arbitration with it. Map scope is just as visible and just as revocable as a
  local one.
- **Arbitrations survive the framework cycle.** Switching a framework off stops
  evaluation and cleans nothing; switching it back on brings the violations
  back, minus the ones an exception covers. Nothing is ever garbage-collected
  behind the user's back.
- **And it can always be undone.** `validationExceptions` is the first prop
  whose normal life includes being REMOVED — undoing a waiver deletes the key —
  and a Y.Map delete reports only `oldValues`. Both re-evaluation guards now
  read it, so an undo brings the live violation straight back instead of
  freezing the board on a stale verdict behind a dead Revoke button.

Two new telemetry events, `ValidationExceptionGranted` and
`ValidationExceptionRevoked`, carry the rule id, the framework, the scope and
how many elements one gesture touched — never board content. A rule waived on
every board is a rule that is wrong, and this is the only place that says so.

**Persistence.** One new optional `@field()` on the base element model,
`validationExceptions`. Declared on the BASE class, exactly like `role` before
it, because an element re-created from props only reaches the Y.Map through
declared accessors and a per-subclass declaration would be silently dropped on
copy. Its default is `undefined` and is never written, so an element that never
got an exception stays byte-identical to one created before the field existed:
no block schema change, no version bump, no migration, and documents written
before and after remain mutually loadable. Revoking the last exception removes
the KEY rather than assigning `undefined`, which the `@field()` setter would
have written into the Y.Map — so an element whose exceptions were all revoked
is byte-identical again too, in the document and not merely through the getter.
`GfxPrimitiveElementModel.clearField` is the counterpart `@field()` was missing.
It removes DECLARED, non-structural fields only: an undeclared key (an
annotation preserved verbatim for a newer client) and the fields nothing can
cope without (`index`, `seed`, `xywh`) are refused with a warning, so a new
delete path into the document cannot undo what the unknown-props deny-list
protects.

A conformant board pays nothing: exceptions are only looked up for a rule that
actually raised something. On the 500-element reference map, where half the
population is in violation, the 16 ms budget still has roughly seventy times the
headroom it needs.
