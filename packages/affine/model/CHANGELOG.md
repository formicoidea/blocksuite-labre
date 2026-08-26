# @labre/affine-model

## 0.32.0

### Minor Changes

- 5b6e9bb: feat(edgeless): EDGY dynamic template, blank EDGY board and dependency spotlight

  - New "EDGY dynamic" template (template panel + EDGY senior menu): the facets
    background (without writings) with the 12 EDGY elements as prefab nodes,
    linked by the 24 canonical relations of the metamodel, each carrying its
    verb as a native connector label.
  - New blank "EDGY board" background element for free-form EDGY modelling.
  - New modular spotlight-on-hover: backgrounds registered as spotlight hosts
    (`SpotlightHostExtension`) grant the elements laid inside their bounds a
    dependency highlight — hovering a node fades everything but the node, its
    connectors and their endpoints. Enabled for the EDGY facets diagram and the
    EDGY board; other frameworks (e.g. Wardley) can opt in with one line.
  - The facets element gains optional backward-compatible `showPictos`,
    `cropToCircles` and `spotlightEnabled` flags; the board gains
    `spotlightEnabled`. Both background toolbars expose a spotlight toggle.
  - The classic "Enterprise Design facets" diagram (senior menu + template
    panel) is now cropped to the circles plus a facet-label allowance — no
    more dead margins around the Venn. Existing documents keep the previous
    letterboxed rendering (`cropToCircles` defaults to false).
  - Fix: canvas view events (click/dblclick) now route to the TOPMOST view
    under the pointer (paint order), so elements laid on a background stay
    editable — previously the background could swallow the double-click.
  - EDGY template gallery: Customer journey, Service blueprint and
    Organisation chart connectors are now ATTACHED to their elements (they
    follow moves, endpoints clip to edges); the blueprint's diagonal arrows
    no longer render as orthogonal zigzags.

- 5076cb8: feat(edgeless): a declared framework background, and Wardley rebuilt on it (PF2)

  Every framework that needed a background — Wardley, Cynefin, Estuarine, the
  BPMN pool — got one by writing a renderer: two hundred lines of `ctx.fillText`,
  its own hit-testing for editable labels, its own resize gate, its own copy of
  the same four hit-test methods on the model. Four dialects of the same idea,
  and the framework that happened to be written last inherited none of the
  niceties the first one had.

  There is now ONE background, configured by DECLARATION.

  - **The primitive** (`FrameworkBackgroundDef` in `@labre/affine-block-surface`)
    describes a background as data: its **geometry** (reference size, whether the
    proportion is locked, whether the handles are offered, the plot margin), its
    **frame of reference** (named axes, orientation, arrowheads, graduations),
    its **named zones**, and its **chrome** (card, colour washes, and a palette so
    a colour is named once and referenced by name). Not one line of it is a
    function, a class or a closure — same philosophy as the validation rules and
    the role defs, for the same reason: a declaration is comparable,
    serialisable, reviewable by someone who does not read TypeScript, and can one
    day be shipped by a host.
  - **The vocabulary is only as wide as its callers.** Every optional field has a
    named consumer cited in its doc comment — the BPMN pool's free aspect ratio
    and `600` name weight, Estuarine's double-headed energy axis and its Georgia
    italic axis letters. Anything nobody had asked for yet is simply absent: a
    drawn grid, a drawn legend box, tick stubs, per-tick labels, free-floating
    annotations and vertical washes were all written and then cut. They are
    cheap to add back the day a framework needs one, and dead weight until then.
  - **The default is deliberately dull.** A declaration that says nothing but its
    size paints a plain white rectangle: no axis, no zone, no decoration. A new
    framework gets a usable background before it has decided what it looks like.
  - **Labels are vocabulary, not prose.** Each one names an i18n key resolved
    through the house seam (`TranslationProvider`), and optionally a model prop
    holding the user's own wording, which always wins. A key nothing resolves and
    nothing defaults shows the raw key, exactly as everywhere else in the library.
    For that key to be REACHABLE, Wardley's ten label fields now default to
    `undefined` instead of to English: an `undefined` default is written nowhere,
    so a map nobody has renamed carries no label text and falls through to the
    vocabulary. Without a catalogue it reads exactly as it always did — the same
    words in the same places — and the first in-place edit writes the prop and
    wins from then on. The in-place editor opens on the words CURRENTLY DRAWN
    rather than on the raw prop, so a never-renamed label does not offer an empty
    box for a name the user can plainly see.
  - **A broken declaration fails loudly.** A `@name` with no palette entry, or a
    wash colour that cannot carry an alpha, used to produce `transparent` or
    `rgba(NaN,NaN,NaN,…)` — painting nothing and explaining nothing. Both now warn
    once and paint magenta.
  - **One walk, two uses.** The declaration's texts are enumerated once and drive
    both the painting and the double-click hit-testing, so a label can no longer
    be drawn in one place and clicked in another.
  - **The model half** (`FrameworkBackgroundElementModel` in
    `@labre/affine-model`) carries what every background shares: a rotated
    rectangle you drop elements onto, selectable, movable and part of undo/redo,
    but a passive canvas connectors must not snap to.

  **Wardley is the first instance, and the Wardley-specific implementation is
  gone** — renderer, label layout and resize gate alike. Two implementations
  coexisting would have meant Wardley quietly keeping behaviours no other
  framework could have.

  No document is invalidated. The persisted element type is still `wardley` and
  every one of its props keeps its name and its meaning — `variant`, `banded`,
  the ten editable label texts, the six visibility toggles. A map authored before
  this change opens with the same geometry, the same zones and the same words,
  and its snapshot round-trips byte-identical; that is asserted end to end
  against the real assembly points, with every expected coordinate written as a
  literal rather than recomputed from the declaration under test.

  What a map created from now on WRITES is smaller by ten keys: the label texts
  are only persisted once the user actually types one. Reading is unaffected in
  both directions — an old map keeps its ten, a new one falls through to the
  vocabulary — and that is precisely the mechanism optional fields exist for.

  The four gradient variants are still the same curves. They are now TABULATED
  ONCE, at module load, into `[offset, alpha]` stop tables the declaration ships:
  nothing is evaluated at paint time, and a wash is data like everything else.

  Wardley's role, element type, reference size, locked 16:9 proportion and
  resize default now come from the declaration, at the toolbox AND at the
  templates. One pre-existing drift is left alone and now documented: the
  templates lay their nodes out in a plot of their own (`x 70 → 1540`), inset
  further than the plot the declaration actually draws (`x 40 → 1570`). Aligning
  them would move every node of every canned map, which is a visual change to
  shipped content and not this slice's business.

  `wardley:map` is still stamped at creation and `wardley.component-outside-map`
  still frames against it, unchanged.

  Two things the next slice owes. The per-variant creation defaults
  (`BACKGROUND_VARIANT_DEFAULTS`, duplicated in the templates) still write English
  prose into the document for the two value-chain variants, so a map created as
  `opportunity` or `benefit` lands with "Opportunity" / "Benefit" / "Investment"
  already persisted as if the user had typed them: only `classic` and
  `evolution-gradient` are fully localisable today. The fix is to make the variant
  part of the declaration — one axis and end-label set per variant, each naming
  its own key — rather than a bag of prop overrides applied at creation, which
  changes what a variant IS and does not belong here. Both copies carry a TODO.

  Only Wardley is migrated. Cynefin, Estuarine and the BPMN pool keep their own
  renderers for now: the declaration expresses the BPMN pool as it stands, but
  Cynefin and Estuarine are built on hand-traced bezier and arc paths, which the
  vocabulary deliberately does not yet cover. Migrating them means adding a
  path-data layer to the declaration, and that is a slice of its own.

### Patch Changes

- a3aa598: A long code snippet can be folded away

  A pasted stack trace or a whole config file took over the page: the code block
  grew to the height of its content and pushed everything after it below the
  fold, and the only way back was to delete lines.

  The code toolbar now carries a collapse toggle. A folded block shows its first
  eight lines and fades out into its own background; the language preview is
  hidden while it is folded, and unfolding brings both back. The fold is written
  onto the block, so it survives a reload and travels with the document — a block
  that was never folded keeps no such state and loads exactly as before.

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

- 5ac0c68: fix(edgeless): hit-testing a degraded connector (empty path) no longer throws

  Follow-up to the absent-endpoint render fix: a connector whose endpoint
  references a vanished element keeps its last bound, so it stays indexed and
  hoverable — and `getElementByPoint` calls `includesPoint` on every mouse
  move. `includesPoint` (Curve mode), `getNearestPoint`,
  `getPointByOffsetDistance` and `getOffsetDistanceByPoint` now degrade on an
  empty path (miss / element origin / bound center / midpoint) instead of
  throwing. At the source, `getBezierParameters` handles a zero-length path
  the same way it already handled a single point.

  Also: `_getConnectorEndElement` no longer casts away null, and
  `updatePath` skips the redundant `path = []` rewrite (no signal
  notification when the path is already empty).

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
- Updated dependencies [a2b7c44]
- Updated dependencies [0bfc872]
- Updated dependencies [9e23b5b]
- Updated dependencies [d797f9a]
- Updated dependencies [54488cd]
- Updated dependencies [5ac0c68]
- Updated dependencies [1fa46c1]
- Updated dependencies [5b6e9bb]
- Updated dependencies [492bac6]
- Updated dependencies [30580db]
- Updated dependencies [3c5c97e]
- Updated dependencies [02797b5]
- Updated dependencies [413fe7b]
- Updated dependencies [724ed1c]
- Updated dependencies [0ddfd47]
- Updated dependencies [3639562]
- Updated dependencies [48e90f4]
- Updated dependencies [5edd916]
- Updated dependencies [025d6f5]
- Updated dependencies [b889326]
- Updated dependencies [1efc6d5]
- Updated dependencies [4162e4a]
- Updated dependencies [fad4c08]
- Updated dependencies [7b66d8d]
- Updated dependencies [4bb44ef]
- Updated dependencies [8d33c60]
- Updated dependencies [7a3458a]
  - @labre/std@0.32.0
  - @labre/store@0.32.0
  - @labre/global@0.32.0

## 0.31.0

### Patch Changes

- Updated dependencies [6a663b6]
  - @labre/store@0.31.0
  - @labre/std@0.31.0
  - @labre/global@0.31.0

## 0.30.2

### Patch Changes

- @labre/global@0.30.2
- @labre/std@0.30.2
- @labre/store@0.30.2

## 0.30.1

### Patch Changes

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
- Updated dependencies [8de86f4]
  - @labre/std@0.30.0
  - @labre/global@0.30.0
  - @labre/store@0.30.0

## 0.29.1

### Patch Changes

- @labre/global@0.29.1
- @labre/std@0.29.1
- @labre/store@0.29.1

## 0.29.0

### Patch Changes

- Updated dependencies [9330750]
  - @labre/std@0.29.0
  - @labre/global@0.29.0
  - @labre/store@0.29.0

## 0.28.0

### Patch Changes

- Updated dependencies [65cc055]
  - @labre/std@0.28.0
  - @labre/global@0.28.0
  - @labre/store@0.28.0

## 0.27.0

### Patch Changes

- Updated dependencies [91f6397]
  - @labre/std@0.27.0
  - @labre/global@0.27.0
  - @labre/store@0.27.0

## 0.26.0

### Minor Changes

- 8960a6c: feat(database): pluggable DataSource for affine:database (injection seam)

  The inline database block (`affine:database`) always built its own
  `DatabaseBlockDataSource`, so a host app could not back it with an external
  source. This adds a minimal, backward-compatible injection seam:

  - New optional model prop `externalSourceId?: string` (schema version 3 → 4;
    no runtime migration — optional prop with a default).
  - New `DatabaseDataSourceProvider` identifier (exported from
    `@labre/affine-block-database`). When a host registers it **and** the block
    carries an `externalSourceId`, the block renders via the injected source.

  With no provider registered and no `externalSourceId`, behavior is identical to
  before. Persistence stays entirely host-side.

### Patch Changes

- @labre/global@0.26.0
- @labre/std@0.26.0
- @labre/store@0.26.0

## 0.25.0

### Minor Changes

- 8960a6c: feat(database): pluggable DataSource for affine:database (injection seam)

  The inline database block (`affine:database`) always built its own
  `DatabaseBlockDataSource`, so a host app could not back it with an external
  source. This adds a minimal, backward-compatible injection seam:

  - New optional model prop `externalSourceId?: string` (schema version 3 → 4;
    no runtime migration — optional prop with a default).
  - New `DatabaseDataSourceProvider` identifier (exported from
    `@labre/affine-block-database`). When a host registers it **and** the block
    carries an `externalSourceId`, the block renders via the injected source.

  With no provider registered and no `externalSourceId`, behavior is identical to
  before. Persistence stays entirely host-side.

### Patch Changes

- @labre/global@0.25.0
- @labre/std@0.25.0
- @labre/store@0.25.0

## 0.24.0

### Patch Changes

- @labre/global@0.24.0
- @labre/std@0.24.0
- @labre/store@0.24.0

## 0.23.3

### Patch Changes

- @labre/global@0.23.3
- @labre/std@0.23.3
- @labre/store@0.23.3

## 0.23.2

### Patch Changes

- @labre/global@0.23.2
- @labre/std@0.23.2
- @labre/store@0.23.2

## 0.23.1

### Patch Changes

- @labre/global@0.23.1
- @labre/std@0.23.1
- @labre/store@0.23.1

## 0.23.0

### Minor Changes

- 9014c87: Add a BPMN process framework (v1, lean) to the edgeless editor. A new
  `@labre/affine-gfx-bpmn` package adds a senior-toolbar BPMN button whose menu
  drops the core BPMN basics onto the canvas:

  - start event (thin green ring), end event (thick red ring), task (rounded
    rectangle with editable label) and exclusive gateway (diamond with an X) -
    all native shapes (editable stroke / fill / text, native resize);
  - a sequence-flow item that arms the native connector tool pre-styled solid
    with a filled triangle head;
  - a pool background container (rounded-rect frame + editable vertical name
    band), with a resize-lock toggle in its element toolbar.

  Visual style is "hybrid": spec-accurate shapes and line weights with accent
  colour only on the event rings. Wired behind a `bpmn` block flag (ships dark
  until the host enables it). Out of scope for v1: intermediate / parallel /
  inclusive gateways, message & association flows, pool lanes, sub-process, data
  objects and task-type icons.

### Patch Changes

- c775151: Update the Estuarine map background to the latest artwork (reference space
  690×801): darker magenta axes (#941253) with larger arrowheads, the Volatile
  boundary redrawn as an explicit curve (instead of a half-circle arc), refreshed
  Liminal / Counter-factual curves, and letter-spaced legends with their own
  colours (green LIMINAL, red VOLATILE, dark COUNTER FACTUAL, red italic e / t
  axis letters). The per-curve and axis-label toggles are unchanged.
  - @labre/global@0.23.0
  - @labre/std@0.23.0
  - @labre/store@0.23.0
