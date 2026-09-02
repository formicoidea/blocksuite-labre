# @labre/affine-gfx-bpmn

## 0.34.2

### Patch Changes

- @labre/affine-block-surface@0.34.2
- @labre/affine-components@0.34.2
- @labre/affine-ext-loader@0.34.2
- @labre/affine-gfx-connector@0.34.2
- @labre/affine-gfx-group@0.34.2
- @labre/affine-gfx-pointer@0.34.2
- @labre/affine-gfx-shape@0.34.2
- @labre/affine-gfx-template@0.34.2
- @labre/affine-model@0.34.2
- @labre/affine-shared@0.34.2
- @labre/affine-widget-edgeless-toolbar@0.34.2
- @labre/global@0.34.2
- @labre/std@0.34.2
- @labre/store@0.34.2

## 0.34.1

### Patch Changes

- 6120f7a: fix(edgeless): a framework background is picked by its border, not its whole area

  Framework backgrounds and boards hit-tested their entire rectangle, so they
  competed with their own content for every click. A board created after the
  shapes it covers sits above them in the paint order and swallowed 100% of the
  clicks on those shapes; one sitting below filled every gap the content left —
  the interior of an unfilled shape, the space beside a small node — which is
  where the "one time in two" came from. Eleven element types were affected: the
  BPMN pool, both C4 frames, the event-storming board, the core domain chart, the
  Wardley background and the context-map board (subclasses of the
  framework-background primitive), plus the EDGY board, the EDGY facets diagram,
  Cynefin and Estuarine (standalone implementations of the same geometry).

  A background is now selected by a band along its border, ten screen pixels wide
  and adjusted for the zoom like every shape's stroke, with two carve-outs:

  - a **BPMN pool** keeps its title bands clickable — the participant strip on the
    left and the lane strip beside it — which is the bpmn.io convention and the
    only part of a pool that is the pool rather than the process drawn on it;
  - **editable label zones** (Wardley axis titles, EDGY facet names, C4 board and
    boundary names) still receive the double-click that renames them, and a BPMN
    pool's lane separators still receive the drag that moves them. Pointer events
    now reach a view through the VIEW's `includesPoint` rather than the model's —
    it delegates to the model by default, so nothing else changes — which is what
    lets a framework declare its own gesture zones beside the code that draws
    them.

  The lasso (`containsBound` / `intersectsBound`) is untouched, and a selected
  background is still dragged from anywhere inside it: the drag path asks about
  the element's visible extent (`ignoreTransparent: false`), which the interior
  still answers, exactly as an unfilled shape does.

- Updated dependencies [6120f7a]
- Updated dependencies [cb49bb1]
  - @labre/affine-model@0.34.1
  - @labre/std@0.34.1
  - @labre/affine-block-surface@0.34.1
  - @labre/affine-components@0.34.1
  - @labre/affine-gfx-connector@0.34.1
  - @labre/affine-gfx-group@0.34.1
  - @labre/affine-gfx-pointer@0.34.1
  - @labre/affine-gfx-shape@0.34.1
  - @labre/affine-gfx-template@0.34.1
  - @labre/affine-shared@0.34.1
  - @labre/affine-widget-edgeless-toolbar@0.34.1
  - @labre/affine-ext-loader@0.34.1
  - @labre/global@0.34.1
  - @labre/store@0.34.1

## 0.34.0

### Minor Changes

- 881d3f5: feat(blocks): every framework bundle publishes a data-only ./commands-manifest subpath, and bundle .d.ts stop leaking \_pkgs internals

  ## `./commands-manifest` (#181)

  A host settings pane that lists the framework commands — id, label, chord,
  scope, owner — had one published route to them: the bundle's MAIN entry. A
  `CommandDescriptor` carries its `run`, so that entry pulls the framework's whole
  action graph behind it: the import/export machinery (Wardley's `import.js` alone
  is 47 KB), the surface, gfx, model and shared deep paths of core. Nothing can be
  tree-shaken away, because every descriptor genuinely references its handler. The
  pane's chunk was carrying eight action graphs to draw about a hundred static
  rows.

  Each framework bundle now also publishes `./commands-manifest`, modelled on the
  existing `./descriptor`: the same commands projected to the six fields a
  shortcuts panel needs — `id`, `owner`, `labelKey`, `labelFallback`, `scope`,
  `defaultKeys` — with no `run`, no `params`, and type-only imports, so the module
  references nothing at all. It is a few hundred bytes per framework instead of
  megabytes.

  The projection is `toShortcutManifestEntry`, new in `@labre/std` beside the two
  projections that were already there. `scripts/build-bundles.mjs` refuses to
  build a framework whose manifest module reaches for a runtime import, and a unit
  test pins every manifest row-for-row against the commands it projects, so the
  second copy cannot drift from the first.

  ## `labelFallback` survives the projection (#181)

  `getShortcutManifest`'s row type kept `labelKey` but dropped `labelFallback`,
  which left a host with no translation catalogue rendering raw i18n keys — and
  forced every host to re-project from the main entry to recover a wording the
  library already knew. `ShortcutManifestEntry` now carries it, and it is declared
  once, in `@labre/std`, so core's rows and a framework bundle's rows are the same
  type: a host concatenates them. `owner` also narrows from `string` to
  `CommandOwner`, and the never-populated `when?: string` is gone.

  ## `_pkgs/*` in the emitted declarations (#60)

  The published `.d.ts` named internal core subpaths — `_pkgs/global/utils`,
  `_pkgs/global/di`, `_pkgs/affine-widget-edgeless-toolbar` — that core's
  `exports` map did not carry. tsc synthesises them when emitting a dependent
  bundle's declarations, by reverse-mapping the tsconfig `paths` entry onto the
  file a type physically lives in. Only `skipLibCheck: true` hid it; a consumer
  that type-checks the bundle declarations got unresolved-module errors.

  `scripts/compile-bundles.mjs` now scans the finished emit for those references
  and publishes exactly the subpaths it finds, then re-checks every reference
  against the map it wrote. Rewriting the specifiers to a public shim was the
  alternative and was not taken: a rewrite only has a target when a public shim
  happens to re-export that exact module, and nothing guarantees one exists for
  every internal declaration tsc may name. Publishing the subpath always has a
  target, and deriving the list from the emit keeps the exposure to what the
  declarations genuinely need.

### Patch Changes

- 8b00f7d: fix(blocks): core toasts, board tooltips, catalogue headers and seed texts cross the translation seam

  A host that wires `TranslationExtension` now gets a catalogue that covers the
  editor, instead of one that covers everything except the parts a user actually
  reads first. Six families of hard-coded English are gone (refs #182, #183);
  every one of them is a `com.labre.*` key with the previous literal as its
  English fallback, so an editor with no `TranslationProvider` registered reads
  exactly what it read before.

  - **Toasts** — "Copied to clipboard", "Linked doc created", "Note removed from
    Page Mode", "Frame inserted into Page.", "No link found".
  - **Board toolbars** — the resize toggle every framework board carries, and the
    two legend wordings, declared once in `@labre/affine-shared` rather than
    eight times.
  - **Editor chrome** — the toolbar verbs (Copy, Duplicate, Delete, Lock, Link,
    More, Bring to Front, Send to Back, Create linked doc, Draw connector), the
    view switcher (Switch / Inline / Card / Embed view) and the linked-doc card's
    four "nothing to show" sentences. `ToolbarAction` gained `labelWording` /
    `tooltipWording`: a declared `[key, English]` pair the toolbar resolves when
    it builds the row, which keeps a call site one line and keeps the row's width
    planning honest about what it is about to say.
  - **Catalogue headers** — every framework now contributes its own
    `com.labre.catalogue.category.*` keys. Core's registry names no framework
    category once `build:bundles` has stripped it, so a bundled host was drawing
    translated entries under English headers.
  - **BPMN import remarks** — the three whose wording is a fixed sentence carry a
    key (`InterchangeNote.messageKey`). The ones that name an element, an id or a
    count of lanes do not: the seam has no interpolation.
  - **Seed texts** — the caption a placed BPMN or EDGY artefact is given, and a
    C4 board's name, are resolved AT PLACEMENT. What lands in the document is
    content the author owns from that moment on and is never re-translated.

  `getTranslationKeyManifest()` gains all of it, including a new `'seed'` source
  for the words a framework writes onto the canvas.

  Three surfaces are deliberately left English, and each one is a refusal rather
  than an oversight. The **C4 component tier seeds** (`NODE_LABEL`,
  `C4_TYPE_PLACEHOLDER`, `DESCRIPTION_PLACEHOLDER`) are read back as SENTINELS by
  the morph and by the mermaid exporter, which is a pure function of the board
  and has no `std` to re-resolve them with — translating them would change what
  an export writes. The **code block's "⋮"** is a `MenuItemGroup` rendered over a
  generic context that carries no `std`. The **slash menu** and the **mobile
  keyboard toolbar** item names are their own vocabularies, untouched apart from
  the toasts they raise.

- 6551c82: fix(edgeless): imported bpmn labels fit their shapes

  A `.bpmn` file drawn by another tool places its artefacts at that tool's own
  scale — bpmn.io's normative sizes are a 100×80 task and a 36-unit event, against
  this pack's 120×72 and 56 — while the label was materialized with the type and
  the margin calibrated for the pack's own boxes: an 18-unit font inside the
  shape's fixed 20-unit horizontal inset. In an imported task that left 60 units
  of line and broke the label in the middle of a word ("Étudie / r le dossie / r");
  in an imported event it left no room at all, and the name sprawled across the
  canvas.

  An artefact read from a file now has its label fitted to the box the file gave
  it: the font and the margin shrink with the symbol, and the text is `Contained`,
  so the renderer keeps shrinking it until it fits rather than painting it past
  the shape. Artefacts placed from the catalogue are untouched, and the geometry
  the file drew is written back unchanged — the fix is visual only, and the XML
  round trip is the same file it was.

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
  - @labre/affine-gfx-group@0.34.0
  - @labre/affine-gfx-pointer@0.34.0
  - @labre/affine-gfx-shape@0.34.0
  - @labre/affine-gfx-template@0.34.0
  - @labre/affine-model@0.34.0
  - @labre/affine-ext-loader@0.34.0
  - @labre/global@0.34.0
  - @labre/store@0.34.0

## 0.33.0

### Patch Changes

- 3fbf69c: feat(edgeless): a BPMN node changes into a nearby kind from its own toolbar

  Realising mid-draft that the rectangle should have been a **user task** used to
  cost a delete, a re-draw, a re-connect and a re-typed label — and every sequence
  flow attached to the node with it. Select a BPMN node now and its contextual
  toolbar carries a **Change type** dropdown: pick the user task, the timer start,
  the parallel gateway, the call activity, and the element stays the same element.
  Same box, same words, same wires, same id. What DOES change is the artefact's
  kind, its role and its appearance: a morph resets styling to what the target
  kind is born as, so a morphed node and one drawn fresh from the palette are the
  same element. One ctrl+z puts it back.

  What a node may become is **declared data**, not a derivation: six families —
  the three tasks, the three starts, the three ends, the two gateways, the two
  data artefacts, and the sub-process with the call activity. Nothing crosses
  between them, because a task and an end event are not the same claim about a
  process; and the text annotation and the group belong to no family at all, so
  the dropdown never appears on them. The role tree was the tempting source and
  the wrong one — it makes a task and a sub-process both activities, and only a
  human knows which pairs a reader accepts as "the same artefact, said more
  precisely".

  The capability itself is generic (`morphToolbarConfig`, in the surface package)
  and names no framework: a second framework gets the same dropdown by declaring
  its own families, its own patch per kind and its own icons, exactly as it
  already registers its validation rules. BPMN is the first taker, and registers
  it from its flag-gated half — a morph is tooling, so switching the framework off
  takes the menu away and leaves every node drawn, painted and checked as before.

  Kind and role are rewritten together in one atomic write per element, so the
  validation engine re-judges the board on its own and no rule ever sees an
  element that is half one artefact and half another. The patch is the shipped
  creation preset in full, which matters concretely for one pair on today's
  table: a sub-process and a call activity are the same rounded rectangle and
  differ only in border thickness, so a call activity really does come out with
  the thick border that IS the distinction between them. Everywhere else the
  members of a family already share a preset, and the full patch is kept anyway —
  insurance for the day a family gains a member that styles itself differently,
  and the guarantee that morph and palette can never disagree.

  One new telemetry event, `FrameworkElementMorphed`, carrying the two roles, the
  framework and how many elements one gesture rewrote — never board content. It is
  its own event rather than a creation one for the reason `FrameworkElementPromoted`
  is: a morph inserts nothing, and counting it as a creation would inflate
  "elements added per framework" forever.

- 5c39582: feat(edgeless): an SVG file imports as an editable sketch

  **Somebody sent you a picture of a process, not a `.bpmn`.** Open the artefact
  catalogue, pick **Import SVG sketch**, and the drawing arrives on the canvas as
  elements you can move, recolour and rewrite: rectangles, ellipses, polygons,
  brush strokes — and every `<text>` in the file as a **free-text element you can
  double-click and edit**, which is the whole point. A label that arrived as a
  picture of a word would be a label nobody could correct.

  The entry is under **Interchange** in the catalogue sidepanel (one click away
  via _More artefacts…_), on both the BPMN and the Wardley frameworks, and it is
  also in the command palette and available to an agent. It is deliberately **not**
  in the senior sub-menu: that row carries a framework's native-format import —
  **Import BPMN XML** today — and this is the fallback for everything else.

  ### It says what it is before it opens the file

  "Best effort: recognises shapes and text, no round-trip." That sentence is the
  contract (`docs/adr/0012`, P2), and it is on the button rather than in a report
  afterwards. What lands is a **sketch you then promote**: nothing here decides
  that a rounded rectangle in your picture was a task, or that a circle was a
  Wardley component. An SVG carries a rendering, not a model, so there is nothing
  to preserve and nothing is written into the document beyond the drawing itself —
  no hidden payload, and no round-trip implied.

  ### And it never drops anything quietly

  The import report names every construct it could not read, **once per kind**: a
  `scale` or `rotate` transform it ignored (the shape is imported, at its
  untransformed position), curves it approximated by their endpoints, gradients it
  replaced with a flat neutral, transparency it flattened, and the constructs the
  sanitizer removed before the reader saw them — `<use>` and `<foreignObject>`,
  which is why a drawing built out of symbol instances can arrive nearly empty and
  now says so instead of leaving you to guess. Three hundred `<use>` instances are
  one remark, not three hundred.

  Parts of a file marked `display:none` or `visibility:hidden` are **not**
  imported, and the report says so: they draw nothing where the file came from,
  and SVG's initial fill is black — so importing an exporter's off-canvas
  scaffolding "faithfully" would put a large black slab over your board.

  The drawing also arrives at the **size the file displays it at**. An SVG whose
  `viewBox` is 1000 units wide and whose `width` is 200 is a drawing at one-fifth
  scale, and the import applies that factor to positions, sizes, stroke widths and
  font sizes alike.

  One thing worth knowing before you reach for it: a **mermaid** diagram paints
  almost entirely through a CSS `<style>` sheet, which this reader does not apply
  — so a mermaid SVG arrives in the initial colours, mostly black, with a remark
  saying why.

  A blank drawing imports as nothing plus a remark rather than an error. A file
  that is not well-formed XML is refused, by name.

  Both frameworks read through **one** parser, so they cannot drift into
  recognising different pictures — and which framework's vocabulary a picture is a
  picture _of_ stays your call, never an inference from the filename.

  ### For hosts

  `@labre/affine` is a **minor** because the library gains two commands and a new
  public function, not because anything was removed. `parseSvgSketch`,
  `SVG_SKETCH_FORMAT_ID`, `SVG_SKETCH_EXTENSION` and `SVG_SKETCH_MIME` are
  exported from `@labre/affine-block-surface`, and each framework exports its own
  capability (`BPMN_SVG_IMPORT`, `WARDLEY_SVG_IMPORT`) — so a host can build its
  own drop zone on `importInterchangeFile` without going near a picker.

  One thing to know if you render the command palette flat: `bpmn.importSvg` and
  `wardley.importSvg` **share the label "Import SVG sketch"**, because they do the
  same thing to the same file and only the framework offering it differs.
  Disambiguate on `owner` — the ids are distinct, and so is every other field.

- 4671780: feat(edgeless): the BPMN descriptive profile gets its toolbox

  The previous release taught the pack to DRAW the descriptive conformance
  subclass of BPMN 2.0 — seventeen artefacts, twenty-five roles, every glyph the
  notation asks for. It shipped no way to reach them: the palette still offered the
  four basics, and the other thirteen existed only for a document that already
  contained one. This release is the other half. **Fifteen commands** join the
  eight that were there, and the BPMN toolbox goes from 8 entries to **23**.

  Thirteen of them create an artefact: the **message** and **timer** starts, the
  **message** and **terminate** ends, the **user** and **service** tasks, the
  **sub-process** and the **call activity**, the **parallel gateway**, the **data
  object**, the **data store**, the **text annotation** and the **group**. Two arm
  a tool:

  - the **message flow** — dashed, an open circle where the message leaves and an
    open arrowhead where it lands, which is exactly how BPMN tells it from the
    sequence flow. Its role (`bpmn:message-flow`) was declared last release and
    stamped by nothing; this tool is what finally writes it, so the arrow is born
    saying "sends a message to" rather than acquiring the sentence afterwards;
  - the **association** — dashed, and with no head at either end. That absence is
    the point: an association names no relation, so there is no direction for
    either end to be wrong about, and an arrowhead would be the picture claiming
    one the vocabulary explicitly refuses.

  One simplification, noted in the code: the spec draws the association DOTTED and
  this editor has no dotted stroke (and no stroke thinner than the message flow's —
  a connector's width is a closed enum), so the two share a line and the endpoints
  carry the whole distinction. A message flow always shows its circle and its head;
  an association never shows either.

  **The catalogue now has sections.** All twenty-three entries used to be filed
  under one heading called "flow", which is what a framework declares when it has
  six things and no reason to sort them. They are now grouped as **events**,
  **activities**, **gateways**, **flows**, **data**, **annotations** and
  **swimlanes** — a framework naming its own sections, with a host's catalogue free
  to translate every header.

  **And BPMN is the first framework to outgrow its own sub-menu.** Twenty-three
  entries against fourteen slots is exactly the case the senior menu was built for
  last month: the popover now opens on the seven commands this user actually
  reaches for, plus a permanent "More artefacts…" that opens the full catalogue
  beside the board. Nothing is unreachable — every one of the twenty-three is in
  the catalogue, in the command palette, bindable from Settings › Shortcuts and
  available to the agent.

  A new template card, **Message exchange**, ships with it: two participants
  stacked, a sequence flow inside the first and a message flow crossing to the
  second. It exists because that is the piece of BPMN people get wrong first — a
  sequence flow may never leave its pool, and the thing that does leave is a
  different statement drawn with a different line.

- c03090c: feat(edgeless): the BPMN pack draws the whole descriptive profile

  The BPMN pack knew four artefacts: a start event, an end event, a task and an
  exclusive gateway. That is enough to draw a diagram and not enough to draw a
  PROCESS — the moment an architect has to say what starts the thing, who does the
  work, what the parallel branch is, or which system of record it writes to, they
  were drawing rectangles and explaining them in a meeting. Seventeen artefacts now
  ship: the **descriptive conformance subclass** of BPMN 2.0, which is the subset
  the standard itself defines for people who model processes rather than execute
  them.

  What arrives: the **message** and **timer** starts and the **message** and
  **terminate** ends; the **user** and **service** tasks, the collapsed
  **sub-process** and the **call activity**; the **parallel gateway**; the three
  artefacts a process needs to point at things outside itself — the **data
  object**, the **data store** and the **text annotation**; and the **group**.

  The group is the one that is not a node at all. It is a lasso: a dashed grey
  rectangle drawn AROUND part of the picture, to say "this much of it is the
  returns process" without claiming any of it. The spec exempts it from every
  connection and containment rule there is — it attaches to no flow, it is not
  bounded by the pool it overlaps, and it may straddle several at once — and it
  behaves that way here because it has no fill: it is grabbed by its border and
  its name, so it never steals a click from the work inside it, and the work
  inside it never becomes its content. Its label sits in the top-left corner
  rather than the middle, for the obvious reason.

  Each is drawn the way the notation draws it, and each is drawn ON the shape it
  already was: a message start is the same thin green ring with an envelope in it,
  a user task the same rounded rectangle with a person in its corner, a call
  activity the same rectangle with the border thickened to say "this stands for a
  whole process defined somewhere else". Nothing was re-skinned, so a process drawn
  last month sits beside one drawn today and they are the same picture.

  Two deliberate simplifications against the reference rendering, both noted in the
  code: a message END event's envelope is drawn hollow rather than solid — the
  thick red ring already says it is an end, and it says it from further away — and
  the timer has no hour ticks. An expanded (drilled-into) sub-process is not here
  either: `subProcess` is the collapsed representation, the `+` box, because an
  expanded one is a container with its own flow inside it and that is a different
  feature.

  **Fifteen roles** join the vocabulary underneath the families that were declared
  for exactly this — the message and timer starts under `bpmn:start-event`, the
  user and service tasks under `bpmn:task`, the parallel gateway under
  `bpmn:gateway` — so everything already written about "an event" or "an activity"
  keeps applying, unchanged, to artefacts that did not exist when it was written.

  Two of them sit outside every family that existed. **`bpmn:data`** is a new
  family of its own — the paperwork is not the work, and a rule about what a
  process DOES must never reach a data store. **`bpmn:text-annotation`** and
  **`bpmn:group`** are families of one, parent-less and childless, because
  commentary is never evidence and a lasso is not a thing the process does — and
  because a parent anywhere in the tree would have inherited the group exactly the
  containment rules the spec exempts it from. And one new edge role,
  **`bpmn:association`**, is the only one in this library
  with no verb at all: "this note is about that task" reads the same from either
  end, so it has no direction to be wrong about and none to fix.

  **Nothing already drawn changes.** The new artefacts are new VALUES of the field
  every BPMN node already carries — no schema change, no migration, no backfill. A
  process authored before this release loads byte for byte and paints exactly as it
  did.

  The palette entries, shortcuts and templates for the thirteen new artefacts
  follow in the next release; this one is the model, the vocabulary and the
  rendering.

- 766eae8: feat(edgeless): bpmn elements declare their roles and the sequence flow speaks

  BPMN artefacts now carry a **semantic role** beside the `kind` they already had.
  `kind` has not moved and still decides which glyph is painted; what it is no
  longer is the authority on what the glyph MEANS. That authority is the role, and
  it is what everything written about a process from now on reads — because on this
  canvas the whole notation is drawn with three native shapes, and an ellipse is a
  start event, an end event or somebody's doodle depending entirely on what the
  author meant.

  Ten roles ship: the three families BPMN's own taxonomy has — **event**,
  **activity**, **gateway** — with the four artefacts of the lean pack underneath
  them (start event, end event, task, exclusive gateway), the **pool** as the frame
  they are drawn in, and the two connecting objects. Declaring the families now,
  with one or two children each, is what lets the message and timer events, the
  sub-process and the parallel gateway arrive later as leaves rather than as a
  reshuffle: anything written about "an event" is written once and stays written.

  The **sequence flow becomes a typed edge**. It says "is followed by", so its
  source is what happens first and its target is what comes next — and the tool now
  says so before the user draws, rather than leaving the meaning of the arrow to
  depend on which end their finger landed on first. Hovering a sequence flow
  reveals that sentence, and the arrow can be reversed from its toolbar, on a
  process opened with the BPMN tooling switched off as much as on. The **message
  flow** is declared alongside it ("sends a message to") and stamped by nothing
  yet: it is reserved for the tool that draws it.

  The shipped templates produce exactly the artefacts the palette does, so a
  process started from a preset reads the same as a hand-drawn one — with one
  deliberate exception, the free arrow of the "Sequence flow" card, which is
  attached to nothing and therefore claims nothing.

  **Nothing already drawn changes.** Processes made before this release carry no
  roles, so nothing is judged and nothing is said about them; they keep rendering
  exactly as they are. Drawing with the tools again is what makes them statements.

- 82d2795: feat(edgeless): a BPMN board leaves as a `.bpmn` file

  Select a pool, open the "⋮" on its toolbar, and "Export BPMN XML" downloads the
  board as a BPMN 2.0 interchange document — the semantic model and the BPMN DI
  diagram in one file, which is what bpmn.io, Camunda Modeler, Signavio and every
  other BPMN tool opens. A process drawn here is no longer only a picture of a
  process.

  It exports the WHOLE board, whichever pool's toolbar launched it. A BPMN
  document is a process, and half a process is not a smaller process: a file
  holding one participant of a two-participant collaboration would be a picture of
  a conversation with one side deleted. The selected pool decides the filename and
  nothing else — the document's own title first, the pool's name if it has none.

  Each lane is drawn as well as listed: the pool arrives in bpmn.io divided into
  the bands you drew, with their names, in the same places.

  What comes out follows what is drawn. One pool or more gives a `collaboration`
  with a `participant` and a `process` each, the message flows under the
  collaboration where the spec puts them, and one extra participant-less process
  for anything drawn outside every pool. No pool at all gives a single `process`
  and no collaboration, which is what a process drawn without swimlanes IS. A
  pool's lanes become a flat `laneSet`, and each artefact is listed in the lane it
  is drawn in — the same centre-in-the-plot arithmetic the audit and the
  validation rules already read, so the file and the badge on the canvas can never
  disagree.

  All seventeen artefacts map: the plain, message and timer starts, the plain,
  message and terminate ends, the task, user task, service task, sub-process, call
  activity, exclusive and parallel gateways, data object, data store, text
  annotation and group. The four triggered events carry the event definition the
  spec asks for rather than becoming elements of their own; a data object arrives
  with the `dataObjectReference` that DI attaches to; a group carries its label on
  a `categoryValue`, which is where BPMN keeps the words a group shows.

  **The export speaks only what the author stated.** A connector with no BPMN role
  relates nothing, so it is not an untyped sequence flow — it is not a flow, and
  it is absent. So is a plain rectangle drawn beside a pool, and so is an arrow
  with a free end, which the format has no way to write down: `sourceRef` and
  `targetRef` are required on every flow. Guessing here would put words in an
  architect's mouth in a file they are about to hand to an execution engine.

  Two limits worth knowing before the first import. A data association is exported
  as a plain `association`, not as the `dataInputAssociation` / `dataOutputAssociation`
  pair — those drag in an `ioSpecification`, a `dataInput`, a `dataOutput`, an
  `inputSet` and an `outputSet` per arrow, which the Descriptive conformance
  sub-class does not ask for. And a message flow drawn on a board with no pool is
  dropped rather than demoted to a sequence flow: "sends a message to" and "is
  followed by" are two different sentences.

  Two more things worth knowing when a BPMN tool complains about a file the
  editor was happy with. A sequence flow you drew from one pool into another is
  exported as you drew it, filed with the process its source is in — BPMN forbids
  a sequence flow crossing a pool boundary, so bpmn.io's linter will say so, and
  the warning is about the board rather than about the export. And a flow object
  left on bare canvas beside the pools goes into a process with no participant:
  correct in the model, and undrawable on a collaboration, so bpmn.io will not
  show it. Both are the export declining to invent a pool nobody drew. Artifacts —
  annotations and groups — are not affected: they have a legal home on the
  collaboration and are drawn where you put them.

  The drawing is translated so its top-left sits at the origin. BPMN DI
  coordinates are relative to the plane and the canvas lets you drag left of zero;
  a tool that clamps at zero would otherwise fold half the process onto its own
  edge.

  Labels survive whatever is in them: `Q&A`, `<draft>` and a two-line task name
  all come back exactly as they went in.

  The serializer is a pure function — element models in, XML string out, no editor
  anywhere near it — and is exported from the package, so a host can serialize a
  board it never rendered.

- 2b41d04: BPMN facts answer where an artefact sits, without an editor to ask.

  `bpmnPoolOf` and `bpmnLaneOf` say which pool an element is drawn on and which
  lane of that pool it falls in — the centre against ratios of the plot, the first
  matching band in order, exactly the convention the audit already uses one level
  down. Pure functions over models: a rule, a host or a test can ask without a
  `BlockStdScope` and without waiting for a validation rule to be registered.

  Together with the typed-flow reading the connector package already exposes
  (`asTypedEdge` / `edgeIsBound` / `edgeVerbOf`), this is the contract the BPMN
  validation rules consume. Nothing about a stored document changes.

- 32e4d45: feat(edgeless): a `.bpmn` file imports from the catalogue — with an honest report — and export warnings reach the user

  The reader shipped in #160 and nobody could reach it. **Import BPMN XML** is the
  door: open the BPMN catalogue, pick the entry, choose a `.bpmn` file, and the
  process is on the canvas — pools, lanes, all seventeen artefacts, the sequence
  flows, the message flows and the associations, laid out where the file's diagram
  drew them, and brought into view.

  It needs nothing selected, which is the point: the moment you want it most is on
  an empty board. So it declines the pool's contextual toolbar (a contextual
  toolbar is a statement about a selection) and the senior sub-menu (which is what
  you reach for to draw something), and lives in the catalogue, the command
  palette and the agent surface. It does declare one precondition — it writes, so
  it withdraws from every surface on a read-only document rather than sitting
  there lit and doing nothing. It is keyless by default and bindable from
  Settings › Shortcuts like every other framework command.

  The whole imported file arrives in view: the fit is computed from the shapes,
  which is what makes a process a bpmn.io user dragged far across their canvas
  land at a readable size rather than as a speck beside the origin.

  **It is filed in a new `interchange` section, and the export moved in beside
  it.** The two directions of one format are one subject — this board as a `.bpmn`
  file, out and in — and the export was under `swimlanes` only because the pool's
  "⋮" is where it is reached from and a section of one is not a section. Nothing
  moved inside any section: a category is where a command is filed, not where it
  sits.

  **The import says what it cost.** A notification names what was drawn, what was
  carried (kept verbatim in the document, invisible on the canvas, because Labre
  has no artefact for it) and what was quarantined (kept, and deliberately never
  written back, because re-emitting it would produce a file that contradicts the
  drawing) — plus the BPMN version and the tool that wrote the file, so
  "bpmn.io drew it differently" is answerable in one line. When there are remarks,
  a second notification spells them out; past a handful it defers to a
  `console.table` that always holds all of them. That is v1 of the report (ADR
  0012's open question 4): the
  destination is the conformity panel, where an import remark belongs beside a
  validation finding, and the console is named as a stopgap rather than dressed up
  as a home.

  A file that is not a readable BPMN document — malformed XML, a DMN decision
  model, a choreography — is refused with the reader's own sentence, which knows
  which of those it was. Nothing is drawn, and nothing is half-drawn.

  What arrives is a new board beside whatever was already on the surface, never a
  merge, and the whole file is one undo step.

  **And the export's warnings finally reach somebody.** The writer has been
  recording what a board says that BPMN has no way to write down — a message flow
  on a board with no pool, an arrow with a loose end, an artefact drawn outside
  every pool that most tools will not render, an imported id that could not be
  given back — and the command threw the list away. It now raises one
  notification. The file still downloads, and it is still valid: a warning names
  what the format could not carry, not a failure.

  Both notifications go through the host's notification service. A standalone
  playground registers none and degrades to silence — the elements are on the
  surface either way.

- 139d77b: refactor(edgeless): the BPMN pool is a declared framework background

  The pool was the last background in the library still drawn by hand: ninety
  lines of canvas code, and a model class that restated the five geometry answers
  every other background inherits. It is now an **instantiation of the
  framework-background primitive**, declared as data in `background.ts` like the
  Wardley map, the Core Domain Chart and the Event Storming board before it.

  One thing changes on screen, and it was asked for: **a pool now paints an opaque
  white card**, like every other framework background. It used to be transparent
  — a decision taken at the red-zone review of 26/08/2026, on the ground that a
  pool IS a map background, and a board where one framework's backdrop is
  see-through and every other one is not reads as a bug. A pool dropped over
  strokes already on the canvas covers them, exactly as a Wardley map dropped over
  them always has; sending the background to the back is the answer in both cases.

  Everything else is reproduced operation for operation — the frame, its rounded
  corners, the filled name band, the divider and the participant name rotated up
  the band — and pinned by a fidelity suite that asserts every literal the deleted
  renderer used to emit. Three further differences are known and recorded there,
  none of them visible: the divider is stroked before the frame instead of after
  (same ink, same width), a `lineJoin` that had nothing to act on is no longer
  set, and the participant name is no longer hidden on a pool narrower than twelve
  model units — a pool narrower than one character of its own name.

  The primitive gains the one concept the pool needed: **side bands**, a filled
  strip painted over a margin, with its own divider and its own label. A band has
  no width of its own — it IS the margin it covers — and it belongs to the card,
  painted over the card's fill and under its border so the frame keeps outlining
  the whole element. A text can now also declare a `middle` baseline, which is
  what centres a name across a band rather than sitting it on a line inside one.

  **Assumed behaviour change: a frame no longer adopts a pool.** Frames have
  excluded framework backgrounds since PF2 — a backdrop the frame was drawn on top
  of would be permanently buried behind its own child — and the pool, now one of
  them, joins that rule. Drawing a frame over a lane groups the flow objects
  inside it and leaves the lane where it is, which is what already happens on a
  Wardley map, a Core Domain Chart and a Context Map board.

  **No document changes.** The persisted element type is still `bpmnPool` and its
  props are still the four it has always written (`name`, `resizeEnabled`,
  `rotate`, `xywh`), with the same defaults, in the same order. A pool authored
  before this change opens, round-trips and paints identically.

- 6bba40c: feat(blocks): a BPMN pool carries its lanes

  A pool can now be divided into lanes (couloirs). "Add lane" and "Remove lane"
  sit on the pool's own toolbar; each lane wears a title band down its leading
  edge, inside the participant's own, with its name turned on its side — the way
  BPMN 2.0 draws a lane. Double-clicking a title band renames what is written in
  it, and the separator between two lanes is dragged to give one of them more
  room. The lanes are DATA on the pool — how many there are, what they are called
  and how the height is shared between them — so the background primitive paints
  them and the audit reports an element's lane the same way it reports any other
  zone.

  A new lane arrives named `Lane 1`, `Lane 2`, and so on: a plain string written
  into the document, exactly like the pool's own `Pool` default, and yours to
  rewrite immediately. It is what makes the first "Add lane" click visible — a
  titled band appears on a pool that had none.

  The title band is chrome INSIDE the lane, not a gutter beside it: an element
  dropped on a lane's band is in that lane, and naming a lane does not shrink its
  share of the pool.

  Renaming is now zoned. A double-click renames the band it landed in — the
  participant in the pool's own strip, a lane in that lane's — and does nothing
  on open canvas. Previously a double-click anywhere on the pool renamed the
  participant, which with a name per lane would have made the flow area a
  rename target for the one name that is not written there. The `text` cursor
  over either band is what says where the names are.

  The framework-background primitive grew the band placement to make this
  possible (`BackgroundInstanceZonesDef.label.band`). It is purely additive: a
  framework that declares no band keeps the corner placement it had, unchanged
  down to the painting operation.

  Nothing changes for a pool that has none. `lanes` is an optional field with no
  default, so no key is written until the first lane exists: a document authored
  before this release opens and paints byte for byte as it did, with no migration
  and no schema version bump. Removing the last lane takes the key back out
  rather than leaving an empty array, so a pool returns to exactly the bytes it
  had. In the other direction, a pool WITH lanes opened by an older build keeps
  them: unknown element props are preserved verbatim (#73), so the lanes survive
  the round trip and are still there when the newer build opens the document
  again.

  Removing a lane moves nothing. An element is in a lane because its centre falls
  in that band, so the lane below simply grows over whatever was drawn in the one
  that went — nothing on the canvas jumps, and the sequence flows still land
  where they were drawn.

  The band placement, the default names and the zoned renaming all come from the
  PO's visual recette of 2026-08-26, which replaced a first pass that wrote each
  lane name across the lane's top-left corner.

- 70dffb7: feat(blocks): a `.bpmn` file becomes a board, and what Labre cannot draw travels sealed

  BPMN could write a `.bpmn` and not read one. It can now read one, which is what
  turns last release's export into an **interoperability claim** rather than a
  download: Labre → `.bpmn` → bpmn.io → `.bpmn` → Labre, with the part of the file
  Labre has no artefact for still in it at the end.

  The reader sorts every node of the file into three states and never a fourth.
  **Mapped** is the vocabulary the pack draws — the seventeen kinds, the pools,
  the lanes, the three edge roles, the diagram — and it lands as ordinary,
  editable artefacts: a task read out of a file and a task drawn from the palette
  are the same element in the document, down to the stroke width. **Carried** is
  everything with no artefact and a home to ride on: a `camunda:` extension, a
  `documentation`, an `ioSpecification`, and the Analytic vocabulary the
  descriptive profile leaves out — a boundary event, an inclusive gateway — kept
  whole on the pool of the process they were written in, with the namespace
  declarations without which they could never be read again. **Quarantined** is
  the short list of things that are kept and deliberately not written back,
  because writing them back would produce a file that contradicts the drawing: a
  vendor colour beside a shape whose fill the author can now change, the body of
  an expanded sub-process drawn collapsed, a nested lane set beside the flat one
  that replaced it, an `<import>` of a document nobody resolved.

  What is kept is filed under the source element it came off, so two lanes of one
  pool that each carry a `camunda:owner` still have two owners afterwards, and a
  flow whose end is something Labre does not draw — a boundary event's error path,
  the commonest Analytic construct there is — is kept whole beside the event it
  runs to rather than drawn as an arrow attached to nothing.

  Nothing is dropped in silence. The import returns a **report** — three counts
  and a list of notes naming what happened to what, by the file's own ids — and
  the notes are precise enough to act on: which fragment was quarantined and why,
  which shape arrived with no diagram and was placed by Labre rather than by the
  file, which lane the file lists an artefact in when the drawing puts it in
  another one. Where the file's `flowNodeRef` and its diagram disagree, the
  **drawing wins**: Labre stores no lane membership, it reads it off the geometry,
  and a second source of truth would be contradicted by the first drag.

  **The round trip is a fixed point.** A board exported, read back and exported
  again is byte-identical — every id in the second file is one the first file
  handed over, because an import records what it was given and an export gives it
  back. That is now pinned twice: once over plain objects, and once through a live
  store, a connector manager and a real browser parser.

  A file's own losses are written down rather than discovered: the loss table
  lives beside the reader, and says which rows are invisible (and recoverable) and
  which are gone.

  Two things this release does not do. There is no menu entry yet — the reader is
  a pure function and a declared registry capability (`bpmn:bpmn:import`), and the
  file picker, the report panel and the export warnings toast are the next
  chantier's. And the carried and quarantined payloads are written to the document
  without yet being written back out to a `.bpmn`: the reader puts them there
  whole, and the writer that puts them back is the other half.

- a9a0a61: feat(blocks): a re-exported board gives back what the import did not understand

  The previous release taught Labre to READ a `.bpmn` and to keep, verbatim and on
  the element it came off, every part of the file it has no artefact for — a
  boundary event, a `camunda:` extension, a vendor's namespace declaration. It
  kept all of it in the document and wrote none of it back. A file with a boundary
  event survived the import and was lost on the next export, which is the
  invisible loss the whole chantier exists to prevent, delayed by one step.

  This release closes the loop. **The exporter reads the payload the importer
  wrote** and puts each piece back where it came from: an attribute onto the
  element its scope names, a fragment inside the element it was a child of, a
  carried flow node into the process, its `BPMNShape` back onto the plane, the
  file's namespace declarations back onto `definitions`. `isExecutable="true"` is
  given back instead of being downgraded to `false` on every round trip.

  **Where a fragment goes is the schema's answer, not the payload's.** A scope
  records which element a fragment was a child of and says nothing about which
  slot of it — and `tProcess` is an `xsd:sequence`, so a carried `<auditing>`
  written after the lane set is a document a validating parser refuses even though
  every character of it is right. Placement is derived from the same XSD sequences
  the exporter already writes its own children in: the base type's children first,
  then lane sets, flow elements, artifacts, and the resource roles that follow
  them. Carried matter lands in a legal slot, always.

  **The claim is a fixed point, and it is a test.** Read a file this library did
  not write, export it, and read it again: the carried payloads are identical, key
  for key, and the second export is byte-identical to the first. That mirrors the
  round-trip guarantee a Labre-drawn board already had, on matter Labre does not
  understand — which is the harder half and the one an architect actually relies
  on. A board that never met an import writes exactly the bytes it wrote before.

  Two things the writer found and fixed on the way, both of which would have been
  silent:

  - **the file's own prefix.** bpmn.io writes BPMN's namespace as `bpmn2:` and
    this library writes it as `bpmn:`. Fragments are stored with the prefixes the
    file spelled them in, so a document that declares only `xmlns:bpmn` cannot
    parse a single one of them. The reader now keeps a declaration unless the
    prefix AND the URI are both ones the writer makes anyway;
  - **quarantine defeated by its own leftovers.** The body of an expanded
    sub-process is quarantined (D5); its inner shapes were then orphaned, carried
    by the residue sweep, and would have been drawn by the writer. Quarantine now
    takes the whole subtree's diagram with it.

  **A carried element is written back at most once, and the unit is the id.** A
  board's foreign payload travels with the element through a copy-paste — that is
  what `interchange` is declared on the base model for — so a pool imported from a
  `.bpmn` and then pasted holds its carried boundary event, its lane's
  documentation and its shape twice. Written twice they are duplicate `xsd:ID`s,
  which is the one thing no BPMN tool survives. The guard is document-wide, keyed
  on the id a carried fragment claims rather than on its text, so it also catches
  two different elements from two different files claiming one id: the first is
  written, the rest are named in the export's warnings.

  **Neither half of a carried attribute is trusted as markup.** A value is escaped
  and a name is interpolated, so a name is the half that can close its own element
  and open others — and `interchange` is ordinary collaborative document data. A
  carried name is written only if it is a name: an NCName, or the `prefix:local`
  pair every foreign attribute in a `.bpmn` wears.

  What still does not round-trip is in the loss table, in `import.ts` and in ADR
  0012, and five rows are new because the writer put them there — a carried shape
  keeps the source file's coordinates and so lands beside a drawing that has since
  moved; a declaration rebinding one of this library's own four prefixes is kept
  in the document and out of the file, and the matter under it is then read under
  Labre's meaning rather than the original's; a declaration scoped to anything but
  `definitions` is not carried at all; a duplicate id keeps its first claimant;
  and two pools disagreeing about one `definitions` attribute resolve last-wins.
  Every one of them is named in the export's warnings rather than left to be
  discovered. Quarantined material is never re-emitted, by design and by test.

- 91fdeed: BPMN validation rules: 21 spec-cited rules, sketch/descriptive profiles, reference corpus

  A BPMN process is now checked against the notation it claims to follow.
  Twenty-one rules, every one citing the page of BPMN 2.0.2 (ISO/IEC 19510) it
  reads: what a sequence flow, a message flow and an association may run between;
  how many flows may reach a start event, an end event, a step or a gateway;
  whether a flow stays inside its pool or crosses between two; whether a pool that
  says where it ends also says where it begins; whether every step can be reached;
  and whether the steps are named at all.

  Five of them are panel-only remarks rather than warnings, because the standard
  explicitly sanctions the shape they report — a step that ends a path, a merge or
  a split drawn without a gateway — and a warning would be the tool arguing with a
  style BPMN allows.

  Two levels of requirement ride on the pool element, and selecting a pool now
  offers the Validation dropdown that chooses between them: `bpmn.sketch` (the
  default, which writes nothing and collects every finding for the panel without
  saying a word on the canvas) and `bpmn.descriptive` (the BPMN 2.0 descriptive
  conformance posture). Two pools on one board can sit at two levels.

  `bpmn:flow-object` joins the role vocabulary as the parent of events, activities
  and gateways — the word BPMN itself uses — so a rule says it once where it would
  otherwise enumerate three families. Pure static data: nothing is written to a
  document and nothing is backfilled.

- 1dbd735: Framework flows keep their style to themselves

  Arming a typed flow tool — a BPMN sequence flow, message flow or association, a
  Wardley link or change arrow, an EDGY relation, a Context Map pattern, an Event
  Storming flow, a Core Domain movement, a C4 relationship — used to write the
  flow's look into the shared "last used connector style". The next plain
  connector then came out dressed as that flow (dash, colour, arrowheads) while
  carrying none of its meaning; BPMN 2.0 (p.40) explicitly forbids other
  connectors adopting a flow's line style.

  The framework look now rides on the tool activation itself
  (`ConnectorToolOptions.style`) and is applied to the drawn edge at creation
  only. The last-props store is never touched by a framework activation, so the
  plain connector tool keeps drawing with the user's own last style — which
  still persists exactly as before when set from the plain tool itself.

- b97efc6: feat(blocks): imports and exports become declared interchange capabilities; the BPMN export is the first

  Reading a foreign file and writing one stop being something a toolbar happens to
  do and become a **declared platform capability**, registered the way validation
  rules and profiles already are. The platform can now answer a question it could
  not ask before: what can Labre read, what can it write, and for which framework.

  The unit of declaration is the **triple** — framework × format × direction — and
  a direction is never implied by its opposite. BPMN writes a `.bpmn` and cannot
  yet read one; the registry says exactly that instead of leaving a caller to
  assume a symmetry nobody implemented. The triple is also the id and the DI key,
  so a capability whose id disagrees with its own three fields is refused at
  registration, and a second capability cannot quietly take the first one's place.

  Each format declares its **tier**, and the tier is what a user is entitled to
  expect. A `semantic` format carries a model — `.bpmn`, mermaid, the OWM DSL — so
  an import of one is a translation and owes the full preservation contract. A
  `visual` format carries a rendering, so an import of one is best-effort
  recognition of shapes and promises no round-trip. A single "Import…" entry that
  hid the difference between the two would earn a support ticket per user.

  The two halves are mirror images and neither knows what an editor is. An
  exporter takes element models and returns the document, its suggested filename
  and its mime type. An importer takes text and returns **serialized element
  props** — never live models: it has no surface to add them to, and the caller
  does the writing. That is what lets the same function serve an editor command
  and an MCP tool, and lets both be tested with plain objects and no container.
  A capability's two halves are declared as one union, so an importer handed over
  as an export does not compile.

  **An export now says what it could not write down.** A board can hold sentences
  BPMN has no way to express, and until now the person who clicked Export was the
  only one not told. Three of them, each of which was a code comment: artefacts
  drawn outside every pool are in the file but most BPMN tools will not draw them,
  because only a pool has a shape to hold them; a message flow on a board with no
  pool is left out rather than quietly demoted to "is followed by"; and an arrow
  with a loose end, or an end attached to something that is not a BPMN artefact,
  cannot be written at all, because BPMN requires both ends of a flow to be named.
  A connector you deliberately left neutral is not one of these and says nothing —
  it states nothing, so it loses nothing.

  **An import report names things, it does not only count them.** Alongside the
  mapped / carried / quarantined counts, a report carries a note per item worth
  naming — which element, its id in the source file verbatim, and what happened to
  it: kept but not re-emitted, an id we could not give back, a position the file
  never carried, or a warning that our reading may be wrong. A tool that says "I
  lost some things" and cannot say which has told you nothing you can act on. A
  report also records the format version it actually read.

  **The `.bpmn` export shipped in #149 is the registry's first entry**, declared
  as `bpmn:bpmn:export`. Nothing about the file it produces changes. There is no
  second door: "Export BPMN XML" runs the declared capability and downloads what
  it returns, so the document, the file name and the content type all come from
  one place and cannot drift apart.

  Registering a capability is tooling, so it lives with the framework's flag: turn
  `bpmn` off and the export is gone. What a past import wrote is content and is
  gated by nothing — the board still opens, still paints, and keeps every byte it
  was given.

- edfaba2: feat(edgeless): interchange imports share one materializer, reporter and picker — and **Import BPMN XML** joins the senior sub-menu

  **Importing a `.bpmn` file no longer starts with finding the catalogue.** The
  entry is in the BPMN sub-menu, beside the artefacts, which is the first thing a
  user opens on an empty canvas — and an empty canvas is exactly where somebody
  who was just sent a process is standing. The PO decision of 2026-08-28 reverses
  the earlier reading ("the sub-menu is a row of things you draw") for the import
  alone: a board comes _from_ a file. The export keeps the old reading — it is
  what you do to a board you already have, and it is reached from the pool it is
  about. The row itself is unchanged in size: BPMN's toolbox has been past the cap
  for a while, so the sub-menu still shows thirteen ranked buttons plus **More
  artefacts…**, and the import takes a slot only for the user who actually reaches
  for it.

  The picker now filters on what the format itself declares, which is why a
  process saved as `.xml` — half the tools in the wild write one — can be picked
  again where the old hard-coded filter had it greyed out. What the file _is_ is
  still decided by the reader, which refuses anything that is not a BPMN
  `<definitions>`.

  **Under it, the import glue became the platform's rather than BPMN's.** Writing
  an imported board onto the surface, repairing the connector ends that named the
  source file's ids, fitting the drawing into view, and saying what the import
  cost were written once for BPMN and were never about BPMN. They are now five
  functions in `@labre/affine-block-surface` — `materializeInterchangeImport`,
  `reportInterchangeImport`, `importInterchangeFile`, `runInterchangeImportFile`
  and `interchangeImportersByExtension` — and they are the **public import API**:
  a host builds its own canvas import UI on them, and a framework's import command
  is one call. BPMN's own entry points are unchanged and behave identically.

  The two file-shaped entries are a pair, and a host wants the first of them:
  `importInterchangeFile(std, capability, file)` imports a `File` the caller
  ALREADY HAS — a drop, a paste, an "open with", a fetch from a document store —
  while `runInterchangeImportFile(std, capability)` is that same import with the
  picker in front of it, which is what a command wants. A drop zone must not be
  answered with a dialog, and neither should have to re-implement the id
  remapping or the viewport fit to avoid one.

  `interchangeImportersByExtension` answers "what could read a file called this",
  and answers with a **list**: `.svg` will be claimed by several frameworks at
  once, because which framework's vocabulary a picture is a picture _of_ is not a
  fact about a filename, and guessing on the user's behalf is the one thing
  `docs/adr/0012` refuses.

  **One report wording for every format, instead of one per format.** The
  notification composes the format's own name into a shared set of translation
  keys (`com.labre.interchange.import.*`), so a host translates "file imported"
  once rather than once per reader we ship, and a new format is never silently
  untranslated. What a BPMN user reads is unchanged, down to the version line.

  ### Breaking for hosts: seven translation keys are renamed

  `@labre/affine` is a **minor** for this reason alone. A host with its own
  catalogue keeps translating the old keys into nothing, and the notification
  silently falls back to English. The migration is one-for-one — the wordings are
  identical apart from `done`, whose format name is now composed in by the library
  rather than baked into the string:

  | removed                                         | replacement                                | wording                                                                         |
  | ----------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------- |
  | `com.labre.commands.bpmn.importXml.done`        | `com.labre.interchange.import.done`        | `BPMN file imported` → `file imported` (the library prefixes the format's name) |
  | `com.labre.commands.bpmn.importXml.failed`      | `com.labre.interchange.import.failed`      | unchanged                                                                       |
  | `com.labre.commands.bpmn.importXml.remarks`     | `com.labre.interchange.import.remarks`     | unchanged                                                                       |
  | `com.labre.commands.bpmn.importXml.console`     | `com.labre.interchange.import.console`     | unchanged                                                                       |
  | `com.labre.commands.bpmn.importXml.drawn`       | `com.labre.interchange.import.drawn`       | unchanged                                                                       |
  | `com.labre.commands.bpmn.importXml.carried`     | `com.labre.interchange.import.carried`     | unchanged                                                                       |
  | `com.labre.commands.bpmn.importXml.quarantined` | `com.labre.interchange.import.quarantined` | unchanged                                                                       |

  `com.labre.commands.bpmn.importXml` and `…importXml.description` — the command's
  own label and description — are **not** affected; nor is
  `com.labre.commands.bpmn.exportXml.warnings`, which stays BPMN's because no
  other format's writer speaks through it.

- 2ec39c0: validation rules carry their provenance — standard, recommendation or Labre convention — and the violation bubble says so

  A rule now declares where its authority comes from, as data rather than as prose
  buried in its message: `standard` with the page of the specification it reads,
  `recommendation` for a SHOULD or an industry linter's rule, `labre-convention`
  for a house style of this editor and nothing else. The violation bubble shows it
  as one discreet line under the finding, with the rule's own citation printed
  verbatim — so a convention can never reach an architect dressed as a norm
  violation, which is what an external review of the BPMN integration asked for.

  The field is purely descriptive: no evaluator reads it, and a rule that declares
  one raises exactly the findings it raised before.

  All twenty-two BPMN rules declare it — twelve `standard`, each with its page,
  eight `recommendation` naming a linter or the sentence the standard merely
  permits, and two conventions that say so out loud. The self-loop check left
  `bpmn.sequence-flow-endpoints` and became `bpmn.sequence-flow-self-loop`: the
  endpoints matrix is BPMN 2.0.2 p.95 and the no-self-loop habit is ours, so one
  rule could not have declared either honestly. Same wording, same severity, same
  i18n keys, one new rule id in the profiles.

  That new id is the one thing this change does not carry over: user exceptions
  are persisted per rule id, so an exception granted on a self-looping flow under
  `bpmn.sequence-flow-endpoints` no longer matches and the finding returns. No
  migration ships, because BPMN landed days ago and these packages are
  unpublished, so the set of affected documents is empty — but the same rename
  after publication would need a migration or an alias, and should not lean on
  this precedent.

  The other five frameworks' rules are annotated too — mostly `recommendation`
  naming the method, with the readability nudges declared as the Labre
  conventions they always were.

- 7ec4478: Senior button components resolve their own label through the translation seam

  The toolbar's navigation tooltips learned to translate a senior tool's
  `labelKey`, but the seven framework senior-button components still carried
  their label as a hard-coded English string. Each button now resolves the same
  `com.labre.framework.<id>` key through `translateKey`, with the previous
  English wording as fallback — so a host catalogue that already translates the
  toolbar translates the buttons too, and a standalone playground reads exactly
  as before.

- a9eb4f6: Senior buttons name themselves in the user's language

  The edgeless toolbar's senior-tool tooltips were the last piece of chrome that
  could only say "Wardley map" or "Event Storming" — a raw English string carried
  on the tool itself, invisible to the host catalogue. A senior tool can now
  declare `labelKey` alongside its `name`, and the toolbar resolves it through
  the same `TranslationProvider` seam every other library wording already uses.

  The seven frameworks declare the key their descriptor already publishes
  (`com.labre.framework.<id>`), so a host that built its catalogue from
  `getTranslationKeyManifest()` translates the buttons with no new key to add.
  `name` stays required and stays the fallback: it is what a standalone
  playground shows, and it is all the core tools (note, shape, template…) have —
  they own no framework identity, so they declare no key.

- e58b13e: fix(blocks): a carried root's id cannot be shadowed by an id inside another attribute's value

  The export's duplicate-id guard reads a carried fragment's root id off the
  opening tag by hand. The scan for the end of the tag was quote-aware, but the
  id extraction was not: a foreign attribute whose VALUE contains a raw
  ` id='X'` — a condition string, an XPath — was scanned as the fragment's id.
  Alongside a legitimate `id="X"` fragment, the innocent one was dropped from
  the export with a warning naming an id it does not have.

  The id is now extracted in the same quote-aware pass that finds the tag end,
  so `id=` inside a quoted value is never mistaken for the attribute. The
  loss-table row for duplicated ids also stops over-claiming: the export names
  the duplicates where the two disagree, and writes an exact duplicate once in
  silence, by design.

- f09f9a3: The senior sub-menu seats thirteen — seven recent, six most-used — and only
  commands that belong there

  Two PO rulings of 28/08/2026 on a framework's senior sub-menu past the cap.
  Both **supersede the arbitration recorded on 26/08/2026** ("the senior menu caps
  at fourteen and ranks seven past it", earlier in this release): that entry's cap
  of fourteen, author-order position law and deterministic cold start all stand —
  its slot count, its 4 + 3 split and its "rank the whole catalogue" rule do not.

  **Only its declarers are eligible.** The ranking used to read the whole
  catalogue, so a command that deliberately declines the sub-menu could be dragged
  into it by its own usage: the PO met "Export BPMN" in a row of things you DRAW
  and rightly asked what it was supposed to export. Membership is now drawn from
  the `senior-menu` surface alone — a declined surface is a statement about where
  a command belongs, not a default usage may out-vote. The overflow trigger still
  reads the catalogue, and the sidepanel's "Recent & frequent" head section still
  ranks it too: that panel is where every command of a framework is reachable, so
  a board action really does belong at its head.

  **Thirteen slots instead of seven, recency first.** Seven buttons in a
  fourteen-wide row left it half-empty; thirteen plus the permanent "More
  artefacts…" button is exactly the cap. The split is inverted to seven
  most-recent plus six most-used, because what you reached for this morning is
  what you are still working on. A command that tops both axes takes a recent
  slot, freeing its most-used slot for the next workhorse down. Display order
  remains author order — the ranking decides membership, never position — and a
  cold start still opens on the authored head, now thirteen deep.

  **The sidepanel's head section stays at seven.** Both PO rulings are about the
  sub-menu, and thirteen is argued from its geometry: a horizontal row of icon
  buttons where thirteen plus "More artefacts…" makes the fourteen cap. None of
  that transfers to a vertical list of 44px rows in a 320px panel, where thirteen
  would fill a laptop's first screen with duplicated shortcuts and push every
  category below the fold. The two surfaces share the arbitration and not its
  magnitude: the head keeps its own split (four recent + three used), so both
  halves of a section labelled "Recent & frequent" survive.

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
  - @labre/affine-gfx-group@0.33.0
  - @labre/affine-gfx-pointer@0.33.0
  - @labre/affine-gfx-shape@0.33.0
  - @labre/affine-gfx-template@0.33.0
  - @labre/affine-ext-loader@0.33.0
  - @labre/global@0.33.0
  - @labre/store@0.33.0

## 0.32.0

### Minor Changes

- 521accb: feat(blocks): flags gate tooling only — a disabled framework stays visible in documents

  Block flags used to decide whether a block was registered at all. A document
  containing a block or framework whose flag was off degraded on load: the schema
  was missing, the block and its whole subtree silently disappeared from the
  model, and snapshot export / copy-paste broke for the entire document.

  The contract is now reversed (see `docs/adr/0009`):

  - **Content is never gated.** `getAffineSchemas` and
    `getInternalStoreExtensions` register everything unconditionally. Every
    document opens, renders, round-trips and saves identically whatever the flags
    say — no deletion, no downgrade, no schema-validation failure on load. Both
    keep their `flags` parameter (now ignored) so existing calls compile
    unchanged.
  - **Only tooling is gated.** A flag removes the framework's senior toolbar
    button, its submenus, its Templates-panel category and its keyboard
    shortcuts. Turning a framework off no longer touches what is already drawn:
    elements keep painting, stay selectable and stay editable, and an OFF → ON
    cycle requires no re-entry of anything.
  - Brush, Wardley, EDGY, BPMN and Cynefin/Estuarine now expose two view
    extensions — an always-registered `…RenderViewExtension` and a flag-gated
    `…ViewExtension` — mirroring what Mindmap and DDD Core Domain already did.

  Consequence accepted: the bundle now always carries every framework's renderer,
  so a framework can no longer ship fully "dark" behind a flag.

  **BREAKING — published framework descriptors.** The four split framework
  bundles (`@formicoidea/labre-framework-{wardley,edgy,bpmn,cynefin}`) change the
  shape of their exported descriptor:

  ```diff
    export const wardleyFramework = {
      flag: 'wardley',
      telemetry: 'wardley',
  -   viewExtension: WardleyViewExtension,
  +   extensions: [
  +     { viewExtension: WardleyRenderViewExtension },
  +     { flag: 'wardley', viewExtension: WardleyViewExtension },
  +   ],
    } as const;
  ```

  `flag` and `telemetry` are unchanged. **`viewExtension` is removed** and is
  deliberately not aliased: no single extension has the old
  `flags[flag] ? register(viewExtension) : skip` semantics any more — aliasing it
  to the gated extension would leave the renderer unregistered even with the flag
  ON, and aliasing it to a composite would drop rendering with the flag OFF.

  Host migration — register every entry in `extensions`, applying `flag` only
  where present:

  ```ts
  const exts = wardleyFramework.extensions
    .filter(e => !e.flag || flags[e.flag] !== false)
    .map(e => e.viewExtension);
  ```

  `@formicoidea/labre-framework-ddd-core-domain` already shipped this list shape;
  the three single-extension DDD bundles keep the original shape untouched.

  Known residual: block view extensions (`database`, `code`, `image`, `frame`, …)
  still bundle renderer and tooling together, so a disabled _block_ renders as
  nothing. Its data is now safe in every case and comes back untouched when the
  flag is re-enabled.

- b889326: feat(blocks): every key the library will ever ask for, on one list

  A host wiring `TranslationProvider` had no way to build its catalogue except
  chasing `translateKey` call sites and `labelKey` declarations across the repo
  — and no way to know a library upgrade had added one. This slice closes the
  seam from the other side: the library now says, out loud and exhaustively,
  which keys it can ask for.

  - **`getTranslationKeyManifest()`** (`@labre/affine/translations`) — the i18n
    sibling of `getShortcutManifest` / `getCommandManifest`: every
    `com.labre.*` key with its English fallback and its source
    (`command`, `role`, `rule`, `profile`, `nudge`, `audit-criterion`,
    `reading`, `background`, `framework`, `chrome`), enumerable without an
    editor instance and flag-independent, so one catalogue serves whatever a
    host later toggles on. Data-declared keys are WALKED from the same runtime
    declarations the editor registers — a key added to a rule or a command
    appears by construction. The widget chrome literals, which live in lit
    templates, are restated once; a unit test scans the library source and
    fails when a used key is missing from the manifest, when a manifest entry
    is used by nobody, or when a restated fallback drifts from what the widget
    renders.
  - **The manifest is COMPOSED, not centralised.** Each framework package
    exports its own contribution (`wardleyTranslationEntries`,
    `edgyTranslationEntries`, …) and the core manifest assembles the chrome's
    entries with the frameworks' — the same shape the command registry already
    has, and for the same reason: `@formicoidea/labre-core` is the editor minus
    the frameworks, so a manifest that named them from the core side would be
    complete in the monorepo and 107 keys of 175 short in the distribution hosts
    actually consume. `scripts/build-bundles.mjs` strips the groups from core's
    copy exactly as it strips the command groups, and a bundled host composes
    with `mergeTranslationEntries` (`@labre/std`, new).
  - The chrome wordings that sit behind template-literal keys (violation
    severities, exemption scopes, relation sides) are now EXPORTED tables the
    manifest walks rather than wordings restated a second time — which is what
    lets the drift check reach them.
  - The translation service grew the README the seam deserved
    (`packages/affine/shared/src/services/translation-service/README.md`):
    host wiring, fallback contract, how to bootstrap a catalogue from the
    manifest, how to compose it in the bundled distribution, and why the 22
    entries with no fallback must not be seeded into `en`. The service moved
    from `translation-service.ts` to `translation-service/index.ts` to house it
    — the barrel export is unchanged, no import moves.

### Patch Changes

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
- Updated dependencies [aa08529]
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
- Updated dependencies [19edf48]
- Updated dependencies [69cdc3d]
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
- Updated dependencies [0991104]
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
  - @labre/affine-gfx-template@0.32.0
  - @labre/affine-model@0.32.0
  - @labre/affine-gfx-shape@0.32.0
  - @labre/affine-gfx-connector@0.32.0
  - @labre/affine-block-surface@0.32.0
  - @labre/affine-gfx-group@0.32.0
  - @labre/global@0.32.0
  - @labre/affine-gfx-pointer@0.32.0
  - @labre/affine-widget-edgeless-toolbar@0.32.0
  - @labre/affine-ext-loader@0.32.0

## 0.31.0

### Patch Changes

- Updated dependencies [6a663b6]
  - @labre/store@0.31.0
  - @labre/affine-block-surface@0.31.0
  - @labre/affine-components@0.31.0
  - @labre/affine-ext-loader@0.31.0
  - @labre/affine-gfx-connector@0.31.0
  - @labre/affine-gfx-group@0.31.0
  - @labre/affine-gfx-pointer@0.31.0
  - @labre/affine-gfx-shape@0.31.0
  - @labre/affine-gfx-template@0.31.0
  - @labre/affine-model@0.31.0
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
- @labre/affine-gfx-group@0.30.2
- @labre/affine-gfx-pointer@0.30.2
- @labre/affine-gfx-shape@0.30.2
- @labre/affine-gfx-template@0.30.2
- @labre/affine-model@0.30.2
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
- @labre/affine-gfx-group@0.30.1
- @labre/affine-gfx-pointer@0.30.1
- @labre/affine-gfx-shape@0.30.1
- @labre/affine-gfx-template@0.30.1
- @labre/affine-model@0.30.1
- @labre/affine-shared@0.30.1
- @labre/affine-widget-edgeless-toolbar@0.30.1
- @labre/global@0.30.1
- @labre/std@0.30.1
- @labre/store@0.30.1

## 0.30.0

### Patch Changes

- ecba791: Per-framework text-fit defaults. Event Storming stickies and Context Map
  bubbles now carry their label as the shape's own text (contained /
  overflow fit) instead of a separate grouped text element — double-click
  edits in place and the box never deforms; previously created prefabs keep
  their old structure and keep working. Estuarine hexi constraints default
  to contained; BPMN nodes and the Wardley inertia bar default to overflow.
- Updated dependencies [9d0fe0c]
- Updated dependencies [ecba791]
- Updated dependencies [8de86f4]
  - @labre/std@0.30.0
  - @labre/affine-model@0.30.0
  - @labre/affine-gfx-shape@0.30.0
  - @labre/affine-block-surface@0.30.0
  - @labre/affine-components@0.30.0
  - @labre/affine-gfx-connector@0.30.0
  - @labre/affine-gfx-group@0.30.0
  - @labre/affine-gfx-pointer@0.30.0
  - @labre/affine-gfx-template@0.30.0
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
- @labre/affine-gfx-group@0.29.1
- @labre/affine-gfx-pointer@0.29.1
- @labre/affine-gfx-shape@0.29.1
- @labre/affine-gfx-template@0.29.1
- @labre/affine-model@0.29.1
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
  - @labre/affine-gfx-group@0.29.0
  - @labre/affine-gfx-pointer@0.29.0
  - @labre/affine-gfx-shape@0.29.0
  - @labre/affine-gfx-template@0.29.0
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
  - @labre/affine-gfx-group@0.28.0
  - @labre/affine-gfx-pointer@0.28.0
  - @labre/affine-gfx-shape@0.28.0
  - @labre/affine-gfx-template@0.28.0
  - @labre/affine-model@0.28.0
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
  - @labre/affine-gfx-group@0.27.0
  - @labre/affine-gfx-pointer@0.27.0
  - @labre/affine-gfx-shape@0.27.0
  - @labre/affine-gfx-template@0.27.0
  - @labre/affine-model@0.27.0
  - @labre/affine-shared@0.27.0
  - @labre/affine-widget-edgeless-toolbar@0.27.0
  - @labre/affine-ext-loader@0.27.0
  - @labre/global@0.27.0
  - @labre/store@0.27.0

## 0.26.0

### Patch Changes

- 6795191: fix(edgeless): keep mobile canvas toolbars within the viewport

  On narrow (mobile) viewports two canvas toolbars overflowed off-screen,
  hiding actions:

  - The selected-element contextual toolbar grew to `max-content` with no
    upper bound. It is now capped to the available viewport width (floating-ui
    `size` middleware) and wraps to a second row instead of overflowing. (A
    scroll container was avoided on purpose: the "More" dropdown is a descendant
    of the toolbar, so `overflow` would clip it and make it unclickable.)
  - The senior framework slide-menu was sized to `max-width: calc(100vw - 16px)`
    but right-aligned to a center-ish toolbar button, so a near-full-width menu
    hung off the LEFT edge on mobile. It is now centered on the main toolbar and
    capped to 95% of the toolbar's width (the existing slide-menu scroll handles
    any remaining overflow), via a shared `clampSeniorMenuToToolbar` helper that
    replaces the duplicated inline positioning in all six framework senior
    buttons (Wardley, BPMN, Cynefin, EDGY, Mind Map, DDD). Desktop is unaffected
    since those menus are narrower than the cap.

- Updated dependencies [8960a6c]
- Updated dependencies [6795191]
  - @labre/affine-model@0.26.0
  - @labre/affine-components@0.26.0
  - @labre/affine-block-surface@0.26.0
  - @labre/affine-gfx-connector@0.26.0
  - @labre/affine-gfx-group@0.26.0
  - @labre/affine-gfx-pointer@0.26.0
  - @labre/affine-gfx-shape@0.26.0
  - @labre/affine-gfx-template@0.26.0
  - @labre/affine-shared@0.26.0
  - @labre/affine-widget-edgeless-toolbar@0.26.0
  - @labre/affine-ext-loader@0.26.0
  - @labre/global@0.26.0
  - @labre/std@0.26.0
  - @labre/store@0.26.0

## 0.25.0

### Patch Changes

- 6795191: fix(edgeless): keep mobile canvas toolbars within the viewport

  On narrow (mobile) viewports two canvas toolbars overflowed off-screen,
  hiding actions:

  - The selected-element contextual toolbar grew to `max-content` with no
    upper bound. It is now capped to the available viewport width (floating-ui
    `size` middleware) and wraps to a second row instead of overflowing. (A
    scroll container was avoided on purpose: the "More" dropdown is a descendant
    of the toolbar, so `overflow` would clip it and make it unclickable.)
  - The senior framework slide-menu was sized to `max-width: calc(100vw - 16px)`
    but right-aligned to a center-ish toolbar button, so a near-full-width menu
    hung off the LEFT edge on mobile. It is now centered on the main toolbar and
    capped to 95% of the toolbar's width (the existing slide-menu scroll handles
    any remaining overflow), via a shared `clampSeniorMenuToToolbar` helper that
    replaces the duplicated inline positioning in all six framework senior
    buttons (Wardley, BPMN, Cynefin, EDGY, Mind Map, DDD). Desktop is unaffected
    since those menus are narrower than the cap.

- Updated dependencies [8960a6c]
- Updated dependencies [6795191]
  - @labre/affine-model@0.25.0
  - @labre/affine-components@0.25.0
  - @labre/affine-block-surface@0.25.0
  - @labre/affine-gfx-connector@0.25.0
  - @labre/affine-gfx-group@0.25.0
  - @labre/affine-gfx-pointer@0.25.0
  - @labre/affine-gfx-shape@0.25.0
  - @labre/affine-gfx-template@0.25.0
  - @labre/affine-shared@0.25.0
  - @labre/affine-widget-edgeless-toolbar@0.25.0
  - @labre/affine-ext-loader@0.25.0
  - @labre/global@0.25.0
  - @labre/std@0.25.0
  - @labre/store@0.25.0

## 0.24.0

### Patch Changes

- Updated dependencies [bc31490]
  - @labre/affine-gfx-template@0.24.0
  - @labre/affine-block-surface@0.24.0
  - @labre/affine-components@0.24.0
  - @labre/affine-ext-loader@0.24.0
  - @labre/affine-gfx-connector@0.24.0
  - @labre/affine-gfx-group@0.24.0
  - @labre/affine-gfx-pointer@0.24.0
  - @labre/affine-gfx-shape@0.24.0
  - @labre/affine-model@0.24.0
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
  - @labre/affine-gfx-group@0.23.3
  - @labre/affine-gfx-pointer@0.23.3
  - @labre/affine-gfx-shape@0.23.3
  - @labre/affine-gfx-template@0.23.3
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
  - @labre/affine-gfx-group@0.23.2
  - @labre/affine-gfx-pointer@0.23.2
  - @labre/affine-gfx-shape@0.23.2
  - @labre/affine-gfx-template@0.23.2
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
  - @labre/affine-gfx-group@0.23.1
  - @labre/affine-gfx-pointer@0.23.1
  - @labre/affine-gfx-shape@0.23.1
  - @labre/affine-gfx-template@0.23.1
  - @labre/affine-widget-edgeless-toolbar@0.23.1
  - @labre/affine-ext-loader@0.23.1
  - @labre/affine-model@0.23.1
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

- d2f435f: Turn the edgeless template panel into a per-framework catalog of worked-example
  diagrams and prefab components. Each framework package contributes its own
  category (Wardley, EDGY, Cynefin, Estuarine, BPMN) via a new
  `extendTemplateCategory` helper, and a generic "Other" category (SWOT, Kanban,
  Business Model Canvas, Fishbone, Gantt) ships from the template package. Every
  template is composed only from existing shapes — the framework's own prefab
  shapes first, general BlockSuite shapes second — so dragging a card inserts real,
  editable elements.

  The templates senior-toolbar button now renders last (new optional `order` on
  `SeniorTool`), and the playground's placeholder cat stickers are removed.

### Patch Changes

- Updated dependencies [9014c87]
- Updated dependencies [c775151]
- Updated dependencies [d2f435f]
  - @labre/affine-model@0.23.0
  - @labre/affine-block-surface@0.23.0
  - @labre/affine-shared@0.23.0
  - @labre/affine-gfx-template@0.23.0
  - @labre/affine-widget-edgeless-toolbar@0.23.0
  - @labre/affine-components@0.23.0
  - @labre/affine-gfx-connector@0.23.0
  - @labre/affine-gfx-group@0.23.0
  - @labre/affine-gfx-pointer@0.23.0
  - @labre/affine-gfx-shape@0.23.0
  - @labre/affine-ext-loader@0.23.0
  - @labre/global@0.23.0
  - @labre/std@0.23.0
  - @labre/store@0.23.0
