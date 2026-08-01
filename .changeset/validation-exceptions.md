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
- **The whole map, once you have said it twice.** After the same rule has been
  waived somewhere else on the board, the bubble offers "Ignore this rule on
  the whole map". Accepting writes the exception on the framework's own
  background element — the map — so it covers everything that map frames, and
  is just as visible and just as revocable as a local one.
- **Arbitrations survive the framework cycle.** Switching a framework off stops
  evaluation and cleans nothing; switching it back on brings the violations
  back, minus the ones an exception covers. Nothing is ever garbage-collected
  behind the user's back.

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
before and after remain mutually loadable.

Cost is nil on a conformant board: exceptions are only looked up for rules that
actually raised something, so the 16 ms evaluation budget is untouched.
