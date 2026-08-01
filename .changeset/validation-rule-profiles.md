---
'@labre/affine-block-surface': minor
'@labre/affine-gfx-wardley': minor
'@labre/affine-shared': minor
'@labre/std': minor
---

feat(edgeless): one framework, several levels of requirement (PF9)

A rule used to bite at exactly one strength, decided once by whoever wrote it,
for everybody. That is the wrong shape for a tool where a rough sketch and a
deliverable diagram live on the same canvas: the level of requirement is not a
property of the rule, it is a property of the WORK.

A framework now ships **profiles** — declarative, versioned data, like its
rules, its roles and its background. A profile says, for each rule of its
framework, how hard that rule bites, or that it does not apply at all.

Wardley ships two:

- **Sketch** (the default): the pilot rule drops to `audit`. The finding is
  still reported to `violations$`, so a host panel and a conformance report see
  it — the canvas simply says nothing. Nobody thinking out loud gets
  interrupted.
- **Strict**: the pilot rule bites at `warning`, and the canvas affordance
  (PF7) appears as before. Still never blocking — strict is a level of
  attention, not a wall.

**The choice is per ROOT INSTANCE, not per document** (PF9.1). Two maps on one
board hold two independent levels: a sketch can sit next to a deliverable
without either dictating the other's requirements. The engine reads the profile
off the background a finding was measured against — an id it already recorded.

### What is persisted

One optional flat string, `validationProfile`, declared as a `@field()` on the
element base class — the same place and the same reasoning as `role` (PF1) and
`validationExceptions` (PF8): an element re-created from props only reaches the
Y.Map through declared accessors, so anything declared per subclass is silently
dropped on copy. Duplicating a strict map gives a strict map; an export carries
it; a peer sees it; undo undoes it.

The default writes NOTHING. `undefined` resolves to the framework's default
profile, and choosing the default back again removes the key rather than
writing it — so a map that never left the default is byte-identical to one
created before profiles existed, and one that tried strict and came back leaves
no trace. Optional field, no schema version bump, no migration, no backfill.

### Cost

A rule that is `'off'` under every profile in play is not evaluated at all: the
engine skips it before touching a single element. It is a skipped rule, not a
filter over findings. The default counts as in play unconditionally, so the
short-circuit only fires when the answer cannot change — a missed skip costs a
linear pass, a wrong skip costs a rule that silently stops firing.

Bench, 500-element reference map: 0.141 ms unchanged, 0.275 ms with profiles in
force, 0.032 ms with every rule off, against a 16 ms frame budget. Flag off
still costs one empty-map check.

### Where the choice lives

Select a map and a small chip above its top-left corner names the level in
force and offers the others. It is **not** on the violation bubble, on purpose:
on the permissive default nothing is ever drawn, so a bubble-only selector
would make the strict profile reachable only through a violation the permissive
profile has already silenced — a one-way door. Selection is the one gesture
that is always available. Profile names are i18n keys resolved through the host
catalogue, with the framework's own wording as the fallback.

The chip is derived from the REGISTERED rules (`backgroundRole`), so it is
gated by the framework flag for free: flag off, no rule, no profile offered,
and the id already written on a map simply goes unread until the flag comes
back.

### What it does not touch

Exceptions (PF8). Raising the level does not resurrect a decision the user made,
and lowering it does not quietly delete one — the two are orthogonal, and the
engine reads exceptions last, independently of the profile.

A new typed telemetry event, `ValidationProfileChanged`, carries the framework
and the profile ids and nothing else. A choice that changes nothing is not a
decision and is not reported.

### Behaviour change

A Wardley map now opens on the permissive default, so an off-map component no
longer draws a bracket or a badge until its map is put on **Strict**. That is
the point — the sketch wins — but it does mean the PF7/PF8 canvas affordance is
opt-in per map from here on.
