# @labre/affine-gfx-c4

## 0.34.2

### Patch Changes

- @labre/affine-block-surface@0.34.2
- @labre/affine-ext-loader@0.34.2
- @labre/affine-gfx-connector@0.34.2
- @labre/affine-gfx-ddd-shared@0.34.2
- @labre/affine-gfx-pointer@0.34.2
- @labre/affine-gfx-shape@0.34.2
- @labre/affine-gfx-text@0.34.2
- @labre/affine-model@0.34.2
- @labre/affine-shared@0.34.2
- @labre/affine-widget-edgeless-toolbar@0.34.2
- @labre/global@0.34.2
- @labre/std@0.34.2

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
  - @labre/affine-gfx-connector@0.34.1
  - @labre/affine-gfx-ddd-shared@0.34.1
  - @labre/affine-gfx-pointer@0.34.1
  - @labre/affine-gfx-shape@0.34.1
  - @labre/affine-gfx-text@0.34.1
  - @labre/affine-shared@0.34.1
  - @labre/affine-widget-edgeless-toolbar@0.34.1
  - @labre/affine-ext-loader@0.34.1
  - @labre/global@0.34.1

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
- Updated dependencies [5f76ab3]
- Updated dependencies [f09d68c]
  - @labre/std@0.34.0
  - @labre/affine-shared@0.34.0
  - @labre/affine-block-surface@0.34.0
  - @labre/affine-widget-edgeless-toolbar@0.34.0
  - @labre/affine-gfx-connector@0.34.0
  - @labre/affine-gfx-ddd-shared@0.34.0
  - @labre/affine-gfx-pointer@0.34.0
  - @labre/affine-gfx-shape@0.34.0
  - @labre/affine-gfx-text@0.34.0
  - @labre/affine-model@0.34.0
  - @labre/affine-ext-loader@0.34.0
  - @labre/global@0.34.0

## 0.33.0

### Patch Changes

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

- d892d97: c4 boundaries know their level, and the zoom rules hold

  C4's four levels are ZOOMS of one element — a software system is made up of
  containers, each of which contains components — and until now the canvas could
  not say so. A boundary was one undifferentiated frame, so "inside a boundary"
  was the only fact a rule could read, and the mistakes that matter most on a C4
  diagram are precisely the ones where the frame is at the wrong zoom.

  A boundary now carries its level as its role: `c4:system-boundary` and
  `c4:container-boundary`, both filed under the `c4:boundary` that already
  existed. The tool writes the role and the variant together at the single place
  that creates a boundary, so what the corner says and what the rules read can
  never disagree. Everything written on the parent role — the two membership
  rules, the automatic legend's "Boundary" row, the mermaid export — reaches both
  children with nothing restated, and a boundary drawn before today keeps the
  parent role and behaves exactly as it always did.

  Three rules follow, and they cite C4's own abstractions rather than the review
  checklist, because what they indict is a statement of the model itself:

  - **a software system drawn inside a boundary** — the boundary already IS a
    system or a container, so the box is a mistyped container or a zoom that never
    happened;
  - **a container drawn inside a container boundary** — that boundary is that
    container, drawn inside itself; only components belong in there;
  - **a component no container boundary claims** — a component is part of a
    container, so a sheet that frames it with a system boundary alone has skipped
    the level between them.

  All three are remarks on the Sketch level and warnings once the board is set to
  Review checklist, which now promotes nine of the fourteen rules. None of them
  has a second reading under which the drawing meant it.

  Nothing new is said about a diagram drawn before this change: the third rule is
  framed on the container boundary, and a document whose boundaries never declared
  a level has no such frame, so it gains no finding it did not already have.

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

- f2aba60: C4 diagrams are checked against the official review checklist

  Eleven validation rules and two levels of requirement land on the C4 pack, read
  off Simon Brown's own diagram review checklist (c4model.com): every element is
  named, every relationship carries a label, every arrow is one the model can state
  in one direction, and every element earns its place on the sheet.

  Six of the eleven restate a question from the checklist. The other five say so in
  their own words rather than implying C4 requires them — a relationship looping
  onto its own element, a plain connector the model never recorded, a component
  outside every boundary, a data store that calls somebody, a person drawn inside a
  boundary. Which rules are the notation speaking and which are the editor's house
  style is readable rule by rule, and the two never share one id.

  The default level is **Sketch** and it argues with nothing — every finding is
  collected for the check-up panel and the canvas stays silent, because a C4
  diagram is drawn boxes-first, arrows-next, words-last and a tool that brackets an
  empty box the moment it appears is a tool switched off within the hour. Choosing
  **Review checklist** on a board promotes six rules to warnings and leaves five as
  remarks — the three isolation nudges, which report unfinished work rather than a
  mistake, and the two house idioms a diagram might honestly have meant.

  The board is where the level is chosen, and the only place: a boundary inherits
  its board's choice, so the two rules anchored on a boundary harden with the rest
  without a second picker to keep in step.

  Naming is one rule for all nine artefacts, because an element's name is now the
  `c4:title` text of its group. It reports a title an author has **emptied** — never
  a freshly dropped node, whose title already carries its kind's own label.

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

- 04ac693: every C4 rule declares its provenance, and none of them claims a standard

  The eleven C4 rules join the frameworks annotated in the provenance work: each
  now says where its authority comes from, so the violation bubble can print a
  citation the reader can weigh instead of leaving them to guess whether the tool
  is quoting the method or the house.

  The split is six `recommendation` and five `labre-convention`, and **`standard`
  appears nowhere**. That is the distinguishing fact about this pack rather than an
  omission: C4 has no published specification to cite a clause of. What it has is
  Simon Brown's diagram review checklist, which is a recommendation however widely
  it is followed — so the six rules that read it name the method, the way the
  Wardley and Context Mapping packs name theirs.

  The five that are the editor's own say so in the citation itself: a plain
  connector the model never recorded, a relationship looping onto its own element,
  a component outside every boundary, a data store that calls somebody, a person
  drawn inside a boundary. Three of those five are still promoted to warnings by
  the Review checklist profile, which is the point worth keeping: where a rule's
  authority comes from and how hard it bites are separate questions, and what
  decides the second is whether the diagram might honestly have meant it.

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
- Updated dependencies [cbd9471]
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
- Updated dependencies [7ec4478]
- Updated dependencies [a9eb4f6]
- Updated dependencies [e42e0c0]
- Updated dependencies [256ee0b]
- Updated dependencies [4a3b26e]
- Updated dependencies [48c3b52]
- Updated dependencies [6a20738]
- Updated dependencies [f09f9a3]
  - @labre/affine-block-surface@0.33.0
  - @labre/affine-shared@0.33.0
  - @labre/affine-model@0.33.0
  - @labre/std@0.33.0
  - @labre/affine-gfx-ddd-shared@0.33.0
  - @labre/affine-gfx-connector@0.33.0
  - @labre/affine-widget-edgeless-toolbar@0.33.0
  - @labre/affine-gfx-pointer@0.33.0
  - @labre/affine-gfx-shape@0.33.0
  - @labre/affine-gfx-text@0.33.0
  - @labre/affine-ext-loader@0.33.0
  - @labre/global@0.33.0
