---
'@labre/affine-gfx-wardley': minor
'@labre/affine-model': patch
---

feat(edgeless): the wardley menu draws Porter's forces

The Wardley sub-menu gains a fourteenth artefact: **Porter's forces**, a white
circle carrying one letter, pushed on from north, east, south and west by four
solid red arrows. It marks a force of EXTERNAL competition bearing on the map —
the thing a value chain is drawn under pressure from, and until now the one
thing an architect had to draw by hand out of a shape and four connectors.

**The letter is the notation**, not a name: **R** relative competition, **L**
struggle for survival, **E** struggle to establish. It is written as the
circle's OWN inner text rather than as a label beside it, so a double-click
opens the native shape editor on it and typing another letter is the whole of
the edit. The circle never grows to fit what is typed — the glyph has a
canonical size that says "external force" at a glance, so it keeps it the way
the inertia bar keeps its own.

Three deliberate calls, all of them about the same fact — a force is not part of
the map it presses on:

- **`wardley:porter` has no parent.** A market and an ecosystem specialise
  `wardley:component` because they ARE links in the value chain drawn at another
  grain. This one is not a link in it at all, so no rule written on
  `wardley:component` may ever reach it — W3's overlap pairs above all. A force
  sitting on top of the components it presses against is what pressing against
  them looks like.
- **No label, and no empty string standing in for one.** The label table's key
  type is narrowed to the kinds that HAVE one, because an empty placeholder is a
  name nobody has typed yet, which is precisely what the morph is allowed to
  rewrite.
- **The four arrows are the glyph's own wiring**, exactly as the market's
  triangle is: free at both ends and role-less, so a resize cannot drag them out
  of square and no composite reports an overlap with itself. Solid where an
  evolution arrow is dashed — the two share a red and must not be mistaken for
  one another. The geometry is one exported helper, so the palette, the map
  legend and the tests read the same numbers.

It joins **no morph family**: "Change type" is the four ways of saying the value
chain depends on something, and a force is not one of them.

The **map legend** grows a row for it when a force stands inside the map, glyph
and letter included, spelling out what the three letters mean. The **OWM export**
cannot write it: the format has no word for an external competition force, so
the node is left out and the export says so in its warnings, beside the losses
it already reports. It is skipped before names are resolved, so a force is never
christened "Component 3" and never takes a label out of a neighbour's mouth.

`addPorter` ships **keyless** and nominates the senior row, which takes Wardley
to fifteen nominations — `SENIOR_MENU_CAP + 1`, exactly the budget ADR 0014 R4
allows and the last seat available. A sixteenth is a curation decision for the
product owner, and `registry.unit.spec.ts` fails until it is made.

**No document changes.** `WardleyNodeKind` gains `'porter'` by appending, which
is how every value on it has ever arrived: a map drawn before this release
carries none of them and opens byte-identical. No schema bump, no migration.
