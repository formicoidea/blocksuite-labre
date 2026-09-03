---
'@labre/affine-gfx-wardley': minor
'@labre/affine-model': patch
---

feat(edgeless): the wardley menu draws accelerators and decelerators

The Wardley sub-menu gains two artefacts: an **accelerator** and a
**decelerator** — a fat arrow pointing right, towards commodity, and its mirror
pointing left, back towards genesis. They are the map's **climate** annotations:
they say nothing about what depends on what, they say how fast the thing beneath
them is moving, and until now an architect had to draw one out of a shape and
some patience.

Each is one native **polygon** (48 × 40) plus a name beside it, grouped. A flat
grey fill under a thick dark rim, which is as close as this canvas gets to the
reference's solid arrow — there is no gradient fill on the surface, and a 1px
border would read as an outline drawing rather than as a solid arrow.

**The direction is the notation**, and three decisions follow from it:

- **Two kinds, two vertex lists, no rotation.** The decelerator's outline is the
  accelerator's mirrored `x → 1 − x`, written out rather than expressed as a
  `rotate`: a rotated element is one the selection, the resize handles and every
  bounding-box reader then have to de-rotate. The outlines are normalized to the
  box, so the same seven points draw a legend row and a canvas arrow.
- **The name follows the shaft.** Every other single Wardley artefact wears its
  name on the right, because a circle has no direction to disagree with. An
  arrow does: the accelerator's name sits on its right, left-aligned, and the
  decelerator's on its left, right-aligned, so the words end against the shaft
  whatever their length and the reading runs into the arrow rather than across
  its head. Both are SemiBold — the one Wardley label that is — because these
  are remarks laid over a map already full of names.
- **`wardley:accelerator` and `wardley:decelerator` have no parent.** Neither is
  a link in the value chain drawn at another grain, so no rule written on
  `wardley:component` may reach them — W3's overlap pairs above all, since an
  accelerator is drawn exactly where the components it accelerates are. Two
  roles and not one with a direction: "this is going faster" and "this is being
  held back" are opposite claims, and a rule about one must never fall on the
  other.

They join **no morph family**, and that had a consequence worth naming: they are
this framework's first polygons, so they are the first kinds to write `vertices`
and `isClosed`. The morph's key union used to be computed over the WHOLE pack,
which would have put those two keys into every morphable kind's delete list —
keys of two shapes nothing may ever morph into. The union is now computed over
the four kinds that actually morph, restated in `presets.ts` (`morph.ts` reads
the presets, so it cannot be read back) with a test asserting the two lists are
the same set.

The **map legend** grows a row for each when one stands inside the map —
"Accelerator (speeds evolution up)" / "Decelerator (slows evolution down)" —
drawn with the map's own outline at the row's scale.

**OWM interchange, both ways.** The export writes them as component-shaped lines
(`accelerator Faster [0.70, 0.40]`), and the decelerator under OWM's own
spelling, `deaccelerator` — not a typo on our side but the keyword the reference
parser claims, so the line opens in any Wardley tool. The import now **draws**
both keywords at the canonical size with their names, where before it carried
them invisibly; the round trip is a fixed point. A document imported before this
change keeps whatever it carried — nothing is migrated, and its carried lines
are still written back verbatim.

**The senior row: a curation decision, made.** Both nominate the sub-menu, which
takes Wardley to seventeen nominations — past ADR 0014 R4's `CAP + 1` budget,
which is exactly the question R4 says must be answered rather than merged. The
product owner answered it on 2026-09-03 (recorded as an amendment under R4):
**every Wardley artefact nominates the row**; the row keeps its cap of fourteen
(thirteen arbitrated seats plus "More artefacts…"), recency and frequency decide
who is shown, and the catalogue lists everything. No curation of the list, no
change to the cap.

**No document changes.** `WardleyNodeKind` gains `'accelerator'` and
`'decelerator'` by appending, which is how every value on it has ever arrived: a
map drawn before this release carries neither and opens byte-identical. No
schema bump, no migration.
