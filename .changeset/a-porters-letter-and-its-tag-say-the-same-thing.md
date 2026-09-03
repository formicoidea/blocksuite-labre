---
'@labre/affine-gfx-wardley': minor
---

feat(edgeless): a porter's letter and its competition tag say the same thing

A Porter's-forces glyph now carries a **Competition** qualification —
`wardley:competition`, with three values: _Relative competition (R)_, _Struggle
for survival (L)_, _Struggle to establish (E)_ — and the letter drawn in the
circle and the value written on it are kept saying the same thing, in both
directions.

**Why both exist.** The letter is the NOTATION: an architect reads `L` off the
map and knows what it says, and typing another letter is the whole of the edit.
The tag is the FACT: nothing — no rule, no reading, no host report — can ask
"which forces does this map name?" of a `Y.Text` holding one character. Dropping
either would cost something real, so neither is the master. Whichever one the
author is looking at is the one they may change, and `WardleyPorterWatcher`
makes the other follow.

- **Pick a force from "Qualify"** and the circle is redrawn with its letter. One
  click on the composite the sub-menu draws reaches the dropdown, because only
  the circle carries `wardley:porter` — the four arrows are the glyph's own
  wiring and carry nothing.
- **Type a letter into the circle** and the glyph is qualified as it is typed.
  `r`, `l`, `E` all land; `X`, `RL` and an emptied circle clear the tag rather
  than picking the nearest value — a glyph nobody can read must not be reported
  as a force somebody named.
- **Clearing the tag leaves the drawing alone.** Un-picking a value is a
  statement about the qualification — "I no longer claim which force this is" —
  and not about a map somebody is still reading.

The two are not symmetric, and that is the design rather than an omission: the
letter is what the author writes, and **the tag is a reading of it**, recomputed
after every local change of the text and written with an origin the undo manager
ignores. So `tag = f(text)` holds at every instant history passes through, and
the undo stack holds the author's own keystrokes and nothing else. A menu pick —
the one gesture that starts from the tag — redraws the letter inside the very
transaction the pick opened, so it still costs exactly one undo entry, redrawing
included. The redraw compares the two semantically (a circle reading `e` already
says "struggle to establish") and never runs while somebody has their caret in
the circle, which is `C4TypeLineWatcher`'s lesson.

The tag rides on the **same `wardley-core` pack** the natures do, and applies to
`wardley:porter` alone. That is the mechanism paying for itself: a force is not
a link in the value chain, so nothing declared on `wardley:component` reaches it
and nothing declared here reaches a component — and a client's private tag is
still a second pack that merges with both, with no library release.

The **map legend** grows a **Porter's five forces** panel under its rows when a
force stands inside the map: the four named pressures around a small glyph of
the notation itself, and the three letters spelled out underneath. It is drawn
only when a force is present, so a legend of a map without one is byte-identical
to the one it produced before.

The watcher is registered **always-on** (`docs/adr/0009`): it creates no
element, offers no button and adds no artefact — it keeps an element already in
the document coherent with itself, which a map drawn while the Wardley button
was on must stay when the button goes off.

**No document changes.** `tags` is the field ADR 0007 already declared, and a
glyph nobody qualifies writes no key at all.
