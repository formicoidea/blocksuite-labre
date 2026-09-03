---
'@labre/affine-gfx-wardley': minor
'@labre/affine-gfx-shape': minor
'@labre/affine-model': patch
---

feat(edgeless): the wardley menu draws areas

The Wardley sub-menu gains a section of its own, **Areas**, and two entries in
it: **Area (rectangle)** and **Area (polygon)**. A zone you draw around the
components it groups — a business unit, a team's territory, a scope under
discussion — and until now an architect had to build one out of a shape, a fill
with the right alpha, and a trip to "Send to back".

Each is **one** element: a `wardleyNode` of kind `area`, translucent (Peace
light at ~60 % opacity, `#c6dbfc99`) under a thin Peace rim, 240 × 160 for the
rectangle and 200 × 200 for the polygon. **One kind, two shapes**: the
`shapeType` carries the whole of what differs between them, so there is one
role, one legend row and one silence in the export rather than two of each. The
polygon opens on the editor's own default outline — a regular pentagon, copied
fresh into the document — and its corners are then moved from the shape
toolbar's vertex editor, which is the point of choosing it over the rectangle.

**The name is the zone's own inner text.** Every other Wardley artefact wears
its name as a text element beside it; a label parked outside a boundary would
name whatever else happens to be there. So an area is created NAMELESS, a
double-click opens the native shape editor on an empty line
(`WardleyNodeView`'s handler, which until now served only the porter's letter),
and the words are written top-left in `TextFitMode.Overflow` — a zone is a
boundary drawn around real components, and a long name must never push it out
and swallow one the author did not mean to include. It is also why this is the
plainest creation site in the pack: one element and no group.

**It is lowered as it is drawn — to just above the map.** The surface paints in
index order, so a zone added after the components it covers would sit on top of
them: a wash over the drawing, and every click meant for a component inside it
eaten by the zone. But "the back of the surface" is one step too far, because a
Wardley map is itself an opaque framework BACKGROUND — a zone sent all the way
back went behind the map and was invisible. So the creation site mints an index
just above the topmost framework background the zone actually OVERLAPS, and
below everything else; with no background under it, the back of the surface is
right again. The author can raise it by hand; what this buys is that the first
thing they do after drawing a zone is not un-doing it.

**`wardley:area` has no parent**, and that is the whole declaration rather than
an omission. A zone is not a link in the value chain at any grain, and it is
drawn precisely ON TOP of the components it names — so a parent of
`wardley:component` would make W3 report an overlap on every area that does its
job. Covering the chain is what a zone IS.

The **map legend** grows a row when one stands inside the map — "Area (zone of
the map)" — drawn as a small translucent rect whatever the map's own zones are:
the row says what a zone is, and the number of corners is the author's choice
rather than notation.

**The OWM export says what it could not write.** OWM has no word for a zone of
the map, so an area is skipped — before `nameOf` is asked, so a nameless zone is
never christened "Component 3" and never counted among the artefacts that lost a
name — and the export warns: "N area(s) could not be written: OWM has no word
for a zone of the map". It is also excluded from label matching, which is the
failure a zone could cause and a force could not: an area's box sits next to
every label on the map, and one it claimed would be a name taken out of another
artefact's mouth and then thrown away.

**The toolbar** keeps what a Wardley node has always kept — the line-style
action and the colour picker seeded with the evolution-cycle swatches — plus the
shape toolbar's vertex editor, narrowed to `kind === 'area'`. Every other
polygon this framework draws has an outline that IS the notation (an accelerator
points right, a decelerator left), and dragging a barb would turn a statement
about the climate into a grey blob.

Making that button actually work took two small openings in
`@labre/affine-gfx-shape`, both additive and both defaulting to today's
behaviour:

- **`WardleyNodeView` now extends `ShapeElementView`.** The vertex action ends
  in `if (view instanceof ShapeElementView) view.enterVertexEditingMode()`, so
  while the Wardley view extended `GfxElementModelView` directly the entry was
  on the row, enabled, and did nothing at all when clicked. `ShapeElementView`
  is now generic over its model, defaulting to `ShapeElementModel` so every
  existing call site is unchanged, and it exposes two
  protected hooks — `editsTextOnDblClick()` and `editsVerticesOnSelection()`,
  both `true` by default — for a framework node that inherits the vertex editor
  but not the "every shape is a box you write in" wiring beside it. Wardley
  answers the first with its porter/area gate and the second with
  `kind === 'area'`.
- **`paletteColorAction` takes an optional `fillColorFor` hook.** A picked
  swatch is a hue, and a zone's fill is a WASH: writing `#5b9cf6` straight in
  replaced `#c6dbfc99` with an opaque colour and hid the map underneath. The
  Wardley toolbar passes a hook that re-appends the zone's alpha for an area and
  is the identity everywhere else — including on an 8-digit value the author
  chose from the custom picker, and on a theme token, neither of which it
  touches. EDGY and every other caller pass two arguments and are unaffected.

Both entries nominate the sub-menu, like every Wardley artefact since the
product owner's amendment of 2026-09-03 to ADR 0014 R4. The row is unchanged —
thirteen arbitrated seats plus "More artefacts…" — and the catalogue lists
everything, now under one more heading.

**No document changes.** `WardleyNodeKind` gains `'area'` by appending, which is
how every value on it has ever arrived: a map drawn before this release carries
none and opens byte-identical. No schema bump, no migration.
