# @labre/affine-block-surface

## 0.34.2

### Patch Changes

- @labre/affine-components@0.34.2
- @labre/affine-ext-loader@0.34.2
- @labre/affine-model@0.34.2
- @labre/affine-rich-text@0.34.2
- @labre/affine-shared@0.34.2
- @labre/global@0.34.2
- @labre/std@0.34.2
- @labre/store@0.34.2

## 0.34.1

### Patch Changes

- cb49bb1: fix(edgeless): the edgy venn stops hosting the spotlight — board logic lives on
  the edgy board

  The EDGY "Enterprise Design Facets" Venn (`edgy`) was registered as a
  spotlight host alongside the EDGY board (`edgyBoard`), so any element laid
  inside its circles got the hover spotlight: hovering one faded everything else
  on the diagram. That is board logic on a drawing. The Venn frames a notation;
  it does not host a dependency reading.

  `SpotlightHostExtension('edgy')` is gone and the "Enable / disable hover
  spotlight" toggle has left the Venn's contextual toolbar. The board keeps both,
  unchanged. The Venn keeps its appearance toggles — labels, pictos, crop,
  resize — plus its legend, which moves from `d.legend` to `c.legend` now that
  the row is one shorter.

  `spotlightEnabled` STAYS on `EdgyFacetsElementModel`: documents written before
  this change carry the property and must stay loadable. It is simply inert —
  nothing reads it on a Venn any more.

  The host lookup `SpotlightManager` runs on every pointermove is now the
  exported pure `findSpotlightHost(target, elements, hostTypes)`, so the rule a
  Venn grants nothing and a board grants is pinned by a unit test rather than by
  a DI registration read by eye.

  Refs #195

- Updated dependencies [6120f7a]
- Updated dependencies [cb49bb1]
  - @labre/affine-model@0.34.1
  - @labre/std@0.34.1
  - @labre/affine-components@0.34.1
  - @labre/affine-rich-text@0.34.1
  - @labre/affine-shared@0.34.1
  - @labre/affine-ext-loader@0.34.1
  - @labre/global@0.34.1
  - @labre/store@0.34.1

## 0.34.0

### Minor Changes

- 5f76ab3: feat(std): a transient per-element highlight api for embedded read-only windows

  Host apps embedding a map preview (an AI conversation thread, a report, a
  sidebar) could only point at elements by reframing the viewport on the union of
  their bounds. That reads as "somewhere around here" and cannot distinguish two
  operations whose elements already share the same view.

  The gfx controller now carries a first-class emphasis API:

  ```ts
  gfx.highlightElements(ids: string[], opts?: {
    reframe?: boolean;   // unite the target bounds and reframe first (default false)
    duration?: number;   // ms before auto-clear, default 2000, 0 = until cleared
    padding?: [number, number, number, number]; // reframe padding
    smooth?: boolean;    // animate the reframe, default true
  }): void

  gfx.highlight.clear();          // drop the emphasis early
  gfx.highlight.highlighted$;     // signal of the currently emphasized ids
  ```

  Guarantees:

  - **Non-destructive** — no store write, no persisted selection, no edit mode.
    It is safe on a read-only or non-interactive editor.
  - **Per element** — an accent ring is stroked around each target, following the
    element rotation; connectors and frames use their bound box. Unknown ids and
    non-graphic blocks are ignored, and elements deleted while highlighted simply
    drop out.
  - **Composable** — `reframe: true` unites the target bounds and calls the
    existing viewport reframe before emphasizing.
  - **Transient** — the highlight auto-clears after `duration`; calling it again
    replaces the previous set and restarts the timer.

  State lives in `ElementHighlightManager` (`@labre/std`, registered by default on
  every std scope); the ring is drawn by `ElementHighlightOverlay`
  (`@labre/affine-block-surface`), registered for the `edgeless`,
  `preview-edgeless` and `mobile-edgeless` view scopes.

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
- Updated dependencies [5f76ab3]
- Updated dependencies [f09d68c]
  - @labre/std@0.34.0
  - @labre/affine-shared@0.34.0
  - @labre/affine-components@0.34.0
  - @labre/affine-model@0.34.0
  - @labre/affine-rich-text@0.34.0
  - @labre/affine-ext-loader@0.34.0
  - @labre/global@0.34.0
  - @labre/store@0.34.0

## 0.33.0

### Minor Changes

- 46ce0c9: feat(edgeless): validate what relations join and which zone an artefact sits in

  Two new rule families in the validation engine, plus the two seams the
  frameworks about to use them need.

  `relation-endpoints` judges a typed edge on WHAT it joins rather than on where
  it is drawn: a framework declares the sentences it sanctions — `source` _verb_
  `target`, all three named by role — and the engine reads the persisted
  `source → target` pair against them. It also arbitrates the three things a pair
  of artefacts can carry too much of: a relation looping back onto its own source,
  the same relation drawn twice, and two patterns that may not coexist between one
  couple (an anti-corruption layer and a conformist link say opposite things). Each
  mode of failure carries its own wording, because the four are fixed with four
  different gestures. An end the framework's grammar never mentions — a hotspot, a
  neutral shape, an artefact of another framework — yields silence: a link onto
  something the model has not named yet is somebody sketching, and a grammar that
  indicted the sketch would be switched off within a day.

  `element-in-zone` judges an artefact against the named REGIONS of the frame it
  sits on, where `element-in-background` only asked whether it was on the frame at
  all: "an outsourced subdomain has no business in the Core quadrant". The zone
  rectangles come from the declaration the renderer already paints from, resolved
  against the instance the subject is actually on, so a rule restates no
  coordinate and follows the map when it is moved or resized. An artefact off
  every frame is silence — that is another rule's question — and the verdict does
  not depend on the zone tints being switched on: a quadrant stays a quadrant when
  the user prints the chart in black and white.

  Being a framework's ROOT INSTANCE — what the profile picker, the Map quality
  checklist and the check-up are offered on — is no longer derived from the
  registered rules alone. A framework may now declare its background role
  outright (`ValidationFrameworkExtension`), which is what a framework whose
  expectations are all negotiated rather than computed needs: it ships nudges and
  no rule, and inventing a rule that never fires to make its panel appear would be
  data claiming an effect it does not have. Frameworks that ship rules are
  unaffected and declare nothing.

  Finally, a background's zones and texts can name the `variants` they belong to,
  exactly as its washes already could — one declaration, two readings of the same
  frame, selected by one model prop. A zone takes its own label with it, and a
  label the current variant does not paint is no longer offered for in-place
  editing. `element-in-zone` reads the same reading: a quadrant this instance does
  not show is not ground an artefact can be judged against.

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

- f929e12: a c4 board declares its level, and the view polices it

  C4's levels are not only zooms of an element — they are DIAGRAM TYPES, and each
  one is defined by what appears on it. Until now the canvas had no way to say
  which of them a sheet was: the board's title is free text, so a board called
  "Payments" said nothing about whether it showed the system's context, its
  containers or its components. Every level rule had to guess the level from what
  happened to be drawn, and the level skip that is easiest to draw — a system
  boundary full of components with no container boundary anywhere — was invisible
  to the whole pack, as `c4.component-level-skip` documented at length.

  A C4 board now carries an optional **level**, set from a small dropdown on the
  selected board: Free sketch (the default), then the four C's the notation is
  named after — Context, Containers, Components, Code. It is a declared fact
  sitting beside the title, not a rename — the author keeps whatever words they
  wrote — and choosing Free sketch clears it again, so a board that never states
  one is byte-identical to every C4 board drawn before today.

  Two rules read it, citing C4's diagram types:

  - **a context diagram** draws systems as boxes, with the people and neighbouring
    systems around them. Containers, components and boundaries have no place on
    one;
  - **a container diagram** draws one system's containers inside its system
    boundary. Components and container boundaries belong on the next sheet down.

  Persons, systems, the containers themselves and the system boundary stay legal
  throughout: C4 draws its neighbours at every level, and the rules refuse only
  what the notation actually refuses. Two of the four levels declare no rule at
  all — a component diagram legitimately shows everything C4 names, and a code
  diagram is a level this pack cannot yet speak about, since the editor draws no
  code-level artefact. Both are still an author's to declare: what a sheet may say
  about itself is the notation's business, not this editor's. Both rules are
  remarks on Sketch and warnings once the board is set to Review checklist, which
  now promotes eleven of the sixteen rules — and a board that declares no level is
  silent under both, so no diagram already drawn gains a finding.

  Under it, the engine gains a generic **`view-admissibility`** family: a rule
  names the prop a frame writes its level in, plus the roles each level value does
  not admit. Nothing in it knows C4 — the prop name and the levels are the rule's
  own data — so any framework whose views come in kinds can ask the same question.
  It is the first family whose subject is the sheet rather than an artefact, it
  walks the surface once, and a frame that declares no level costs it nothing.

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

- 7aa932c: feat(blocks): count relations, count artefacts per frame, and follow the graph

  Four new rule families in the validation engine, plus one capability on an
  existing one. All framework-agnostic: a framework declares data, the engine
  knows a family and never a notation.

  **`edge-degree`** — how many typed relations may arrive at, and leave, one node.
  The half of a relation grammar no per-edge rule can express, because the mistake
  is a COUNT and nothing is wrong with any single link: "this step begins the
  process, so nothing points at it", "this step is not a dead end". Read off the
  persisted `source → target` pairs, so the verdict survives every layout of the
  same document, and one finding per node however many bounds it breaks.

  **`role-count`** — how many artefacts of one role one INSTANCE of a frame must
  carry. Existence and uniqueness, tallied per frame and reported ON it, so the
  bracket lands on the frame and an arbitration made on one frame says nothing
  about the frame beside it. Membership is containment only: an artefact floating
  next to a frame has never satisfied a requirement about what is inside it.

  **`edge-locality`** — a relation constrained relative to the frames its two ends
  sit on: one relation stays inside a single frame, another only exists between
  two. In the legal case and the illegal one the two ends carry exactly the same
  roles, so nothing but the attribution can tell them apart — which is why no
  grammar rule could ever say it.

  **`reachability`** — every artefact must be reachable from a declared root by
  following typed relations. The orphan question, and the first one in this engine
  that no amount of looking at an element or at a relation can answer. A board
  carrying no root at all is total silence: the missing root is `role-count`'s
  finding, raised once, on the frame, rather than a wall of brackets with one
  cause.

  **`relation-endpoints` learns to see the link nobody typed.** Quick-connect and
  auto-complete draw a connector carrying no role, so a framework's grammar read
  it as absent while the user read it as drawn — a board that looks joined up and
  validates as if nobody had joined anything. A rule can now ask for exactly one
  kind of role-less link back: one drawn between two artefacts its own sanctioned
  sentences could have related. A plain link to a note, to a legend glyph, to the
  frame the artefacts are drawn on, to a rectangle somebody dropped on the board
  to think with, stays what it always was — somebody pointing at something, and
  none of the framework's business.

  Every family is linear in the elements and the relations, `reachability` is
  `O(V + E)`, and none of them adds a pair-wise sweep: the 16 ms drawing budget
  and the single quadratic term the engine already had are untouched.

- 932bf35: feat(blocks): a bound that either side may satisfy, one that waits to be armed, and a graph that starts where it is drawn

  Three small extensions to the rule families, each closing a shape a real
  notation makes and the engine could not express. All three are additive: absent,
  every existing rule means exactly what it meant.

  **`edge-degree.eitherMin`** — a DISJUNCTIVE floor. The four per-direction bounds
  are conjunctive, and a whole class of requirement says the opposite: an artefact
  must do one thing OR the other, and doing either is enough. A branching artefact
  that neither splits nor merges takes one thing in, puts one thing out and
  decides nothing — but `minIn: 2` would indict every split and `minOut: 2` every
  merge, so no conjunction of the four says it. The bound is orthogonal to them
  and reported last, because "nothing arrives here" names the side to act on and
  "neither side has enough" does not.

  **`role-count.ifPresent`** — a GUARD. Whole families of artefact are optional
  alone and normative in pairs: a sketch may show neither a beginning nor an end,
  but not one without the other. An unconditional minimum would state the wrong
  thing twice — indicting the legitimate sketch, in the name of a requirement the
  notation does not make — so the pairing is written as a bound plus a guard, and
  the two directions are two rules. A frame the guard has not armed is not judged
  at all, rather than judged and found compliant. The guard element has to be IN
  the frame, on the same containment-only reading the counted subjects use.

  **`reachability.implicitRoots`** — a second kind of beginning. A notation whose
  start marker is optional has a silent way of saying where the work begins: draw
  the artefact and point nothing at it. Two branches side by side, only one of
  them marked, are both well-formed — and the traversal would have reported the
  whole of the unmarked one as unreachable, a wall of brackets over a drawing that
  is right. With the flag on, what survives is the only real defect: a ring
  entered from nowhere, whose work can never begin. The zero-root silence is
  unchanged in spirit and widened in fact — it now means no root of either kind.

  Still linear, still `O(V + E)`, still no framework name anywhere in the engine.

- 932bf35: feat(blocks): a forbidden shape of degree, a count that does not descend, and a family that reads words

  Three more capabilities in the validation engine, from a triangulation against
  the reference process linters. Two are fields on families that already exist;
  the third is the first brick of the PRD's _étiquetage_ family.

  **`edge-degree.forbidPattern`** — a FORBIDDEN ZONE, declared as the bounds a
  subject must not all satisfy at once. The inverse polarity of every other bound:
  it fires when the node matches all of them rather than when it misses one. Two
  shapes want exactly that and neither is a floor or a ceiling — an artefact that
  merges AND splits at the same time is ambiguous although each half alone is
  fine, and an artefact that does NEITHER is superfluous although a ceiling on
  either side alone would forbid the legitimate case. It carries its own words,
  because a forbidden zone is not a bound that failed and never reads like one, and
  a pattern with no bound in it (which every node matches) is dropped with a
  warning rather than indicting the board.

  **`role-count.exact`** — count the elements whose role IS the subject, without
  descending into its specialisations. The descending default is right when the
  requirement is about the family: "one beginning" means one beginning of any kind,
  and a new variant inherits the rule for free. It is wrong when the requirement is
  about the PLAIN member as distinct from its qualified siblings — "at most one
  unqualified beginning" is a statement about the artefact carrying no qualifier,
  and under the descending reading it cannot be written at all. The guard keeps
  descending, deliberately: asking "is there one of these at all" is a question
  about the family whatever the bound beside it counts.

  **`label-presence`** — a new family, and the first that reads an element's
  WORDS. Every other one asks about geometry, roles or relations, all of which a
  reader can partly infer from the drawing; a box with nothing written in it is the
  one defect nothing recovers. Absent means no text, empty text, whitespace, or
  invisible code points alone — an artefact named with a zero-width space looks
  unnamed and would otherwise validate as named, which is the worst of both.

  Naming is the one property a user changes by typing, so `text` becomes
  verdict-bearing only for a framework that registers a REAL-TIME rule of that
  family. A rule declared on-demand costs the drawing path nothing at all; a
  real-time one wakes the debounced evaluation on every keystroke. Both are
  supported, and which one a framework wants is a decision it makes in its own
  declaration.

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

- 334bd61: fix(edgeless): restyling a framework flow no longer restyles the plain connector

  The sibling of the tool-arming leak: `EdgelessCRUDExtension.updateElement`
  recorded EVERY element restyle into the shared last-props, which are keyed by
  type. Restyle an existing BPMN message flow or C4 relationship through the
  element toolbar and the dashed, marker-headed look was memorised as "the last
  connector" — so the next plain connector drew dressed as the flow.

  The crud now skips last-props recording when the element (or the patch) carries
  a `role`: framework artefacts keep their costume to themselves, while a user
  restyling a plain element still teaches the next one, exactly as before.

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

- Updated dependencies [3fbf69c]
- Updated dependencies [f929e12]
- Updated dependencies [13360cd]
- Updated dependencies [c03090c]
- Updated dependencies [32e4d45]
- Updated dependencies [139d77b]
- Updated dependencies [6bba40c]
- Updated dependencies [a8325bb]
- Updated dependencies [ff19911]
- Updated dependencies [b03132c]
- Updated dependencies [48049d6]
- Updated dependencies [7136db0]
- Updated dependencies [5737a56]
- Updated dependencies [168617d]
- Updated dependencies [9022c92]
- Updated dependencies [edfaba2]
- Updated dependencies [e42e0c0]
- Updated dependencies [256ee0b]
- Updated dependencies [4a3b26e]
- Updated dependencies [48c3b52]
- Updated dependencies [6a20738]
- Updated dependencies [f09f9a3]
  - @labre/affine-components@0.33.0
  - @labre/affine-shared@0.33.0
  - @labre/affine-model@0.33.0
  - @labre/std@0.33.0
  - @labre/affine-rich-text@0.33.0
  - @labre/affine-ext-loader@0.33.0
  - @labre/global@0.33.0
  - @labre/store@0.33.0

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

- 86e7562: fix(edgeless): the info panels take their place — and their width — from the senior bar

  PO recette of 02/08/2026, second pass, points 2 and 3. The panels that tell you
  about the canvas now share one place and one measure: **anchored to the editor,
  above the senior button bar, at exactly its width** (ADR 0011).

  **"Read this component" stops guessing its width.** The 480px it shipped with
  lined up with nothing on screen. Its left and right edges are now the toolbar
  bar's own, measured off the bar's rect rather than computed from the toolbar's
  layout constants — the bar is `fit-content` over a tool count that changes with
  the editor's width, so any arithmetic would be a copy that drifts. A resize or a
  zoom re-measures, and so does the toolbar's own re-layout, which lands a frame
  later than the resize does.

  **Map quality adopts the same pattern.** It leaves the popover that hung off the
  map's top-right corner at 320px, flipping sides and ends to stay on screen, for
  the same anchored panel in the same layer above every toolbar. Only the
  presentation moved: the entry in the background's contextual menu is still the
  trigger, the panel is still about one root instance, and nothing it renders
  changed.

  **One component, not two copies.** `EditorAnchoredPanel` owns the geometry, the
  layer, the dialog semantics, the pointer-swallowing, click-away and Escape, and
  the re-measure wiring; a panel subclasses it, says when it is open and how it
  closes, and renders its body. A read-only board renders no toolbar, so a panel
  with no bar to measure falls back to a centred, comfortable measure — the only
  place a width floor applies, because where the bar IS measured the match is
  exact.

  ADR 0011 records the decision: canvas metadata is shown in a panel anchored to
  the editor, above the senior button bar, at its width — today the reading and
  Map quality, tomorrow any surface that talks about the canvas rather than about
  a selection.

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
    land on `ValidationManager.checkup# @labre/affine-block-surface
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

- 1c37478: fix(edgeless): revoke an exception from the element, not from a grey dot
  PO acceptance on PF8: the way back out of a waived validation rule moves to the
  contextual toolbar of the element that carries it, and the grey badge that used
  to hold it disappears.
  **The grey badge is gone.** PF8 kept a muted dot on the canvas for every excused
  finding, so it could be clicked to revoke. That put a permanent marker on the
  board for something the user had explicitly decided to stop caring about — the
  affordance argued with the decision it was reporting. An excused finding now
  draws nothing at all: no bracket, no badge. The amber badge of a LIVE violation
  is untouched (PF7), and the engine still reports the excused finding on
  `violations# @labre/affine-block-surface
, so a host panel and an export still see it. Nothing is hidden;
the canvas just stops shouting about a settled question.
**"Revoke exception" lives on the element.** Selecting the thing is the path
everybody already knows, so the way back sits where everything else you can do
to an element sits. Which element gets the entry follows exactly the rule the
canvas mark already followed: the outermost enclosing canvas group — i.e. the
whole component built by the senior menu — or the element itself when it is not
grouped. Dissolve the group and the entry moves down to the element, with
nothing to invalidate. A framework background answers for the map-wide
arbitration written on it, so the same entry there takes back the map scope.
The entry appears only when the selected element actually answers for an
exception, and only when a registered rule can still be arbitrated on — so a
board with the framework switched off never shows it, while the exceptions
themselves stay in the document, untouched (PF8.6). Its label goes through the
`TranslationProvider`seam like the rest of the validation chrome.
Registered on`custom:affine:surface:\*`, the free wildcard slot merged into
  every canvas element's toolbar: one registration covers a group, a bare
  framework element and a background alike, and no framework's own toolbar config
  is touched.
  The detail bubble is unchanged: it still lists an excused finding with its state
  and a Revoke, for the case where it shares an anchor with a live one.
- 985a92f: fix(edgeless): the contextual toolbar is one line, and gives way instead of wrapping

  PO arbitration of 02/08/2026. The contextual toolbar of a selected element used
  to WRAP when it ran out of width — which, on the map the PO was looking at, put
  the "⋮" alone on a second line. A toolbar whose height depends on the selection
  is a toolbar that moves under the cursor. It now stays one line at every width,
  and spends its least important entries instead.

  **The row measures itself.** Every render is measured once, whole; when it
  overflows the cap the editor gives it, the widget re-renders it with the entries
  that have to give way. Widen the editor and they come back — the collapse is a
  view state and nothing about it is written to the document.

  **Two ways to give way, in that order.** An entry that declares an `icon` AND a
  `label` drops its label first and keeps it as its tooltip: a row of icons is
  still a row of things you can click. Only then does an entry leave the row for
  the "⋮" menu that is already there, where it keeps its FULL label and its
  behaviour. Every entry that can shrink shrinks before any entry moves.

  **Nothing in the widget names a framework.** Which entry gives way is decided
  entirely by the entries' own config: a new `priority?: number` on every toolbar
  action (higher stays on the row longer, `0` by default), plus whether the entry
  has an icon and a label to trade. Say nothing and you keep exactly the order the
  toolbar has today, minus the wrap — an entry rendered later gives way first. An
  entry that brings its own template (`content`) or its own sub-actions is opaque
  to the widget and keeps its place: the two qualification dropdowns keep their
  text, because a dropdown nested inside a dropdown is worse than a dropdown that
  stayed.

  For our own tranches: **Read this component** gains an eye icon, so a tight row
  turns it into an icon with a tooltip rather than pushing it into the menu; and
  **Revoke exception** — rare, wordy, with no icon to fall back to — declares
  `priority: -1` so it is the first entry to move, despite sorting early.

  The measuring and re-rendering live in the widget; the arithmetic that decides
  which entries are spent is a pure function in `@labre/affine-shared`, pinned by
  its own unit suite.

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

- 3ac3587: feat(edgeless): minimal validation engine and its first Wardley rule (PF5/PF7)
  Frameworks can now declare validation rules, and elements that break one get a
  discreet mark on the canvas. Wave 1 — the path end to end, one rule wide.
  - `@labre/affine-block-surface`: the engine. Rules are declarative, versioned
    DATA owned by their framework (`{ id, framework, family, severity, appliesTo,
messageKey, version }`); the engine only knows how to evaluate a FAMILY. One
    family ships: `element-in-background`. Results are violation OBJECTS
    (`{ ruleId, elementIds, severity, messageKey, suggestion? }`) on a reactive
    signal, `ValidationManager.violations# @labre/affine-block-surface
    — the seam a host conformance panel
    will read. The engine holds no prose: every human-readable string is an i18n
    key resolved by the host.
  - `@labre/affine-gfx-wardley`: the pilot rule. A `wardley:component` — or any
    role specialising it, so `market` and `ecosystem` come free — drawn outside
    the map is flagged `component-outside-map`. A `warning`, never blocking: the
    sketch always wins. A map-less canvas raises nothing. The map background now
    carries a role of its own, `wardley:map`, so both sides of a rule are roles
    and the engine never reads a shape type. Existing backgrounds are not
    backfilled: authored without the role, they frame nothing and raise nothing —
    an older document stays a sketch.
  - Affordance (PF7, minimal): elements in violation get amber corner brackets
    drawn by a canvas overlay. No element model is touched, nothing is written to
    the document, no undo entry is created. No conformance panel yet.
    Proportionality is enforced by construction: an element with no role is never
    evaluated, and a framework's rules only ever match its own roles.
    Gating follows the reversed flag contract (`docs/adr/0009`) with no new
    machinery: rules are registered by the FLAG-GATED `WardleyViewExtension`, so
    turning the `wardley` flag off removes them with the rest of the tooling.
    Already-drawn maps keep rendering, they simply stop being checked, and a board
    with every framework disabled does zero validation work.
    Like every flag in this library, that gate is an assembly-time gate, not a
    runtime switch: flipping a flag mid-session neither starts nor stops
    validation, and marks already on screen stay there until the editor is
    reassembled.
    Performance is asserted, not hoped for: a bench in the normal unit suite builds
    a 500-element reference map — backed by real `Y.Map`s, so field reads and
    `xywh` deserialization cost what they cost in production — and fails the build
    if a full evaluation exceeds one 60 fps frame (16 ms). It currently runs in
    ~0.15 ms, and ~0.0002 ms with the flag off.
- fad4c08: feat(edgeless): no rule is a wall — validation exceptions (PF8)

  A rule that cannot be waived is a wall, and a whiteboard with walls stops being
  a thinking tool. Every violation now carries its own way out, on the message
  that reports it.

  - **One click, on the bubble.** Each rule named in the violation bubble carries
    an "Ignore this validation rule" action. No detour through a settings panel,
    and no waiting: the gesture applies immediately.
  - **The exception is written on the element.** It lands in the document as
    `{ ruleId, author?, at }`, on the elements the rule actually indicts — so it
    says nothing about the next component, and nothing about the next rule. It
    rides along on a copy, a duplicate, a "turn into linked doc" and an export,
    and it dies with the element it belongs to.
  - **The finding changes state, it does not vanish.** An excused violation is
    still reported: it drops out of the flash and the bracket and its badge goes
    grey, but it keeps its line in the bubble, now reading "exception" and
    carrying a **Revoke** that puts it straight back. A board can never hide an
    arbitration it was told to make.
  - **One map, once you have said it twice.** After the same rule has been waived
    somewhere else on the board, the bubble offers "Ignore this rule on the whole
    map". Accepting writes the exception on the framework's own background
    element — and on THAT one only. A violation of `element-in-background` now
    records the background it is attributed to: since no background contained the
    element (that is what the violation says), it is the NEAREST one, by
    edge-to-edge gap, with exact ties broken by the smaller id so the answer never
    depends on the order the surface was walked in. A board carrying three maps
    therefore holds three independent arbitrations: waiving a rule on one says
    nothing about the map beside it, and deleting a map takes exactly its own
    arbitration with it. Map scope is just as visible and just as revocable as a
    local one.
  - **Arbitrations survive the framework cycle.** Switching a framework off stops
    evaluation and cleans nothing; switching it back on brings the violations
    back, minus the ones an exception covers. Nothing is ever garbage-collected
    behind the user's back.
  - **And it can always be undone.** `validationExceptions` is the first prop
    whose normal life includes being REMOVED — undoing a waiver deletes the key —
    and a Y.Map delete reports only `oldValues`. Both re-evaluation guards now
    read it, so an undo brings the live violation straight back instead of
    freezing the board on a stale verdict behind a dead Revoke button.

  Two new telemetry events, `ValidationExceptionGranted` and
  `ValidationExceptionRevoked`, carry the rule id, the framework, the scope and
  how many elements one gesture touched — never board content. A rule waived on
  every board is a rule that is wrong, and this is the only place that says so.

  **Persistence.** One new optional `@field()` on the base element model,
  `validationExceptions`. Declared on the BASE class, exactly like `role` before
  it, because an element re-created from props only reaches the Y.Map through
  declared accessors and a per-subclass declaration would be silently dropped on
  copy. Its default is `undefined` and is never written, so an element that never
  got an exception stays byte-identical to one created before the field existed:
  no block schema change, no version bump, no migration, and documents written
  before and after remain mutually loadable. Revoking the last exception removes
  the KEY rather than assigning `undefined`, which the `@field()` setter would
  have written into the Y.Map — so an element whose exceptions were all revoked
  is byte-identical again too, in the document and not merely through the getter.
  `GfxPrimitiveElementModel.clearField` is the counterpart `@field()` was missing.
  It removes DECLARED, non-structural fields only: an undeclared key (an
  annotation preserved verbatim for a newer client) and the fields nothing can
  cope without (`index`, `seed`, `xywh`) are refused with a warning, so a new
  delete path into the document cannot undo what the unknown-props deny-list
  protects.

  A conformant board pays nothing: exceptions are only looked up for a rule that
  actually raised something. On the 500-element reference map, where half the
  population is in violation, the 16 ms budget still has roughly seventy times the
  headroom it needs.

- 7b940cf: fix(edgeless): the validation profile belongs in the map's toolbar

  PF9 shipped the profile selector as a chip pinned to the instance's top-left
  corner. Recette found it twice wrong: the contextual toolbar of the selected
  map lands on those same pixels and buried it outright, and at a low zoom what
  did show through was unreadable.

  The toolbar that hid it is the toolbar that should have carried it. Selecting a
  Wardley map now gives its contextual toolbar a **Validation** dropdown naming
  the level of requirement in force, offering the others with a tick on the
  current one. A per-instance setting sits with the instance's other per-instance
  settings — the axes, the labels, the legend — instead of floating over the
  canvas competing with them for the same corner.

  The chip is gone, and with it the ~355 lines it took to keep a canvas
  affordance alive: its own click-away, Escape, pan/zoom tracking, viewport
  clamping and late element resolution are all things a toolbar entry gets for
  free.

  Nothing about the DATA changed. `validationProfile` is still one optional flat
  string on the background element, the default still writes nothing and choosing
  it back still clears the key, exceptions are still untouched by a change of
  level, and `ValidationManager.setProfile` is still the only write path — the
  toolbar adds a `captureSync` in front of it so one click is one undo.

  ### Where it lives

  `validationToolbarConfig` is generic and lives with the engine, in
  `@labre/affine-block-surface`. It names no framework, no element type and no
  role: the entry stands up when the selected element is one the engine
  recognises as a framework's root instance (through the registered rules'
  `backgroundRole`) whose framework declares more than one profile. A second
  framework shipping profiles gets the same dropdown by registering the very same
  object on its own flavour.

  It is registered by Wardley's **flag-gated** view extension, beside its rules
  and its profiles — deciding how hard to check a document is tooling, so the
  flag removes the module entirely rather than merely emptying it. That is a
  deliberate split from `wardleyToolbarExtension`, which stays always-on because
  a stored map must keep its axes and its labels whatever the flag says
  (`docs/adr/0009`). The two modules coexist on one element through the `custom:`
  flavour slot, the pattern `gfx/mindmap` already uses on
  `custom:affine:surface:shape`.

  The dropdown renders sections and ships with one, so PF7.11's map quality is
  one more block in the same menu rather than another button competing for
  toolbar width.

  ### Also

  `wardley-validation-profiles.spec.ts` now drives the real element toolbar. That
  needed telling the editor it is in edgeless mode: `setupEditor('edgeless')`
  mounts the edgeless root but the default `DocModeService.getEditorMode()`
  answers `null`, which the toolbar reads as page mode and skips every surface
  selection. The override is local to that suite.

- 7b66d8d: feat(edgeless): one framework, several levels of requirement (PF9)
  A rule used to bite at exactly one strength, decided once by whoever wrote it,
  for everybody. That is the wrong shape for a tool where a rough sketch and a
  deliverable diagram live on the same canvas: the level of requirement is not a
  property of the rule, it is a property of the WORK.
  A framework now ships **profiles** — declarative, versioned data, like its
  rules, its roles and its background. A profile says, for each rule of its
  framework, how hard that rule bites, or that it does not apply at all.
  Wardley ships two:
  - **Sketch** (the default): the pilot rule drops to `audit`. The finding is
    still reported to `violations# @labre/affine-block-surface
    , so a host panel and a conformance report see
    it — the canvas simply says nothing. Nobody thinking out loud gets
    interrupted.
  - **Strict**: the pilot rule bites at `warning`, and the canvas affordance
    (PF7) appears as before. Still never blocking — strict is a level of
    attention, not a wall.
    **The choice is per ROOT INSTANCE, not per document** (PF9.1). Two maps on one
    board hold two independent levels: a sketch can sit next to a deliverable
    without either dictating the other's requirements. The engine reads the profile
    off the background a finding was measured against — an id it already recorded.
  ### What is persisted
  One optional flat string, `validationProfile`, declared as a `@field()` on the
  element base class — the same place and the same reasoning as `role` (PF1) and
  `validationExceptions` (PF8): an element re-created from props only reaches the
  Y.Map through declared accessors, so anything declared per subclass is silently
  dropped on copy. Duplicating a strict map gives a strict map; an export carries
  it; a peer sees it; undo undoes it.
  The default writes NOTHING. `undefined` resolves to the framework's default
  profile, and choosing the default back again removes the key rather than
  writing it — so a map that never left the default is byte-identical to one
  created before profiles existed, and one that tried strict and came back leaves
  no trace. Optional field, no schema version bump, no migration, no backfill.
  ### Cost
  A rule that is `'off'` under every profile in play is not evaluated at all: the
  engine skips it before touching a single element. It is a skipped rule, not a
  filter over findings. The default counts as in play unconditionally, so the
  short-circuit only fires when the answer cannot change — a missed skip costs a
  linear pass, a wrong skip costs a rule that silently stops firing.
  Bench, 500-element reference map: 0.141 ms unchanged, 0.275 ms with profiles in
  force, 0.032 ms with every rule off, against a 16 ms frame budget. Flag off
  still costs one empty-map check.
  ### Where the choice lives
  Select a map and a small chip above its top-left corner names the level in
  force and offers the others. It is **not** on the violation bubble, on purpose:
  on the permissive default nothing is ever drawn, so a bubble-only selector
  would make the strict profile reachable only through a violation the permissive
  profile has already silenced — a one-way door. Selection is the one gesture
  that is always available. Profile names are i18n keys resolved through the host
  catalogue, with the framework's own wording as the fallback.
  The chip is derived from the REGISTERED rules (`backgroundRole`), so it is
  gated by the framework flag for free: flag off, no rule, no profile offered,
  and the id already written on a map simply goes unread until the flag comes
  back.
  ### What it does not touch
  Exceptions (PF8). Raising the level does not resurrect a decision the user made,
  and lowering it does not quietly delete one — the two are orthogonal, and the
  engine reads exceptions last, independently of the profile.
  A new typed telemetry event, `ValidationProfileChanged`, carries the framework
  and the profile ids and nothing else. A choice that changes nothing is not a
  decision and is not reported.
  ### Behaviour change
  A Wardley map now opens on the permissive default, so an off-map component no
  longer draws a bracket or a badge until its map is put on **Strict**. That is
  the point — the sketch wins — but it does mean the PF7/PF8 canvas affordance is
  opt-in per map from here on.
- 30061cb: feat(edgeless): tell me what is wrong, and keep telling me (PF7)
  The validation affordance stopped at "something here is off": a mute amber
  bracket, drawn for as long as the violation held. It answered neither of the
  two questions a user actually has — _what_ is wrong, and _is it still wrong an
  hour later_. This slice answers both, on two clocks.
  - **The moment it happens.** A violation that APPEARS flashes its bracket at
    full strength for three seconds, then fades out over half a second. That is
    when the user still remembers the gesture that caused it and can undo it in
    one move.
  - **For as long as it holds.** Once — and only once — the bracket has finished
    fading, a small amber badge takes its place, just outside the anchor's
    top-right corner. The two are never on screen together. A board left
    overnight still shows what it breaks, without a canvas full of brackets.
  - **On demand.** Clicking either marker opens a bubble naming the rules broken
    on that anchor: label, severity, and remediation hint when the rule carries
    one. It closes on a click elsewhere, on Escape, or on pan/zoom, and flips
    above or to the left of its marker rather than run off the viewport. Clicking
    a marker does not select the shape underneath — the pointer pair is stopped
    there, so neither selection nor a drag starts.
    Both markers are sized in MODEL units and scale with the board, like the
    elements they annotate. Screen-constant annotations are right for a transient
    snap guide and wrong here: on a hundred-component map, zoomed out, they grow
    relative to the content until the marks are all you can see. Zoomed out far
    enough these shrink with everything else — deliberately. The exception is the
    click target, which keeps a 44 px screen floor as invisible padding around the
    model-sized visual, so a badge three pixels wide is still reachable by thumb
    (the pattern `edgeless-auto-complete` already uses on this canvas). The bubble
    stays in screen pixels: prose rendered at quarter size is not smaller prose,
    it is unreadable prose.
    The bubble consumes normalised violation OBJECTS and nothing else: no rule
    logic reached the UI, and no rule wording is hard-coded in the library. Rule
    labels are i18n keys resolved through a new, optional host seam
    (`TranslationExtension` / `TranslationProvider` in `@labre/affine-shared`,
    mirroring `TelemetryExtension`). With no catalogue registered the raw key is
    shown rather than a sentence the library invented for somebody else's rule;
    only the bubble's own chrome — the severity chip — carries an English default.
    Anchoring is unchanged and shared with the bracket: one badge per outermost
    enclosing group. The bubble lists one line per RULE broken on that anchor, not
    one per element — two components of a group both drawn off the map are two
    violations on the signal, but repeating the same sentence twice would say
    nothing extra.
    `audit` violations are now excluded from the canvas affordance, as their
    severity has always said they should be: collected for reporting, invisible to
    the drawing user. They still reach `violations# @labre/affine-block-surface
untouched, for a host panel.
Escape is taken only within the editor host, never on `document`: with a bubble
    open it dismisses the bubble instead of clearing the canvas selection, and a
    library has no business making that call for the whole page.
    Nothing here touches evaluation, the violation object or the 16 ms budget, and
    nothing is written to the document — the "first seen" timestamps that drive the
    flash are session state, rebuilt on every reload, so a document records which
    rules it breaks and never when you happened to look. No clock runs without a
    violation: the fade's animation frames stop by themselves once every mark has
    settled, the single timer that wakes the badge for the handover is armed only
    while a bracket is still up, and the element-tracking subscription only exists
    while something is flagged.
- 061729e: Three generic rule families, and the first three real Wardley rules

  The validation engine gained the three families a business framework actually
  needs, and Wardley gained the first rules that were asked for rather than
  invented to prove the machinery.

  **The declaration now answers questions.** A framework background (PF2) already
  described its axes and zones so they could be painted; it now exposes them as
  evaluation FACTS — which way each axis runs, where one zone ends and the next
  begins, in model coordinates for a given instance. Pure data in, pure data out:
  a rule reads the frame of reference without the engine owning a registry of
  backgrounds or importing a renderer.

  **Three families, all declarative.** `orientation-against-axis` confronts a
  directional element with the declared sense of an axis, `attachment` requires an
  element to be posed on a carrier and optionally at a zone transition, and
  `no-overlap` is the first family that is not element-local: it evaluates PAIRS
  of declared roles, with each side's geometry following its role's own kind, so
  an edge is measured along its path and not by the bounding box of its diagonal.
  `no-overlap` supports an incremental pass — a drag re-tests only the couples
  involving something that moved, reaches the same verdict as a full one, and is
  bounded by it: past the crossover, or when a frame is touched at all, it simply
  sweeps.

  **Three Wardley rules.** A change arrow may not point against evolution; an
  inertia bar belongs on a dependency, at a phase transition; nodes and labels
  must not sit on top of each other. Each ships an i18n key and the framework's
  own wording as a fallback, so a host with no catalogue reads a sentence instead
  of a dotted key — and the library still never invents the wording of somebody
  else's rule.

  **New role values, no schema change.** Reversing a PF1 decision: the change
  arrow, the inertia bar and the artefact labels are no longer neutral, because an
  element with no role is never evaluated and these three rules are about exactly
  those artefacts. Toolbox and templates write the same values. Documents drawn
  before today carry none of them, so they raise nothing — no backfill, no
  retro-violation. The market glyph's inner dots went the other way and became
  neutral, for the same reason its triangle wiring always was: they are part of a
  composite, not artefacts anybody placed.

  **The pilot rule is gone.** `wardley.component-outside-map` existed to prove the
  engine end to end; parking a node in the margin while you think is normal work.
  Every test that exercised the affordance, the exceptions, the profiles and the
  budget through it now exercises them through the real rules, in the same commit.

  The bench grew a reference map carrying arrows, bars, labels and links, and a
  worst-case drag. Both stay far inside one frame. It also records the budget's
  horizon so the next slice inherits a figure and not a conclusion: growth is
  quadratic in the pair-wise participants, the 16 ms wall sits at roughly **2000
  elements** today, and a test fails the day a SECOND pair-wise rule lands — which
  is the honest trigger for a spatial index, along with the first board past that
  wall. (An earlier draft of this slice quoted 1300 and 2500 in two places: both
  were measured with the map generator inside the timer, which dilutes a quadratic
  engine with a linear build. 2000 is the corrected, single figure.)

### Patch Changes

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

- 89b90e9: The surface canvas fits its block again inside a scaled host

  An embedded edgeless doc is drawn by a host that scales the whole editor, and
  the viewport reports its size through `getBoundingClientRect()` — a size that
  already carries that outer scale. The canvas was sized from those numbers and
  then scaled a second time by the container, so at any host scale other than 1
  it spilled past the block it belongs to: everything painted on the canvas —
  the Wardley, EDGY, DDD and Cynefin frameworks included — sat outside the
  block's own frame.

  The canvas now carries the inverse of that scale, so all drawing stays in the
  surface's own coordinate space. An unscaled editor is unaffected.

- f7f23b2: A validation badge stays on the element it accuses inside a scaled editor

  The PF7 marks — the amber badge, the band that makes a bracket clickable, and
  the detail bubble they open — are drawn over the canvas, but were placed in
  real screen pixels while the container they live in is the one an embedding
  host scales. In a synced edgeless doc opened inside another document the
  container applied its scale a second time and the badge accused a blank patch
  of paper several elements away, with the bubble flipping at the wrong edge.

  They now state their placement the way the element under them does. In a
  standalone editor, where the host applies no scale, nothing moves.

- 630633b: fix(edgeless): keep both connector endpoints valid on self-loops and partial clones

  Two connector robustness fixes from the ADR 0010 recon (PR #86):

  - `reassociateConnectorsCommand` re-points **both** endpoints of a self-loop
    connector (source and target on the same element). Previously an early
    `continue` left `target` bound to the old element id after a block
    conversion.
  - Turning a partial selection into a linked doc no longer breaks a connector
    whose other end stays behind. That endpoint now becomes an **absolute
    position** — the same conversion the clipboard already applies through
    `serializeConnector` — instead of keeping an element id that means nothing
    in the new document. The connector arrives visible, selectable and at the
    place it occupied in the source document.

- 0ddfd47: fix(edgeless): a readonly board refuses element moves, resizes and tool arming

  Surface-element writes go through `store.transact`. `SurfaceBlockModel` does
  throw on readonly, but that is an exception raised at the bottom of a gesture:
  several paths never reach it, and the ones that do surface an uncaught error on
  `window` instead of a clean refusal.

  What actually changes on a readonly board:

  - **The mouse no longer moves anything.** `DefaultTool.dragStart` went straight
    to `handleElementMove`, which writes `xywh` through a `@field()` accessor —
    raw `store.transact`, no crud, no exception. A drag on a readonly board wrote
    into the Yjs document exactly as on an editable one. The refusal sits in
    `InteractivityManager.handleElementMove` / `handleElementResize` /
    `handleElementRotate` / `requestElementClone` — the layer that actually
    writes, so no gesture entry point can go round it. Panning, rubber-band
    selection and plain selection stay available; moving content, alt-drag
    cloning and resizing do not.
  - **`edgeless-selected-rect` drops its 8 resize handles.** The gate existed but
    only ran on selection change, so a board switched to readonly while something
    was selected kept its handles — and dragging one wrote.
  - **Creation tools refuse to arm** (`p`, `Shift-p`, `c`, `t`, `n`, `f`, `e`,
    `s`). They call `surface.addElement` / `store.addBlock` directly and raised
    uncaught `BlockSuiteError`s on ordinary keystrokes. The whitelist lives on
    `ToolController.setTool`, the single bottleneck every entry point goes
    through — keyboard managers, the toolbar and its mixins, senior buttons —
    because `s` is bound by `shape-draggable.ts` straight onto the mixin and
    never reaches the edgeless keyboard manager. Selection, pan and the
    presentation navigator still switch.
  - **`createGroupFromSelectedCommand` / `ungroupCommand`** refuse **before**
    their `removeChild` calls, which used to run even though the follow-up
    `addElement` would refuse — orphaning the selection out of its parent group,
    or dissolving the group outright on `Shift+Mod+G`. This is the one
    destructive bug of the set.
  - **Mindmap keyboard writes**: node text overwrite on letter-typing (both the
    wrapped hotkeys and the generic keyDown listener), `addNode` on Enter/Tab,
    arrow-key element moves (arrow **navigation** stays), Backspace/Delete.
  - **`ValidationManager.setException` / `setProfile` / `revokeExceptionsOn`**
    return empty/`false`; every caller gates its `track` on those returns, so a
    write that never happened is never reported.
  - **`applyLastStyle`**: no targets, so the command's `when` fails and the
    keystroke falls through to the `redo-windows` alias that shares Mod+Y on
    Windows.

  `EdgelessCRUDExtension` (`addElement` / `updateElement` / `deleteElements` /
  `removeElement`) and `EdgelessRootService.removeElement` / `reorderElement` now
  refuse with a `console.error` instead of letting the model throw — the same
  contract as `store.updateBlock` / `deleteBlock` / `moveBlocks`. That is a change
  of failure MODE, not a new refusal: the surface model already said no.

  `framework/store` and `sync` are untouched.

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

- 184c412: fix(edgeless): the bubble reads, the link is marked where it is, and the panel says who is speaking

  Three things the PO sent back from the 02/08 recette. None of them changes what
  is evaluated, when, or what is written to the document — all three are about a
  surface that was telling the truth in a way nobody could read.

  **The detail bubble could not be read.** It opened UNDERNEATH the element
  toolbar, and the wheel over it panned the board instead of scrolling it — which
  closed it, on `viewportUpdated`, at exactly the length where reading mattered.
  Both halves had one cause and one fix each:

  - while a bubble is open, the widget HOST is raised above the popover level (a
    z-index of its own makes the host a stacking context, so the bubble can never
    climb out of it on its own) and drops straight back to the badge's level when
    it closes;
  - while a bubble is open, the CANVAS does not take the wheel. One capture-phase
    listener on the editor host stops the event before any bubble-phase handler
    sees it — the edgeless wheel handler included, which used to `preventDefault`
    the scroll on its way past. Nothing is cancelled, so the browser still
    scrolls the bubble; nothing is registered on `document`, so the page outside
    the editor keeps its wheel; nothing happens at all while no bubble is open.
    The board is frozen wherever the pointer is, and one click anywhere gives it
    back — the PO's call, and the only one that survives a bubble the user is
    halfway through.

  **A link was badged on a corner of its bounding box.** For a diagonal
  connector that corner is a point on empty paper, a long way from the trait
  being accused. Anchors now carry a `kind`: a `node` keeps its top-right corner,
  an `edge` is marked in the MIDDLE of the link — the midpoint of the drawn path
  by arc length (so an elbowed connector is marked halfway along what the eye
  follows, not at its bend), falling back to the intersection of the bounding
  rectangle's diagonals for an edge the layout has not routed. An anchor is an
  edge because its ROLE says so (`kind: 'edge'`) or because its GEOMETRY does (it
  exposes a path), so a generalist connector carrying no role is marked correctly
  too. The point is computed once, in `resolveViolationAnchors`, where it can be
  asserted as a coordinate.

  **The Map quality panel appeared to contradict itself**: "Nothing to report"
  over a map wearing amber badges, with no title and no legend. Three different
  things live on that surface and the panel never said which was speaking. It
  does now, without moving a single boundary between them:

  - the checklist is introduced as "To be checked by you" — the tool does not
    judge a nudge, and ticking is still assuming;
  - the check-up names the rule FAMILIES it walked ("Check-up (tones,
    nomenclature):"), so its verdict is about something rather than about
    everything;
  - a read-only context line counts the real-time findings on THIS map, narrowed
    on `backgroundId` exactly as a check-up is, so the badges on the canvas are
    accounted for in the panel instead of being silently denied by it.

  Every one of those strings is an i18n key with a library fallback, like the
  rest of the panel; rule wording still comes from the framework and the host
  catalogue still wins over both. The panel's rows now share one fixed gutter for
  the checkboxes, so the lines that have no box no longer hang a checkbox-width
  to the left of the ones that do.

- c2735aa: W2 only speaks while the dashed columns are on the map

  An inertia bar is judged against the phase divider it straddles. Hide the
  dividers — the "Columns (dividers)" toggle of the Wardley toolbar — and the
  verdict was still being handed down against a line that is no longer on the
  canvas: a warning whose only suggestion ("slide the bar until it sits astride
  the dashed line") pointed at nothing the user could see. W2 is now ACTIVE only
  while the columns are displayed.

  **Scoped, not weakened.** Nothing about the rule's geometry changed. Switch the
  columns back on and every finding comes back, on the same bars, in the same
  places, with the same wording — and the four other visibility toggles of a
  Wardley map (axes, phase labels, corner labels, visibility labels) leave W2
  exactly where it was. The other three rules are untouched with the columns
  hidden: a toggle that switched the whole check-up off would be a toggle nobody
  would dare use.

  **The condition is data, and the engine still names no framework.** The dividers
  are drawn from `axes[].ticks.visibleProp`, and that is the field the rule now
  reads: the transition bands are resolved against the INSTANCE being measured, so
  a frame whose graduations are hidden yields no band and asks nothing of the
  symbols on it — the same silence a frame that declares no transition at all
  already produced. A framework that offers no such toggle is bit-for-bit
  unaffected, and the reading pass, which describes what a map MEANS rather than
  what it draws, still sees every declared frontier.

  **The toggle re-judges live.** The props worth re-evaluating for are no longer a
  constant: the manager derives them from the declarations it was handed, so a
  framework's own visibility prop wakes the engine exactly like a move does.
  Hiding the columns clears the marks on the spot instead of leaving them up until
  some unrelated drag happened to wake it.

  No document changes: `showColumnDividers` already existed and already defaulted
  to shown, so every map ever drawn is judged today exactly as it was yesterday.

- 346b5d9: fix(edgeless): W2 measures the punctuated equilibrium zone, and says which half failed

  Recette PO of 01/08/2026: two inertia bars dropped squarely on the "Product"
  and "Commodity" dividers, both flagged, both told they were "not on a
  dependency at a phase transition". Reproduced and measured: the bars were
  **0.00 units** off the transition — the boundary half was satisfied to the
  unit — and 410 and 846 units from the nearest dependency, against a 24-unit
  tolerance. The verdict was right; the sentence hid the only thing the user
  could act on.

  - **The zone of punctuated equilibrium is declared data.** A framework
    background now carries `transitionBandWidth`, a ratio of the plot, and
    `backgroundTransitionBands()` exposes each transition as a named band
    (`custom-built|product`) in model coordinates. Wardley declares `0.1` — ±5%
    of the plot either side of each divider, ±76 model units on the 1600-wide
    reference map against the 40 absolute units it replaces. The old absolute
    slack was 5.5% of the plot on an 800-wide map and 1.3% on a 3200-wide one:
    the same gesture judged four times as harshly for having resized the map.
    Being a ratio, the band now survives resizing.
  - **W2 speaks twice.** `com.labre.wardley.validation.inertia-off-carrier` ("not
    drawn on a dependency") and
    `com.labre.wardley.validation.inertia-off-equilibrium-zone` ("sits mid-phase,
    outside the zone of punctuated equilibrium"), each with its own suggestion.
    Still one rule, one badge on one bar; the finding names the half that failed,
    and the carrier wins when both do — a symbol attached to nothing has to find
    something to be about before where it sits can mean anything.
    `com.labre.wardley.validation.inertia-off-transition` and its suggestion key
    are gone; a host shipping a catalogue replaces them with the two above.
  - `AttachmentDef.boundaryTolerance` is replaced by the frame's declared band.
    A rule asking for a boundary against a background that declares none warns
    once and drops the requirement rather than indicting every subject.
  - `backgroundTransitionBands()` guards the declared width: `<= 0` warns and
    drops the requirement (no silently inverted band), and a width wider than the
    gap between two transitions warns and is narrowed to that gap (no silently
    overlapping bands).
  - **`Violation.boundaryId`** names the frontier a finding is about
    (`custom-built|product`) — the nearest band the subject missed, so "outside
    the equilibrium zone" also says which zone. Absent when the carrier is what
    failed.

- 77b0100: fix(edgeless): an inertia bar is judged on the divider it straddles, and Map quality is the checklist

  Second pass of the PO recette of 02/08/2026, on two points of substance.

  ## W2 changes meaning — read this before updating a catalogue

  The rule was built on a misreading, and the PO settled it with two captures and
  one sentence:

  > "The horizontal position of an inertia bar is only valid if it is astride two
  > evolution phases, that is, superimposed on a dashed vertical axis."

  - **Old rule** — the bar had to sit ON A DEPENDENCY _and_ at a phase transition,
    and the finding named the carrier half first ("This inertia bar is not drawn on
    a dependency."). A bar alone on a divider was flagged.
  - **New rule** — the bar has to STRADDLE a phase transition, and nothing else. A
    bar alone on a divider is valid (the PO's second capture); a bar between two
    dividers is not (the third), with or without a dependency under it.

  What that means in practice:

  - The carrier condition is gone, with the second message that existed only to
    tell the two halves apart. Both
    `com.labre.wardley.validation.inertia-off-carrier` and
    `com.labre.wardley.validation.inertia-off-equilibrium-zone` (and their
    suggestion keys) are retired; the rule now speaks one sentence, under
    `com.labre.wardley.validation.inertia-off-transition` — "This inertia bar sits
    inside a phase, not astride a phase transition." A host shipping a catalogue
    replaces the two keys with this one. `Violation.boundaryId` still names the
    frontier the bar missed.
  - **"Astride", as geometry:** the bar's own EXTENT along the evolution axis must
    intersect the transition BAND — the divider widened by the frame's declared
    `transitionBandWidth`. One interval overlap, saying both halves of
    "superimposed on the axis": a bar wide enough to cover the divider is accepted
    whatever the band says, and a bar too thin to cover anything (the toolbox draws
    it eight units wide) is accepted inside the band the map itself declares. It is
    measured on the ink, never on the centre, and the band stays a ratio of the
    plot so a resized map gets the same verdict.
  - `AttachmentDef.carrierRole` and `tolerance` are now OPTIONAL: the family still
    supports "posed on a carrier" for a rule that wants it, W2 simply no longer
    declares one. `AttachmentDef.offBoundary` is only read by a rule that declares
    both.
  - The Kodak template is unaffected: its bar is computed at the crossing of the
    `capture → storage` dependency with the Commodity divider, so it is centred on
    that divider and stays green.

  ## Map quality is the checklist, and only the checklist

  The panel carried three different kinds of statement — the nudges, a "Run
  check-up" button with its remarks and the families it walked, and a count of the
  real-time warnings on the map. All three were true, and reading them together
  was work. The PO's decision is to keep the one the panel is for:

  - the **check-up section** and the **real-time warning count** are gone from the
    panel and from the contextual toolbar's entry;
  - Wardley no longer declares **Q5** (`wardley.tone-off-convention`) or **Q6**
    (`wardley.phase-nomenclature`); `WARDLEY_CHECKUP_RULES` is gone and
    `gfx/wardley`'s `quality.ts` is now `nudges.ts`, exporting `WARDLEY_NUDGES`;
  - `ValidationManager.hasMapQuality()` now answers on the checklist alone, so a
    framework declaring only on-demand rules is not offered an empty panel;
  - the `MapQualityCheckupRun` telemetry event is removed, having lost its only
    emitter.

  **Nothing was removed from the engine.** The on-demand moment (PF5.14) —
  `moment: 'on-demand'`, `runCheckup`, `checkupRulesFor`, `evaluateCheckup` — and
  the `tone-convention` and `majority-fact` families are still there and still
  tested, including the zero-cost guarantee at the bench. The next framework that
  wants a check-up declares one; Wardley stopped exposing one.

- 8d33c60: W3 measures the words, not the box they were written in

  The overlap rule was reporting things nobody can see. Two captures from the
  acceptance, same cause: a Wardley label is created 120 to 200 units wide
  whatever it says, so a name of three letters leaves most of its box blank —
  and the rule was measuring the box. A dependency crossing that empty margin
  raised label/link; two labels whose words were thirty units apart raised
  label/label.

  **A role can now say it is TEXT** (`RoleKind` gains a third value next to
  `node` and `edge`, hence the `minor` on `@labre/std`). `no-overlap` measures a
  `text` role by the ink its words occupy inside its box, placed where the
  alignment puts it — and hands a ROTATED text its whole box back, because
  narrowing one is how a miss gets built rather than a warning too many.

  The engine still measures nothing on a canvas: a `measureText` per label per
  pass would cost, and would make the same map validate differently depending on
  which fonts a host happens to have loaded. The width is declared, per character
  and by CLASS — thin `i l I j` and punctuation, narrow `f t r`, wide `m w M W`,
  capitals, full-width scripts, and the rest. One mean advance was the first
  answer and it read `utility` half as wide again as it is drawn, which put a
  ghost 20 units past the last letter and a false positive on every link crossing
  it. Against the real renderer at Inter 18, over a 28-name bench, the table now
  lands between 11 % narrow and dead on — **never wide, on any of them**. The
  test prints every line and fails outside ±15 %.

  **A rule can now say how deep a collision has to be.** `minPenetration`, in
  model units: how far the two geometries reach INTO each other, which for a
  link crossing a name is how far under the edge of it the line actually goes.
  Wardley's W3 declares 4 — a link grazing the top of a name and two names
  sharing a hair of ink are silent, a link through the middle of a name (13
  units deep) and a name written across a node are not.

  Nothing else moved: the same overlaps are reported, on the same pairs, with
  the same severity and the same exceptions. Documents are untouched — no
  schema, no stored value, no migration.

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
- Updated dependencies [751ac44]
- Updated dependencies [54488cd]
- Updated dependencies [9453013]
- Updated dependencies [b746d6b]
- Updated dependencies [5ac0c68]
- Updated dependencies [1fa46c1]
- Updated dependencies [0473dcb]
- Updated dependencies [5b6e9bb]
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
- Updated dependencies [0ddfd47]
- Updated dependencies [3639562]
- Updated dependencies [5d16745]
- Updated dependencies [48e90f4]
- Updated dependencies [5edd916]
- Updated dependencies [5a16359]
- Updated dependencies [025d6f5]
- Updated dependencies [b1ed4ef]
- Updated dependencies [985a92f]
- Updated dependencies [b889326]
- Updated dependencies [1efc6d5]
- Updated dependencies [4162e4a]
- Updated dependencies [fad4c08]
- Updated dependencies [7b66d8d]
- Updated dependencies [4bb44ef]
- Updated dependencies [30061cb]
- Updated dependencies [77b0100]
- Updated dependencies [8d33c60]
- Updated dependencies [7a3458a]
  - @labre/std@0.32.0
  - @labre/affine-shared@0.32.0
  - @labre/store@0.32.0
  - @labre/affine-components@0.32.0
  - @labre/affine-model@0.32.0
  - @labre/global@0.32.0
  - @labre/affine-rich-text@0.32.0
  - @labre/affine-ext-loader@0.32.0

## 0.31.0

### Patch Changes

- Updated dependencies [6a663b6]
  - @labre/store@0.31.0
  - @labre/affine-components@0.31.0
  - @labre/affine-ext-loader@0.31.0
  - @labre/affine-model@0.31.0
  - @labre/affine-rich-text@0.31.0
  - @labre/affine-shared@0.31.0
  - @labre/std@0.31.0
  - @labre/global@0.31.0

## 0.30.2

### Patch Changes

- @labre/affine-components@0.30.2
- @labre/affine-ext-loader@0.30.2
- @labre/affine-model@0.30.2
- @labre/affine-rich-text@0.30.2
- @labre/affine-shared@0.30.2
- @labre/global@0.30.2
- @labre/std@0.30.2
- @labre/store@0.30.2

## 0.30.1

### Patch Changes

- @labre/affine-components@0.30.1
- @labre/affine-ext-loader@0.30.1
- @labre/affine-model@0.30.1
- @labre/affine-rich-text@0.30.1
- @labre/affine-shared@0.30.1
- @labre/global@0.30.1
- @labre/std@0.30.1
- @labre/store@0.30.1

## 0.30.0

### Patch Changes

- Updated dependencies [9d0fe0c]
- Updated dependencies [ecba791]
- Updated dependencies [8de86f4]
  - @labre/std@0.30.0
  - @labre/affine-model@0.30.0
  - @labre/affine-components@0.30.0
  - @labre/affine-rich-text@0.30.0
  - @labre/affine-shared@0.30.0
  - @labre/affine-ext-loader@0.30.0
  - @labre/global@0.30.0
  - @labre/store@0.30.0

## 0.29.1

### Patch Changes

- @labre/affine-components@0.29.1
- @labre/affine-ext-loader@0.29.1
- @labre/affine-model@0.29.1
- @labre/affine-rich-text@0.29.1
- @labre/affine-shared@0.29.1
- @labre/global@0.29.1
- @labre/std@0.29.1
- @labre/store@0.29.1

## 0.29.0

### Patch Changes

- Updated dependencies [7375b9a]
- Updated dependencies [9330750]
  - @labre/affine-shared@0.29.0
  - @labre/std@0.29.0
  - @labre/affine-components@0.29.0
  - @labre/affine-rich-text@0.29.0
  - @labre/affine-model@0.29.0
  - @labre/affine-ext-loader@0.29.0
  - @labre/global@0.29.0
  - @labre/store@0.29.0

## 0.28.0

### Patch Changes

- Updated dependencies [65cc055]
  - @labre/std@0.28.0
  - @labre/affine-components@0.28.0
  - @labre/affine-model@0.28.0
  - @labre/affine-rich-text@0.28.0
  - @labre/affine-shared@0.28.0
  - @labre/affine-ext-loader@0.28.0
  - @labre/global@0.28.0
  - @labre/store@0.28.0

## 0.27.0

### Patch Changes

- Updated dependencies [91f6397]
  - @labre/std@0.27.0
  - @labre/affine-components@0.27.0
  - @labre/affine-model@0.27.0
  - @labre/affine-rich-text@0.27.0
  - @labre/affine-shared@0.27.0
  - @labre/affine-ext-loader@0.27.0
  - @labre/global@0.27.0
  - @labre/store@0.27.0

## 0.26.0

### Patch Changes

- Updated dependencies [8960a6c]
- Updated dependencies [6795191]
  - @labre/affine-model@0.26.0
  - @labre/affine-components@0.26.0
  - @labre/affine-rich-text@0.26.0
  - @labre/affine-shared@0.26.0
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
  - @labre/affine-rich-text@0.25.0
  - @labre/affine-shared@0.25.0
  - @labre/affine-ext-loader@0.25.0
  - @labre/global@0.25.0
  - @labre/std@0.25.0
  - @labre/store@0.25.0

## 0.24.0

### Patch Changes

- @labre/affine-components@0.24.0
- @labre/affine-ext-loader@0.24.0
- @labre/affine-model@0.24.0
- @labre/affine-rich-text@0.24.0
- @labre/affine-shared@0.24.0
- @labre/global@0.24.0
- @labre/std@0.24.0
- @labre/store@0.24.0

## 0.23.3

### Patch Changes

- Updated dependencies
  - @labre/affine-shared@0.23.3
  - @labre/affine-components@0.23.3
  - @labre/affine-rich-text@0.23.3
  - @labre/affine-ext-loader@0.23.3
  - @labre/affine-model@0.23.3
  - @labre/global@0.23.3
  - @labre/std@0.23.3
  - @labre/store@0.23.3

## 0.23.2

### Patch Changes

- Updated dependencies [ee682da]
  - @labre/affine-shared@0.23.2
  - @labre/affine-components@0.23.2
  - @labre/affine-rich-text@0.23.2
  - @labre/affine-ext-loader@0.23.2
  - @labre/affine-model@0.23.2
  - @labre/global@0.23.2
  - @labre/std@0.23.2
  - @labre/store@0.23.2

## 0.23.1

### Patch Changes

- Updated dependencies [1beb60e]
  - @labre/affine-shared@0.23.1
  - @labre/affine-components@0.23.1
  - @labre/affine-rich-text@0.23.1
  - @labre/affine-ext-loader@0.23.1
  - @labre/affine-model@0.23.1
  - @labre/global@0.23.1
  - @labre/std@0.23.1
  - @labre/store@0.23.1

## 0.23.0

### Patch Changes

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

- Updated dependencies [9014c87]
- Updated dependencies [c775151]
  - @labre/affine-model@0.23.0
  - @labre/affine-shared@0.23.0
  - @labre/affine-components@0.23.0
  - @labre/affine-rich-text@0.23.0
  - @labre/affine-ext-loader@0.23.0
  - @labre/global@0.23.0
  - @labre/std@0.23.0
  - @labre/store@0.23.0
