---
'@labre/affine-gfx-wardley': minor
'@labre/affine-gfx-shape': patch
'@labre/affine-gfx-edgy': patch
---

feat(edgeless): the wardley node colour picker offers the cycle swatches

Selecting a Wardley artefact used to open the editor's historical palette —
twenty hues that say nothing on a map, and none of the three the notation
actually thinks in. Colouring a component by where it sits in the evolution
cycle meant reaching for the custom picker and typing a hex, once per node,
with nothing to keep two maps agreeing on what "War" looks like.

The picker now leads with the cycle itself: **Wonder**, **Peace**, **War**
(Simon Wardley's climatic pattern), saturated first and then in a light shade
for a fill that has to sit under a label, followed by the three colours the map
already draws with — the evolution arrow's red, the inertia bar's near-black,
and a method's neutral grey. After them come the neutrals of the default
palette, which every drawing needs and no notation owns; the legacy editor
colours are gone. They are shortcuts, never constraints: no rule reads a node's
colour, and the custom picker is still one click away.

EDGY has had exactly this for its own facets, so the ~100 lines that wire the
shape colour picker to a framework's swatches move into the shape package as
`paletteColorAction(id, palettes)` (plus `neutralPalettes()`, the filter both
lists end with). EDGY now calls the factory and keeps only its swatch list —
same behaviour, said once — and the next framework that wants its palette in
front of the picker declares an array instead of copying a file.
