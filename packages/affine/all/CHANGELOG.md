# @labre/affine

## 0.34.1

### Patch Changes

- Updated dependencies [6120f7a]
- Updated dependencies [cb49bb1]
  - @labre/affine-model@0.34.1
  - @labre/affine-gfx-bpmn@0.34.1
  - @labre/affine-gfx-c4@0.34.1
  - @labre/affine-gfx-edgy@0.34.1
  - @labre/affine-gfx-wardley@0.34.1
  - @labre/std@0.34.1
  - @labre/affine-block-surface@0.34.1
  - @labre/affine-block-attachment@0.34.1
  - @labre/affine-block-bookmark@0.34.1
  - @labre/affine-block-callout@0.34.1
  - @labre/affine-block-code@0.34.1
  - @labre/affine-block-data-view@0.34.1
  - @labre/affine-block-database@0.34.1
  - @labre/affine-block-divider@0.34.1
  - @labre/affine-block-edgeless-text@0.34.1
  - @labre/affine-block-embed@0.34.1
  - @labre/affine-block-embed-doc@0.34.1
  - @labre/affine-block-frame@0.34.1
  - @labre/affine-block-image@0.34.1
  - @labre/affine-block-latex@0.34.1
  - @labre/affine-block-list@0.34.1
  - @labre/affine-block-note@0.34.1
  - @labre/affine-block-paragraph@0.34.1
  - @labre/affine-block-root@0.34.1
  - @labre/affine-block-surface-ref@0.34.1
  - @labre/affine-block-table@0.34.1
  - @labre/affine-components@0.34.1
  - @labre/affine-fragment-adapter-panel@0.34.1
  - @labre/affine-fragment-doc-title@0.34.1
  - @labre/affine-fragment-frame-panel@0.34.1
  - @labre/affine-fragment-outline@0.34.1
  - @labre/affine-gfx-brush@0.34.1
  - @labre/affine-gfx-connector@0.34.1
  - @labre/affine-gfx-cynefin-estuarine@0.34.1
  - @labre/affine-gfx-ddd-aggregate@0.34.1
  - @labre/affine-gfx-ddd-context-map@0.34.1
  - @labre/affine-gfx-ddd-core-domain@0.34.1
  - @labre/affine-gfx-ddd-event-storming@0.34.1
  - @labre/affine-gfx-ddd-shared@0.34.1
  - @labre/affine-gfx-group@0.34.1
  - @labre/affine-gfx-link@0.34.1
  - @labre/affine-gfx-mindmap@0.34.1
  - @labre/affine-gfx-note@0.34.1
  - @labre/affine-gfx-pointer@0.34.1
  - @labre/affine-gfx-shape@0.34.1
  - @labre/affine-gfx-template@0.34.1
  - @labre/affine-gfx-text@0.34.1
  - @labre/affine-inline-comment@0.34.1
  - @labre/affine-inline-footnote@0.34.1
  - @labre/affine-inline-latex@0.34.1
  - @labre/affine-inline-link@0.34.1
  - @labre/affine-inline-mention@0.34.1
  - @labre/affine-inline-preset@0.34.1
  - @labre/affine-inline-reference@0.34.1
  - @labre/affine-rich-text@0.34.1
  - @labre/affine-shared@0.34.1
  - @labre/affine-widget-drag-handle@0.34.1
  - @labre/affine-widget-edgeless-auto-connect@0.34.1
  - @labre/affine-widget-edgeless-dragging-area@0.34.1
  - @labre/affine-widget-edgeless-selected-rect@0.34.1
  - @labre/affine-widget-edgeless-toolbar@0.34.1
  - @labre/affine-widget-edgeless-zoom-toolbar@0.34.1
  - @labre/affine-widget-frame-title@0.34.1
  - @labre/affine-widget-keyboard-toolbar@0.34.1
  - @labre/affine-widget-linked-doc@0.34.1
  - @labre/affine-widget-note-slicer@0.34.1
  - @labre/affine-widget-page-dragging-area@0.34.1
  - @labre/affine-widget-remote-selection@0.34.1
  - @labre/affine-widget-scroll-anchoring@0.34.1
  - @labre/affine-widget-toolbar@0.34.1
  - @labre/affine-widget-viewport-overlay@0.34.1
  - @labre/data-view@0.34.1
  - @labre/affine-foundation@0.34.1
  - @labre/affine-gfx-turbo-renderer@0.34.1
  - @labre/affine-widget-slash-menu@0.34.1
  - @labre/affine-ext-loader@0.34.1
  - @labre/global@0.34.1
  - @labre/store@0.34.1
  - @labre/sync@0.34.1

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

- Updated dependencies [881d3f5]
- Updated dependencies [6c1bdfb]
- Updated dependencies [8b00f7d]
- Updated dependencies [6551c82]
- Updated dependencies [5f76ab3]
- Updated dependencies [f09d68c]
  - @labre/std@0.34.0
  - @labre/affine-gfx-wardley@0.34.0
  - @labre/affine-gfx-edgy@0.34.0
  - @labre/affine-gfx-cynefin-estuarine@0.34.0
  - @labre/affine-gfx-bpmn@0.34.0
  - @labre/affine-gfx-c4@0.34.0
  - @labre/affine-gfx-ddd-event-storming@0.34.0
  - @labre/affine-gfx-ddd-core-domain@0.34.0
  - @labre/affine-gfx-ddd-context-map@0.34.0
  - @labre/affine-shared@0.34.0
  - @labre/affine-block-root@0.34.0
  - @labre/affine-block-surface@0.34.0
  - @labre/affine-block-attachment@0.34.0
  - @labre/affine-block-bookmark@0.34.0
  - @labre/affine-block-code@0.34.0
  - @labre/affine-block-database@0.34.0
  - @labre/affine-block-embed@0.34.0
  - @labre/affine-block-embed-doc@0.34.0
  - @labre/affine-block-frame@0.34.0
  - @labre/affine-block-image@0.34.0
  - @labre/affine-block-note@0.34.0
  - @labre/affine-block-surface-ref@0.34.0
  - @labre/affine-components@0.34.0
  - @labre/affine-inline-link@0.34.0
  - @labre/affine-inline-reference@0.34.0
  - @labre/affine-widget-toolbar@0.34.0
  - @labre/affine-widget-edgeless-toolbar@0.34.0
  - @labre/affine-widget-slash-menu@0.34.0
  - @labre/affine-widget-keyboard-toolbar@0.34.0
  - @labre/affine-block-callout@0.34.0
  - @labre/affine-block-data-view@0.34.0
  - @labre/affine-block-divider@0.34.0
  - @labre/affine-block-edgeless-text@0.34.0
  - @labre/affine-block-latex@0.34.0
  - @labre/affine-block-list@0.34.0
  - @labre/affine-block-paragraph@0.34.0
  - @labre/affine-block-table@0.34.0
  - @labre/data-view@0.34.0
  - @labre/affine-foundation@0.34.0
  - @labre/affine-fragment-adapter-panel@0.34.0
  - @labre/affine-fragment-doc-title@0.34.0
  - @labre/affine-fragment-frame-panel@0.34.0
  - @labre/affine-fragment-outline@0.34.0
  - @labre/affine-gfx-brush@0.34.0
  - @labre/affine-gfx-connector@0.34.0
  - @labre/affine-gfx-ddd-aggregate@0.34.0
  - @labre/affine-gfx-ddd-shared@0.34.0
  - @labre/affine-gfx-group@0.34.0
  - @labre/affine-gfx-link@0.34.0
  - @labre/affine-gfx-mindmap@0.34.0
  - @labre/affine-gfx-note@0.34.0
  - @labre/affine-gfx-pointer@0.34.0
  - @labre/affine-gfx-shape@0.34.0
  - @labre/affine-gfx-template@0.34.0
  - @labre/affine-gfx-text@0.34.0
  - @labre/affine-gfx-turbo-renderer@0.34.0
  - @labre/affine-inline-comment@0.34.0
  - @labre/affine-inline-footnote@0.34.0
  - @labre/affine-inline-latex@0.34.0
  - @labre/affine-inline-mention@0.34.0
  - @labre/affine-inline-preset@0.34.0
  - @labre/affine-model@0.34.0
  - @labre/affine-rich-text@0.34.0
  - @labre/affine-widget-drag-handle@0.34.0
  - @labre/affine-widget-edgeless-auto-connect@0.34.0
  - @labre/affine-widget-edgeless-dragging-area@0.34.0
  - @labre/affine-widget-edgeless-selected-rect@0.34.0
  - @labre/affine-widget-edgeless-zoom-toolbar@0.34.0
  - @labre/affine-widget-frame-title@0.34.0
  - @labre/affine-widget-linked-doc@0.34.0
  - @labre/affine-widget-note-slicer@0.34.0
  - @labre/affine-widget-page-dragging-area@0.34.0
  - @labre/affine-widget-remote-selection@0.34.0
  - @labre/affine-widget-scroll-anchoring@0.34.0
  - @labre/affine-widget-viewport-overlay@0.34.0
  - @labre/affine-ext-loader@0.34.0
  - @labre/global@0.34.0
  - @labre/store@0.34.0
  - @labre/sync@0.34.0

## 0.33.0

### Minor Changes

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

- 48049d6: feat(edgeless): a context map is drawn on a board, and its relationships are typed

  A Context Map now has a **board** to be drawn on — a white card, deliberately
  without axes or zones, because nothing about where a bounded context sits on the
  sheet means anything. What the board is for is the frame: it is what tells the
  tool which artefacts belong to the map, and it is what a per-map level of
  requirement is written on. It is created 1400 × 900 from a new first entry in the
  Context Map palette and can be stretched freely in either direction.

  The nine **relationship patterns changed gesture**. They used to drop a little
  drawing in mid-air — a line between two points, an abbreviation tag, two letters
  — that looked like the notation and said nothing: the line was attached to
  nothing, so nobody, human or machine, could tell which contexts it related, and
  the user still had to drag both ends onto the bubbles by hand. Choosing a pattern
  now arms the link tool, pre-styled (dashed for Separate Ways and Big Ball of Mud,
  an arrowhead towards the downstream end for the five upstream/downstream ones),
  and the user draws the relationship between two contexts. For the patterns that
  have a direction the tool says which way to drag: from the upstream context to
  the downstream one.

  That is what makes the map **readable by the tool**, and five checks come with
  it. It says so when a relationship loops back onto its own context, when the same
  pattern is drawn twice between the same two contexts, when a context is parked
  off the board, and — the two that are really about DDD — when a couple carries
  both a Conformist and an Anticorruption Layer, or a Customer/Supplier plus a
  pattern that contradicts it. An Anticorruption Layer on a Customer/Supplier is
  reported more quietly, at every level of requirement, because it is a question
  and not a mistake: it is legitimate while a model is being retired, and only the
  team knows whether that is the case. Everything else stays silent — a
  relationship drawn onto a cloud, onto a note, onto anything the model has not
  named is somebody sketching.

  Two levels of requirement ship with it, **Sketch** (the default: findings are
  recorded, the canvas says nothing) and **Strict**, chosen per board from the
  board's toolbar, plus a four-point quality checklist the tool cannot judge for
  you: every relationship carries a discussed pattern, Separate Ways are
  documented, every downstream of a Big Ball of Mud is protected, the map has a
  legend.

  **Nothing already drawn changes.** Maps made before this release carry no roles,
  so not one of them is judged, and the old relationship drawings keep rendering
  exactly as they are — they are simply drawings now, and the tool has nothing to
  say about them. Redrawing one with the new tool is what makes it a statement.

- 168617d: feat(edgeless): an event storming board carries a timeline, and its flows are typed

  Event Storming now has a **board** to be stormed on — a wide white roll, 3200 ×
  1400, freely stretchable in either direction — and it carries the one thing the
  method actually has a frame of reference for: a **time axis** along the bottom,
  running left to right. Nothing else is graduated, on purpose. How high a sticky
  sits on the wall means nothing, and drawing lanes to suggest it did would invent
  a meaning the framework does not have; swimlanes are deliberately left for a
  later release rather than half-shipped. The board is created from a new first
  entry in the Event Storming palette. The axis is drawn **heavy, and labelled
  big**: the word "Time" is set large enough to be read at the zoom where a whole
  3200-wide Big Picture fits on screen, which is the zoom a Big Picture is
  actually looked at. It is the only thing the board declares, and it should not
  be the smallest thing on it.

  The palette also gains the **Aggregate**, the pale-yellow sticky a command lands
  on and the thing that raises the event. Without it the canonical sentence —
  command, aggregate, domain event — could not be drawn at all. It is created
  larger than the others, as it is on a real wall, and in a paler yellow chosen so
  that the three yellows of the notation (constraint, actor, aggregate) can be told
  apart at a glance rather than only by position.

  **Flow changed gesture.** It used to drop a little arrow in mid-air, attached to
  nothing: it looked like the notation and said nothing, and the user still had to
  drag both ends onto the stickies by hand. Choosing Flow now arms the link tool
  and says which way to drag — from what happens first to what follows — and the
  arc the user draws references the two stickies for real.

  That is what makes the wall **readable by the tool**, and three checks come with
  it. It says so when a flow runs backwards along the timeline, when an arc is not
  one of the nine sentences Event Storming says (an actor issues a command; the
  command lands on an aggregate or an external system; that raises a domain event;
  the event triggers a policy or feeds a read model), and when two stickies cover
  each other badly enough to hide a word. Everything else stays silent: an arrow
  drawn at a **hotspot** or a constraint is somebody parking a question, not making
  a claim, and the tool has nothing to say about it — nor about an arc onto a note,
  onto a plain rectangle, or onto anything the model has not named. Two flows drawn
  between the same two stickies are not reported either: a wall gets a line drawn
  twice while three people talk at once.

  There is deliberately **no check on how stickies are named**. "Order placed"
  versus "Place order" is the first thing a facilitator corrects and the most
  tempting rule of the lot — and reading marker-pen prose in whatever language the
  room speaks is not something a tool can do without being wrong every fifth
  sticky. It is a checklist item instead, beside four others the tool cannot judge
  for you: the timeline has been read out loud and reordered, every hotspot has
  been discussed, the actors and external systems are identified, the pivotal
  events are marked.

  Three levels of requirement ship with it, chosen per board from the board's own
  toolbar, because Event Storming is not one activity but three. **Big Picture
  (Sketch)** (the default) says nothing at all — a Big Picture is supposed to be
  chaotic, and a tool arguing with that hand is judging one stage of the workshop
  by the criteria of a later one. **Process modelling** turns on the timeline and
  only the timeline: that stage is about ordering the frieze, and the kinds are
  still being settled. **Software design** turns on all three.

  **Nothing already drawn changes.** Walls stormed before this release carry no
  roles, so not one of them is judged, and the old flow arrows keep rendering
  exactly as they are — they are simply drawings now. Redrawing one with the new
  tool is what makes it a statement.

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

- 13360cd: feat(edgeless): a C4 element changes into a nearby kind from its own toolbar

  Discovering, halfway through a container diagram, that the box should have been
  the **cylinder** used to cost a delete, a re-draw, a re-connect and three tiers
  of retyped words. Select a C4 element now and its contextual toolbar carries a
  **Change type** dropdown: turn a container into a database, a mobile app or a
  web app; turn a person or a software system into its external, grey twin. The
  component stays the same component — same box, same name, same description,
  same relationships, same ids — and one ctrl+z puts it back.

  What an element may become is **declared data**: three families — the two
  people, the two software systems, and the four containers (the plain box, the
  cylinder, the phone and the browser window). Every member of a family lays its
  words out identically, which is what makes the swap free of any re-layout: the
  three tiers stay exactly where they were. Nothing crosses between the families,
  and the **component** is deliberately in none of them — a component is a part of
  a container, not another drawing of one, and offering that swap would invite a
  diagram that mixes two levels of the model. Boundaries and boards are frames and
  are never offered it either.

  What changes is the shape's kind, its role and its full appearance, taken from
  the very table the palette draws from — so a morphed database and one drawn
  fresh from the sub-menu are the same element. That matters visibly here: a
  container paints its body natively and a cylinder, a phone and a browser window
  hand it to the renderer, so a two-field patch would have left a rectangle
  painted behind the cylinder. The grey of an external element moves with it for
  the same reason.

  The component's own words follow the shape too, under one timid rule: **only
  what the notation itself wrote is rewritten, never what you typed.** An
  untouched container morphed to a database is renamed "Database" and captioned
  `[Container: technology]`, because a cylinder captioned "Container" is a picture
  contradicting itself. A container you called "Customer database", built with
  React, keeps both — the name verbatim, and the technology carried across into
  the new caption.

  Under the hood, the generic morph module now supports **composite** artefacts: a
  C4 element is a native group holding the shape and its three lines of words, so
  a spec may say which element inside the selection the kind is actually written
  on, and what else the artefact owes the change — both inside one undo step.
  BPMN's own declaration is untouched. Registering it also lifted an invisible
  ceiling: a toolbar flavour used to hold at most two modules, and both of the
  group's slots were already taken (native group operations, and Wardley's
  qualification dropdown, which is on the group for the very same reason). A
  module may now name its owner, so several frameworks can contribute to one
  element's row, and a morph's toolbar entry is scoped by the framework that
  declared it so two of them on one row can never be merged into one dropdown.
  The whole view layer is mounted in a test that fails on the collision that used
  to be silent until the editor refused to open.

- 8890efe: feat(edgeless): the senior row and the c4 catalogue follow the boards-first order, and only the board arbitrates the checklist

  Three arbitrations from the second recette wave, none of which changes what a
  document contains — all three are about the order things are met in, and about
  which element a decision is made on.

  **The senior row reads in the order the PO asked for.** Left to right: Wardley
  Maps, EDGY, Cynefin, BPMN, Event storming, C4, Core Domain Chart, Context
  Mapping. Only one button moved — Event storming now sits before C4 — but the
  mechanism that decides the row was worth writing down while we were in it. No
  framework declares a `SeniorTool.order`, so they all share the default sort
  group; `Array.prototype.sort` is stable, so the row is exactly the registration
  order of the flag-gated tooling extensions. That order is declared once, in
  `FRAMEWORK_DESCRIPTORS`, and a new spec holds `view.ts` to it — along with the
  premise it rests on, that nobody has quietly declared an `order` that would make
  the sort start mattering. The three DDD frameworks, whose always-on and
  flag-gated halves had drifted into two separate blocks, are paired back up like
  every other framework, so moving one in the row moves both halves with it.

  **The C4 sub-menu leads with the board.** A new house convention, decided on
  this pack and stated where the order is declared: for a framework of fourteen
  commands or fewer — one whose sub-menu is never arbitrated, so the author's
  order is the only order anybody ever sees — boards come first, then the base
  components, then the niche ones, and components of the same type stay adjacent.
  C4 now reads: the board, then person and person (external), system and system
  (external), container, component, then the database, the mobile app and the web
  browser, then the relationship, the two boundaries, and the export.

  This supersedes the previous order, which led with the four levels and put the
  board sixth. That order was built to make the would-be cold start _drawable_;
  the PO's answer is that a cold start opening with the sheet is drawable sooner,
  and that an external variant belongs next to the plain form it varies rather
  than in a trailing ghetto of externals. The artefact catalogue follows: its
  first section is now Diagrams rather than Elements.

  **Only the board arbitrates the level of requirement.** The Sketch / Review
  checklist selector belongs on the C4 board and on nothing else — a boundary is
  part of a diagram, not a diagram, and offering the picker twice invited two
  answers to one question.

  That left a real gap, because two of C4's rules — the homeless component and
  the person drawn inside a boundary — frame their question against the
  _boundary_, and a finding is judged by the profile of the instance it is
  attributed to. Raising a board to its review checklist would have hardened
  eleven rules and silently left those two at the sketch level for ever.

  So the engine learned the general form of the missing sentence: **a frame that
  names no profile inherits the one chosen on the frame it is drawn inside** — the
  innermost of them, by the same centre-in-the-frame arithmetic the audit, the
  membership families and the C4 export already use to answer "which frame is this
  drawn on". A frame that _does_ name one keeps it, so a framework can still offer
  a second picker the day it wants one. A frame drawn inside nothing still falls
  back to its framework's default. Cross-framework nesting needs no special case:
  a profile id belonging to another framework was already ignored, so a frame that
  inherits a foreign one lands exactly where it landed before.

  It costs nothing on a document whose author never left the default level, which
  is most of them: choosing the default back _deletes_ the field, so the engine
  still reads no geometry at all unless somebody has actually chosen something.

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

- a8325bb: feat(edgeless): a c4 component is the shape and its own text, grouped

  The PO's recette rejected the mechanism the last change shipped, and it was
  right to: an element's technology and its description were typed into a
  "Details" popover on the toolbar and painted back onto the box by the renderer.
  Two lines of the notation that an architect could read and never write on. On a
  whiteboard you write on the picture.

  **So a C4 element is now five elements that behave as one.** The shape, which
  carries no text at all; a canvas text holding the NAME; one holding the type
  line — `[Person]`, `[Container: Java and Spring MVC]`; one holding the
  description; and a group joining the four. One click selects the whole component
  and moves, copies or deletes it as one thing. A double-click opens the ordinary
  in-place editor on whichever line is under the pointer — the same gesture, the
  same editor and the same toolbar as any other words on the canvas, for all three
  of them. There is no form left anywhere in the pack, and no second kind of text.

  Double-clicking the BODY of the shape edits the name, which is what everybody's
  hand does anyway: the gesture is routed to the name's own editor rather than
  opening the shape's, so an element can never grow an invisible second name under
  its real one.

  **All three tiers exist from the moment you draw one**, carrying the official
  stencil's own prompts: the kind's label as the name, `[Container: technology]`
  under it and `description` under that. You meet three lines of stencil and
  overwrite what you have something to say about, rather than a bare box and three
  invisible slots somebody has to tell you about. A prompt is not a value: an
  element whose tiers are untouched exports as `Container(alias, "Container")`,
  not as one built with a technology called "technology". The NAME is the
  exception and goes out verbatim — an unnamed container really is a container,
  and saying so beats printing `?`.

  **Elements are taller, because the words now need the room.** A default box goes
  from 212.6 × 148.8 to **212.6 × 172.8**, and a person from 212.6 × 244.4 to
  **212.6 × 268.3**. The width is untouched — every glyph is proportioned off it,
  a person's head included. The height is no longer the stencil's textRect but the
  sum of what the box actually holds: a margin, two lines for the name, a small
  gap, the type line, a wider gap, two lines for the description, the same margin
  again. Two lines for the name is what drove the growth: "Internet Banking
  System" does not fit on one at this size, and it should not have to. Change a
  tier's size or a gap and the footprint follows, so a box can never disagree with
  its own contents. **Existing elements keep the size they were drawn at.**

  **The type line stays half the notation's.** Which of the four levels a box is,
  is the diagram's business — it comes from the element's kind, which is what the
  picture paints — so the bracketed word is rewritten from the kind whenever you
  finish editing the line, and only the TECHNOLOGY is kept. Type `Java` into a
  container's type line and it becomes `[Container: Java]`; type
  `[Person: Java]` and it still becomes `[Container: Java]`; clear it and it
  becomes `[Container]`. The rewrite happens when the editor closes, never while
  you are typing, and it is one undo away.

  The reading is deliberately forgiving, because you are typing on a picture and
  not filling in a field: a line left as `Container: Java`, as `Java`, or split
  over two lines all state the same technology. A colon that is not the notation's
  is left alone — an author whose technology is `https://internal/docs` gets to
  keep it.

  **The two removed model fields.** `technology` and `description` are gone from
  the C4 node's schema: they were added in the previous change, never released,
  and are now written on the canvas instead. Nothing in any document is migrated
  or lost — a node that never stated one wrote no key for it, which is exactly why
  they could be added without a schema bump and why they can be removed the same
  way.

  **The mermaid export says exactly what it said before**, byte for byte on the
  same diagram: the name, the technology and the description all come out of the
  words the author typed, resolved through the group and the role each text
  carries. Which text belongs to which box is answered by the GROUP, and which of
  a component's texts is the name by its ROLE — never by the order the elements
  happen to sit in, so reordering, copying or regrouping cannot swap one
  architect's technology onto another's box.

  Four behaviours worth knowing, all of them pinned:

  - an element drawn **before this change** keeps its name in the shape's own
    text, which is where the previous iteration put it, and the export reads it
    from there. Nothing is migrated or rewritten, and double-clicking such an
    element still opens the editor its name is actually in;
  - an **ungrouped** element — one whose group was released, or whose texts were
    deleted — exports with no name, no technology and no description. It is still
    a C4 element, the role being on the shape, and nothing is invented for it;
  - a **relationship dropped on the component** rather than exactly on its shape —
    on the group, or on one of the two lines of words — is written against the
    shape all the same. All four parts accept a connector and all four look like
    the same box on the canvas, so without this every such arrow would have
    vanished from the exported file with no sign that it had;
  - a group holding **two** C4 elements speaks for neither. That is a lasso drawn
    round two boxes, and an arrow landing on it points at nothing in particular.

  The node renderer no longer paints any text at all: the glyphs — the person, the
  cylinder, the phone, the browser window — are untouched, and every word on a
  component is a real element.

- 280ac0c: feat(edgeless): a C4 board leaves as a mermaid diagram

  Select a C4 board, open the "⋮" on its toolbar, and "Export as mermaid"
  downloads it as a `.mmd` file in mermaid's C4 syntax — the one you paste into
  mermaid.live, into a GitHub or GitLab markdown file, into Notion, or commit next
  to the code the diagram is about. A C4 diagram drawn here is no longer only a
  picture of an architecture.

  It exports the SELECTED board, and this is the one place C4's export deliberately
  does not do what BPMN's does. A BPMN document is a process and half a process is
  not a smaller process, so that export takes the whole surface. A C4 board is one
  LEVEL of one model — a context diagram, a container diagram, a component diagram
  — and the whole point of drawing three of them side by side is that they are
  three separate diagrams. Select several and you get several documents in one
  file, each complete and each announced by a comment; mermaid renders one diagram
  per document, so merging them would produce a file no renderer accepts.

  The diagram type is read off what is actually drawn rather than asked of you: a
  board holding a component is a `C4Component`, one holding a container, a
  database, a mobile app or a web browser is a `C4Container`, and anything else is
  a `C4Context`. The board's name becomes the diagram's `title`.

  All nine elements map. A person and an external person become `Person` and
  `Person_Ext`, a system and an external system `System` and `System_Ext`, a
  container `Container`, a database `ContainerDb`, and a component `Component`. A
  mobile app and a web browser are containers with a technology written on them —
  `Container(…, "mobile app")` and `Container(…, "web browser")` — because neither
  is a level of its own: they are a container with a picture.

  Boundaries come out nested the way you drew them. A container boundary drawn
  inside a system boundary is written inside it, and an element belongs to the
  innermost boundary whose frame its centre sits in — the same centre-in-the-plot
  arithmetic the audit and the validation rules already use, so the file and the
  canvas can never disagree about what is inside what.

  Aliases are derived from the names, so the file reads: `Rel(customer,
single_page_app, "Uses")` rather than a line of surface ids. Two elements with
  the same name get a counting suffix (`billing`, `billing_2`), and a name that
  folds to nothing keeps a short placeholder.

  **The export speaks only what the author stated.** A connector with no C4 role
  relates nothing, so it is not an untyped relationship — it is not a relationship
  at all, and it is absent. So is a box drawn with the C4 stencil and never stamped
  with a role, an element sitting on another board, and a relationship with a free
  end or an end on something outside the diagram, which mermaid has no way to write
  down. Guessing here would put words in an architect's mouth.

  Labels survive whatever is in them, with three exceptions the format forces: a
  multi-line label is joined into one line (a macro call is one line), a double
  quote becomes an apostrophe (the C4 grammar has no escape for one inside a
  quoted argument), and a run of `%%` collapses to one `%` (it would otherwise open
  a comment and swallow the rest of the statement). Accents, CJK and emoji all come
  through untouched. An element or a boundary with nothing written on it is named
  `"?"` rather than exported as a blank box.

  One consequence worth knowing: the export is C4's fourteenth catalogue entry
  against fourteen slots, so the framework still fits its sub-menu exactly — the
  thirteen artefacts, in author order, with nothing arbitrated. It has spent the
  last slot, and a fifteenth entry of any kind would start ranking the sub-menu by
  what you reach for, as BPMN's already is.

  The serializer is a pure function — element models in, mermaid string out, no
  editor anywhere near it — and is exported from the package, so a host can
  serialize a board it never rendered.

- b744736: feat(edgeless): the C4 mermaid export becomes a declared interchange capability

  The mermaid export joins the interchange registry as `c4:mermaid:export` —
  framework `c4`, format `mermaid` (semantic, `.mmd`), direction export — so the
  platform's answer to "what can Labre write, and for which framework" now
  includes C4 without anyone reading a toolbar to find out.

  Nothing about the file changes. The capability is a thin adapter over the same
  pure serializer the command has always run: it picks the C4 artefacts out of
  the elements it is handed — the shapes, the boundaries, the relationships, and
  since the grouped component the written tiers and their groups too — names the
  file, and states the content type. The `c4.exportMermaid` command now runs THIS
  capability, so the command and the registry cannot produce different bytes,
  filenames or content types — there is one door, and the registry is the label
  on it.

  One reading is C4's own: the selection is expressed through which boards the
  caller puts in the element list. A C4 board is one level of one model, so every
  board in the list becomes a document — the command passes the selected boards,
  and a headless host that hands over the whole surface gets every board, one
  document each.

  Declared by the flag-gated view extension, like the rules and profiles: with
  the `c4` flag off the capability is not offered, while a stored diagram keeps
  painting (`docs/adr/0009`, `docs/adr/0012`).

- ff19911: feat(edgeless): c4 nodes carry their name, type and description, and every node edits its text

  Three things the PO's recette asked for, on the C4 pack.

  **Every node now edits its text.** A person, a database, a mobile app and a web
  browser are drawn by their glyph rather than by a native rectangle, so the shape
  underneath them is created unfilled — and an unfilled shape is hit only near its
  border and on the few characters of its own label. The body you could plainly
  see was not a target: double-clicking it opened nothing, and dragging or
  selecting from the middle missed too. A C4 element is a BOX and its whole area
  belongs to it, so it now says so, whatever its fill. Nothing is stored and
  nothing is migrated: a diagram drawn last week behaves the same way the moment
  it is opened.

  **Nodes carry three tiers, as the notation does.** The name is the shape's own
  inner text, edited in place on a double-click. Under it the type line —
  `[Person]`, `[Software System]`, `[Container: Java]` — whose bracketed word says
  what the element is and can therefore never disagree with the picture; and under
  that the author's description. How those two are edited changed again before
  release, in the very next entry: they are canvas text you write on directly, not
  a popover, and the model carries no field for either.

  The type wording follows the official stencil, including the one entry that
  looks like a mistake: a **database says `[Container: technology]`**, not
  `[Database: …]`. A database is a container and the cylinder is a picture of one,
  not a fourth level. The mermaid export still writes `ContainerDb` — a different
  question in a different grammar. An external element says the same word as the
  kind it is external to; what "external" changes is the colour.

  **The mermaid export carries them.** `Person(alias, "name", "description")`,
  `Container(alias, "name", "technology", "description")`, and — the case worth
  knowing — `ContainerDb(alias, "name", "", "description")` when there is a
  description and no technology: those arguments are positional, and a sentence
  written in the technology's slot would be read as the technology. An author's own
  technology now wins over the default a phone or a browser window carries. A
  technology typed on a person is drawn on the canvas and does not survive the
  export, because mermaid's `Person` has no slot for one.

  **The glyphs are redrawn against the reference stencil**, path by path, from the
  PO's own model file rather than from memory. The person is a circular head about
  half the box wide, its top flush with the element, fused into a strongly rounded
  body — one silhouette, not a disc parked over a block. The phone and the browser
  window are no longer a band painted over a coloured box: their outer rectangle
  is the darker colour — the bezel, the frame — with a lighter screen inset in it,
  a home button and a speaker slot on the one, three dots and an address bar on
  the other. The four boxed levels lose their rounded corners, because the stencil
  draws them square. Every border is the stencil's own darker shade of its fill
  rather than one darkened by eye, which is what makes the two devices read at all.

  **Sizes change.** Seven of the nine kinds now share one footprint — 212 × 148,
  the stencil's single repeated box at ×2 — so a row of elements lines up without
  anybody arranging them. The two people are 212 × 244, and that is the stencil's
  own exception rather than a preference: its person path puts the head clear
  above a body that is itself the standard height, and its sheet shifts the person
  down the page to make room. Squeezing that into the shared box would turn the
  head into a flat ellipse, which is the one thing about a C4 person everybody
  recognises. **Existing nodes keep the size they were drawn at** — this is a
  creation-time default, like every other value here.

  Boundaries and relationships pick up the stencil's own line work too: both are
  drawn in one neutral grey at the stencil's weights and dashes, and a boundary's
  corners are square. A boundary now writes its level under its name —
  `[Software System]` or `[Container]` — derived from the variant, so a boundary
  drawn before this change gets its line as well. That line is vocabulary rather
  than the author's words: it goes through the host's catalogue like every other
  piece of framework wording, and the in-place editor still opens on the name and
  only the name.

  One limit, stated rather than worked around: the relationship's label is drawn
  by the connector primitive, which has no white background pill of the kind the
  stencil puts behind "Uses [technology]". The line, its dash, its weight, its
  grey and its filled arrowhead all match; the label sits on the diagram.

- b03132c: feat(std): runCommand feeds an injectable usage store

  The editor now measures how recently and how often each command was invoked,
  and exposes the seam a host needs to persist those measures itself.

  `runCommand` — already the one place a command runs and the one place its
  telemetry is emitted — records every invocation into `CommandUsageIdentifier`.
  Every invocation, not every instrumented one: the call sits outside the
  telemetry condition, so core actions, toggles and the self-emitting commands
  are counted like the rest. Telemetry leaves for a dashboard; usage is local
  state the editor reads back, and the sub-menu that will show a framework's
  seven most relevant commands has to rank artefacts nobody thought to
  instrument.

  The default store keeps the pair of numbers in this browser's `localStorage`,
  capped and best-effort: a browser refusing storage costs a measure, never a
  command. A host that owns per-user state replaces it wholesale with
  `CommandUsageExtension(store)`, so the ranking follows the user from laptop to
  tablet instead of restarting at zero.

  Measurement only — nothing ranks anything yet, and no menu changes.

- 90145f1: test(blocks): the image adapter snapshot suites stop racing the vite cache

  The `image` cases of the html and markdown adapter suites failed on every cold
  vite transform cache and passed on every warm one — the first test to pull a
  lazily-imported chunk paid the whole transform cost against a `testTimeout` of
  1000 ms that assumed a warm, idle machine. The package's test timeout is now
  10 s, the same budget the other heavy view packages (`affine-components`, the
  toolbar widgets, the gfx template) already use for the same reason. Test
  configuration only; no runtime behaviour changes.

- 9022c92: feat(blocks): a framework background can declare zones its instances shape

  Until now a background's zones were the framework's: the same four quadrants on
  every Cynefin grid, the same four phases on every Wardley map. A framework can
  now declare that its elements carry a partition of their OWN plot —
  `instanceZones` names the model prop that holds it, which way the pieces stack,
  the line drawn between two of them and the style their names are written in.
  The named consumer is the **BPMN pool's lanes (couloirs)**, arriving in the next
  tranche; this one is the platform capability alone, and no framework in the
  library declares the field yet.

  Sizes are relative **weights**, never lengths. A pool with lanes of `1, 2, 1`
  gives the middle one half its height at any size, and dragging the pool taller
  redistributes the extra space proportionally instead of leaving a gap under the
  last band. It is the same reasoning every position in the primitive is a ratio
  of the plot for: a background survives being stretched, and so must the
  partition the user drew on it. A row with no finite, positive size is dropped
  with a warning and its neighbours share the space — one band fewer, never an
  invented one, and never a broken frame.

  The dividers are painted with the zone tints they separate, under the
  graduations and the axis lines; the names are written horizontally at the
  top-left of each band, with the other texts. Zone names are drawn by the
  renderer and are **not** double-clickable on the canvas: the label walk that
  feeds the hit tester is a function of the declaration alone, and a zone is
  created, deleted and renamed through its framework's own tooling.

  The audit reports an instance's zones after the framework's, namespaced
  (`lane:sales`) so a user-named zone cannot shadow a declared one, and carrying
  the user's own wording in a new optional `name`. An element's `zone` fact
  therefore now reads `lane:<id>` on a frame that partitions itself, with no
  change to how it is resolved.

  **No document changes**, and nothing on screen moves: a declaration that says
  nothing about instance zones paints exactly the picture it painted before, down
  to the canvas operation.

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

- e42e0c0: feat(std): the senior menu caps at fourteen and ranks seven past it

  A framework's senior button opens one row of buttons, and that row holds
  **fourteen**. Until now that number was a design review: the registry test
  refused a framework that _declared_ more than fourteen sub-menu commands, and
  nothing said what a framework should do once its toolbox honestly outgrew them.
  It now has an answer.

  Below the cap nothing changes at all — the sub-menu is the framework's authored
  list, whole and in the order its author wrote it. Past it, the row becomes a
  **shortcut to the seven artefacts this user actually reaches for**: the four
  most-used plus the three most-recent, deduplicated, with a command that tops
  both axes taking one slot and handing the freed one back to frequency. Two axes
  rather than one, because frequency alone never surfaces the tool picked up
  yesterday and recency alone would reshuffle the row at every click.

  The seven are then laid out **in authored order, never in rank order**. What the
  ranking decides is membership; position stays where the framework put it,
  because a menu whose buttons swap places under the cursor is precisely the
  pattern this feature exists to avoid. On a fresh install, with nothing measured
  yet, both axes collapse to authored order and the row shows the first seven — a
  cold start that is deterministic rather than empty.

  The ranking reads the framework's **whole catalogue**, not the fourteen its
  author picked. An artefact left out of the row that a user invokes constantly
  has earned a slot, and a selection that could only ever demote would never learn
  that.

  Beside the seven sits a permanent **More artefacts…** button, opening the
  catalogue sidepanel on the framework's full toolbox — and it appears only when
  something answers the new `ArtefactCatalogueProvider` seam, since a button that
  opens nothing is a dead control. The seam ships here as an interface; the panel
  behind it arrives in its own release.

  **Nothing visible changes today.** The largest framework in the library declares
  thirteen artefacts, so no senior menu is past the cap and every one of them
  still shows its whole toolbox. This is the rule the BPMN full pack will be the
  first to meet.

  > **Superseded later in this same release** — "The senior sub-menu seats
  > thirteen". The PO re-arbitrated on 28/08/2026: the row seats **thirteen**
  > (seven most-recent + six most-used), and the ranking reads the framework's
  > **nominated `senior-menu` list** rather than its whole catalogue. The cap of
  > fourteen, the author-order position law and the deterministic cold start below
  > are unchanged.

- 256ee0b: feat(edgeless): the artefact catalogue sidepanel

  A framework's senior sub-menu is a row of icons, and a row of icons stops
  working somewhere around fourteen. The catalogue is where the rest go: a
  full-height column down the left edge of the editor, listing everything the
  framework declares on the `'catalogue'` surface — grouped by the categories the
  framework itself declared, each artefact spelled out with its icon, its
  translated label and its keyboard chord instead of guessed from a glyph.

  It is drawn from the command registry and nothing else, so a framework that
  adds an artefact gets a row for it with no code written here. Rows are at least
  44px tall because these boards are worked on a tablet as often as on a laptop;
  the list scrolls, the canvas behind it does not. One tap runs the command and
  puts the panel away — and X, Escape and a click on the canvas all close it on
  the first gesture, none of them touching the tool the user had armed.

  `ArtefactCatalogueProvider` is the seam. The library registers its own panel as
  the default implementation, unconditionally; a host that already owns a sidebar
  registers `ArtefactCatalogueExtension(service)` and takes the catalogue over,
  after which the library's widget is never asked to open.

  Dormant until something opens it: no framework overflows its sub-menu yet, so
  today nothing calls `open` — the panel is there for the BPMN pack and for the
  hosts that want the catalogue on their own terms.

- 4a3b26e: feat(edgeless): the C4 pack draws people, systems, containers and boundaries

  C4 is the notation an architect reaches for when somebody asks "what IS this
  system" — four levels, drawn one zoom at a time: the people and systems around
  it, the containers it is made of, the components inside one of those. Until now
  it was drawn here with rectangles and explained in a meeting. The pack now ships
  its model, its vocabulary and its rendering.

  **Nine artefacts.** A **person** and an **external person**, drawn as the
  stencil draws them — a head over a rounded body block; a **software system** and
  an **external system**; a **container**, and the three flavours C4 gives a
  picture of their own: a **database** (a cylinder), a **mobile app** (a phone
  bezel down its leading edge) and a **web app** (a browser chrome band with its
  three dots); and a **component**.

  They are drawn in C4's own colour code, which is not decoration but the
  notation: the four levels run from the near-navy of a person through the blue of
  a system and the lighter blue of a container to the pale wash of a component,
  and anything outside the scope of the diagram is grey. That colour is what tells
  a container from a component when both are rounded rectangles with words in
  them — and it is why the pack has nine artefacts but only five element roles.

  **Two frames.** The **C4 board** is a plain titled white card: no axes, no
  zones, because a C4 diagram is a graph and a system drawn top left says nothing
  more than one drawn bottom right. Its title is what names the level being drawn,
  and a double-click on it renames it in place.

  The **boundary** is the dashed rectangle drawn round a group of elements to say
  "all of this is one system". It is the first background in the library that is
  deliberately TRANSPARENT: every other one is a card you put things on, and this
  one is drawn OVER a diagram that is already there — an opaque card would hide
  the very thing it is pointing at. Its name sits in the bottom-left corner, where
  C4 puts it, and renames the same way. A boundary can say which level it encloses
  (a system boundary or a container boundary); the field is optional, and a
  boundary that says nothing reads as the outer one.

  **Eight roles** join the vocabulary: `c4:person`, `c4:system`, `c4:container`,
  `c4:database`, `c4:component`, the two frames, and one edge —
  `c4:relationship`, because C4 has exactly one kind of line and its label is
  where the author says which kind of using it is. The four LEVELS are deliberately
  flat: a container is _part of_ a system, not _a kind of_ system, so filing them
  in a chain would make every rule about systems fall on every container. The one
  specialisation declared is the one C4 itself draws — a database is a container,
  so everything written about containers already reaches it.

  **Nothing already drawn changes.** The three element types are new; no existing
  model is touched, no field is renamed, and the one optional field in the pack
  writes nothing when it is not used — so there is no schema version bump and no
  migration.

  The framework-background primitive gains one thing along the way: a background
  may now declare its card's border DASHED. That is what the boundary is, and it
  belongs in the declaration a reviewer can read rather than in a renderer only
  one framework would ever have. Every existing declaration is unchanged and
  paints the solid line it always painted.

  The palette entries, shortcuts, templates and the senior toolbar button follow
  in the next release; this one is the model, the vocabulary and the rendering.

- 6882201: feat(edgeless): the C4 senior button, board and catalogue tooling

  The C4 pack shipped its models and its rendering last week: a diagram drawn by
  hand painted correctly, and there was no way to draw one. This is the toolbox.

  A **C4 button** joins the edgeless toolbar, and its sub-menu holds thirteen
  entries: the four levels of the model (person, software system, container,
  component), the relationship that joins any two of them, the board they are
  drawn on, the database, the system and container boundaries, the mobile app and
  the web browser, and the two "somebody else owns this" variants of the person
  and the system. Thirteen against a menu that holds fourteen — C4 is the last
  framework that FITS, so nothing is ranked away and the row is exactly the list
  above, in that order.

  The order is not decorative. It leads with the seven a C4 diagram cannot be
  drawn without, because the day a fourteenth artefact lands those seven become
  the first thing a new user meets. BPMN learned that in a live recette, with a
  first contact that offered six ways to draw a circle and nothing to connect
  them.

  Everything is in the **artefact catalogue** and bindable from
  Settings › Shortcuts, filed under four headers: Elements, Relations, Diagrams
  and Boundaries — the last of which is new to the library, because a boundary is
  neither an element of the model nor the sheet it is drawn on.

  Every element is created in the stencil's own colours and stamped with the role
  that says what it MEANS — which is the only thing that can say so, since three
  of the four levels are the same rounded rectangle. The person and the database
  are created as outlines the renderer fills in, so their head-and-body and their
  cylinder are drawn rather than approximated.

  The **relationship tool** arms a straight, dashed, grey arrow with a filled
  head: the stencil's own line, and the only kind of line C4 has. It is a typed
  edge — its verb is "uses", the source is the element with the need — so hovering
  it says which way it reads, on a board whose C4 button is switched off as much
  as on one where it is on.

  Selecting a board offers its own row: lock or unlock resizing, and **generate a
  legend** of the notation actually used on it. The legend lists what is drawn and
  nothing else — a board of cylinders lists a database and not a container — and
  it arrives as real, editable elements you can move and rewrite. It is reached
  from that button and from nowhere else: generating a legend is something you do
  to a board you are looking at, not an artefact to pick off a palette, so it is
  deliberately absent from the catalogue and from Settings › Shortcuts. Renaming a
  board or a boundary is unchanged: double-click the words.

  With the C4 tooling switched off, a stored board keeps painting, stays
  selectable and keeps its resize toggle; the legend button goes with the rest of
  the C4 gestures, since generating one CREATES elements.

- 48c3b52: The catalogue leads with what you reach for

  The sidepanel now opens on a "Recent & frequent" head section (PO recette,
  27/08/2026): the same seven-slot arbitration the senior sub-menu runs,
  re-consumed through the new pure `rankCommandsByUsage` — one ranking, two
  consumers, never two opinions. (Later in this same release the two axes swap
  priority to recency-first, and the sub-menu grows to thirteen slots while this
  section stays at seven — see "The senior sub-menu seats thirteen".)
  Only commands that actually carry a measure appear, so a fresh install shows
  no section rather than a "recent" label padded with the never-used; the rows
  repeat below in their categories, the way every launcher does it.

- 2bcfef0: The context map legend lives on its board alone

  The palette carried a static, full-notation Legend entry beside the board's
  own automatic legend — two answers to one question. The PO's recette
  (27/08/2026) removed the palette entry: the ONE legend is the contextual
  auto-legend on the selected board, the same single gesture Core Domain Chart
  has always had. The palette shrinks to twelve commands; the removal is pinned
  by test so a duplicate has to explain itself.

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

- 7d49a23: feat(edgeless): a Wardley map arrives from and leaves as an OnlineWardleyMaps `.owm` file

  Two new entries in the Wardley catalogue, and they are one subject in two
  directions: **Import Wardley map (OWM)** and **Export Wardley map (OWM)**.

  **Import** is in the Wardley sub-menu, because on an empty canvas that row is
  the first thing you open and "start from the map somebody sent me" belongs in
  it. Pick a `.owm` (or `.wm`) file and the map is on the board: the axes, every
  component, anchor, market, ecosystem and pipeline where the file's coordinates
  put them, every dependency drawn from the consumer to what it needs, every
  `evolve` line drawn as an evolved twin with the red arrow that says it is
  moving, and the notes. It needs nothing selected. It writes, so it withdraws
  from every surface on a read-only document rather than sitting there lit and
  doing nothing. The whole file is one undo step, and it arrives in view.

  **Export** is in the catalogue, the command palette and the agent surface. It
  downloads the whole map as an `.owm`, ready to open in any Wardley mapping tool.
  It reads and never writes, so it is offered on a locked map and on a read-only
  document — which is precisely the board somebody wants to take away. It appears
  whenever there is a Wardley map on the board, because a Wardley component has no
  "evolution" property: where it sits on the plot **is** its coordinate, so with no
  map there is nothing to measure against.

  **A map you imported keeps the title its file gave it.** Export writes the
  title the `.owm` carried, not the name of the Labre document it happens to be
  sitting in — so a map you opened from a colleague's file goes back to them under
  the title they gave it. The document's name is still what the download is
  called, and it becomes the title only when the file carried none. When the two
  differ the export says so.

  **The import says what it cost.** A notification names what was drawn and what
  was carried — kept verbatim in the document, invisible on the canvas, because
  Labre draws no artefact for it. Everything the pack does not draw is carried and
  given back on the next export, in place: `style`, `size`, the evolution-axis
  labels, `annotation`, the attitudes, `submap`, `url`, `accelerator`, the flow
  links, a link with a `;` context, a pipeline with a `{ … }` body, and every `//`
  comment. A modifier written on a line that IS drawn — `label [12, -8]`,
  `(build)`, `inertia` — comes back on that very line rather than at the bottom of
  the file.

  **And it never claims a position it invented.** A statement with no coordinates —
  `anchor Client`, which is how half the maps in the wild are written — is laid out
  at the top of the value chain and the report says, by name, that the file did not
  say where it goes. Unreadable coordinates get the same treatment plus a warning.

  **Export warnings reach the user too.** A board with two maps on it (an `.owm`
  holds one), an artefact with no name (a component is identified by its name), a
  component sitting off the plot, an evolution arrow that also climbs the value
  chain, a link with a loose end — each is a sentence the format has no way to
  write down, and the person who clicked Export is the one entitled to hear about
  it. The file still downloads, and it is still valid.

  Both notifications go through the host's notification service; a standalone
  playground registers none and degrades to silence.

  **The Wardley sub-menu now has a "More artefacts…" button.** Fifteen commands is one past the fourteen the row seats, so — exactly as BPMN's does — the Wardley palette becomes the thirteen artefacts you reach for most, plus one button that opens the full catalogue. Nothing became unreachable, and everything is still in the catalogue, the command palette and Settings › Shortcuts.

  **The serializer now lives in the library.** It used to live outside this
  repository, which meant one format with two implementations that nothing
  compared. `exportWardleyOwm` and `importWardleyOwm` are pure functions exported
  from the Wardley package, so the editor command and any host tool call the same
  one — and the round trip they make together is pinned: a map this library wrote
  comes back byte for byte, and a map it did not settles after a single cycle.

- Updated dependencies [3fbf69c]
- Updated dependencies [f929e12]
- Updated dependencies [13360cd]
- Updated dependencies [5c39582]
- Updated dependencies [8890efe]
- Updated dependencies [4671780]
- Updated dependencies [c03090c]
- Updated dependencies [766eae8]
- Updated dependencies [82d2795]
- Updated dependencies [2b41d04]
- Updated dependencies [32e4d45]
- Updated dependencies [139d77b]
- Updated dependencies [6bba40c]
- Updated dependencies [70dffb7]
- Updated dependencies [a9a0a61]
- Updated dependencies [91fdeed]
- Updated dependencies [d892d97]
- Updated dependencies [a8325bb]
- Updated dependencies [f2aba60]
- Updated dependencies [280ac0c]
- Updated dependencies [b744736]
- Updated dependencies [ff19911]
- Updated dependencies [04ac693]
- Updated dependencies [7aa932c]
- Updated dependencies [b03132c]
- Updated dependencies [48049d6]
- Updated dependencies [7136db0]
- Updated dependencies [cbd9471]
- Updated dependencies [932bf35]
- Updated dependencies [6fd58e5]
- Updated dependencies [21aa9d8]
- Updated dependencies [9f91a96]
- Updated dependencies [5737a56]
- Updated dependencies [753872b]
- Updated dependencies [2dc39cf]
- Updated dependencies [168617d]
- Updated dependencies [932bf35]
- Updated dependencies [1dbd735]
- Updated dependencies [9022c92]
- Updated dependencies [b97efc6]
- Updated dependencies [edfaba2]
- Updated dependencies [46ce0c9]
- Updated dependencies [334bd61]
- Updated dependencies [2ec39c0]
- Updated dependencies [7ec4478]
- Updated dependencies [a9eb4f6]
- Updated dependencies [e42e0c0]
- Updated dependencies [256ee0b]
- Updated dependencies [4a3b26e]
- Updated dependencies [6882201]
- Updated dependencies [48c3b52]
- Updated dependencies [6a20738]
- Updated dependencies [2bcfef0]
- Updated dependencies [d5c6f07]
- Updated dependencies [e58b13e]
- Updated dependencies [f09f9a3]
- Updated dependencies [7d49a23]
  - @labre/affine-block-surface@0.33.0
  - @labre/affine-components@0.33.0
  - @labre/affine-gfx-bpmn@0.33.0
  - @labre/affine-shared@0.33.0
  - @labre/affine-gfx-c4@0.33.0
  - @labre/affine-model@0.33.0
  - @labre/affine-widget-toolbar@0.33.0
  - @labre/affine-gfx-wardley@0.33.0
  - @labre/std@0.33.0
  - @labre/affine-gfx-ddd-shared@0.33.0
  - @labre/affine-gfx-ddd-context-map@0.33.0
  - @labre/affine-gfx-ddd-core-domain@0.33.0
  - @labre/affine-gfx-ddd-event-storming@0.33.0
  - @labre/affine-gfx-edgy@0.33.0
  - @labre/affine-gfx-cynefin-estuarine@0.33.0
  - @labre/affine-gfx-connector@0.33.0
  - @labre/affine-widget-edgeless-toolbar@0.33.0
  - @labre/affine-block-attachment@0.33.0
  - @labre/affine-block-bookmark@0.33.0
  - @labre/affine-block-edgeless-text@0.33.0
  - @labre/affine-block-embed@0.33.0
  - @labre/affine-block-embed-doc@0.33.0
  - @labre/affine-block-frame@0.33.0
  - @labre/affine-block-image@0.33.0
  - @labre/affine-block-note@0.33.0
  - @labre/affine-block-root@0.33.0
  - @labre/affine-block-surface-ref@0.33.0
  - @labre/affine-fragment-doc-title@0.33.0
  - @labre/affine-fragment-frame-panel@0.33.0
  - @labre/affine-gfx-brush@0.33.0
  - @labre/affine-gfx-ddd-aggregate@0.33.0
  - @labre/affine-gfx-group@0.33.0
  - @labre/affine-gfx-link@0.33.0
  - @labre/affine-gfx-mindmap@0.33.0
  - @labre/affine-gfx-note@0.33.0
  - @labre/affine-gfx-pointer@0.33.0
  - @labre/affine-gfx-shape@0.33.0
  - @labre/affine-gfx-template@0.33.0
  - @labre/affine-gfx-text@0.33.0
  - @labre/affine-widget-drag-handle@0.33.0
  - @labre/affine-widget-edgeless-auto-connect@0.33.0
  - @labre/affine-widget-edgeless-dragging-area@0.33.0
  - @labre/affine-widget-edgeless-selected-rect@0.33.0
  - @labre/affine-widget-edgeless-zoom-toolbar@0.33.0
  - @labre/affine-widget-frame-title@0.33.0
  - @labre/affine-widget-keyboard-toolbar@0.33.0
  - @labre/affine-widget-note-slicer@0.33.0
  - @labre/affine-widget-remote-selection@0.33.0
  - @labre/affine-block-callout@0.33.0
  - @labre/affine-block-code@0.33.0
  - @labre/affine-block-data-view@0.33.0
  - @labre/affine-block-database@0.33.0
  - @labre/affine-block-divider@0.33.0
  - @labre/affine-block-latex@0.33.0
  - @labre/affine-block-list@0.33.0
  - @labre/affine-block-paragraph@0.33.0
  - @labre/affine-block-table@0.33.0
  - @labre/data-view@0.33.0
  - @labre/affine-foundation@0.33.0
  - @labre/affine-fragment-adapter-panel@0.33.0
  - @labre/affine-fragment-outline@0.33.0
  - @labre/affine-inline-footnote@0.33.0
  - @labre/affine-inline-latex@0.33.0
  - @labre/affine-inline-link@0.33.0
  - @labre/affine-inline-mention@0.33.0
  - @labre/affine-inline-preset@0.33.0
  - @labre/affine-inline-reference@0.33.0
  - @labre/affine-rich-text@0.33.0
  - @labre/affine-widget-linked-doc@0.33.0
  - @labre/affine-widget-page-dragging-area@0.33.0
  - @labre/affine-widget-slash-menu@0.33.0
  - @labre/affine-widget-viewport-overlay@0.33.0
  - @labre/affine-inline-comment@0.33.0
  - @labre/affine-widget-scroll-anchoring@0.33.0
  - @labre/affine-gfx-turbo-renderer@0.33.0
  - @labre/affine-ext-loader@0.33.0
  - @labre/global@0.33.0
  - @labre/store@0.33.0
  - @labre/sync@0.33.0

## 0.32.0

### Minor Changes

- bb482e8: The AI audit seam, for a host-side assistant (PF14.1)
  A framework can now declare **audit criteria** as versioned data, and a host can
  plug an assistant in to evaluate them. The library ships the seam and nothing
  else: no model, no prompt runner, and no dependency on one. Wardley ships the
  first three criteria — A1 positioning is justified (contextual ubiquity, not
  technical maturity), A2 the value chain is legible, A3 the model applies here
  (competitive landscapes only). See `docs/adr/0008` § surface `'agent'`.
  **The invariant.** The deterministic engine never depends on the AI. Levels 1
  and 2 — the rules evaluated inside the 16 ms frame budget — are computed,
  rendered and arbitrated with no knowledge that the seam exists. Audit results
  land in a **separate signal** (`ValidationManager.auditFindings# @labre/affine
), never in
  `violations# @labre/affine
  , and their severity is forced to `audit` library-side rather than
  trusted, so a provider cannot put a model's opinion behind a canvas bracket. A
  bench asserts the numeric half: a board carrying a finding per element re-judges
  in the same time as a clean one.
  **What hosts get.**

  1. `AuditExtension(service)` injects an `AuditService`:

     ```ts
     runAudit(
       request: { criteria: AuditCriterion[]; facts: AuditFacts },
       options: { onProgress?: (p: AuditProgress) => void; signal?: AbortSignal }
     ): Promise<AuditResult>
     ```

     `facts` is render-free and serializable end to end (ADR 0006 § 5): the role
     vocabulary, each framework frame with its axes and named zones as plot
     ratios, every role-carrying element placed inside its frame, and the level
     1/2 findings the engine already computed. No element model, no `Bound`, no
     template, no function — it survives a `postMessage`.

  2. The `map.audit` command, on the `'agent'` and `'palette'` surfaces,
     `availability: 'selection:framework'`, keyless but bindable.

  3. Three telemetry events — `MapAuditStarted`, `MapAuditCompleted`,
     `MapAuditInterrupted` — carrying counts and ids only.
     **A new switch axis: `OPTIONAL_CAPABILITIES`.** `ai-audit` gates the command,
     with the same contract as a block flag (missing key = enabled, disabling removes
     tooling only) but on its **own list**, because `OPTIONAL_BLOCKS` answers "does
     this block or framework exist for this user" and every entry there names
     something a document can contain. A capability names none. Hosts still pass one
     object: `LabreFlags = BlockFlags & CapabilityFlags`, and the two key spaces are
     disjoint, so a host that only ever spoke `BlockFlags` keeps compiling and
     behaving identically.
     Nothing here is persisted — criteria are code, findings are session state — so
     switching `ai-audit` off cannot lose data even in principle.
     **The request is isolated on the way out.** `requestAudit` hands the provider a
     `structuredClone` of the request, not the caller's objects. This is the outbound
     half of "a provider is not believed", symmetric with the finding normalisation:
     some facts are not fresh objects — an axis `forward` vector came straight from a
     module constant the engine multiplies against — so a provider writing into its
     own input could flip an axis convention and turn correct arrows into violations
     on the canvas. The clone closes the whole class, at a cost the seam already
     claims (the request must be serializable).
     **Two audits at once: the newest wins.** An audit is a network call and takes
     seconds, so a user asking again while the first is in flight is ordinary. Runs
     carry a generation; a run superseded by a newer one publishes nothing and
     reports `MapAuditInterrupted` with `reason: 'superseded'` rather than a
     completion whose `findingCount` describes findings nobody will see.
     **Degradation is the default path.** No noop provider is registered. With none
     injected (the standalone playground, every unit suite), `map.audit` is still
     enumerable but refuses cleanly with `status: 'unavailable'` — not a throw, not a
     console error — and levels 1 and 2 are untouched. A registered provider may also
     _declare_ itself unavailable (assistant behind an app-side feature flag, quota
     exhausted, no model configured); that is passed through rather than folded into
     `complete`. A provider that throws becomes `status: 'error'`; an abort, whatever
     shape it arrives in, becomes `status: 'aborted'` and **keeps the findings already
     produced**.
     **Host panels must tolerate stale element ids.** `AuditFinding.elementIds` is
     checked for type and not validated against the surface: the board moves on while
     an audit is in flight, so an id naming a departed element is stale rather than
     wrong, and a lookup per id would be paid on every finding to say so.
     **`map.audit` carries no read-only guard, deliberately.** Unlike `pivot.bind`,
     it writes nothing: reviewing a map you have been given and cannot change is not
     an edge case for an audit, it is the case. A test asserts it runs to completion
     against a read-only store that throws on any write.

- 612c859: One command registry behind every surface (PF3)

  Every framework artefact is now declared exactly once, as a `CommandDescriptor`
  in `@labre/std`. The senior button sub-menu, the keyboard bindings and
  Settings › Shortcuts all read that one list instead of each keeping their own
  — which is how Wardley's menu had drifted to 13 artefacts against 7 in the
  shortcut manifest, and how EDGY, BPMN, Cynefin/Estuarine and the three DDD
  palettes were completely absent from Settings › Shortcuts. See
  `docs/adr/0008`.

  60 framework commands were converted in one release (wardley 13, edgy 7, bpmn
  6, cynefin-estuarine 3, ddd-event-storming 9, ddd-core-domain 10,
  ddd-context-map 12), plus the 6 core ones.

  **What users see.** Settings › Shortcuts grows from ~10 rows to 66: every
  command is listed and bindable, including the ~53 that ship with no default
  chord. The effective keymap is unchanged — the same combos trigger the same
  actions, and existing override tables keep working (a golden test compares the
  resolved keymap, per platform and per scope, against the pre-switchover one).
  Cynefin/Estuarine starts reporting telemetry, which it never did.

  **What hosts must change.**

  1. `ShortcutManifestEntry` changes shape. It still describes shortcuts and
     nothing else — no `iconKey`, no `category` — but `when?: string` is gone (no
     descriptor in the library ever set it), `defaultKeys` is always present, and
     `owner` narrows from `string` to `CommandOwner`. Recompile; nothing changes
     at runtime.
  2. Framework bundles' `descriptor.ts` renames `telemetry` to `telemetryKey`,
     which now carries the historical analytics value in every case (it used to
     echo the flag key, so the three DDD bundles advertised a value the library
     never sent):

     ```diff
     - import { dddEventStormingFramework } from '@formicoidea/labre-framework-ddd-event-storming/descriptor';
     - registerFramework(dddEventStormingFramework.telemetry);   // 'ddd-event-storming'
     + registerFramework(dddEventStormingFramework.telemetryKey); // 'event-storming'
     ```

  3. Menu tooltips are i18n keys now (`com.labre.commands.<id>`). Each command
     also ships the English wording it replaced as a fallback, so a host with no
     catalogue entry reads exactly as before — but a host that wants them
     localised must extend its catalogue with the new keys. **No existing key was
     renamed**: `com.affine.keyboardShortcuts.*` and the seven
     `com.labre.keyboardShortcuts.wardley.*` are carried over verbatim.
  4. **`undo` / `redo` now stop propagation.** Their handlers used to return
     `undefined` after `preventDefault()`, so the keystroke kept travelling; the
     projection returns `true` uniformly. Nothing inside the editor was reading
     `Mod-z` / `Shift-Mod-z` — they are the only handlers bound to those combos —
     but **an application listener mounted above the editor will no longer see
     those keystrokes**. This does not fail at compile time; if you rely on it,
     listen in the capture phase.
  5. New entry points: `@labre/affine/commands` (`getCommands`,
     `getCommandManifest`, `getCommandManifestForSurface`) and
     `@labre/affine/frameworks` (`FRAMEWORK_DESCRIPTORS` — per-framework label,
     icon, chord prefix, analytics keys and packaging, the identity that was
     previously spelled five times and had drifted).

  **Analytics are unaffected.** The per-menu `track()` helpers are gone; emission
  happens once, in the registry's `run()`. `framework` and `segment` keep their
  historical PostHog values through `FrameworkDescriptor.telemetryKey` /
  `telemetrySegment`, and events gain one field — `control`, naming which surface
  invoked the command. Existing dashboards keep working untouched.

  Disabling a framework's flag now removes its commands from the registry, the
  keymap and the sub-menu at once, while its already-drawn elements keep painting
  as before.

  **Known limitation.** Telemetry reports that a command was _invoked_, not that
  its gesture _completed_: `edgy.insertDynamic` is asynchronous and emits while
  its template insertion is still pending. That was already true of the per-menu
  `track()` it replaces, so no metric changes — but it is now one central
  decision rather than five scattered ones, and therefore worth revisiting when
  outcome-level reporting is needed.

- 0473dcb: feat(edgeless): add keyboard shortcuts for duplicate and apply last style

  Duplicate (previously toolbar-only) is now bound to Mod+D on the canvas, and
  Mod+Y applies the last used style to the selection — across element types.
  Both are edgeless-scoped, enumerable and host-rebindable via the shortcut
  manifest (`getShortcutManifest`).

  - Mod+D duplicates the current selection. On mac this is Cmd+D and coexists
    with the existing Ctrl+D = delete binding; on Windows/Linux it is Ctrl+D.
  - Mod+Y repaints the selected elements with every style prop the user last
    set, wherever the target type supports it: a fill picked on a rect applies
    to an ellipse, a font style set on a text applies to a shape. Props foreign
    to the target type are dropped per prop (schema-filtered), geometry and
    content are never touched, and one undo restores the previous styles.

- 499b305: Add a font size selector to the edgeless text toolbar

  The context toolbar of a free text component on the canvas offered font,
  color, style and alignment but no size — the only way to size text was
  dragging the selection handles, which makes consistent sizing across a board
  tedious. The edgeless text block has no `fontSize` prop by design (its visual
  size is `scale` over the 15px base font), so the new dropdown drives `scale`:
  presets (16–128) plus a custom integer input, displayed as the pixel size
  users reason about. Picking a size rescales the block exactly like
  ratio-locked corner resizing (top-left anchored, layout width preserved, so
  text wrapping does not change), and undo restores each step.

  Also registers the surface and edgeless-text packages in the root vitest
  workspace so their unit tests run in CI.

- 3c5c97e: feat(edgeless): map quality — a checklist you tick and a check-up you ask for (PF5.14, PF7.10, PF7.11, PF13.8, PF13.9)
  A rule only belongs in the real-time engine if an algorithm can decide it, on
  persisted data, inside the 16 ms budget. Everything else was homeless. This
  slice gives it a home: a **Map quality** panel on the framework's own instance,
  with the things the tool cannot judge on one side and the things it can — but
  that are not urgent — on the other.
  - **A check-up is about ONE map.** It walks the whole surface — that is where
    the elements are — but the answer is narrowed to the instance the user asked
    about, on the `backgroundId` every family measuring against a frame already
    records. A board carrying two Wardley maps holds two independent answers, and
    a panel showing the neighbour's would be the whole-surface tally the majority
    family goes out of its way not to compute. Narrowed in the engine, not at the
    rendering, so a run reaching a host or the agent is already about one map; the
    run names its instance, and the panel refuses one that is not its own.
  - **A second evaluation moment.** A rule now carries `moment: 'realtime'`
    (the default, and what every rule written so far means) or `'on-demand'`. An
    on-demand rule is not filtered out of the drawing path, it never enters it:
    the moment is tested before the rule reaches a profile lookup, let alone an
    element — and in the frame bookkeeping the manager does around the evaluation,
    which is a full surface walk per rule once per tick and would otherwise have
    handed the drawing budget back exactly what the second moment took away
    (+58 %, and invisible to a bench that times the evaluation alone). Its results
    land on `ValidationManager.checkup# @labre/affine
, a signal of its
    own — so they never reach the timeline, the bracket or the badge, and "outside
    the canvas affordance" is a property of the wiring rather than a filter
    somebody has to remember. A run carries one timestamp, taken when the user
    asked, and yields the thread between rules once it has held it for a frame,
    reporting `done / total`as it goes. A run started while another is still
    yielding supersedes it. A rule that throws ends the run _visibly_ — reported
    finished, carrying`error` — because the one thing a failure must not do is
    leave the panel believing a check-up is in flight, which reads as "Checking…"
    for ever and disables the only button that could try again.
  - **Nudges: expectations the tool cannot check, and does not pretend to.** A
    framework declares them as data — `{ id, framework, labelKey, fallback }` —
    and nothing ever evaluates them. They are offered as a checklist, and ticking
    one is the same gesture as granting an exception: the user says "I have taken
    care of this", and the tool records that rather than claiming to have looked.
  - **One entry, in the dropdown that was built for it.** PF9's Validation
    dropdown was written to render SECTIONS and shipped with one; Map quality is
    the second. It opens a panel — four boxes to tick, a **Run check-up** button
    and the remarks that come back — because a menu that closes on the first click
    is the wrong shape for a surface you work in. The same panel is reachable from
    the command registry (`validation.mapQuality`, palette and agent), so it is
    one command with several surfaces rather than two implementations.
  - **Generic, not Wardley.** Nothing in the panel, the entry or the command names
    a framework, a role or a rule. Whether an instance has a checklist or a
    check-up is derived from what the frameworks registered, exactly as the
    profile picker already derives which profiles it may offer. A second framework
    declaring either gets all of it with no code written anywhere.
  - **Wardley Q1–Q4** ship as data: the title that frames the study, the context,
    the legend, the evolution axis being used and legended. Four things a map needs
    in order to be discussed, and not one of them decidable by a machine.
  - **Wardley Q5 — the tone convention.** A new `tone-convention` rule family: the
    landscape is drawn in greys, red is reserved for what is moving and green for
    benefits. The sanctioned tones are named against the frame's OWN declared
    palette (three new entries: `landscape`, `change`, `benefit`), so a rule
    restates no colour the background owns and a host restyling the frame restyles
    the convention with it. The comparison is by tone family, never byte for byte,
    or every legitimate shade of grey the shape toolbar can produce would be a
    finding. A colour the engine cannot honestly read — a theme variable with no
    tone in its name, a gradient, `transparent`, the stored fill of an unfilled
    shape — yields silence rather than a guess.
  - **Wardley Q6 — shipped inert.** "Most of what you have mapped is an activity;
    the phase names for activities would read better" needs the type-3 **nature**.
    The new `majority-fact` family is built for a fact that may not be there yet:
    a surface where not one subject carries it raises nothing, silently, per map.
    MF3 has since landed the nature — as a tag def pack, with the qualification in
    the element's `tags` (a nested `Y.Map<string[]>`), not as the flat prop this
    family reads. So Q6 still says nothing, now because the fact sits somewhere
    `majority-fact` does not look. Teaching a generic engine family to read a tag
    is its own slice; until then the gap is pinned by two assertions that state
    both ends — the tag id that exists and the flat prop that does not — so it
    cannot rot into "later means never".
    Two new telemetry events, `MapQualityNudgeToggled` and `MapQualityCheckupRun`,
    carry the framework, the nudge id and the counts — never board content. A nudge
    everybody ticks immediately is a reminder nobody needed; a nudge nobody ever
    ticks is an expectation the tool failed to make actionable. Nothing else can say
    either, because nothing here is ever computed.
    **Persistence.** One new optional `@field()` on the base element model,
    `qualityChecklist: string[]` — the ids ticked on the instance. Declared on the
    BASE class for the same reason `role`, `validationExceptions` and
    `validationProfile` are: an element re-created from props only reaches the Y.Map
    through declared accessors, so a per-subclass declaration would be silently
    dropped on copy. Its default is `undefined` and is never written, so an instance
    with nothing ticked stays byte-identical to one created before the field
    existed: no block schema change, no version bump, no migration, and documents
    written before and after remain mutually loadable. Unticking the last one removes
    the KEY through `clearField` rather than leaving an empty array behind, so an
    emptied checklist is byte-identical again too — in the document, and not merely
    through the getter. Ids of nudges no framework declares any more are kept rather
    than pruned: the tooling comes and goes with a flag, the decisions recorded on it
    do not. `setNudgeChecked` enforces read-only itself, at the seam, like
    `setProfile` and `setException` do: a disabled checkbox covers exactly one
    caller, and `clearField` goes through `Store.transact`, which — unlike
    `addBlock` / `updateBlock` / `deleteBlock` — carries no read-only guard of its
    own, so unticking would genuinely delete the key from a document nobody may edit.
    **Cost.** Measured, not asserted: registering the two Wardley check-up rules
    beside the three real-time ones leaves both the verdict and the timing of the
    drawing path unchanged on the 500-element reference map. The two timings are
    measured on INTERLEAVED samples, because taken one after the other they compare
    two moments in the runner's life as much as two rule sets — the same evaluation
    drifts by half again between back-to-back medians, which is several times the
    effect being looked for. That is the whole point of the second moment.
- 02797b5: Surface elements can now be an **occurrence of a pivot record**: a new optional
  `pivotDocId` field on `GfxPrimitiveElementModel`, a `pivot.bind` command that
  writes it, and an injectable `PivotPropertiesProvider` the host implements to
  turn that id into displayable properties. Implements ADRs 0005 and 0006.

  A pivot record is a document owned by the host application holding the durable,
  cross-board identity of a business object ("the Payments component"). A Wardley
  `component` drawn on three maps is the _same_ component; until now the library
  had no way to say so.

  **The field.** `pivotDocId?: string`, declared on the BASE element class next to
  `role` and `validationExceptions`, for the same reason: an element re-created
  from props (paste, duplicate, alt-drag clone, template insertion) only reaches
  the Y.Map through keys with a declared accessor, so a per-subclass declaration
  would be dropped on copy — invisibly, until the next reload. It is **distinct
  from `linkedDocId`**, which is a hyperlink (one target per element, exclusive
  with `externalLink`, opened by the hover arrow) rather than an identity
  (many elements to one record). An element may carry both; code reading one as a
  stand-in for the other is a bug.

  **No version bump, no migration, and none is needed.** Surface elements carry no
  schema version and have no upgrade hook, unlike block schemas — where the
  analogous `externalSourceId` forced `affine:database` from version 3 to 4. The
  field is additive and an absent key reads as `undefined`. An element that never
  binds writes no key at all, so it stays byte-identical to one created before
  this release. Old documents open unbound; documents carrying the field open on
  older builds, which preserve the key without reading it.

  **Release-ordering constraint, and why this release satisfies it.** The
  declaration of a field must ship no later than anything that writes it: on a
  client that does not declare `pivotDocId`, the five element-creation-from-props
  paths drop the key silently — no exception, no warning, no telemetry, the copy
  looks correct in the session and is unbound on reload. Declaration and its one
  writer therefore ship **together**, and the writer is a command with no default
  keyboard binding and no menu entry in the library, so nothing writes the field
  until a host wires its own record picker to it. Fleets that must interoperate
  with clients older than this release should roll the library out before enabling
  that host UI.

  **The command.** `pivot.bind` (owner `core`, availability `selection`, surfaces
  `palette` + `agent`, keyless by intent and still bindable from
  Settings › Shortcuts). Its parameter is `{ pivotDocId: string | null }`, where
  `null` unbinds — the key is required, so a forgotten argument cannot silently
  destroy a binding. The library never chooses a document: which record to bind to
  is the host's decision, passed in. `store.captureSync()` runs **before** the
  write, so a bind issued within 500 ms of a drag is its own undo step rather than
  being reverted together with the drag. Unbinding removes the Y.Map key rather
  than leaving a tombstone.

  The command emits one new telemetry event, `FrameworkElementPromoted`
  (`rung`, `direction`, optional `framework`/`role`, `elementCount`). It is
  deliberately not `FrameworkElementAdded`: a promotion inserts nothing, so
  reusing the creation event would count a drawn-then-bound shape twice and
  inflate "elements added per framework" permanently. Its `labelKey` is the first
  under `com.labre.command.*` rather than `com.labre.keyboardShortcuts.*` — hosts
  shipping a translation catalogue must add `com.labre.command.pivot.bind` and
  `com.labre.command.pivot.bind.description`, or the English `labelFallback` is
  used.

  **The provider.** `PivotPropertiesProvider` + `PivotPropertiesExtension(service,
{ hoverFields })` in `@labre/affine-shared/services`. `properties$(pivotDocId,
{ fields })` returns a `ReadonlySignal` **synchronously** — there is no
  `Promise`-returning method on the read path, so no call site can `await` one and
  the host's latency budget cannot leak into a gesture. Values are typed and
  render-free: no `TemplateResult`, no HTML, ever. The provider is told which
  fields to load and must load only those; `hoverFields: []` means the library
  does not call it at all. **No noop default is registered**: absence is a
  meaningful state (standalone playground, tests, a host build that failed to
  register), so it stays the tested default path. Every provider call is guarded,
  and a throwing host degrades rather than crashing a hover.

  **Backlinks are computed, never persisted.** `collectPivotOccurrences(surface,
pivotDocId?)` walks the surface and returns the occurrences; there is no index,
  no reverse map, no cache and nothing written back. Cross-document aggregation is
  the host's, built from per-document calls.

  The command is gated on `store.readonly` in both its `when` predicate and its
  body. The predicate is what a surface consults; the body guard is what actually
  protects the document, because `runCommand` consults neither `when` nor
  `availability` and the palette and the agent reach `run` directly. Binding in a
  read-only document used to throw out of `runCommand`, and unbinding used to
  **succeed** — `clearField` goes through `Store.transact`, which carries no
  read-only guard of its own.

  Also in `@labre/std`, two additions to the command registry:

  - `AnyCommandDescriptor`, the registry's element type with its parameter
    contract erased. The registry is heterogeneous now that a command takes
    parameters, and `CommandDescriptor<void>` could not express that.
    Registry-facing signatures (`CommandExtension`, `runCommand`,
    `getRegisteredCommands`, the two projections…) use the alias; existing
    `CommandDescriptor[]` declarations are unaffected.
  - `CommandManifestEntry.params?: CommandParam[]` — a minimal serializable
    description (`key`, `kind`, `required`, `nullable`) derived from the
    descriptor's zod schema, so the `'agent'` surface is usable end to end. The
    schema itself never crosses the seam. Derivation is all-or-nothing: a
    parameter the reader cannot describe withdraws the whole contract rather than
    advertising a partial one. Nullary commands are unaffected — they project no
    `params` key at all.

- 3e1665b: The reversed reading comes back from the PO recette of 02/08/2026 with a place
  of its own and a sentence it was missing.

  **It is no longer hidden behind the toolbars.** The proposal shipped as a bubble
  floating beside the element, and it rendered BEHIND the contextual toolbar: the
  widget host sat at `z-index: 2`, while `editor-toolbar` takes
  `--affine-z-index-popover`, which the theme sets to `1000`. It is now anchored
  to the EDITOR — bottom-centre, at a comfortable 480px measure instead of the
  300px of a bubble — in a layer above every toolbar, the senior menu and its
  sub-menu included. The panel is what the user is reading; the toolbars can wait
  underneath it.

  The layer is `calc(var(--affine-z-index-popover, 1000) + 10)`, set on the HOST
  rather than on the panel, because every widget host is a sibling in
  `.widgets-container` and `affine-toolbar-widget` declares no stacking context of
  its own — that sibling level is where the contest is actually decided. The
  fallback is not decoration: it is the host's theme stylesheet that defines the
  variable, never this library. What still paints above it, correctly, is what
  mounts outside the contained widgets layer: `popMenu` context menus and the
  toolbar drag preview.

  The host stays ZERO-SIZED, and that is not a style choice either:
  `.widgets-container > * { pointer-events: auto }` is an outer-tree rule on a
  shadowless component and beats `:host { pointer-events: none }` outright, so a
  host with a real box would swallow canvas clicks across the whole bottom of the
  board. The panel carries the box; the host only carries the anchor.

  A pan or a zoom no longer closes the panel. It closed because it hung off an
  element that the gesture moved out from under it; anchored to the editor,
  following what the reading is talking about while the reading is on screen is
  simply the obvious thing to want. A resize still re-renders it, because its box
  is clamped to the editor's.

  **A new section: value flow.** For each typed edge touching the component, one
  sentence saying which way the VALUE runs — up, from the supplier to the
  consumer: _"Value flows up from Kettle to Brewing tea"_. It is the opposite
  direction from the dependency arrow, which is the whole reason it deserves its
  own words: ADR 0010 § 2 fixes `source` as the consumer and `target` as what it
  needs, so a map read from the bottom up is a map read against its arrows. The
  section is derived from the relations already read — no second traversal, no
  second convention to keep in step with ADR 0010 — and an element with no typed
  link gets no section at all rather than an empty heading.

  Two i18n slots (`com.labre.reading.value-flow` and its `.to` suffix) so a host
  catalogue can put the halves where its own grammar wants them; the English
  fallback is what a silent host gets.

  `ElementReading` gains a `name` field — what the subject is CALLED, its own text
  or its label sibling's — because both ends of a flow sentence must be said by
  name, and every renderer re-deriving it was one renderer too many.

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

- 5d16745: Clicking a component now asks the tool **what it reads of it**, and offers the
  answer as a proposal: type of node, nature, parent-child relations, evolution
  phase and naming convention — with nothing written anywhere until the user
  confirms. Implements MF3 (reversed reading), on the PO arbitration of
  01/08/2026: _triggered on a click, never by automatic validation, and no write
  without confirmation._

  **The trigger is a gesture, and only a gesture.** A new `element.read` command
  (owner `core`, availability `selection`, surfaces `palette` + `agent`, keyless
  by intent) opens the proposal; the selected component's contextual toolbar gains
  a **Read this component** entry that invokes the same command with the element
  id, so the toolbar, the palette and the agent share one implementation. Nothing
  opens it by itself, and nothing about validation reaches it. `element.read` is
  deliberately **not** read-only gated: reading a board one cannot edit is exactly
  as legitimate as reading one you can.

  **The five readings, each a function of data the document already carries.**

  - **Type of node** — the element's `role`, plus the chain it specialises,
    resolved through the framework's own role vocabulary (`wardley:market` reads
    as "a kind of Component" because the framework said so, not because the panel
    knows what a market is).
  - **Nature** — the type-3 tags the element CARRIES. When it carries none the
    field is empty and stays empty: no nature is inferred from the shape, from the
    name or from the position. That is the whole of the arbitration, and it is the
    one thing the reading refuses to do.
  - **Parent-child relations** — the typed edges touching the element, read with
    the ADR 0010 convention (`source` is the subject of the role's verb; for
    `wardley:dependency` that makes the source the consumer). Consumers read as
    "above", suppliers as "below", and **a link whose declaration contradicts the
    drawing is named as such** — W4 seen from the record's side, reported without
    picking a winner. An edge with an unbound end, a neutral connector and a
    self-loop are all skipped.
  - **Evolution phase** — the declared zone the element's centre falls in, taken
    from the framework background's own `zones`, plus "in the zone of punctuated
    equilibrium" when it sits inside a declared transition band. A component that
    is on no map has no phase, and the panel says so rather than guessing the
    nearest one.
  - **Naming convention** — declarative data per nature, shipped by the framework.
    Wardley's is deliberately **one motif**: does the name read as an action? The
    gerund is expected positively for `activity` and negatively for `data`,
    `practice` and `knowledge` — four entries, no word list, no dictionary the
    library would then own. It is a suggestion with the framework's own wording,
    never a violation, and it is silent on an unnamed element or on a nature no
    convention describes.

    **The motif is English, and the data says so.** A convention declares its
    `lang`, and the engine applies it only when the host says it is serving that
    language — so a board named in French gets silence rather than a confident
    wrong answer in both directions ("Facturation" told to use a verb, "Planning"
    told it reads as an action). A host that declares no language gets silence
    too. Extending the coverage is adding one convention per language for the same
    value, not changing code. This is what `TranslationService.language` (new,
    optional) exists for, and it is the only thing the library reads it for: the
    library still holds no catalogue and still negotiates no locale.

  **Confirming is the only write, and it reuses the existing rungs.** The panel
  proposes a nature only when the LINKED RECORD carries one the element does not,
  **and only after resolving the record's word against the framework's own tag
  def** — by value id, by id case-insensitively, then by label, with no fuzzy
  match anywhere. A pivot record is the host's document and its "nature" property
  holds the host's words (`"Activity"`), while an element carries namespaced value
  ids (`wardley:nature/activity`): they are not the same alphabet. What cannot be
  resolved is named in a sentence and offered no button — writing it would put a
  value no def describes into the document (the naming line vanishes, the
  qualification dropdown shows a raw id, rules stop matching), and comparing it
  would report a permanent false drift on an element that is correctly qualified.
  `tag.set` deliberately does not police its values, so the guard stands at the
  point of proposal. Confirming runs the existing `tag.set`; linking to a record runs the existing
  `pivot.bind` with an id the HOST supplies through a new
  `PivotRecordPickerProvider` — with no picker registered the action does not
  exist (hidden, not disabled), like every other seam whose absence is meaningful.
  In a read-only document the readings are all there and the confirmations are
  not. A unit test and an integration test both assert the invariant that matters:
  opening and closing a proposal a hundred times leaves the document byte-identical.

  **The drift trigger.** A bound element whose position or qualification changes
  gets one informative, non-blocking line: the board and the record disagree, with
  "Update the record" wired to the existing fire-and-forget materiality publisher.
  It is debounced (200 ms), asynchronous and **local-gated** — a colleague's drag
  is their drift to notice — so it is never on the 16 ms path of the gesture that
  caused it, by construction rather than by measurement. The comparison is bounded
  to the two record properties a framework names (`recordKeys`), read through the
  guarded `queryPivotProperties`, and — on the nature — to values the framework's
  own def describes: no provider, no configured fields, a property the record does
  not carry, or a word in the host's alphabet, and the trigger says nothing at
  all. A host whose record spells things differently gets no comparison and no
  drift, and that is now true of the VALUES as well as of the keys.

  **Everything a framework contributes is data.** `ReadingProfile` — roles,
  subject role, nature tag and its conventions, edge role, background declaration
  and phase axis — registered with `ReadingProfileExtension` from the framework's
  **flag-gated** view extension, exactly like its rules and its profiles. Reading a
  map is tooling: switch the Wardley flag off and the entry, the panel and the
  trigger vanish while every element still loads, paints and stays selectable
  (ADR 0009). The engine (`readElement`) is pure and names no framework; the panel
  resolves every word through the host's catalogue with the framework's own
  English fallback.

  `element.read` declares `surfaces: ['palette', 'contextual-toolbar', 'agent']`,
  and the toolbar entry and the panel's confirmations report
  `contextual-toolbar` as their invocation surface — a reading triggered by
  clicking a component is not a palette invocation, and the telemetry says so.

  Hosts shipping a translation catalogue gain the `com.labre.reading.*` keys (the
  panel's chrome and the toolbar entry), `com.labre.command.element.read[.description]`,
  and Wardley's `com.labre.wardley.reading.naming.*`. All of them carry English
  fallbacks, so a host with no catalogue reads correctly. A host that also
  implements the new optional `TranslationService.language` gets the naming
  suggestions; one that does not keeps every other reading and simply never sees
  that line.

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

- 1efc6d5: feat(edgeless): an element can say what KIND of thing it is (MF3)

  Implements ADR 0007: the level-3 contextual qualification of a surface element,
  the format its definitions take, and the one-way reflection of a bound
  occurrence's qualification onto its pivot record (ADR 0006 § 4).

  Level 2 said what an element IS on a map (`role`, PR #71). Level 3 says what
  kind of thing it is — a Wardley component is an activity, or data, or a
  practice, or knowledge — and that is a different question, authored on the
  element, reflected onto the record, and read by the rules engine.

  - **`tags?: Y.Map<string[]>` on `GfxPrimitiveElementModel`**, keyed by
    namespaced tag def id. A NESTED Y.Map and not a plain object, because
    `@field()` writes straight into the element's Y.Map with no `native2Y` in the
    path: a plain object there is ONE opaque value, so two people qualifying the
    same element on two DIFFERENT tags would silently lose one of the two. The
    nested map merges per tag; the `string[]` of a single tag stays
    last-write-wins, which is correct — one tag's value set is one atomic choice.
    There is no migration runner for surface elements, so the shape is chosen
    once, and an under-powered merge is the harm class the red zone exists to
    prevent.
  - **Default `undefined`, never stamped.** Declared on the BASE class so paste,
    duplicate and alt-drag clone preserve it for every primitive type at once,
    and absent by default so an element that is never qualified stays
    byte-identical to one created before the field existed: no schema version
    bump, no migration. Removing the last tag removes the key rather than leaving
    an empty map behind.
  - **`UniverseTagDefs` + `UniverseTagDefsExtension`**, the tags-only DI registry.
    Variant-parameterized on `packId` with `di.override`, so distinct packs
    accumulate and identical packs REPLACE: a host that re-registers on every
    render never throws and never grows the registry. The merge is total and
    silent — an invalid id, a cross-framework id, an unknown `formatVersion` each
    drop the offending def and record an issue. Nothing throws, ever: a
    misconfigured pack must never cost a user their board.
  - **The Wardley natures** (activity / data / practice / knowledge) ship as the
    library's one real pack, on the same mechanism a host uses for its own
    taxonomy. A client's private extension is a second pack with another
    `packId`, with no library release.
  - **`tag.set`**, a keyless `core` command taking the tag id and its values
    (`[]` clears). Read-only gated in `when` AND in `run`, `captureSync()` BEFORE
    the write, one `FrameworkElementPromoted` per gesture on the `tag` rung. Like
    `pivot.bind` it is self-emitting, and enumerated as such in the registry
    invariants test.
  - **A "Nature" section on the element toolbar**, generic in shape (it names no
    framework and builds from the seeded packs) and parameterized by the
    registrar's `RoleDefs`. It resolves through a canvas group to its single
    role-bearing member, so one click on a Wardley component reaches it.
  - **`PivotMaterialityPublisher`**, the local-gated watcher that reflects a bound
    element's qualification onto its record. Driven by Yjs transactions rather
    than by the setter or the command layer, because undo goes through neither: a
    setter-driven design desyncs the record on the very first Ctrl+Z. Coalesces
    per element per microtask, publishes full state, de-duplicates, and RETRACTS
    (`present: false`) on deletion, unbind and re-bind, so a record never keeps
    materialities attributed to an occurrence that no longer exists.

  **Release ordering, adopted from #67 recommendation #4 and unchanged from
  #89.** This release DECLARES the field; nothing in the product writes it until
  the host wires a qualification surface. Ship the declaration release before any
  release that writes `tags`, so the fleet floor tolerates the key.

  An older client keeps the value through load / edit / save (`syncElementFromY`
  mirrors every entry into `_preserved`), and — unlike `pivotDocId` — it keeps it
  on the five element-creation-from-props paths too, **as a plain object**: an
  undeclared key goes down the unknown-key branch, whose encodability guard
  accepts the serialized nested map because it is flat JSON. Nothing is lost; the
  shape is simply not the specified one. This release therefore also READS that
  degraded shape and CONVERTS it, preserving its content, on the first write —
  without which the declaring release would answer `{}` for a qualified element
  and then overwrite a colleague's tag, which would empty the release-ordering
  rule of its meaning.

  Two supporting changes in `@labre/std`, both consequences of the field being a
  nested Y type on the base class:

  - `syncElementFromY` re-attaches an `@observe`d nested type when the key itself
    is rewritten. Remote peers and undo/redo never reach the accessor's setter,
    the only other caller of `startObserve`, so the observer was left on a dead
    type and every later in-place mutation went unseen.
  - `startObserve` no longer warns for an ABSENT optional Y-type field. An
    unqualified element is the normal case, not a misuse.

### Patch Changes

- be100e3: fix(edgeless): the direction reveal is one sentence, laid along the link

  PO acceptance of 02/08/2026, point 5: `depends on` was hiding the chevron and
  did not say what it was about. It now reads as the whole statement, turned onto
  the line it describes:

  ```
  Kettle | depends on > Electricity
  ```

  - **The sentence, not the verb.** The label is `{consumer} {verb} {provider}`,
    the two names read from the document — an element's own text, or the text of
    the sibling in its group carrying a role of `kind: 'text'`, which is how a
    framework artefact is composed on this canvas. Read generically, by kind: no
    framework's label role is named. An unnamed end is dropped rather than
    blanked, so a bare map still reads `depends on`.
  - **Along the link.** The label centres on the middle of the drawn path by ARC
    LENGTH and is rotated to the angle of the median segment. The old placement
    took the middle VERTEX, which on a two-point path is the target endpoint —
    which is how the tooltip ended up on the tip of the link, on top of the
    chevron. When the angle would stand the text on its head the box is turned by
    180°; the sentence itself never reverses.
  - **The point IS the arrow.** The box ends in a point on the side facing the
    target, so the reveal is one mark instead of two that cover each other. On a
    box turned 180° the point moves to its other end, because that is the end
    still facing the provider. Reversing the edge (M3) turns the box over and
    moves the point with it.
  - **The canvas chevron is gone**, and with it `EdgeDirectionOverlay`: there is
    nothing left for it to draw. The reveal is DOM only now, still in model units
    (the box scales with the zoom), still on hover AND selection, still silent on
    an edge bound to nothing, and still wording the verb through the host's
    catalogue.

  Breaking for a host that reached into these: `EdgeDirectionOverlay`,
  `targetAnchorOf` and `midpointOf` are removed in favour of `labelAnchorOf`, and
  the label's test id is `edge-direction-label` (was `edge-direction-verb`).

- ff3a5f7: fix(edgeless): the direction label is the verb alone, and it stays under the toolbars

  Second PO pass on the direction reveal (recette of 02/08/2026, points 4 and 5).
  Two complaints, one about the layer and one about the length.

  **It painted over the senior menu.** The label belongs to the canvas — it is
  glued to a link, in model units, turning and scaling with the map — and the
  toolbars overhang the canvas. Its host sat at `z-index: 2`, which cleared
  `edgeless-toolbar-widget`'s `1`, and the senior menu rides on that host's
  z-index because its sub-menus are appended inside its own subtree. The host is
  at `0` now: under the bottom toolbar and under `editor-toolbar`'s
  `--affine-z-index-popover`, and still over the canvas, since
  `.widgets-container` has `contain: layout` and paints as a whole above
  `.edgeless-container`. This is the deliberate reverse of the reading panel's
  choice — that panel is what the user is reading, so the toolbars wait
  underneath it; this one is part of the drawing.

  The armed tool's hint now hangs upwards from its anchor line rather than
  downwards, so the whole box clears the toolbar strip instead of having its
  lower third clipped by the toolbar it no longer paints over.

  **The label said too much.** `Kettle depends on Electricity` is a box longer
  than most links: it overhung both ends and covered the very components it was
  naming. The label is the **verb alone** now — `depends on` — still laid along
  the link, still ending in a point aimed at the provider, and still turning that
  point over when the edge is reversed. The two names are already drawn at both
  ends of the line; what the drawing does not say is what the line MEANS.

  Reading the names out of the document (`endpointNamesOf`) had no consumer left
  and is deleted. The reading panel resolves its own names through
  `readRelations`, where a name in prose is the point rather than an overlay.

- f0b2a0b: Fix the empty font style menu outside Firefox

  Surface fonts are registered with quoted family names (`"blocksuite:surface:Inter"`)
  while models store them unquoted (`blocksuite:surface:Inter`). `isSameFontFamily`
  branched on `IS_FIREFOX` and only added the quotes on the Firefox path, so on
  Chrome — and every other non-Firefox browser — `getFontFacesByFontFamily` matched
  nothing.

  With no matching font face, `edgeless-font-weight-and-style-panel` rendered zero
  rows: opening "Font style" on a text, shape, connector or edgeless text element
  showed an empty 124×36 box, making weight and italic unreachable. Family matching
  is now quote-insensitive on both sides and no longer depends on the engine.

- 3639562: feat(edgeless): the direction of a typed edge is a statement, and W4 reads it

  `docs/adr/0010` in one slice. For a connector carrying an edge role, the
  persisted `source → target` pair IS the relation's orientation and part of the
  document's meaning. That was already true of the data since #71 — and it was
  invisible: the Wardley link tool draws no arrowhead, nothing said which way to
  drag, nothing showed which way it came out, and nothing could change it. A rule
  on top of that would have been a rule on top of an accident, so the three
  mechanisms that turn the by-product into a statement ship WITH the rule, never
  before it.

  - **M1 — say it.** An edge role now declares its own `direction`: the verb the
    relation is read with (`depends on`), and the sentence that tells the user
    which way to draw it. The Wardley link tool shows it under its label in the
    senior sub-menu ("Drag from the component that has the need to what it
    needs"), and the evolution arrow shows its own. Keys and framework fallbacks,
    resolved through the host's catalogue: the library still puts no words in a
    framework's mouth. `CommandDescriptor.descriptionFallback` is new, beside the
    `descriptionKey` that already crossed the manifest seam and was never
    rendered.
  - **M2 — show it.** Hovering or selecting a typed edge reveals a chevron at its
    TARGET end plus the role's verb — an `Overlay` and a widget
    (`affine-edge-direction-widget`), never the element renderer, which knows
    neither hover nor selection. At rest the map keeps its canonical arrowless
    look: on a Wardley map a permanent head already means evolution movement, and
    two meanings on one glyph make both unreadable. Nothing is revealed for an
    edge bound to nothing — a stroke that relates nothing says nothing.
  - **M3 — let them fix it.** `edge.invert-direction` swaps `source` ↔ `target`
    AND the two endpoint styles, in one undo step, from the contextual toolbar,
    the palette, Settings › Shortcuts or the agent. `curveControlPoint` is
    deliberately untouched (an absolute pass-through point at t = 0.5, symmetric
    under a `P0` ↔ `P3` exchange, so the drawn curve does not move — an
    integration spec pins it). It writes through the surface and not through
    `EdgelessCRUDIdentifier`, so an inversion never becomes the default style of
    the next connector drawn.
  - **`b.flip-direction` is hidden for a typed edge.** It swaps the arrowhead
    STYLES without touching the ends: honest on a generalist connector, a lie on
    an edge whose direction is the relation. Reverse direction takes its place.
    Gated on the ROLE vocabulary, not on a framework flag — a stored typed edge
    stays protected on a board whose framework tooling is switched off.
  - **W4, a new rule family — `relative-order-along-axis`.** Given a typed edge,
    the two elements it links are compared along one declared axis of the frame,
    in the order the edge states. Wardley ships
    `wardley.provider-above-consumer`: "a provider may not sit above its
    consumer", `warning` under strict, `audit` under sketch, with 2% of the map's
    height of slack (a ratio, never model units — two components drawn level are
    not a mistake). Its finding names THREE elements for the first time: the two
    nodes and the edge, because reversing the edge is one of the two honest ways
    out and that gesture lives on the edge. It stays silent on an edge with a
    free end, a dangling end, a pair straddling two maps, a self-loop, and any
    edge whose role is not the one it names. Cost is linear in the RELATIONS
    somebody drew — a 200-node chain is 199 findings, not 19 900 comparisons —
    and measures ~0.3 ms on the 500-element reference map.
  - **The role VOCABULARY is now registered** (`RoleVocabularyExtension`, from a
    framework's always-on render extension) and readable
    (`findRoleDef`, `isTypedEdgeRole`). The library had the "is this a typed
    edge?" predicate since PF1 and used it nowhere.
  - **Templates.** The palette's "Link" and "Evolution arrow" swatches are
    de-typed: a horizontal stroke bound to nothing is a sample of a style, and it
    must claim nothing. Both template kits now decide what a stroke MEANS with
    one flag (`evolution`) instead of two different colour tests — a style
    inconsistency until W4 read these edges, a semantic one afterwards. Kodak's
    red _solid_ links stay typed dependencies, which is what they are.
  - **Telemetry.** `EdgeDirectionInverted` (ids only, never board content): how
    often a direction has to be corrected is the measurement of whether the
    drawing gesture announces itself well enough.
  - The inversion acts on the typed edges of the selection, so a lasso holding a
    Wardley link and a plain connector reverses the first and leaves the second
    alone — rather than showing no direction entry at all. A typed edge with a
    free end offers none: there is no relation there to reverse.
  - `VERDICT_PROPS` gains `source` and `target`, so re-pointing or reversing an
    edge re-judges the board instead of waiting for an unrelated drag.

- Updated dependencies [832c793]
- Updated dependencies [c5c07b9]
- Updated dependencies [a2b7c44]
- Updated dependencies [ff5f060]
- Updated dependencies [913da26]
- Updated dependencies [1b59f3c]
- Updated dependencies [41ab595]
- Updated dependencies [0bfc872]
- Updated dependencies [8ded589]
- Updated dependencies [50ab9ae]
- Updated dependencies [d6a0c71]
- Updated dependencies [f832f27]
- Updated dependencies [9e23b5b]
- Updated dependencies [b9ed412]
- Updated dependencies [a3aa598]
- Updated dependencies [90a9168]
- Updated dependencies [aa08529]
- Updated dependencies [6417a2f]
- Updated dependencies [9ffab42]
- Updated dependencies [c6eac56]
- Updated dependencies [acbec17]
- Updated dependencies [d797f9a]
- Updated dependencies [9fde974]
- Updated dependencies [d360f72]
- Updated dependencies [9fe5773]
- Updated dependencies [50ab9ae]
- Updated dependencies [6264dfc]
- Updated dependencies [89b90e9]
- Updated dependencies [4868d70]
- Updated dependencies [9c440fb]
- Updated dependencies [c2e1020]
- Updated dependencies [463989f]
- Updated dependencies [a5eca31]
- Updated dependencies [ceb2761]
- Updated dependencies [f7f23b2]
- Updated dependencies [865abd4]
- Updated dependencies [3b30d8f]
- Updated dependencies [751ac44]
- Updated dependencies [54488cd]
- Updated dependencies [9453013]
- Updated dependencies [695471f]
- Updated dependencies [c4c9b9e]
- Updated dependencies [cef3b1a]
- Updated dependencies [b746d6b]
- Updated dependencies [b93b43c]
- Updated dependencies [5ac0c68]
- Updated dependencies [630633b]
- Updated dependencies [1fa46c1]
- Updated dependencies [d8eb24a]
- Updated dependencies [be100e3]
- Updated dependencies [ff3a5f7]
- Updated dependencies [0473dcb]
- Updated dependencies [5b6e9bb]
- Updated dependencies [86e7562]
- Updated dependencies [492bac6]
- Updated dependencies [72b334c]
- Updated dependencies [9bf1d3e]
- Updated dependencies [fc52023]
- Updated dependencies [30580db]
- Updated dependencies [08e9b24]
- Updated dependencies [dc5261e]
- Updated dependencies [5076cb8]
- Updated dependencies [7a12ce2]
- Updated dependencies [864f07a]
- Updated dependencies [3c5c97e]
- Updated dependencies [1b72bcd]
- Updated dependencies [9cf65a2]
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
- Updated dependencies [521accb]
- Updated dependencies [5d16745]
- Updated dependencies [1c37478]
- Updated dependencies [b684b4c]
- Updated dependencies [6618345]
- Updated dependencies [48e90f4]
- Updated dependencies [141de0e]
- Updated dependencies [5a61fb2]
- Updated dependencies [8f339d1]
- Updated dependencies [5cfcc6a]
- Updated dependencies [fb26f85]
- Updated dependencies [0991104]
- Updated dependencies [5edd916]
- Updated dependencies [5a16359]
- Updated dependencies [4668921]
- Updated dependencies [025d6f5]
- Updated dependencies [9acadeb]
- Updated dependencies [b1ed4ef]
- Updated dependencies [ce64e4f]
- Updated dependencies [985a92f]
- Updated dependencies [f05ff48]
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
- Updated dependencies [55c6597]
  - @labre/std@0.32.0
  - @labre/affine-shared@0.32.0
  - @labre/affine-widget-drag-handle@0.32.0
  - @labre/store@0.32.0
  - @labre/affine-block-embed-doc@0.32.0
  - @labre/affine-block-note@0.32.0
  - @labre/affine-components@0.32.0
  - @labre/affine-gfx-template@0.32.0
  - @labre/data-view@0.32.0
  - @labre/affine-block-database@0.32.0
  - @labre/affine-block-data-view@0.32.0
  - @labre/affine-block-code@0.32.0
  - @labre/affine-widget-toolbar@0.32.0
  - @labre/affine-block-edgeless-text@0.32.0
  - @labre/affine-model@0.32.0
  - @labre/affine-gfx-shape@0.32.0
  - @labre/affine-gfx-brush@0.32.0
  - @labre/affine-gfx-connector@0.32.0
  - @labre/affine-block-surface@0.32.0
  - @labre/affine-block-table@0.32.0
  - @labre/affine-gfx-text@0.32.0
  - @labre/affine-gfx-group@0.32.0
  - @labre/affine-widget-frame-title@0.32.0
  - @labre/affine-block-latex@0.32.0
  - @labre/affine-inline-latex@0.32.0
  - @labre/affine-widget-edgeless-selected-rect@0.32.0
  - @labre/affine-widget-remote-selection@0.32.0
  - @labre/affine-block-callout@0.32.0
  - @labre/affine-inline-preset@0.32.0
  - @labre/global@0.32.0
  - @labre/affine-block-root@0.32.0
  - @labre/affine-gfx-edgy@0.32.0
  - @labre/affine-block-frame@0.32.0
  - @labre/affine-gfx-wardley@0.32.0
  - @labre/affine-widget-linked-doc@0.32.0
  - @labre/affine-gfx-pointer@0.32.0
  - @labre/affine-widget-edgeless-toolbar@0.32.0
  - @labre/affine-gfx-bpmn@0.32.0
  - @labre/affine-gfx-cynefin-estuarine@0.32.0
  - @labre/affine-widget-slash-menu@0.32.0
  - @labre/affine-inline-link@0.32.0
  - @labre/affine-gfx-ddd-event-storming@0.32.0
  - @labre/affine-gfx-ddd-core-domain@0.32.0
  - @labre/affine-gfx-ddd-context-map@0.32.0
  - @labre/affine-foundation@0.32.0
  - @labre/affine-block-attachment@0.32.0
  - @labre/affine-block-bookmark@0.32.0
  - @labre/affine-block-divider@0.32.0
  - @labre/affine-block-embed@0.32.0
  - @labre/affine-block-image@0.32.0
  - @labre/affine-block-list@0.32.0
  - @labre/affine-block-paragraph@0.32.0
  - @labre/affine-block-surface-ref@0.32.0
  - @labre/affine-fragment-adapter-panel@0.32.0
  - @labre/affine-fragment-doc-title@0.32.0
  - @labre/affine-fragment-frame-panel@0.32.0
  - @labre/affine-fragment-outline@0.32.0
  - @labre/affine-gfx-ddd-aggregate@0.32.0
  - @labre/affine-gfx-ddd-shared@0.32.0
  - @labre/affine-gfx-link@0.32.0
  - @labre/affine-gfx-mindmap@0.32.0
  - @labre/affine-gfx-note@0.32.0
  - @labre/affine-gfx-turbo-renderer@0.32.0
  - @labre/affine-inline-comment@0.32.0
  - @labre/affine-inline-footnote@0.32.0
  - @labre/affine-inline-mention@0.32.0
  - @labre/affine-inline-reference@0.32.0
  - @labre/affine-rich-text@0.32.0
  - @labre/affine-widget-edgeless-auto-connect@0.32.0
  - @labre/affine-widget-edgeless-dragging-area@0.32.0
  - @labre/affine-widget-edgeless-zoom-toolbar@0.32.0
  - @labre/affine-widget-keyboard-toolbar@0.32.0
  - @labre/affine-widget-note-slicer@0.32.0
  - @labre/affine-widget-page-dragging-area@0.32.0
  - @labre/affine-widget-scroll-anchoring@0.32.0
  - @labre/affine-widget-viewport-overlay@0.32.0
  - @labre/affine-ext-loader@0.32.0
  - @labre/sync@0.32.0

## 0.31.0

### Patch Changes

- Updated dependencies [6a663b6]
  - @labre/store@0.31.0
  - @labre/affine-block-attachment@0.31.0
  - @labre/affine-block-bookmark@0.31.0
  - @labre/affine-block-callout@0.31.0
  - @labre/affine-block-code@0.31.0
  - @labre/affine-block-data-view@0.31.0
  - @labre/affine-block-database@0.31.0
  - @labre/affine-block-divider@0.31.0
  - @labre/affine-block-edgeless-text@0.31.0
  - @labre/affine-block-embed@0.31.0
  - @labre/affine-block-embed-doc@0.31.0
  - @labre/affine-block-frame@0.31.0
  - @labre/affine-block-image@0.31.0
  - @labre/affine-block-latex@0.31.0
  - @labre/affine-block-list@0.31.0
  - @labre/affine-block-note@0.31.0
  - @labre/affine-block-paragraph@0.31.0
  - @labre/affine-block-root@0.31.0
  - @labre/affine-block-surface@0.31.0
  - @labre/affine-block-surface-ref@0.31.0
  - @labre/affine-block-table@0.31.0
  - @labre/affine-components@0.31.0
  - @labre/data-view@0.31.0
  - @labre/affine-ext-loader@0.31.0
  - @labre/affine-foundation@0.31.0
  - @labre/affine-fragment-adapter-panel@0.31.0
  - @labre/affine-fragment-doc-title@0.31.0
  - @labre/affine-fragment-frame-panel@0.31.0
  - @labre/affine-fragment-outline@0.31.0
  - @labre/affine-gfx-bpmn@0.31.0
  - @labre/affine-gfx-brush@0.31.0
  - @labre/affine-gfx-connector@0.31.0
  - @labre/affine-gfx-cynefin-estuarine@0.31.0
  - @labre/affine-gfx-ddd-aggregate@0.31.0
  - @labre/affine-gfx-ddd-context-map@0.31.0
  - @labre/affine-gfx-ddd-core-domain@0.31.0
  - @labre/affine-gfx-ddd-event-storming@0.31.0
  - @labre/affine-gfx-ddd-shared@0.31.0
  - @labre/affine-gfx-edgy@0.31.0
  - @labre/affine-gfx-group@0.31.0
  - @labre/affine-gfx-link@0.31.0
  - @labre/affine-gfx-mindmap@0.31.0
  - @labre/affine-gfx-note@0.31.0
  - @labre/affine-gfx-pointer@0.31.0
  - @labre/affine-gfx-shape@0.31.0
  - @labre/affine-gfx-template@0.31.0
  - @labre/affine-gfx-text@0.31.0
  - @labre/affine-gfx-turbo-renderer@0.31.0
  - @labre/affine-gfx-wardley@0.31.0
  - @labre/affine-inline-comment@0.31.0
  - @labre/affine-inline-footnote@0.31.0
  - @labre/affine-inline-latex@0.31.0
  - @labre/affine-inline-link@0.31.0
  - @labre/affine-inline-mention@0.31.0
  - @labre/affine-inline-preset@0.31.0
  - @labre/affine-inline-reference@0.31.0
  - @labre/affine-model@0.31.0
  - @labre/affine-rich-text@0.31.0
  - @labre/affine-shared@0.31.0
  - @labre/affine-widget-drag-handle@0.31.0
  - @labre/affine-widget-keyboard-toolbar@0.31.0
  - @labre/affine-widget-linked-doc@0.31.0
  - @labre/affine-widget-page-dragging-area@0.31.0
  - @labre/affine-widget-slash-menu@0.31.0
  - @labre/std@0.31.0
  - @labre/affine-widget-toolbar@0.31.0
  - @labre/affine-widget-edgeless-selected-rect@0.31.0
  - @labre/affine-widget-edgeless-auto-connect@0.31.0
  - @labre/affine-widget-edgeless-dragging-area@0.31.0
  - @labre/affine-widget-note-slicer@0.31.0
  - @labre/affine-widget-edgeless-toolbar@0.31.0
  - @labre/affine-widget-edgeless-zoom-toolbar@0.31.0
  - @labre/affine-widget-frame-title@0.31.0
  - @labre/affine-widget-remote-selection@0.31.0
  - @labre/affine-widget-viewport-overlay@0.31.0
  - @labre/affine-widget-scroll-anchoring@0.31.0
  - @labre/global@0.31.0
  - @labre/sync@0.31.0

## 0.30.2

### Patch Changes

- 33acdfa: Publish bundles whose ESM specifiers Node can resolve

  The compiled bundles emitted specifiers verbatim from the vendored source, so
  `dist` shipped extensionless relative imports (`from './shortcuts'`), extensionless
  subpath imports (`from 'lodash-es/last'`), and bare imports of bundler-only proxy
  directories (`@atlaskit/pragmatic-drag-and-drop/element/adapter`). Bundlers accept
  all three; Node's ESM resolver accepts none, so any consumer that let Node resolve
  the bundles — a test runner treating them as externalized deps, a bundler-less
  import — failed with ERR_MODULE_NOT_FOUND / ERR_UNSUPPORTED_DIR_IMPORT.

  `compile-bundles.mjs` now rewrites every emitted specifier to an explicit one and
  fails the build on any relative import that resolves to nothing.

  - @labre/affine-block-attachment@0.30.2
  - @labre/affine-block-bookmark@0.30.2
  - @labre/affine-block-callout@0.30.2
  - @labre/affine-block-code@0.30.2
  - @labre/affine-block-data-view@0.30.2
  - @labre/affine-block-database@0.30.2
  - @labre/affine-block-divider@0.30.2
  - @labre/affine-block-edgeless-text@0.30.2
  - @labre/affine-block-embed@0.30.2
  - @labre/affine-block-embed-doc@0.30.2
  - @labre/affine-block-frame@0.30.2
  - @labre/affine-block-image@0.30.2
  - @labre/affine-block-latex@0.30.2
  - @labre/affine-block-list@0.30.2
  - @labre/affine-block-note@0.30.2
  - @labre/affine-block-paragraph@0.30.2
  - @labre/affine-block-root@0.30.2
  - @labre/affine-block-surface@0.30.2
  - @labre/affine-block-surface-ref@0.30.2
  - @labre/affine-block-table@0.30.2
  - @labre/affine-components@0.30.2
  - @labre/data-view@0.30.2
  - @labre/affine-ext-loader@0.30.2
  - @labre/affine-foundation@0.30.2
  - @labre/affine-fragment-adapter-panel@0.30.2
  - @labre/affine-fragment-doc-title@0.30.2
  - @labre/affine-fragment-frame-panel@0.30.2
  - @labre/affine-fragment-outline@0.30.2
  - @labre/affine-gfx-bpmn@0.30.2
  - @labre/affine-gfx-brush@0.30.2
  - @labre/affine-gfx-connector@0.30.2
  - @labre/affine-gfx-cynefin-estuarine@0.30.2
  - @labre/affine-gfx-ddd-aggregate@0.30.2
  - @labre/affine-gfx-ddd-context-map@0.30.2
  - @labre/affine-gfx-ddd-core-domain@0.30.2
  - @labre/affine-gfx-ddd-event-storming@0.30.2
  - @labre/affine-gfx-ddd-shared@0.30.2
  - @labre/affine-gfx-edgy@0.30.2
  - @labre/affine-gfx-group@0.30.2
  - @labre/affine-gfx-link@0.30.2
  - @labre/affine-gfx-mindmap@0.30.2
  - @labre/affine-gfx-note@0.30.2
  - @labre/affine-gfx-pointer@0.30.2
  - @labre/affine-gfx-shape@0.30.2
  - @labre/affine-gfx-template@0.30.2
  - @labre/affine-gfx-text@0.30.2
  - @labre/affine-gfx-turbo-renderer@0.30.2
  - @labre/affine-gfx-wardley@0.30.2
  - @labre/affine-inline-comment@0.30.2
  - @labre/affine-inline-footnote@0.30.2
  - @labre/affine-inline-latex@0.30.2
  - @labre/affine-inline-link@0.30.2
  - @labre/affine-inline-mention@0.30.2
  - @labre/affine-inline-preset@0.30.2
  - @labre/affine-inline-reference@0.30.2
  - @labre/affine-model@0.30.2
  - @labre/affine-rich-text@0.30.2
  - @labre/affine-shared@0.30.2
  - @labre/affine-widget-drag-handle@0.30.2
  - @labre/affine-widget-edgeless-auto-connect@0.30.2
  - @labre/affine-widget-edgeless-dragging-area@0.30.2
  - @labre/affine-widget-edgeless-selected-rect@0.30.2
  - @labre/affine-widget-edgeless-toolbar@0.30.2
  - @labre/affine-widget-edgeless-zoom-toolbar@0.30.2
  - @labre/affine-widget-frame-title@0.30.2
  - @labre/affine-widget-keyboard-toolbar@0.30.2
  - @labre/affine-widget-linked-doc@0.30.2
  - @labre/affine-widget-note-slicer@0.30.2
  - @labre/affine-widget-page-dragging-area@0.30.2
  - @labre/affine-widget-remote-selection@0.30.2
  - @labre/affine-widget-scroll-anchoring@0.30.2
  - @labre/affine-widget-slash-menu@0.30.2
  - @labre/affine-widget-toolbar@0.30.2
  - @labre/affine-widget-viewport-overlay@0.30.2
  - @labre/global@0.30.2
  - @labre/std@0.30.2
  - @labre/store@0.30.2
  - @labre/sync@0.30.2

## 0.30.1

### Patch Changes

- Updated dependencies [09f1d82]
  - @labre/affine-gfx-cynefin-estuarine@0.30.1
  - @labre/affine-block-attachment@0.30.1
  - @labre/affine-block-bookmark@0.30.1
  - @labre/affine-block-callout@0.30.1
  - @labre/affine-block-code@0.30.1
  - @labre/affine-block-data-view@0.30.1
  - @labre/affine-block-database@0.30.1
  - @labre/affine-block-divider@0.30.1
  - @labre/affine-block-edgeless-text@0.30.1
  - @labre/affine-block-embed@0.30.1
  - @labre/affine-block-embed-doc@0.30.1
  - @labre/affine-block-frame@0.30.1
  - @labre/affine-block-image@0.30.1
  - @labre/affine-block-latex@0.30.1
  - @labre/affine-block-list@0.30.1
  - @labre/affine-block-note@0.30.1
  - @labre/affine-block-paragraph@0.30.1
  - @labre/affine-block-root@0.30.1
  - @labre/affine-block-surface@0.30.1
  - @labre/affine-block-surface-ref@0.30.1
  - @labre/affine-block-table@0.30.1
  - @labre/affine-components@0.30.1
  - @labre/data-view@0.30.1
  - @labre/affine-ext-loader@0.30.1
  - @labre/affine-foundation@0.30.1
  - @labre/affine-fragment-adapter-panel@0.30.1
  - @labre/affine-fragment-doc-title@0.30.1
  - @labre/affine-fragment-frame-panel@0.30.1
  - @labre/affine-fragment-outline@0.30.1
  - @labre/affine-gfx-bpmn@0.30.1
  - @labre/affine-gfx-brush@0.30.1
  - @labre/affine-gfx-connector@0.30.1
  - @labre/affine-gfx-ddd-aggregate@0.30.1
  - @labre/affine-gfx-ddd-context-map@0.30.1
  - @labre/affine-gfx-ddd-core-domain@0.30.1
  - @labre/affine-gfx-ddd-event-storming@0.30.1
  - @labre/affine-gfx-ddd-shared@0.30.1
  - @labre/affine-gfx-edgy@0.30.1
  - @labre/affine-gfx-group@0.30.1
  - @labre/affine-gfx-link@0.30.1
  - @labre/affine-gfx-mindmap@0.30.1
  - @labre/affine-gfx-note@0.30.1
  - @labre/affine-gfx-pointer@0.30.1
  - @labre/affine-gfx-shape@0.30.1
  - @labre/affine-gfx-template@0.30.1
  - @labre/affine-gfx-text@0.30.1
  - @labre/affine-gfx-turbo-renderer@0.30.1
  - @labre/affine-gfx-wardley@0.30.1
  - @labre/affine-inline-comment@0.30.1
  - @labre/affine-inline-footnote@0.30.1
  - @labre/affine-inline-latex@0.30.1
  - @labre/affine-inline-link@0.30.1
  - @labre/affine-inline-mention@0.30.1
  - @labre/affine-inline-preset@0.30.1
  - @labre/affine-inline-reference@0.30.1
  - @labre/affine-model@0.30.1
  - @labre/affine-rich-text@0.30.1
  - @labre/affine-shared@0.30.1
  - @labre/affine-widget-drag-handle@0.30.1
  - @labre/affine-widget-edgeless-auto-connect@0.30.1
  - @labre/affine-widget-edgeless-dragging-area@0.30.1
  - @labre/affine-widget-edgeless-selected-rect@0.30.1
  - @labre/affine-widget-edgeless-toolbar@0.30.1
  - @labre/affine-widget-edgeless-zoom-toolbar@0.30.1
  - @labre/affine-widget-frame-title@0.30.1
  - @labre/affine-widget-keyboard-toolbar@0.30.1
  - @labre/affine-widget-linked-doc@0.30.1
  - @labre/affine-widget-note-slicer@0.30.1
  - @labre/affine-widget-page-dragging-area@0.30.1
  - @labre/affine-widget-remote-selection@0.30.1
  - @labre/affine-widget-scroll-anchoring@0.30.1
  - @labre/affine-widget-slash-menu@0.30.1
  - @labre/affine-widget-toolbar@0.30.1
  - @labre/affine-widget-viewport-overlay@0.30.1
  - @labre/global@0.30.1
  - @labre/std@0.30.1
  - @labre/store@0.30.1
  - @labre/sync@0.30.1

## 0.30.0

### Minor Changes

- 8deda2d: Wardley canvas keyboard chords: press `w`, then `c` (component), `l` (link
  tool), `a` (evolution arrow), `i` (inertia), `p` (pipeline), `m` (method) or
  `b` (classic background). Edgeless-only, disabled with the `wardley` block
  flag, host-rebindable via the shortcut manifest (`getShortcutManifest` now
  lists the `wardley` group). The wardley menu actions were extracted into
  standalone functions shared by the toolbar and the shortcuts.

### Patch Changes

- Updated dependencies [9d0fe0c]
- Updated dependencies [4aeb85e]
- Updated dependencies [ecba791]
- Updated dependencies [ecba791]
- Updated dependencies [8de86f4]
- Updated dependencies [d295c58]
- Updated dependencies [8deda2d]
  - @labre/std@0.30.0
  - @labre/affine-block-frame@0.30.0
  - @labre/affine-gfx-ddd-shared@0.30.0
  - @labre/affine-gfx-ddd-context-map@0.30.0
  - @labre/affine-gfx-cynefin-estuarine@0.30.0
  - @labre/affine-gfx-bpmn@0.30.0
  - @labre/affine-gfx-wardley@0.30.0
  - @labre/affine-model@0.30.0
  - @labre/affine-gfx-shape@0.30.0
  - @labre/affine-block-root@0.30.0
  - @labre/affine-block-attachment@0.30.0
  - @labre/affine-block-bookmark@0.30.0
  - @labre/affine-block-callout@0.30.0
  - @labre/affine-block-code@0.30.0
  - @labre/affine-block-data-view@0.30.0
  - @labre/affine-block-database@0.30.0
  - @labre/affine-block-divider@0.30.0
  - @labre/affine-block-edgeless-text@0.30.0
  - @labre/affine-block-embed@0.30.0
  - @labre/affine-block-embed-doc@0.30.0
  - @labre/affine-block-image@0.30.0
  - @labre/affine-block-latex@0.30.0
  - @labre/affine-block-list@0.30.0
  - @labre/affine-block-note@0.30.0
  - @labre/affine-block-paragraph@0.30.0
  - @labre/affine-block-surface@0.30.0
  - @labre/affine-block-surface-ref@0.30.0
  - @labre/affine-block-table@0.30.0
  - @labre/affine-components@0.30.0
  - @labre/data-view@0.30.0
  - @labre/affine-foundation@0.30.0
  - @labre/affine-fragment-adapter-panel@0.30.0
  - @labre/affine-fragment-doc-title@0.30.0
  - @labre/affine-fragment-frame-panel@0.30.0
  - @labre/affine-fragment-outline@0.30.0
  - @labre/affine-gfx-brush@0.30.0
  - @labre/affine-gfx-connector@0.30.0
  - @labre/affine-gfx-ddd-aggregate@0.30.0
  - @labre/affine-gfx-ddd-core-domain@0.30.0
  - @labre/affine-gfx-ddd-event-storming@0.30.0
  - @labre/affine-gfx-edgy@0.30.0
  - @labre/affine-gfx-group@0.30.0
  - @labre/affine-gfx-link@0.30.0
  - @labre/affine-gfx-mindmap@0.30.0
  - @labre/affine-gfx-note@0.30.0
  - @labre/affine-gfx-pointer@0.30.0
  - @labre/affine-gfx-template@0.30.0
  - @labre/affine-gfx-text@0.30.0
  - @labre/affine-gfx-turbo-renderer@0.30.0
  - @labre/affine-inline-comment@0.30.0
  - @labre/affine-inline-footnote@0.30.0
  - @labre/affine-inline-latex@0.30.0
  - @labre/affine-inline-link@0.30.0
  - @labre/affine-inline-mention@0.30.0
  - @labre/affine-inline-preset@0.30.0
  - @labre/affine-inline-reference@0.30.0
  - @labre/affine-rich-text@0.30.0
  - @labre/affine-shared@0.30.0
  - @labre/affine-widget-drag-handle@0.30.0
  - @labre/affine-widget-edgeless-auto-connect@0.30.0
  - @labre/affine-widget-edgeless-dragging-area@0.30.0
  - @labre/affine-widget-edgeless-selected-rect@0.30.0
  - @labre/affine-widget-edgeless-toolbar@0.30.0
  - @labre/affine-widget-edgeless-zoom-toolbar@0.30.0
  - @labre/affine-widget-frame-title@0.30.0
  - @labre/affine-widget-keyboard-toolbar@0.30.0
  - @labre/affine-widget-linked-doc@0.30.0
  - @labre/affine-widget-note-slicer@0.30.0
  - @labre/affine-widget-page-dragging-area@0.30.0
  - @labre/affine-widget-remote-selection@0.30.0
  - @labre/affine-widget-scroll-anchoring@0.30.0
  - @labre/affine-widget-slash-menu@0.30.0
  - @labre/affine-widget-toolbar@0.30.0
  - @labre/affine-widget-viewport-overlay@0.30.0
  - @labre/affine-ext-loader@0.30.0
  - @labre/global@0.30.0
  - @labre/store@0.30.0
  - @labre/sync@0.30.0

## 0.29.1

### Patch Changes

- Re-publish so the host seams shipped in #30 and #37 are reachable from the
  published bundle via `@formicoidea/labre-core/shared/services`:

  - `KeymapOverrideExtension`, `ShortcutConflictReporterExtension`, `canonicalCombo`
    and the `ShortcutOverrides` / `ShortcutManifestEntry` / `ShortcutConflict` types (#30)
  - `LinkedDocContentResolverExtension`, `LinkedDocContentResolverIdentifier`
    and the `LinkedDocContentResolver` type (#37)

  The re-exports already exist in source (`shared/services` barrel); they only
  predated the `0.29.0` npm tarball, so the host could not import them. No code
  change — a fresh release exposes them. Closes #43.

  - @labre/affine-block-attachment@0.29.1
  - @labre/affine-block-bookmark@0.29.1
  - @labre/affine-block-callout@0.29.1
  - @labre/affine-block-code@0.29.1
  - @labre/affine-block-data-view@0.29.1
  - @labre/affine-block-database@0.29.1
  - @labre/affine-block-divider@0.29.1
  - @labre/affine-block-edgeless-text@0.29.1
  - @labre/affine-block-embed@0.29.1
  - @labre/affine-block-embed-doc@0.29.1
  - @labre/affine-block-frame@0.29.1
  - @labre/affine-block-image@0.29.1
  - @labre/affine-block-latex@0.29.1
  - @labre/affine-block-list@0.29.1
  - @labre/affine-block-note@0.29.1
  - @labre/affine-block-paragraph@0.29.1
  - @labre/affine-block-root@0.29.1
  - @labre/affine-block-surface@0.29.1
  - @labre/affine-block-surface-ref@0.29.1
  - @labre/affine-block-table@0.29.1
  - @labre/affine-components@0.29.1
  - @labre/data-view@0.29.1
  - @labre/affine-ext-loader@0.29.1
  - @labre/affine-foundation@0.29.1
  - @labre/affine-fragment-adapter-panel@0.29.1
  - @labre/affine-fragment-doc-title@0.29.1
  - @labre/affine-fragment-frame-panel@0.29.1
  - @labre/affine-fragment-outline@0.29.1
  - @labre/affine-gfx-bpmn@0.29.1
  - @labre/affine-gfx-brush@0.29.1
  - @labre/affine-gfx-connector@0.29.1
  - @labre/affine-gfx-cynefin-estuarine@0.29.1
  - @labre/affine-gfx-ddd-aggregate@0.29.1
  - @labre/affine-gfx-ddd-context-map@0.29.1
  - @labre/affine-gfx-ddd-core-domain@0.29.1
  - @labre/affine-gfx-ddd-event-storming@0.29.1
  - @labre/affine-gfx-ddd-shared@0.29.1
  - @labre/affine-gfx-edgy@0.29.1
  - @labre/affine-gfx-group@0.29.1
  - @labre/affine-gfx-link@0.29.1
  - @labre/affine-gfx-mindmap@0.29.1
  - @labre/affine-gfx-note@0.29.1
  - @labre/affine-gfx-pointer@0.29.1
  - @labre/affine-gfx-shape@0.29.1
  - @labre/affine-gfx-template@0.29.1
  - @labre/affine-gfx-text@0.29.1
  - @labre/affine-gfx-turbo-renderer@0.29.1
  - @labre/affine-gfx-wardley@0.29.1
  - @labre/affine-inline-comment@0.29.1
  - @labre/affine-inline-footnote@0.29.1
  - @labre/affine-inline-latex@0.29.1
  - @labre/affine-inline-link@0.29.1
  - @labre/affine-inline-mention@0.29.1
  - @labre/affine-inline-preset@0.29.1
  - @labre/affine-inline-reference@0.29.1
  - @labre/affine-model@0.29.1
  - @labre/affine-rich-text@0.29.1
  - @labre/affine-shared@0.29.1
  - @labre/affine-widget-drag-handle@0.29.1
  - @labre/affine-widget-edgeless-auto-connect@0.29.1
  - @labre/affine-widget-edgeless-dragging-area@0.29.1
  - @labre/affine-widget-edgeless-selected-rect@0.29.1
  - @labre/affine-widget-edgeless-toolbar@0.29.1
  - @labre/affine-widget-edgeless-zoom-toolbar@0.29.1
  - @labre/affine-widget-frame-title@0.29.1
  - @labre/affine-widget-keyboard-toolbar@0.29.1
  - @labre/affine-widget-linked-doc@0.29.1
  - @labre/affine-widget-note-slicer@0.29.1
  - @labre/affine-widget-page-dragging-area@0.29.1
  - @labre/affine-widget-remote-selection@0.29.1
  - @labre/affine-widget-scroll-anchoring@0.29.1
  - @labre/affine-widget-slash-menu@0.29.1
  - @labre/affine-widget-toolbar@0.29.1
  - @labre/affine-widget-viewport-overlay@0.29.1
  - @labre/global@0.29.1
  - @labre/std@0.29.1
  - @labre/store@0.29.1
  - @labre/sync@0.29.1

## 0.29.0

### Minor Changes

- 054423b: Replace the edgeless "Others" senior toolbar button (and its submenu) with two
  standalone senior buttons placed next to pen/eraser: **Text** (insert an
  editable text element) and **Add file** (open the file picker and insert the
  image/attachment). Each is a single tap and is individually flag-gated
  (`edgeless-text`, `edgeless-media`, replacing the old `other` flag). The actions
  reuse the former submenu's `textRender` / `mediaRender`, so text/file insertion
  is unchanged.
- 7aab287: Add `getShortcutManifest(flags)` (#30, phase 2): the enumerable, framework-aware
  shortcut manifest for a host "Shortcuts" settings panel. It returns the core
  shortcuts plus the shortcuts contributed by the currently-enabled frameworks
  (flag-gated like `getInternalViewExtensions`), as metadata-only entries (no
  runtime handler). Enumerable without an editor instance. Exposed at
  `@labre/affine/shortcuts`. The per-framework contribution seam is ready
  (`coreShortcuts` is now exported from the root block); no framework ships
  shortcuts yet, so the manifest currently returns core only.

### Patch Changes

- Updated dependencies [cbdd8c6]
- Updated dependencies [ad7a655]
- Updated dependencies [7375b9a]
- Updated dependencies [3a3c99b]
- Updated dependencies [43462b5]
- Updated dependencies [054423b]
- Updated dependencies [ab409c5]
- Updated dependencies [40db887]
- Updated dependencies [7aab287]
- Updated dependencies [9330750]
  - @labre/affine-gfx-ddd-core-domain@0.29.0
  - @labre/affine-gfx-link@0.29.0
  - @labre/affine-shared@0.29.0
  - @labre/affine-block-embed-doc@0.29.0
  - @labre/affine-gfx-mindmap@0.29.0
  - @labre/affine-block-root@0.29.0
  - @labre/std@0.29.0
  - @labre/affine-block-attachment@0.29.0
  - @labre/affine-block-bookmark@0.29.0
  - @labre/affine-block-callout@0.29.0
  - @labre/affine-block-code@0.29.0
  - @labre/affine-block-data-view@0.29.0
  - @labre/affine-block-database@0.29.0
  - @labre/affine-block-divider@0.29.0
  - @labre/affine-block-edgeless-text@0.29.0
  - @labre/affine-block-embed@0.29.0
  - @labre/affine-block-frame@0.29.0
  - @labre/affine-block-image@0.29.0
  - @labre/affine-block-latex@0.29.0
  - @labre/affine-block-list@0.29.0
  - @labre/affine-block-note@0.29.0
  - @labre/affine-block-paragraph@0.29.0
  - @labre/affine-block-surface@0.29.0
  - @labre/affine-block-surface-ref@0.29.0
  - @labre/affine-block-table@0.29.0
  - @labre/affine-components@0.29.0
  - @labre/data-view@0.29.0
  - @labre/affine-foundation@0.29.0
  - @labre/affine-fragment-adapter-panel@0.29.0
  - @labre/affine-fragment-doc-title@0.29.0
  - @labre/affine-fragment-frame-panel@0.29.0
  - @labre/affine-fragment-outline@0.29.0
  - @labre/affine-gfx-bpmn@0.29.0
  - @labre/affine-gfx-brush@0.29.0
  - @labre/affine-gfx-connector@0.29.0
  - @labre/affine-gfx-cynefin-estuarine@0.29.0
  - @labre/affine-gfx-ddd-aggregate@0.29.0
  - @labre/affine-gfx-ddd-context-map@0.29.0
  - @labre/affine-gfx-ddd-event-storming@0.29.0
  - @labre/affine-gfx-ddd-shared@0.29.0
  - @labre/affine-gfx-edgy@0.29.0
  - @labre/affine-gfx-group@0.29.0
  - @labre/affine-gfx-note@0.29.0
  - @labre/affine-gfx-pointer@0.29.0
  - @labre/affine-gfx-shape@0.29.0
  - @labre/affine-gfx-template@0.29.0
  - @labre/affine-gfx-text@0.29.0
  - @labre/affine-gfx-wardley@0.29.0
  - @labre/affine-inline-comment@0.29.0
  - @labre/affine-inline-footnote@0.29.0
  - @labre/affine-inline-latex@0.29.0
  - @labre/affine-inline-link@0.29.0
  - @labre/affine-inline-mention@0.29.0
  - @labre/affine-inline-preset@0.29.0
  - @labre/affine-inline-reference@0.29.0
  - @labre/affine-rich-text@0.29.0
  - @labre/affine-widget-drag-handle@0.29.0
  - @labre/affine-widget-edgeless-auto-connect@0.29.0
  - @labre/affine-widget-edgeless-dragging-area@0.29.0
  - @labre/affine-widget-edgeless-selected-rect@0.29.0
  - @labre/affine-widget-edgeless-toolbar@0.29.0
  - @labre/affine-widget-edgeless-zoom-toolbar@0.29.0
  - @labre/affine-widget-frame-title@0.29.0
  - @labre/affine-widget-keyboard-toolbar@0.29.0
  - @labre/affine-widget-linked-doc@0.29.0
  - @labre/affine-widget-note-slicer@0.29.0
  - @labre/affine-widget-page-dragging-area@0.29.0
  - @labre/affine-widget-remote-selection@0.29.0
  - @labre/affine-widget-scroll-anchoring@0.29.0
  - @labre/affine-widget-slash-menu@0.29.0
  - @labre/affine-widget-toolbar@0.29.0
  - @labre/affine-widget-viewport-overlay@0.29.0
  - @labre/affine-gfx-turbo-renderer@0.29.0
  - @labre/affine-model@0.29.0
  - @labre/affine-ext-loader@0.29.0
  - @labre/global@0.29.0
  - @labre/store@0.29.0
  - @labre/sync@0.29.0

## 0.28.0

### Patch Changes

- Updated dependencies [1cd6c92]
- Updated dependencies [65cc055]
  - @labre/affine-block-database@0.28.0
  - @labre/data-view@0.28.0
  - @labre/std@0.28.0
  - @labre/affine-block-data-view@0.28.0
  - @labre/affine-block-root@0.28.0
  - @labre/affine-widget-keyboard-toolbar@0.28.0
  - @labre/affine-widget-toolbar@0.28.0
  - @labre/affine-block-table@0.28.0
  - @labre/affine-foundation@0.28.0
  - @labre/affine-block-attachment@0.28.0
  - @labre/affine-block-bookmark@0.28.0
  - @labre/affine-block-callout@0.28.0
  - @labre/affine-block-code@0.28.0
  - @labre/affine-block-divider@0.28.0
  - @labre/affine-block-edgeless-text@0.28.0
  - @labre/affine-block-embed@0.28.0
  - @labre/affine-block-embed-doc@0.28.0
  - @labre/affine-block-frame@0.28.0
  - @labre/affine-block-image@0.28.0
  - @labre/affine-block-latex@0.28.0
  - @labre/affine-block-list@0.28.0
  - @labre/affine-block-note@0.28.0
  - @labre/affine-block-paragraph@0.28.0
  - @labre/affine-block-surface@0.28.0
  - @labre/affine-block-surface-ref@0.28.0
  - @labre/affine-components@0.28.0
  - @labre/affine-fragment-adapter-panel@0.28.0
  - @labre/affine-fragment-doc-title@0.28.0
  - @labre/affine-fragment-frame-panel@0.28.0
  - @labre/affine-fragment-outline@0.28.0
  - @labre/affine-gfx-bpmn@0.28.0
  - @labre/affine-gfx-brush@0.28.0
  - @labre/affine-gfx-connector@0.28.0
  - @labre/affine-gfx-cynefin-estuarine@0.28.0
  - @labre/affine-gfx-ddd-aggregate@0.28.0
  - @labre/affine-gfx-ddd-context-map@0.28.0
  - @labre/affine-gfx-ddd-core-domain@0.28.0
  - @labre/affine-gfx-ddd-event-storming@0.28.0
  - @labre/affine-gfx-ddd-shared@0.28.0
  - @labre/affine-gfx-edgy@0.28.0
  - @labre/affine-gfx-group@0.28.0
  - @labre/affine-gfx-link@0.28.0
  - @labre/affine-gfx-mindmap@0.28.0
  - @labre/affine-gfx-note@0.28.0
  - @labre/affine-gfx-pointer@0.28.0
  - @labre/affine-gfx-shape@0.28.0
  - @labre/affine-gfx-template@0.28.0
  - @labre/affine-gfx-text@0.28.0
  - @labre/affine-gfx-turbo-renderer@0.28.0
  - @labre/affine-gfx-wardley@0.28.0
  - @labre/affine-inline-comment@0.28.0
  - @labre/affine-inline-footnote@0.28.0
  - @labre/affine-inline-latex@0.28.0
  - @labre/affine-inline-link@0.28.0
  - @labre/affine-inline-mention@0.28.0
  - @labre/affine-inline-preset@0.28.0
  - @labre/affine-inline-reference@0.28.0
  - @labre/affine-model@0.28.0
  - @labre/affine-rich-text@0.28.0
  - @labre/affine-shared@0.28.0
  - @labre/affine-widget-drag-handle@0.28.0
  - @labre/affine-widget-edgeless-auto-connect@0.28.0
  - @labre/affine-widget-edgeless-dragging-area@0.28.0
  - @labre/affine-widget-edgeless-selected-rect@0.28.0
  - @labre/affine-widget-edgeless-toolbar@0.28.0
  - @labre/affine-widget-edgeless-zoom-toolbar@0.28.0
  - @labre/affine-widget-frame-title@0.28.0
  - @labre/affine-widget-linked-doc@0.28.0
  - @labre/affine-widget-note-slicer@0.28.0
  - @labre/affine-widget-page-dragging-area@0.28.0
  - @labre/affine-widget-remote-selection@0.28.0
  - @labre/affine-widget-scroll-anchoring@0.28.0
  - @labre/affine-widget-slash-menu@0.28.0
  - @labre/affine-widget-viewport-overlay@0.28.0
  - @labre/affine-ext-loader@0.28.0
  - @labre/global@0.28.0
  - @labre/store@0.28.0
  - @labre/sync@0.28.0

## 0.27.0

### Patch Changes

- Updated dependencies [14ef3e7]
- Updated dependencies [91f6397]
- Updated dependencies [91f6397]
  - @labre/affine-block-database@0.27.0
  - @labre/affine-block-root@0.27.0
  - @labre/affine-widget-edgeless-selected-rect@0.27.0
  - @labre/std@0.27.0
  - @labre/affine-block-data-view@0.27.0
  - @labre/affine-widget-keyboard-toolbar@0.27.0
  - @labre/affine-widget-toolbar@0.27.0
  - @labre/affine-widget-note-slicer@0.27.0
  - @labre/affine-block-attachment@0.27.0
  - @labre/affine-block-bookmark@0.27.0
  - @labre/affine-block-callout@0.27.0
  - @labre/affine-block-code@0.27.0
  - @labre/affine-block-divider@0.27.0
  - @labre/affine-block-edgeless-text@0.27.0
  - @labre/affine-block-embed@0.27.0
  - @labre/affine-block-embed-doc@0.27.0
  - @labre/affine-block-frame@0.27.0
  - @labre/affine-block-image@0.27.0
  - @labre/affine-block-latex@0.27.0
  - @labre/affine-block-list@0.27.0
  - @labre/affine-block-note@0.27.0
  - @labre/affine-block-paragraph@0.27.0
  - @labre/affine-block-surface@0.27.0
  - @labre/affine-block-surface-ref@0.27.0
  - @labre/affine-block-table@0.27.0
  - @labre/affine-components@0.27.0
  - @labre/data-view@0.27.0
  - @labre/affine-foundation@0.27.0
  - @labre/affine-fragment-adapter-panel@0.27.0
  - @labre/affine-fragment-doc-title@0.27.0
  - @labre/affine-fragment-frame-panel@0.27.0
  - @labre/affine-fragment-outline@0.27.0
  - @labre/affine-gfx-bpmn@0.27.0
  - @labre/affine-gfx-brush@0.27.0
  - @labre/affine-gfx-connector@0.27.0
  - @labre/affine-gfx-cynefin-estuarine@0.27.0
  - @labre/affine-gfx-ddd-aggregate@0.27.0
  - @labre/affine-gfx-ddd-context-map@0.27.0
  - @labre/affine-gfx-ddd-core-domain@0.27.0
  - @labre/affine-gfx-ddd-event-storming@0.27.0
  - @labre/affine-gfx-ddd-shared@0.27.0
  - @labre/affine-gfx-edgy@0.27.0
  - @labre/affine-gfx-group@0.27.0
  - @labre/affine-gfx-link@0.27.0
  - @labre/affine-gfx-mindmap@0.27.0
  - @labre/affine-gfx-note@0.27.0
  - @labre/affine-gfx-pointer@0.27.0
  - @labre/affine-gfx-shape@0.27.0
  - @labre/affine-gfx-template@0.27.0
  - @labre/affine-gfx-text@0.27.0
  - @labre/affine-gfx-turbo-renderer@0.27.0
  - @labre/affine-gfx-wardley@0.27.0
  - @labre/affine-inline-comment@0.27.0
  - @labre/affine-inline-footnote@0.27.0
  - @labre/affine-inline-latex@0.27.0
  - @labre/affine-inline-link@0.27.0
  - @labre/affine-inline-mention@0.27.0
  - @labre/affine-inline-preset@0.27.0
  - @labre/affine-inline-reference@0.27.0
  - @labre/affine-model@0.27.0
  - @labre/affine-rich-text@0.27.0
  - @labre/affine-shared@0.27.0
  - @labre/affine-widget-drag-handle@0.27.0
  - @labre/affine-widget-edgeless-auto-connect@0.27.0
  - @labre/affine-widget-edgeless-dragging-area@0.27.0
  - @labre/affine-widget-edgeless-toolbar@0.27.0
  - @labre/affine-widget-edgeless-zoom-toolbar@0.27.0
  - @labre/affine-widget-frame-title@0.27.0
  - @labre/affine-widget-linked-doc@0.27.0
  - @labre/affine-widget-page-dragging-area@0.27.0
  - @labre/affine-widget-remote-selection@0.27.0
  - @labre/affine-widget-scroll-anchoring@0.27.0
  - @labre/affine-widget-slash-menu@0.27.0
  - @labre/affine-widget-viewport-overlay@0.27.0
  - @labre/affine-ext-loader@0.27.0
  - @labre/global@0.27.0
  - @labre/store@0.27.0
  - @labre/sync@0.27.0

## 0.26.0

### Minor Changes

- 66cd7e6: feat(blocks): ship each DDD senior button as its own package + bundle

  DDD was a single package holding three senior buttons (Event Storming, Core
  Domain Chart, Context Map), so the release bundler vendored it into
  `labre-core` instead of emitting framework bundles. It is now split per the
  "one senior button = one package" rule:

  - `@labre/affine-gfx-ddd-shared` → published as `@formicoidea/labre-ddd-shared`
    (shared base: consts/prefabs/menu-base/icons/template builders).
  - `@labre/affine-gfx-ddd-event-storming`, `-core-domain`, `-context-map`,
    `-aggregate` → published as `@formicoidea/labre-framework-ddd-*`, each
    depending on `labre-core` + `labre-ddd-shared`.

  `scripts/build-bundles.mjs` is now data-driven (adding a senior-button package
  is one `FRAMEWORKS` entry, with multi-extension/flag support), and
  `compile-/publish-bundles.mjs` resolve and order bundle→bundle dependencies
  (core → shared → frameworks). DDD no longer ships inside `labre-core` —
  consumers import it from the dedicated framework packages.

### Patch Changes

- Updated dependencies [8960a6c]
- Updated dependencies [6795191]
  - @labre/affine-block-database@0.26.0
  - @labre/affine-model@0.26.0
  - @labre/affine-components@0.26.0
  - @labre/affine-widget-toolbar@0.26.0
  - @labre/affine-gfx-wardley@0.26.0
  - @labre/affine-gfx-bpmn@0.26.0
  - @labre/affine-gfx-cynefin-estuarine@0.26.0
  - @labre/affine-gfx-edgy@0.26.0
  - @labre/affine-gfx-mindmap@0.26.0
  - @labre/affine-gfx-ddd-shared@0.26.0
  - @labre/affine-block-data-view@0.26.0
  - @labre/affine-block-root@0.26.0
  - @labre/affine-widget-keyboard-toolbar@0.26.0
  - @labre/affine-block-attachment@0.26.0
  - @labre/affine-block-bookmark@0.26.0
  - @labre/affine-block-callout@0.26.0
  - @labre/affine-block-code@0.26.0
  - @labre/affine-block-divider@0.26.0
  - @labre/affine-block-edgeless-text@0.26.0
  - @labre/affine-block-embed@0.26.0
  - @labre/affine-block-embed-doc@0.26.0
  - @labre/affine-block-frame@0.26.0
  - @labre/affine-block-image@0.26.0
  - @labre/affine-block-latex@0.26.0
  - @labre/affine-block-list@0.26.0
  - @labre/affine-block-note@0.26.0
  - @labre/affine-block-paragraph@0.26.0
  - @labre/affine-block-surface@0.26.0
  - @labre/affine-block-surface-ref@0.26.0
  - @labre/affine-block-table@0.26.0
  - @labre/affine-fragment-adapter-panel@0.26.0
  - @labre/affine-fragment-doc-title@0.26.0
  - @labre/affine-fragment-frame-panel@0.26.0
  - @labre/affine-fragment-outline@0.26.0
  - @labre/affine-gfx-brush@0.26.0
  - @labre/affine-gfx-connector@0.26.0
  - @labre/affine-gfx-ddd-aggregate@0.26.0
  - @labre/affine-gfx-ddd-context-map@0.26.0
  - @labre/affine-gfx-ddd-core-domain@0.26.0
  - @labre/affine-gfx-ddd-event-storming@0.26.0
  - @labre/affine-gfx-group@0.26.0
  - @labre/affine-gfx-link@0.26.0
  - @labre/affine-gfx-note@0.26.0
  - @labre/affine-gfx-pointer@0.26.0
  - @labre/affine-gfx-shape@0.26.0
  - @labre/affine-gfx-template@0.26.0
  - @labre/affine-gfx-text@0.26.0
  - @labre/affine-inline-comment@0.26.0
  - @labre/affine-inline-footnote@0.26.0
  - @labre/affine-inline-latex@0.26.0
  - @labre/affine-inline-link@0.26.0
  - @labre/affine-inline-mention@0.26.0
  - @labre/affine-inline-preset@0.26.0
  - @labre/affine-inline-reference@0.26.0
  - @labre/affine-rich-text@0.26.0
  - @labre/affine-shared@0.26.0
  - @labre/affine-widget-drag-handle@0.26.0
  - @labre/affine-widget-edgeless-auto-connect@0.26.0
  - @labre/affine-widget-edgeless-dragging-area@0.26.0
  - @labre/affine-widget-edgeless-selected-rect@0.26.0
  - @labre/affine-widget-edgeless-toolbar@0.26.0
  - @labre/affine-widget-edgeless-zoom-toolbar@0.26.0
  - @labre/affine-widget-frame-title@0.26.0
  - @labre/affine-widget-linked-doc@0.26.0
  - @labre/affine-widget-note-slicer@0.26.0
  - @labre/affine-widget-page-dragging-area@0.26.0
  - @labre/affine-widget-remote-selection@0.26.0
  - @labre/affine-widget-scroll-anchoring@0.26.0
  - @labre/affine-widget-viewport-overlay@0.26.0
  - @labre/data-view@0.26.0
  - @labre/affine-foundation@0.26.0
  - @labre/affine-widget-slash-menu@0.26.0
  - @labre/affine-ext-loader@0.26.0
  - @labre/affine-gfx-turbo-renderer@0.26.0
  - @labre/global@0.26.0
  - @labre/std@0.26.0
  - @labre/store@0.26.0
  - @labre/sync@0.26.0

## 0.25.0

### Minor Changes

- 66cd7e6: feat(blocks): ship each DDD senior button as its own package + bundle

  DDD was a single package holding three senior buttons (Event Storming, Core
  Domain Chart, Context Map), so the release bundler vendored it into
  `labre-core` instead of emitting framework bundles. It is now split per the
  "one senior button = one package" rule:

  - `@labre/affine-gfx-ddd-shared` → published as `@formicoidea/labre-ddd-shared`
    (shared base: consts/prefabs/menu-base/icons/template builders).
  - `@labre/affine-gfx-ddd-event-storming`, `-core-domain`, `-context-map`,
    `-aggregate` → published as `@formicoidea/labre-framework-ddd-*`, each
    depending on `labre-core` + `labre-ddd-shared`.

  `scripts/build-bundles.mjs` is now data-driven (adding a senior-button package
  is one `FRAMEWORKS` entry, with multi-extension/flag support), and
  `compile-/publish-bundles.mjs` resolve and order bundle→bundle dependencies
  (core → shared → frameworks). DDD no longer ships inside `labre-core` —
  consumers import it from the dedicated framework packages.

### Patch Changes

- Updated dependencies [8960a6c]
- Updated dependencies [6795191]
  - @labre/affine-block-database@0.25.0
  - @labre/affine-model@0.25.0
  - @labre/affine-components@0.25.0
  - @labre/affine-widget-toolbar@0.25.0
  - @labre/affine-gfx-wardley@0.25.0
  - @labre/affine-gfx-bpmn@0.25.0
  - @labre/affine-gfx-cynefin-estuarine@0.25.0
  - @labre/affine-gfx-edgy@0.25.0
  - @labre/affine-gfx-mindmap@0.25.0
  - @labre/affine-gfx-ddd-shared@0.25.0
  - @labre/affine-block-data-view@0.25.0
  - @labre/affine-block-root@0.25.0
  - @labre/affine-widget-keyboard-toolbar@0.25.0
  - @labre/affine-block-attachment@0.25.0
  - @labre/affine-block-bookmark@0.25.0
  - @labre/affine-block-callout@0.25.0
  - @labre/affine-block-code@0.25.0
  - @labre/affine-block-divider@0.25.0
  - @labre/affine-block-edgeless-text@0.25.0
  - @labre/affine-block-embed@0.25.0
  - @labre/affine-block-embed-doc@0.25.0
  - @labre/affine-block-frame@0.25.0
  - @labre/affine-block-image@0.25.0
  - @labre/affine-block-latex@0.25.0
  - @labre/affine-block-list@0.25.0
  - @labre/affine-block-note@0.25.0
  - @labre/affine-block-paragraph@0.25.0
  - @labre/affine-block-surface@0.25.0
  - @labre/affine-block-surface-ref@0.25.0
  - @labre/affine-block-table@0.25.0
  - @labre/affine-fragment-adapter-panel@0.25.0
  - @labre/affine-fragment-doc-title@0.25.0
  - @labre/affine-fragment-frame-panel@0.25.0
  - @labre/affine-fragment-outline@0.25.0
  - @labre/affine-gfx-brush@0.25.0
  - @labre/affine-gfx-connector@0.25.0
  - @labre/affine-gfx-ddd-aggregate@0.25.0
  - @labre/affine-gfx-ddd-context-map@0.25.0
  - @labre/affine-gfx-ddd-core-domain@0.25.0
  - @labre/affine-gfx-ddd-event-storming@0.25.0
  - @labre/affine-gfx-group@0.25.0
  - @labre/affine-gfx-link@0.25.0
  - @labre/affine-gfx-note@0.25.0
  - @labre/affine-gfx-pointer@0.25.0
  - @labre/affine-gfx-shape@0.25.0
  - @labre/affine-gfx-template@0.25.0
  - @labre/affine-gfx-text@0.25.0
  - @labre/affine-inline-comment@0.25.0
  - @labre/affine-inline-footnote@0.25.0
  - @labre/affine-inline-latex@0.25.0
  - @labre/affine-inline-link@0.25.0
  - @labre/affine-inline-mention@0.25.0
  - @labre/affine-inline-preset@0.25.0
  - @labre/affine-inline-reference@0.25.0
  - @labre/affine-rich-text@0.25.0
  - @labre/affine-shared@0.25.0
  - @labre/affine-widget-drag-handle@0.25.0
  - @labre/affine-widget-edgeless-auto-connect@0.25.0
  - @labre/affine-widget-edgeless-dragging-area@0.25.0
  - @labre/affine-widget-edgeless-selected-rect@0.25.0
  - @labre/affine-widget-edgeless-toolbar@0.25.0
  - @labre/affine-widget-edgeless-zoom-toolbar@0.25.0
  - @labre/affine-widget-frame-title@0.25.0
  - @labre/affine-widget-linked-doc@0.25.0
  - @labre/affine-widget-note-slicer@0.25.0
  - @labre/affine-widget-page-dragging-area@0.25.0
  - @labre/affine-widget-remote-selection@0.25.0
  - @labre/affine-widget-scroll-anchoring@0.25.0
  - @labre/affine-widget-viewport-overlay@0.25.0
  - @labre/data-view@0.25.0
  - @labre/affine-foundation@0.25.0
  - @labre/affine-widget-slash-menu@0.25.0
  - @labre/affine-ext-loader@0.25.0
  - @labre/affine-gfx-turbo-renderer@0.25.0
  - @labre/global@0.25.0
  - @labre/std@0.25.0
  - @labre/store@0.25.0
  - @labre/sync@0.25.0

## 0.24.0

### Minor Changes

- bc31490: feat(edgeless): add Domain-Driven Design framework tools

  Three independently flag-gated edgeless senior buttons — Event Storming
  (Brandolini colour-coded stickies), Core Domain Chart (a new drawn background
  element + sub-domain dots, movement arrows and a Notation legend) and Context
  Map (bounded-context bubbles + the nine relationship patterns) — plus
  dedicated Templates-panel sections: one per senior button (Event Storming,
  Core Domain Chart, Context Map) and a standalone Aggregate Design Canvas.

  All three sub-menus compose the same shared prefab builders (sticky, dot,
  bubble, connector, group) over native shape/connector/text/group elements, so
  only the Core Domain Chart background adds a new element model. Flags:
  `ddd-event-storming`, `ddd-core-domain`, `ddd-context-map`, `ddd-templates`.

  A senior-button flag gates only its toolbar button: Core Domain Chart
  rendering (element view, painter, interaction and contextual toolbar) is
  always registered, so disabling `ddd-core-domain` no longer un-paints existing
  charts, and Templates-panel insertion still renders them.

- bc31490: feat(edgeless): split the "Others" toolbox into a dedicated Mind Map button

  The combined senior button now splits in two:

  - **Mind Map** — a dedicated senior button (the mindmap glyph, the `m` shortcut,
    the style picker + import), flag-gated by `mindmap`.
  - **Others** — keeps free-text and add-file, flag-gated by a new `other` flag
    (it no longer rides the `mindmap` flag), same basket icon minus the mindmap.

  Both buttons share one parameterized component/menu (`variant`). Mindmap
  rendering (element view, painter, interaction, contextual toolbars) is now
  always registered, independent of either flag — so disabling a button never
  un-paints existing mindmaps nor breaks Templates-panel insertion.

  A new **"Mind Map"** section in the Templates panel offers the 4 built-in styles
  as starter mindmaps. Inserting a mindmap template required teaching the
  template id-regeneration middleware (`replaceIdMiddleware`) to remap a mindmap's
  node-id references (`children` keys + `parent` back-refs), so inserted mindmaps
  rebuild correctly.

### Patch Changes

- Updated dependencies [bc31490]
- Updated dependencies [bc31490]
- Updated dependencies [bc31490]
  - @labre/affine-gfx-ddd@0.24.0
  - @labre/affine-gfx-mindmap@0.24.0
  - @labre/affine-gfx-template@0.24.0
  - @labre/affine-gfx-wardley@0.24.0
  - @labre/affine-block-root@0.24.0
  - @labre/affine-gfx-bpmn@0.24.0
  - @labre/affine-gfx-cynefin-estuarine@0.24.0
  - @labre/affine-gfx-edgy@0.24.0
  - @labre/affine-block-attachment@0.24.0
  - @labre/affine-block-bookmark@0.24.0
  - @labre/affine-block-callout@0.24.0
  - @labre/affine-block-code@0.24.0
  - @labre/affine-block-data-view@0.24.0
  - @labre/affine-block-database@0.24.0
  - @labre/affine-block-divider@0.24.0
  - @labre/affine-block-edgeless-text@0.24.0
  - @labre/affine-block-embed@0.24.0
  - @labre/affine-block-embed-doc@0.24.0
  - @labre/affine-block-frame@0.24.0
  - @labre/affine-block-image@0.24.0
  - @labre/affine-block-latex@0.24.0
  - @labre/affine-block-list@0.24.0
  - @labre/affine-block-note@0.24.0
  - @labre/affine-block-paragraph@0.24.0
  - @labre/affine-block-surface@0.24.0
  - @labre/affine-block-surface-ref@0.24.0
  - @labre/affine-block-table@0.24.0
  - @labre/affine-components@0.24.0
  - @labre/data-view@0.24.0
  - @labre/affine-ext-loader@0.24.0
  - @labre/affine-foundation@0.24.0
  - @labre/affine-fragment-adapter-panel@0.24.0
  - @labre/affine-fragment-doc-title@0.24.0
  - @labre/affine-fragment-frame-panel@0.24.0
  - @labre/affine-fragment-outline@0.24.0
  - @labre/affine-gfx-brush@0.24.0
  - @labre/affine-gfx-connector@0.24.0
  - @labre/affine-gfx-group@0.24.0
  - @labre/affine-gfx-link@0.24.0
  - @labre/affine-gfx-note@0.24.0
  - @labre/affine-gfx-pointer@0.24.0
  - @labre/affine-gfx-shape@0.24.0
  - @labre/affine-gfx-text@0.24.0
  - @labre/affine-gfx-turbo-renderer@0.24.0
  - @labre/affine-inline-comment@0.24.0
  - @labre/affine-inline-footnote@0.24.0
  - @labre/affine-inline-latex@0.24.0
  - @labre/affine-inline-link@0.24.0
  - @labre/affine-inline-mention@0.24.0
  - @labre/affine-inline-preset@0.24.0
  - @labre/affine-inline-reference@0.24.0
  - @labre/affine-model@0.24.0
  - @labre/affine-rich-text@0.24.0
  - @labre/affine-shared@0.24.0
  - @labre/affine-widget-drag-handle@0.24.0
  - @labre/affine-widget-edgeless-auto-connect@0.24.0
  - @labre/affine-widget-edgeless-dragging-area@0.24.0
  - @labre/affine-widget-edgeless-selected-rect@0.24.0
  - @labre/affine-widget-edgeless-toolbar@0.24.0
  - @labre/affine-widget-edgeless-zoom-toolbar@0.24.0
  - @labre/affine-widget-frame-title@0.24.0
  - @labre/affine-widget-keyboard-toolbar@0.24.0
  - @labre/affine-widget-linked-doc@0.24.0
  - @labre/affine-widget-note-slicer@0.24.0
  - @labre/affine-widget-page-dragging-area@0.24.0
  - @labre/affine-widget-remote-selection@0.24.0
  - @labre/affine-widget-scroll-anchoring@0.24.0
  - @labre/affine-widget-slash-menu@0.24.0
  - @labre/affine-widget-toolbar@0.24.0
  - @labre/affine-widget-viewport-overlay@0.24.0
  - @labre/global@0.24.0
  - @labre/std@0.24.0
  - @labre/store@0.24.0
  - @labre/sync@0.24.0

## 0.23.3

### Patch Changes

- Updated dependencies
  - @labre/affine-shared@0.23.3
  - @labre/affine-block-attachment@0.23.3
  - @labre/affine-block-bookmark@0.23.3
  - @labre/affine-block-callout@0.23.3
  - @labre/affine-block-code@0.23.3
  - @labre/affine-block-data-view@0.23.3
  - @labre/affine-block-database@0.23.3
  - @labre/affine-block-divider@0.23.3
  - @labre/affine-block-edgeless-text@0.23.3
  - @labre/affine-block-embed@0.23.3
  - @labre/affine-block-embed-doc@0.23.3
  - @labre/affine-block-frame@0.23.3
  - @labre/affine-block-image@0.23.3
  - @labre/affine-block-latex@0.23.3
  - @labre/affine-block-list@0.23.3
  - @labre/affine-block-note@0.23.3
  - @labre/affine-block-paragraph@0.23.3
  - @labre/affine-block-root@0.23.3
  - @labre/affine-block-surface@0.23.3
  - @labre/affine-block-surface-ref@0.23.3
  - @labre/affine-block-table@0.23.3
  - @labre/affine-components@0.23.3
  - @labre/data-view@0.23.3
  - @labre/affine-foundation@0.23.3
  - @labre/affine-fragment-adapter-panel@0.23.3
  - @labre/affine-fragment-doc-title@0.23.3
  - @labre/affine-fragment-frame-panel@0.23.3
  - @labre/affine-fragment-outline@0.23.3
  - @labre/affine-gfx-bpmn@0.23.3
  - @labre/affine-gfx-brush@0.23.3
  - @labre/affine-gfx-connector@0.23.3
  - @labre/affine-gfx-cynefin-estuarine@0.23.3
  - @labre/affine-gfx-edgy@0.23.3
  - @labre/affine-gfx-group@0.23.3
  - @labre/affine-gfx-link@0.23.3
  - @labre/affine-gfx-mindmap@0.23.3
  - @labre/affine-gfx-note@0.23.3
  - @labre/affine-gfx-pointer@0.23.3
  - @labre/affine-gfx-shape@0.23.3
  - @labre/affine-gfx-template@0.23.3
  - @labre/affine-gfx-text@0.23.3
  - @labre/affine-gfx-wardley@0.23.3
  - @labre/affine-inline-comment@0.23.3
  - @labre/affine-inline-footnote@0.23.3
  - @labre/affine-inline-latex@0.23.3
  - @labre/affine-inline-link@0.23.3
  - @labre/affine-inline-mention@0.23.3
  - @labre/affine-inline-preset@0.23.3
  - @labre/affine-inline-reference@0.23.3
  - @labre/affine-rich-text@0.23.3
  - @labre/affine-widget-drag-handle@0.23.3
  - @labre/affine-widget-edgeless-auto-connect@0.23.3
  - @labre/affine-widget-edgeless-dragging-area@0.23.3
  - @labre/affine-widget-edgeless-selected-rect@0.23.3
  - @labre/affine-widget-edgeless-toolbar@0.23.3
  - @labre/affine-widget-edgeless-zoom-toolbar@0.23.3
  - @labre/affine-widget-frame-title@0.23.3
  - @labre/affine-widget-keyboard-toolbar@0.23.3
  - @labre/affine-widget-linked-doc@0.23.3
  - @labre/affine-widget-note-slicer@0.23.3
  - @labre/affine-widget-page-dragging-area@0.23.3
  - @labre/affine-widget-remote-selection@0.23.3
  - @labre/affine-widget-scroll-anchoring@0.23.3
  - @labre/affine-widget-slash-menu@0.23.3
  - @labre/affine-widget-toolbar@0.23.3
  - @labre/affine-widget-viewport-overlay@0.23.3
  - @labre/affine-ext-loader@0.23.3
  - @labre/affine-gfx-turbo-renderer@0.23.3
  - @labre/affine-model@0.23.3
  - @labre/global@0.23.3
  - @labre/std@0.23.3
  - @labre/store@0.23.3
  - @labre/sync@0.23.3

## 0.23.2

### Patch Changes

- Updated dependencies [ee682da]
  - @labre/affine-shared@0.23.2
  - @labre/affine-block-attachment@0.23.2
  - @labre/affine-block-bookmark@0.23.2
  - @labre/affine-block-callout@0.23.2
  - @labre/affine-block-code@0.23.2
  - @labre/affine-block-data-view@0.23.2
  - @labre/affine-block-database@0.23.2
  - @labre/affine-block-divider@0.23.2
  - @labre/affine-block-edgeless-text@0.23.2
  - @labre/affine-block-embed@0.23.2
  - @labre/affine-block-embed-doc@0.23.2
  - @labre/affine-block-frame@0.23.2
  - @labre/affine-block-image@0.23.2
  - @labre/affine-block-latex@0.23.2
  - @labre/affine-block-list@0.23.2
  - @labre/affine-block-note@0.23.2
  - @labre/affine-block-paragraph@0.23.2
  - @labre/affine-block-root@0.23.2
  - @labre/affine-block-surface@0.23.2
  - @labre/affine-block-surface-ref@0.23.2
  - @labre/affine-block-table@0.23.2
  - @labre/affine-components@0.23.2
  - @labre/data-view@0.23.2
  - @labre/affine-foundation@0.23.2
  - @labre/affine-fragment-adapter-panel@0.23.2
  - @labre/affine-fragment-doc-title@0.23.2
  - @labre/affine-fragment-frame-panel@0.23.2
  - @labre/affine-fragment-outline@0.23.2
  - @labre/affine-gfx-bpmn@0.23.2
  - @labre/affine-gfx-brush@0.23.2
  - @labre/affine-gfx-connector@0.23.2
  - @labre/affine-gfx-cynefin-estuarine@0.23.2
  - @labre/affine-gfx-edgy@0.23.2
  - @labre/affine-gfx-group@0.23.2
  - @labre/affine-gfx-link@0.23.2
  - @labre/affine-gfx-mindmap@0.23.2
  - @labre/affine-gfx-note@0.23.2
  - @labre/affine-gfx-pointer@0.23.2
  - @labre/affine-gfx-shape@0.23.2
  - @labre/affine-gfx-template@0.23.2
  - @labre/affine-gfx-text@0.23.2
  - @labre/affine-gfx-wardley@0.23.2
  - @labre/affine-inline-comment@0.23.2
  - @labre/affine-inline-footnote@0.23.2
  - @labre/affine-inline-latex@0.23.2
  - @labre/affine-inline-link@0.23.2
  - @labre/affine-inline-mention@0.23.2
  - @labre/affine-inline-preset@0.23.2
  - @labre/affine-inline-reference@0.23.2
  - @labre/affine-rich-text@0.23.2
  - @labre/affine-widget-drag-handle@0.23.2
  - @labre/affine-widget-edgeless-auto-connect@0.23.2
  - @labre/affine-widget-edgeless-dragging-area@0.23.2
  - @labre/affine-widget-edgeless-selected-rect@0.23.2
  - @labre/affine-widget-edgeless-toolbar@0.23.2
  - @labre/affine-widget-edgeless-zoom-toolbar@0.23.2
  - @labre/affine-widget-frame-title@0.23.2
  - @labre/affine-widget-keyboard-toolbar@0.23.2
  - @labre/affine-widget-linked-doc@0.23.2
  - @labre/affine-widget-note-slicer@0.23.2
  - @labre/affine-widget-page-dragging-area@0.23.2
  - @labre/affine-widget-remote-selection@0.23.2
  - @labre/affine-widget-scroll-anchoring@0.23.2
  - @labre/affine-widget-slash-menu@0.23.2
  - @labre/affine-widget-toolbar@0.23.2
  - @labre/affine-widget-viewport-overlay@0.23.2
  - @labre/affine-ext-loader@0.23.2
  - @labre/affine-gfx-turbo-renderer@0.23.2
  - @labre/affine-model@0.23.2
  - @labre/global@0.23.2
  - @labre/std@0.23.2
  - @labre/store@0.23.2
  - @labre/sync@0.23.2

## 0.23.1

### Patch Changes

- Updated dependencies [1beb60e]
  - @labre/affine-shared@0.23.1
  - @labre/affine-block-attachment@0.23.1
  - @labre/affine-block-bookmark@0.23.1
  - @labre/affine-block-callout@0.23.1
  - @labre/affine-block-code@0.23.1
  - @labre/affine-block-data-view@0.23.1
  - @labre/affine-block-database@0.23.1
  - @labre/affine-block-divider@0.23.1
  - @labre/affine-block-edgeless-text@0.23.1
  - @labre/affine-block-embed@0.23.1
  - @labre/affine-block-embed-doc@0.23.1
  - @labre/affine-block-frame@0.23.1
  - @labre/affine-block-image@0.23.1
  - @labre/affine-block-latex@0.23.1
  - @labre/affine-block-list@0.23.1
  - @labre/affine-block-note@0.23.1
  - @labre/affine-block-paragraph@0.23.1
  - @labre/affine-block-root@0.23.1
  - @labre/affine-block-surface@0.23.1
  - @labre/affine-block-surface-ref@0.23.1
  - @labre/affine-block-table@0.23.1
  - @labre/affine-components@0.23.1
  - @labre/data-view@0.23.1
  - @labre/affine-foundation@0.23.1
  - @labre/affine-fragment-adapter-panel@0.23.1
  - @labre/affine-fragment-doc-title@0.23.1
  - @labre/affine-fragment-frame-panel@0.23.1
  - @labre/affine-fragment-outline@0.23.1
  - @labre/affine-gfx-bpmn@0.23.1
  - @labre/affine-gfx-brush@0.23.1
  - @labre/affine-gfx-connector@0.23.1
  - @labre/affine-gfx-cynefin-estuarine@0.23.1
  - @labre/affine-gfx-edgy@0.23.1
  - @labre/affine-gfx-group@0.23.1
  - @labre/affine-gfx-link@0.23.1
  - @labre/affine-gfx-mindmap@0.23.1
  - @labre/affine-gfx-note@0.23.1
  - @labre/affine-gfx-pointer@0.23.1
  - @labre/affine-gfx-shape@0.23.1
  - @labre/affine-gfx-template@0.23.1
  - @labre/affine-gfx-text@0.23.1
  - @labre/affine-gfx-wardley@0.23.1
  - @labre/affine-inline-comment@0.23.1
  - @labre/affine-inline-footnote@0.23.1
  - @labre/affine-inline-latex@0.23.1
  - @labre/affine-inline-link@0.23.1
  - @labre/affine-inline-mention@0.23.1
  - @labre/affine-inline-preset@0.23.1
  - @labre/affine-inline-reference@0.23.1
  - @labre/affine-rich-text@0.23.1
  - @labre/affine-widget-drag-handle@0.23.1
  - @labre/affine-widget-edgeless-auto-connect@0.23.1
  - @labre/affine-widget-edgeless-dragging-area@0.23.1
  - @labre/affine-widget-edgeless-selected-rect@0.23.1
  - @labre/affine-widget-edgeless-toolbar@0.23.1
  - @labre/affine-widget-edgeless-zoom-toolbar@0.23.1
  - @labre/affine-widget-frame-title@0.23.1
  - @labre/affine-widget-keyboard-toolbar@0.23.1
  - @labre/affine-widget-linked-doc@0.23.1
  - @labre/affine-widget-note-slicer@0.23.1
  - @labre/affine-widget-page-dragging-area@0.23.1
  - @labre/affine-widget-remote-selection@0.23.1
  - @labre/affine-widget-scroll-anchoring@0.23.1
  - @labre/affine-widget-slash-menu@0.23.1
  - @labre/affine-widget-toolbar@0.23.1
  - @labre/affine-widget-viewport-overlay@0.23.1
  - @labre/affine-ext-loader@0.23.1
  - @labre/affine-gfx-turbo-renderer@0.23.1
  - @labre/affine-model@0.23.1
  - @labre/global@0.23.1
  - @labre/std@0.23.1
  - @labre/store@0.23.1
  - @labre/sync@0.23.1

## 0.23.0

### Patch Changes

- Updated dependencies [9014c87]
- Updated dependencies [c775151]
- Updated dependencies [c775151]
- Updated dependencies [d2f435f]
  - @labre/affine-gfx-bpmn@0.23.0
  - @labre/affine-model@0.23.0
  - @labre/affine-block-surface@0.23.0
  - @labre/affine-shared@0.23.0
  - @labre/affine-gfx-cynefin-estuarine@0.23.0
  - @labre/affine-gfx-template@0.23.0
  - @labre/affine-gfx-wardley@0.23.0
  - @labre/affine-gfx-edgy@0.23.0
  - @labre/affine-widget-edgeless-toolbar@0.23.0
  - @labre/affine-block-attachment@0.23.0
  - @labre/affine-block-bookmark@0.23.0
  - @labre/affine-block-callout@0.23.0
  - @labre/affine-block-code@0.23.0
  - @labre/affine-block-data-view@0.23.0
  - @labre/affine-block-database@0.23.0
  - @labre/affine-block-divider@0.23.0
  - @labre/affine-block-edgeless-text@0.23.0
  - @labre/affine-block-embed@0.23.0
  - @labre/affine-block-embed-doc@0.23.0
  - @labre/affine-block-frame@0.23.0
  - @labre/affine-block-image@0.23.0
  - @labre/affine-block-latex@0.23.0
  - @labre/affine-block-list@0.23.0
  - @labre/affine-block-note@0.23.0
  - @labre/affine-block-paragraph@0.23.0
  - @labre/affine-block-root@0.23.0
  - @labre/affine-block-surface-ref@0.23.0
  - @labre/affine-block-table@0.23.0
  - @labre/affine-components@0.23.0
  - @labre/affine-fragment-adapter-panel@0.23.0
  - @labre/affine-fragment-doc-title@0.23.0
  - @labre/affine-fragment-frame-panel@0.23.0
  - @labre/affine-fragment-outline@0.23.0
  - @labre/affine-gfx-brush@0.23.0
  - @labre/affine-gfx-connector@0.23.0
  - @labre/affine-gfx-group@0.23.0
  - @labre/affine-gfx-link@0.23.0
  - @labre/affine-gfx-mindmap@0.23.0
  - @labre/affine-gfx-note@0.23.0
  - @labre/affine-gfx-pointer@0.23.0
  - @labre/affine-gfx-shape@0.23.0
  - @labre/affine-gfx-text@0.23.0
  - @labre/affine-inline-comment@0.23.0
  - @labre/affine-inline-footnote@0.23.0
  - @labre/affine-inline-latex@0.23.0
  - @labre/affine-inline-link@0.23.0
  - @labre/affine-inline-mention@0.23.0
  - @labre/affine-inline-preset@0.23.0
  - @labre/affine-inline-reference@0.23.0
  - @labre/affine-rich-text@0.23.0
  - @labre/affine-widget-drag-handle@0.23.0
  - @labre/affine-widget-edgeless-auto-connect@0.23.0
  - @labre/affine-widget-edgeless-dragging-area@0.23.0
  - @labre/affine-widget-edgeless-selected-rect@0.23.0
  - @labre/affine-widget-edgeless-zoom-toolbar@0.23.0
  - @labre/affine-widget-frame-title@0.23.0
  - @labre/affine-widget-keyboard-toolbar@0.23.0
  - @labre/affine-widget-linked-doc@0.23.0
  - @labre/affine-widget-note-slicer@0.23.0
  - @labre/affine-widget-page-dragging-area@0.23.0
  - @labre/affine-widget-remote-selection@0.23.0
  - @labre/affine-widget-scroll-anchoring@0.23.0
  - @labre/affine-widget-toolbar@0.23.0
  - @labre/affine-widget-viewport-overlay@0.23.0
  - @labre/data-view@0.23.0
  - @labre/affine-foundation@0.23.0
  - @labre/affine-widget-slash-menu@0.23.0
  - @labre/affine-ext-loader@0.23.0
  - @labre/affine-gfx-turbo-renderer@0.23.0
  - @labre/global@0.23.0
  - @labre/std@0.23.0
  - @labre/store@0.23.0
  - @labre/sync@0.23.0
