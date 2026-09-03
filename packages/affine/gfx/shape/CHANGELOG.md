# @labre/affine-gfx-shape

## 0.36.0

### Minor Changes

- 7381b0b: feat(edgeless): the wardley menu draws areas

  The Wardley sub-menu gains a section of its own, **Areas**, and two entries in
  it: **Area (rectangle)** and **Area (polygon)**. A zone you draw around the
  components it groups — a business unit, a team's territory, a scope under
  discussion — and until now an architect had to build one out of a shape, a fill
  with the right alpha, and a trip to "Send to back".

  Each is **one** element: a `wardleyNode` of kind `area`, translucent (Peace
  light at ~25 % opacity, `#c6dbfc40`) under a thin Peace rim, 240 × 160 for the
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
    replaced `#c6dbfc40` with an opaque colour and hid the map underneath. The
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

### Patch Changes

- 1149791: feat(edgeless): the wardley node colour picker offers the cycle swatches

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

- Updated dependencies [9fa662a]
- Updated dependencies [60fb357]
- Updated dependencies [3db21ea]
- Updated dependencies [7381b0b]
- Updated dependencies [f7c5b9b]
  - @labre/affine-components@0.36.0
  - @labre/affine-block-surface@0.36.0
  - @labre/affine-shared@0.36.0
  - @labre/std@0.36.0
  - @labre/affine-model@0.36.0
  - @labre/affine-gfx-connector@0.36.0
  - @labre/affine-gfx-text@0.36.0
  - @labre/affine-rich-text@0.36.0
  - @labre/affine-widget-edgeless-toolbar@0.36.0
  - @labre/affine-ext-loader@0.36.0
  - @labre/global@0.36.0
  - @labre/store@0.36.0

## 0.35.0

### Patch Changes

- Updated dependencies [ea5d249]
- Updated dependencies [e9cd7e1]
- Updated dependencies [de3560d]
- Updated dependencies [7f09608]
- Updated dependencies [ad21e60]
- Updated dependencies [cf0d8a1]
  - @labre/affine-components@0.35.0
  - @labre/affine-block-surface@0.35.0
  - @labre/affine-shared@0.35.0
  - @labre/std@0.35.0
  - @labre/affine-model@0.35.0
  - @labre/affine-gfx-connector@0.35.0
  - @labre/affine-widget-edgeless-toolbar@0.35.0
  - @labre/affine-gfx-text@0.35.0
  - @labre/affine-rich-text@0.35.0
  - @labre/affine-ext-loader@0.35.0
  - @labre/global@0.35.0
  - @labre/store@0.35.0

## 0.34.2

### Patch Changes

- @labre/affine-block-surface@0.34.2
- @labre/affine-components@0.34.2
- @labre/affine-ext-loader@0.34.2
- @labre/affine-gfx-connector@0.34.2
- @labre/affine-gfx-text@0.34.2
- @labre/affine-model@0.34.2
- @labre/affine-rich-text@0.34.2
- @labre/affine-shared@0.34.2
- @labre/affine-widget-edgeless-toolbar@0.34.2
- @labre/global@0.34.2
- @labre/std@0.34.2
- @labre/store@0.34.2

## 0.34.1

### Patch Changes

- Updated dependencies [6120f7a]
- Updated dependencies [cb49bb1]
  - @labre/affine-model@0.34.1
  - @labre/std@0.34.1
  - @labre/affine-block-surface@0.34.1
  - @labre/affine-components@0.34.1
  - @labre/affine-gfx-connector@0.34.1
  - @labre/affine-gfx-text@0.34.1
  - @labre/affine-rich-text@0.34.1
  - @labre/affine-shared@0.34.1
  - @labre/affine-widget-edgeless-toolbar@0.34.1
  - @labre/affine-ext-loader@0.34.1
  - @labre/global@0.34.1
  - @labre/store@0.34.1

## 0.34.0

### Patch Changes

- Updated dependencies [881d3f5]
- Updated dependencies [6c1bdfb]
- Updated dependencies [8b00f7d]
- Updated dependencies [5f76ab3]
- Updated dependencies [f09d68c]
  - @labre/std@0.34.0
  - @labre/affine-shared@0.34.0
  - @labre/affine-block-surface@0.34.0
  - @labre/affine-components@0.34.0
  - @labre/affine-widget-edgeless-toolbar@0.34.0
  - @labre/affine-gfx-connector@0.34.0
  - @labre/affine-gfx-text@0.34.0
  - @labre/affine-model@0.34.0
  - @labre/affine-rich-text@0.34.0
  - @labre/affine-ext-loader@0.34.0
  - @labre/global@0.34.0
  - @labre/store@0.34.0

## 0.33.0

### Patch Changes

- Updated dependencies [3fbf69c]
- Updated dependencies [f929e12]
- Updated dependencies [13360cd]
- Updated dependencies [5c39582]
- Updated dependencies [8890efe]
- Updated dependencies [c03090c]
- Updated dependencies [32e4d45]
- Updated dependencies [139d77b]
- Updated dependencies [6bba40c]
- Updated dependencies [a8325bb]
- Updated dependencies [ff19911]
- Updated dependencies [7aa932c]
- Updated dependencies [b03132c]
- Updated dependencies [48049d6]
- Updated dependencies [7136db0]
- Updated dependencies [932bf35]
- Updated dependencies [5737a56]
- Updated dependencies [168617d]
- Updated dependencies [932bf35]
- Updated dependencies [1dbd735]
- Updated dependencies [9022c92]
- Updated dependencies [b97efc6]
- Updated dependencies [edfaba2]
- Updated dependencies [46ce0c9]
- Updated dependencies [334bd61]
- Updated dependencies [2ec39c0]
- Updated dependencies [a9eb4f6]
- Updated dependencies [e42e0c0]
- Updated dependencies [256ee0b]
- Updated dependencies [4a3b26e]
- Updated dependencies [48c3b52]
- Updated dependencies [6a20738]
- Updated dependencies [f09f9a3]
  - @labre/affine-block-surface@0.33.0
  - @labre/affine-components@0.33.0
  - @labre/affine-shared@0.33.0
  - @labre/affine-model@0.33.0
  - @labre/std@0.33.0
  - @labre/affine-gfx-connector@0.33.0
  - @labre/affine-widget-edgeless-toolbar@0.33.0
  - @labre/affine-gfx-text@0.33.0
  - @labre/affine-rich-text@0.33.0
  - @labre/affine-ext-loader@0.33.0
  - @labre/global@0.33.0
  - @labre/store@0.33.0

## 0.32.0

### Patch Changes

- aa08529: A shape grows while an IME composition is still under way

  Typing Chinese, Japanese or Korean into a shape — a mindmap node above all —
  builds the word in a preedit string that lives only in the DOM until the user
  validates it. Nothing told the shape to remeasure in the meantime, so the word
  being composed ran outside the node it was being typed into, and the node only
  caught up once the composition ended.

  The editor now remeasures once per frame while a composition is in progress, and
  once more when it ends. A mindmap re-places its nodes for that measurement
  without re-applying its style, which used to fit each node back to the text the
  model still held and undo the growth on the spot.

- 6417a2f: A mindmap node wraps instead of stretching across the board

  A node whose text was long grew a single line as wide as the sentence, pushing
  the rest of the branch off screen and making the map unreadable. The four
  mindmap styles now cap their nodes at 512px: past that width the text wraps and
  the node grows downwards. The cap is applied while typing too — the editor
  measures the wrapped text rather than the line it would have drawn, so what is
  being written stays inside the node.

  This is a deliberate change of rendering for documents that already contain
  long nodes. Opening such a document changes nothing: no layout runs on load, so
  the map paints exactly as it was stored. The first layout of the session — the
  first node added, moved, collapsed or edited — is what adopts the cap, and the
  long nodes then re-wrap. Nothing else moves: nodes shorter than 512px are laid
  out exactly as before.

  Shapes other than mindmap nodes are untouched. They carry no maximum width, and
  the editor keeps measuring them the way it always has, so the Grow mode of the
  Wardley, EDGY, DDD and Cynefin shapes behaves identically.

  Also fixes a mindmap that wrote its node positions to the document mid-edit: a
  layout requested while the tree was already stashed used to un-stash it and
  flush every intermediate position into the history.

- d797f9a: Pen and highlighter strokes paint in the DOM, and every canvas element stacks where its layer says

  The DOM renderer knew how to paint shapes and connectors but not brush or
  highlighter strokes, so a board rendered through it lost every pen mark. Both
  strokes now have a DOM renderer of their own, drawing the same path the canvas
  renderer draws.

  Stacking was decided twice and disagreed. Each element renderer set its own
  `z-index` while a canvas layer only ever reserved a single CSS index, however
  many elements it held — so a shape and the note stacked just above it could
  claim the same value and overlap the wrong way round. A canvas layer now
  reserves one index per element, exactly like a block layer, and the `z-index`
  is written once, by the DOM renderer, for every element it paints.

- 9453013: Selection, handles and remote cursors follow their element inside a scaled editor

  An editor embedded in a host that scales it — a synced edgeless doc opened
  inside another document — paints its blocks in the container's already scaled
  space. The overlays drawn over those blocks were instead placed in real screen
  pixels, so the container scaled them a second time: the selection rectangle, the
  resize and element handles, the link chip, the remote cursors and the shape text
  editor all drifted away from the shapes they belong to, and further away with
  every scroll and zoom.

  Every one of them now states its placement the way a block states its own, so
  they sit on their element again. A standalone editor, where the host applies no
  scale, is unaffected.

- 5edd916: A big board stays responsive: the canvas redraws only what changed

  Every element event repainted the whole surface, and every stacking canvas was
  allocated at full viewport size however little of it a layer occupied — on a
  1440x900 screen at device pixel ratio 2 that is about 20 MB of pixel buffer per
  layer, whether the layer held one shape or a hundred. Editing a large map spent
  most of its frame budget in redraws nothing on screen could tell apart.

  A stacking canvas is now sized to the bound of the elements it actually holds,
  clipped to the viewport, and canvases freed by a layer change are pooled for
  reuse instead of being thrown away. A change to one element marks only the
  layer it lives in, so a pan, a zoom or a single edit no longer forces a full
  repaint. During a drag a layer's canvas is allowed to grow but never to shrink,
  so the dragged element does not flicker at the edge of its own canvas; the full
  redraw comes once, when the drag ends.

  The DOM renderers for brush, highlighter, shape and connector now keep the
  nodes they already built and overwrite their attributes, instead of rebuilding
  the whole SVG subtree on every frame — a hundred redraws of one stroke now
  allocate two nodes in total instead of two hundred.

  Alongside: a block host re-reads its stacking order when the layers change, so
  a reorder shows immediately; sending a mindmap node backwards moves the whole
  mindmap once rather than each selected node in turn; and a connector whose path
  is momentarily empty answers its geometry questions instead of throwing.

- Updated dependencies [832c793]
- Updated dependencies [c5c07b9]
- Updated dependencies [a2b7c44]
- Updated dependencies [ff5f060]
- Updated dependencies [1b59f3c]
- Updated dependencies [41ab595]
- Updated dependencies [0bfc872]
- Updated dependencies [8ded589]
- Updated dependencies [9e23b5b]
- Updated dependencies [a3aa598]
- Updated dependencies [90a9168]
- Updated dependencies [6417a2f]
- Updated dependencies [d797f9a]
- Updated dependencies [9fde974]
- Updated dependencies [d360f72]
- Updated dependencies [50ab9ae]
- Updated dependencies [89b90e9]
- Updated dependencies [463989f]
- Updated dependencies [f7f23b2]
- Updated dependencies [751ac44]
- Updated dependencies [54488cd]
- Updated dependencies [9453013]
- Updated dependencies [b746d6b]
- Updated dependencies [b93b43c]
- Updated dependencies [5ac0c68]
- Updated dependencies [630633b]
- Updated dependencies [1fa46c1]
- Updated dependencies [be100e3]
- Updated dependencies [ff3a5f7]
- Updated dependencies [0473dcb]
- Updated dependencies [5b6e9bb]
- Updated dependencies [86e7562]
- Updated dependencies [492bac6]
- Updated dependencies [72b334c]
- Updated dependencies [30580db]
- Updated dependencies [08e9b24]
- Updated dependencies [5076cb8]
- Updated dependencies [3c5c97e]
- Updated dependencies [7c10406]
- Updated dependencies [02797b5]
- Updated dependencies [413fe7b]
- Updated dependencies [724ed1c]
- Updated dependencies [c7612da]
- Updated dependencies [3e1665b]
- Updated dependencies [0ddfd47]
- Updated dependencies [3639562]
- Updated dependencies [5d16745]
- Updated dependencies [1c37478]
- Updated dependencies [48e90f4]
- Updated dependencies [5edd916]
- Updated dependencies [5a16359]
- Updated dependencies [025d6f5]
- Updated dependencies [b1ed4ef]
- Updated dependencies [985a92f]
- Updated dependencies [b889326]
- Updated dependencies [1efc6d5]
- Updated dependencies [4162e4a]
- Updated dependencies [3ac3587]
- Updated dependencies [fad4c08]
- Updated dependencies [7b940cf]
- Updated dependencies [7b66d8d]
- Updated dependencies [184c412]
- Updated dependencies [4bb44ef]
- Updated dependencies [30061cb]
- Updated dependencies [c2735aa]
- Updated dependencies [346b5d9]
- Updated dependencies [77b0100]
- Updated dependencies [8d33c60]
- Updated dependencies [061729e]
- Updated dependencies [7a3458a]
  - @labre/std@0.32.0
  - @labre/affine-shared@0.32.0
  - @labre/store@0.32.0
  - @labre/affine-components@0.32.0
  - @labre/affine-model@0.32.0
  - @labre/affine-gfx-connector@0.32.0
  - @labre/affine-block-surface@0.32.0
  - @labre/affine-gfx-text@0.32.0
  - @labre/global@0.32.0
  - @labre/affine-widget-edgeless-toolbar@0.32.0
  - @labre/affine-rich-text@0.32.0
  - @labre/affine-ext-loader@0.32.0

## 0.31.0

### Patch Changes

- Updated dependencies [6a663b6]
  - @labre/store@0.31.0
  - @labre/affine-block-surface@0.31.0
  - @labre/affine-components@0.31.0
  - @labre/affine-ext-loader@0.31.0
  - @labre/affine-gfx-connector@0.31.0
  - @labre/affine-gfx-text@0.31.0
  - @labre/affine-model@0.31.0
  - @labre/affine-rich-text@0.31.0
  - @labre/affine-shared@0.31.0
  - @labre/std@0.31.0
  - @labre/affine-widget-edgeless-toolbar@0.31.0
  - @labre/global@0.31.0

## 0.30.2

### Patch Changes

- @labre/affine-block-surface@0.30.2
- @labre/affine-components@0.30.2
- @labre/affine-ext-loader@0.30.2
- @labre/affine-gfx-connector@0.30.2
- @labre/affine-gfx-text@0.30.2
- @labre/affine-model@0.30.2
- @labre/affine-rich-text@0.30.2
- @labre/affine-shared@0.30.2
- @labre/affine-widget-edgeless-toolbar@0.30.2
- @labre/global@0.30.2
- @labre/std@0.30.2
- @labre/store@0.30.2

## 0.30.1

### Patch Changes

- @labre/affine-block-surface@0.30.1
- @labre/affine-components@0.30.1
- @labre/affine-ext-loader@0.30.1
- @labre/affine-gfx-connector@0.30.1
- @labre/affine-gfx-text@0.30.1
- @labre/affine-model@0.30.1
- @labre/affine-rich-text@0.30.1
- @labre/affine-shared@0.30.1
- @labre/affine-widget-edgeless-toolbar@0.30.1
- @labre/global@0.30.1
- @labre/std@0.30.1
- @labre/store@0.30.1

## 0.30.0

### Minor Changes

- ecba791: Shape text fit modes: a new `textFitMode` prop on shapes (and polygons)
  chooses how text and bounds reconcile — `grow` (fixed font, the shape grows;
  the previous and default behavior), `contained` (fixed shape, the font size
  shrinks so the text fits — post-it behavior) or `overflow` (fixed shape and
  font; the text may paint past the bounds). Existing documents are untouched:
  the prop reads `grow` via the field fallback. In contained/overflow the
  resize clamp ("cannot shrink below the text") is lifted.

### Patch Changes

- Updated dependencies [9d0fe0c]
- Updated dependencies [ecba791]
- Updated dependencies [8de86f4]
  - @labre/std@0.30.0
  - @labre/affine-model@0.30.0
  - @labre/affine-block-surface@0.30.0
  - @labre/affine-components@0.30.0
  - @labre/affine-gfx-connector@0.30.0
  - @labre/affine-gfx-text@0.30.0
  - @labre/affine-rich-text@0.30.0
  - @labre/affine-shared@0.30.0
  - @labre/affine-widget-edgeless-toolbar@0.30.0
  - @labre/affine-ext-loader@0.30.0
  - @labre/global@0.30.0
  - @labre/store@0.30.0

## 0.29.1

### Patch Changes

- @labre/affine-block-surface@0.29.1
- @labre/affine-components@0.29.1
- @labre/affine-ext-loader@0.29.1
- @labre/affine-gfx-connector@0.29.1
- @labre/affine-gfx-text@0.29.1
- @labre/affine-model@0.29.1
- @labre/affine-rich-text@0.29.1
- @labre/affine-shared@0.29.1
- @labre/affine-widget-edgeless-toolbar@0.29.1
- @labre/global@0.29.1
- @labre/std@0.29.1
- @labre/store@0.29.1

## 0.29.0

### Patch Changes

- Updated dependencies [7375b9a]
- Updated dependencies [9330750]
  - @labre/affine-shared@0.29.0
  - @labre/std@0.29.0
  - @labre/affine-block-surface@0.29.0
  - @labre/affine-components@0.29.0
  - @labre/affine-gfx-connector@0.29.0
  - @labre/affine-gfx-text@0.29.0
  - @labre/affine-rich-text@0.29.0
  - @labre/affine-widget-edgeless-toolbar@0.29.0
  - @labre/affine-model@0.29.0
  - @labre/affine-ext-loader@0.29.0
  - @labre/global@0.29.0
  - @labre/store@0.29.0

## 0.28.0

### Patch Changes

- Updated dependencies [65cc055]
  - @labre/std@0.28.0
  - @labre/affine-block-surface@0.28.0
  - @labre/affine-components@0.28.0
  - @labre/affine-gfx-connector@0.28.0
  - @labre/affine-gfx-text@0.28.0
  - @labre/affine-model@0.28.0
  - @labre/affine-rich-text@0.28.0
  - @labre/affine-shared@0.28.0
  - @labre/affine-widget-edgeless-toolbar@0.28.0
  - @labre/affine-ext-loader@0.28.0
  - @labre/global@0.28.0
  - @labre/store@0.28.0

## 0.27.0

### Patch Changes

- Updated dependencies [91f6397]
  - @labre/std@0.27.0
  - @labre/affine-block-surface@0.27.0
  - @labre/affine-components@0.27.0
  - @labre/affine-gfx-connector@0.27.0
  - @labre/affine-gfx-text@0.27.0
  - @labre/affine-model@0.27.0
  - @labre/affine-rich-text@0.27.0
  - @labre/affine-shared@0.27.0
  - @labre/affine-widget-edgeless-toolbar@0.27.0
  - @labre/affine-ext-loader@0.27.0
  - @labre/global@0.27.0
  - @labre/store@0.27.0

## 0.26.0

### Patch Changes

- Updated dependencies [8960a6c]
- Updated dependencies [6795191]
  - @labre/affine-model@0.26.0
  - @labre/affine-components@0.26.0
  - @labre/affine-block-surface@0.26.0
  - @labre/affine-gfx-connector@0.26.0
  - @labre/affine-gfx-text@0.26.0
  - @labre/affine-rich-text@0.26.0
  - @labre/affine-shared@0.26.0
  - @labre/affine-widget-edgeless-toolbar@0.26.0
  - @labre/affine-ext-loader@0.26.0
  - @labre/global@0.26.0
  - @labre/std@0.26.0
  - @labre/store@0.26.0

## 0.25.0

### Patch Changes

- Updated dependencies [8960a6c]
- Updated dependencies [6795191]
  - @labre/affine-model@0.25.0
  - @labre/affine-components@0.25.0
  - @labre/affine-block-surface@0.25.0
  - @labre/affine-gfx-connector@0.25.0
  - @labre/affine-gfx-text@0.25.0
  - @labre/affine-rich-text@0.25.0
  - @labre/affine-shared@0.25.0
  - @labre/affine-widget-edgeless-toolbar@0.25.0
  - @labre/affine-ext-loader@0.25.0
  - @labre/global@0.25.0
  - @labre/std@0.25.0
  - @labre/store@0.25.0

## 0.24.0

### Patch Changes

- @labre/affine-block-surface@0.24.0
- @labre/affine-components@0.24.0
- @labre/affine-ext-loader@0.24.0
- @labre/affine-gfx-connector@0.24.0
- @labre/affine-gfx-text@0.24.0
- @labre/affine-model@0.24.0
- @labre/affine-rich-text@0.24.0
- @labre/affine-shared@0.24.0
- @labre/affine-widget-edgeless-toolbar@0.24.0
- @labre/global@0.24.0
- @labre/std@0.24.0
- @labre/store@0.24.0

## 0.23.3

### Patch Changes

- Updated dependencies
  - @labre/affine-shared@0.23.3
  - @labre/affine-block-surface@0.23.3
  - @labre/affine-components@0.23.3
  - @labre/affine-gfx-connector@0.23.3
  - @labre/affine-gfx-text@0.23.3
  - @labre/affine-rich-text@0.23.3
  - @labre/affine-widget-edgeless-toolbar@0.23.3
  - @labre/affine-ext-loader@0.23.3
  - @labre/affine-model@0.23.3
  - @labre/global@0.23.3
  - @labre/std@0.23.3
  - @labre/store@0.23.3

## 0.23.2

### Patch Changes

- Updated dependencies [ee682da]
  - @labre/affine-shared@0.23.2
  - @labre/affine-block-surface@0.23.2
  - @labre/affine-components@0.23.2
  - @labre/affine-gfx-connector@0.23.2
  - @labre/affine-gfx-text@0.23.2
  - @labre/affine-rich-text@0.23.2
  - @labre/affine-widget-edgeless-toolbar@0.23.2
  - @labre/affine-ext-loader@0.23.2
  - @labre/affine-model@0.23.2
  - @labre/global@0.23.2
  - @labre/std@0.23.2
  - @labre/store@0.23.2

## 0.23.1

### Patch Changes

- Updated dependencies [1beb60e]
  - @labre/affine-shared@0.23.1
  - @labre/affine-block-surface@0.23.1
  - @labre/affine-components@0.23.1
  - @labre/affine-gfx-connector@0.23.1
  - @labre/affine-gfx-text@0.23.1
  - @labre/affine-rich-text@0.23.1
  - @labre/affine-widget-edgeless-toolbar@0.23.1
  - @labre/affine-ext-loader@0.23.1
  - @labre/affine-model@0.23.1
  - @labre/global@0.23.1
  - @labre/std@0.23.1
  - @labre/store@0.23.1

## 0.23.0

### Patch Changes

- Updated dependencies [9014c87]
- Updated dependencies [c775151]
- Updated dependencies [d2f435f]
  - @labre/affine-model@0.23.0
  - @labre/affine-block-surface@0.23.0
  - @labre/affine-shared@0.23.0
  - @labre/affine-widget-edgeless-toolbar@0.23.0
  - @labre/affine-components@0.23.0
  - @labre/affine-gfx-connector@0.23.0
  - @labre/affine-gfx-text@0.23.0
  - @labre/affine-rich-text@0.23.0
  - @labre/affine-ext-loader@0.23.0
  - @labre/global@0.23.0
  - @labre/std@0.23.0
  - @labre/store@0.23.0
