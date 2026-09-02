---
'@labre/affine-gfx-wardley': minor
---

feat(edgeless): wardley components morph into their neighbours

A selected Wardley artefact now carries the **Change type** dropdown its BPMN
and C4 cousins already have. One family, the four ways of saying "the value
chain depends on this": **component**, **market**, **ecosystem**, **pipeline**.
Realising halfway through a map that what you drew is a market of many
suppliers, or a whole ecosystem, used to cost a delete, a re-draw, every
dependency re-attached and the name typed again.

Unlike BPMN and C4, a Wardley morph rebuilds the artefact's **glyph**, because
on this notation the glyph is the meaning: a market arrives with the three dots
and the triangle that make it one, a pipeline arrives with the handle it is
connected through, and both are taken away again on the way out. The
dependencies and evolution arrows already attached follow — a link drawn to a
component moves onto the handle when it becomes a pipeline, and back to the body
when it stops being one. All of it is a single undo step.

Two deliberate departures, both PO decisions:

- **The size is the notation, so the morph applies it.** A market left at a
  component's 18 pixels is an unreadable smudge; the target's canonical size is
  written, CENTRED on where the artefact already stands, so it does not move.
  BPMN and C4 keep the user's box, where a size is only a preference.
- **The handle lands flat** in the artefact's group, where a pipeline drawn from
  the sub-menu nests it with the label. Nothing reads that nesting, and the
  reverse morph flattens a drawn one the same way.

The **anchor** and the **method** are offered neither way: an anchor is what the
value chain hangs from rather than a link in it, and a method's fill encodes a
decision a morph would silently discard. The label is the author's — the only
string rewritten is a placeholder nobody has typed over.

Wardley's creation presets move to `presets.ts` and are exported, so the palette
and the morph read one description of what a market looks like. `wardley` gates
the menu only: a map drawn while the flag was on keeps every element, every role
and every rule when it goes off.
